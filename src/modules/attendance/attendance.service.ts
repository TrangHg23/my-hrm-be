import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { AttendanceQueryDto } from './dto/attendance-query.dto';
import { MyAttendanceQueryDto } from './dto/my-attendance-query.dto';
import { AttendanceStatus } from '@prisma/client';
import { VIETNAM_TIMEZONE } from './attendance.constants';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

@Injectable()
export class AttendanceService {
  constructor(private prisma: PrismaService) {}

  // ─── Employee: Check-in ────────────────────────────────────────────────────

  async checkIn(userId: string) {
    const now = new Date();
    const { start: todayStart, end: todayEnd } = this.getVNTodayRange();

    // Find or create today's attendance record
    let attendance = await this.prisma.attendance.findFirst({
      where: {
        userId,
        date: { gte: todayStart, lt: todayEnd },
      },
      include: { sessions: { orderBy: { checkinTime: 'desc' } } },
    });

    // If open session exists, don't error - punch() will handle this case
    // checkIn is still available separately for explicit use

    if (!attendance) {
      attendance = await this.prisma.attendance.create({
        data: {
          userId,
          date: todayStart,
          status: AttendanceStatus.PRESENT,
        },
        include: { sessions: true },
      });
    }

    // Create new session
    const session = await this.prisma.attendanceSession.create({
      data: {
        attendanceId: attendance.id,
        checkinTime: now,
      },
    });

    return {
      message: `Check-in thành công lúc ${this.formatTime(now)}`,
      session,
    };
  }

  // ─── Employee: Check-out ───────────────────────────────────────────────────

  async checkOut(userId: string) {
    const now = new Date();
    const { start: todayStart, end: todayEnd } = this.getVNTodayRange();

    const attendance = await this.prisma.attendance.findFirst({
      where: {
        userId,
        date: { gte: todayStart, lt: todayEnd },
      },
      include: { sessions: { orderBy: { checkinTime: 'desc' } } },
    });

    if (!attendance) {
      throw new NotFoundException(
        'Không tìm thấy bản ghi chấm công hôm nay. Vui lòng check-in trước.',
      );
    }

    const openSession = attendance.sessions.find((s) => !s.checkoutTime);

    if (!openSession) {
      throw new BadRequestException(
        'Không có ca làm việc nào đang mở. Vui lòng check-in trước.',
      );
    }

    // Validate min 30 minutes
    const minutesDiff =
      (now.getTime() - openSession.checkinTime.getTime()) / 60000;
    if (minutesDiff < 30) {
      const remaining = Math.ceil(30 - minutesDiff);
      throw new BadRequestException(
        `Chưa đủ 30 phút kể từ lúc check-in. Còn ${remaining} phút nữa mới được checkout.`,
      );
    }

    // Update session with checkout time
    const updatedSession = await this.prisma.attendanceSession.update({
      where: { id: openSession.id },
      data: { checkoutTime: now },
    });

    // Recalculate totalHours for the day
    const allSessions = await this.prisma.attendanceSession.findMany({
      where: { attendanceId: attendance.id },
    });

    const totalMinutes = allSessions.reduce((sum, s) => {
      if (!s.checkoutTime) return sum;
      return sum + (s.checkoutTime.getTime() - s.checkinTime.getTime()) / 60000;
    }, 0);

    await this.prisma.attendance.update({
      where: { id: attendance.id },
      data: { totalHours: parseFloat((totalMinutes / 60).toFixed(2)) },
    });

    return {
      message: `Check-out thành công lúc ${this.formatTime(now)}`,
      session: updatedSession,
      totalHours: parseFloat((totalMinutes / 60).toFixed(2)),
    };
  }

  // ─── Employee: Unified punch (toggle check-in / check-out) ────────────────

