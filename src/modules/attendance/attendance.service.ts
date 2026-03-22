import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { AttendanceQueryDto } from './dto/attendance-query.dto';
import { MyAttendanceQueryDto } from './dto/my-attendance-query.dto';
import { AttendanceStatus } from '@prisma/client';

@Injectable()
export class AttendanceService {
  constructor(private prisma: PrismaService) {}

  // ─── Employee: Check-in ────────────────────────────────────────────────────

  async checkIn(userId: string) {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

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
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

    const attendance = await this.prisma.attendance.findFirst({
      where: {
        userId,
        date: { gte: todayStart, lt: todayEnd },
      },
      include: { sessions: { orderBy: { checkinTime: 'desc' } } },
    });

    if (!attendance) {
      throw new NotFoundException('Không tìm thấy bản ghi chấm công hôm nay. Vui lòng check-in trước.');
    }

    const openSession = attendance.sessions.find((s) => !s.checkoutTime);

    if (!openSession) {
      throw new BadRequestException('Không có ca làm việc nào đang mở. Vui lòng check-in trước.');
    }

    // Validate min 30 minutes
    const minutesDiff = (now.getTime() - openSession.checkinTime.getTime()) / 60000;
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
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

    const attendance = await this.prisma.attendance.findFirst({
      where: { userId, date: { gte: todayStart, lt: todayEnd } },
      include: { sessions: { orderBy: { checkinTime: 'desc' } } },
    });

    const openSession = attendance?.sessions.find((s) => !s.checkoutTime);

    // ── If there is an open session → this is a CHECK-OUT ──
    if (openSession) {
      const minutesDiff = (now.getTime() - openSession.checkinTime.getTime()) / 60000;
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
        return sum + (s.checkoutTime.getTime() - s.checkinTime.getTime()) / 60000;
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
    const todayStr = new Date().toISOString().split('T')[0];
    return this.getAllAttendance({ ...query, date: todayStr });
  }

  // ─── Employee: Get my attendance by month ─────────────────────────────────

  async getMyAttendance(userId: string, query: MyAttendanceQueryDto) {
    const now = new Date();
    const month = query.month ?? now.getMonth() + 1;
    const year = query.year ?? now.getFullYear();

    const from = new Date(year, month - 1, 1);          // First day of month
    const to   = new Date(year, month, 1);               // First day of next month

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
      const start = new Date(query.date);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
      where.date = { gte: start, lt: end };
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

  private formatTime(date: Date): string {
    return date.toLocaleTimeString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  }
}