  async punch(userId: string) {
    const now = new Date();
    const { start: todayStart, end: todayEnd } = this.getVNTodayRange();

    const attendance = await this.prisma.attendance.findFirst({
      where: { userId, date: { gte: todayStart, lt: todayEnd } },
      include: { sessions: { orderBy: { checkinTime: 'desc' } } },
    });

    const openSession = attendance?.sessions.find((s) => !s.checkoutTime);

    // ── If there is an open session → this is a CHECK-OUT ──
    if (openSession) {
      const minutesDiff =
        (now.getTime() - openSession.checkinTime.getTime()) / 60000;
      if (minutesDiff < 30) {
        const remaining = Math.ceil(30 - minutesDiff);
        throw new BadRequestException(
          `Chưa đủ 30 phút kể từ lúc check-in. Còn ${remaining} phút nữa mới được checkout.`,
        );
      }

      const updatedSession = await this.prisma.attendanceSession.update({
        where: { id: openSession.id },
        data: { checkoutTime: now },
      });

      const allSessions = await this.prisma.attendanceSession.findMany({
        where: { attendanceId: attendance!.id },
      });
      const totalMinutes = allSessions.reduce((sum, s) => {
        if (!s.checkoutTime) return sum;
        return (
          sum + (s.checkoutTime.getTime() - s.checkinTime.getTime()) / 60000
        );
      }, 0);
      await this.prisma.attendance.update({
        where: { id: attendance!.id },
        data: { totalHours: parseFloat((totalMinutes / 60).toFixed(2)) },
      });

      return {
        action: 'checkout',
        message: `Check-out thành công lúc ${this.formatTime(now)}`,
        session: updatedSession,
        totalHours: parseFloat((totalMinutes / 60).toFixed(2)),
      };
    }

    // ── No open session → this is a CHECK-IN ──
    let record = attendance;
    if (!record) {
      record = await this.prisma.attendance.create({
        data: { userId, date: todayStart, status: AttendanceStatus.PRESENT },
        include: { sessions: true },
      });
    }

    const session = await this.prisma.attendanceSession.create({
      data: { attendanceId: record.id, checkinTime: now },
    });

    return {
      action: 'checkin',
      message: `Check-in thành công lúc ${this.formatTime(now)}`,
      session,
    };
  }

  // ─── Admin: Get today's attendance report for all employees ───────────────

  async getTodayAttendance(query: AttendanceQueryDto) {
    const { vnDate } = this.getVNTodayRange();
    return this.getAllAttendance({ ...query, date: vnDate });
  }

  // ─── Employee: Get my attendance by month ─────────────────────────────────

  async getMyAttendance(userId: string, query: MyAttendanceQueryDto) {
    const now = new Date();
    const month = query.month ?? now.getMonth() + 1;
    const year = query.year ?? now.getFullYear();

    const from = new Date(year, month - 1, 1); // First day of month
    const to = new Date(year, month, 1); // First day of next month

    const records = await this.prisma.attendance.findMany({
      where: {
        userId,
        date: { gte: from, lt: to },
      },
      include: {
        sessions: { orderBy: { checkinTime: 'asc' } },
      },
      orderBy: { date: 'asc' },
    });

    return { month, year, total: records.length, data: records };
  }

  // ─── Admin: Get all attendance (paginated, filter by date/userId) ──────────

  async getAllAttendance(query: AttendanceQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Record<string, any> = {};

    if (query.userId) {
      where.userId = query.userId;
    }

    if (query.date) {
      const { start, end } = this.getVNDateRange(query.date);
      where.date = { gte: start, lte: end };
    }

    const [data, total] = await this.prisma.$transaction([
      this.prisma.attendance.findMany({
        where,
        include: {
          sessions: { orderBy: { checkinTime: 'asc' } },
          user: { select: { id: true, name: true, email: true } },
        },
        orderBy: { date: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.attendance.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  private formatTime(date: Date | null): string {
    if (!date) return '--:--';
    return dayjs(date).tz(VIETNAM_TIMEZONE).format('HH:mm');
  }

  private getVNDateRange(dateStr: string) {
    const start = dayjs.tz(dateStr, VIETNAM_TIMEZONE).startOf('day').toDate();
    const end = dayjs.tz(dateStr, VIETNAM_TIMEZONE).endOf('day').toDate();
    return { start, end };
  }

  private getVNStartOfDay(dateStr?: string): Date {
    const tz = VIETNAM_TIMEZONE;
    if (dateStr) {
      return dayjs.tz(dateStr, tz).startOf('day').toDate();
    }
    return dayjs.tz(dayjs(), tz).startOf('day').toDate();
  }

  private getVNTodayRange() {
    const start = this.getVNStartOfDay();
    const end = dayjs(start).add(1, 'day').toDate();
    const vnDate = dayjs(start).tz(VIETNAM_TIMEZONE).format('YYYY-MM-DD');

    return { start, end, vnDate };
  }
}
