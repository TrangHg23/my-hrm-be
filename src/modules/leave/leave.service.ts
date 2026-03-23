import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateLeaveRequestDto } from './dto/create-leave-request.dto';
import { LeaveQueryDto } from './dto/leave-query.dto';
import { ProcessLeaveRequestDto } from './dto/process-leave-request.dto';
import { LeaveStatus } from '@prisma/client';
import {
  nowVN,
  parseDateVN,
  formatDateVN,
  formatTimeToHHmm,
} from '../../global/utils/date.util';

@Injectable()
export class LeaveService {
  constructor(private prisma: PrismaService) {}

  /**
   * Refined Leave Request Creation
   * Hardened with critical runtime validations for defense-in-depth.
   */
  async createLeaveRequest(userId: string, dto: CreateLeaveRequestDto) {
    const { fromDate, toDate, isFullDay, startTime, endTime, reason } = dto;

    const fromDateObj = parseDateVN(fromDate);
    const toDateObj = parseDateVN(toDate);

    // 1. Critical Runtime Validation (Hardening)
    if (toDateObj < fromDateObj) {
      throw new BadRequestException({
        error: 'INVALID_RANGE',
        message: 'toDate cannot be before fromDate',
      });
    }

    if (!isFullDay) {
      if (fromDate !== toDate) {
        throw new BadRequestException({
          error: 'INVALID_CONSTRAINTS',
          message: 'For partial-day leave, fromDate and toDate must be the same',
        });
      }
      if (!startTime || !endTime) {
        throw new BadRequestException({
          error: 'MISSING_TIME',
          message: 'startTime and endTime are required for partial-day leave',
        });
      }
      if (this.normalizeTime(endTime) <= this.normalizeTime(startTime)) {
        throw new BadRequestException({
          error: 'INVALID_TIME_RANGE',
          message: 'endTime must be after startTime',
        });
      }
    }

    // 2. Overlap Check (Hardened)
    const existingRequests = await this.prisma.leaveRequest.findMany({
      where: {
        userId,
        status: { in: [LeaveStatus.PENDING, LeaveStatus.APPROVED] },
        deletedAt: null,
        OR: [
          {
            fromDate: { lte: toDateObj },
            toDate: { gte: fromDateObj },
          },
        ],
      },
    });

    for (const existing of existingRequests) {
      if (this.isOverlapping(dto, existing)) {
        throw new BadRequestException({
          error: 'LEAVE_OVERLAP',
          message: 'Leave request overlaps with existing request',
        });
      }
    }

    // 3. Create Request
    return this.prisma.leaveRequest.create({
      data: {
        userId,
        fromDate: fromDateObj,
        toDate: toDateObj,
        isFullDay,
        startTime: startTime ? this.parseTimeToDate(startTime) : null,
        endTime: endTime ? this.parseTimeToDate(endTime) : null,
        reason,
        status: LeaveStatus.PENDING,
      },
    });
  }

  async getMyLeaveRequests(userId: string, query: LeaveQueryDto) {
    return this.getLeaveRequests({ ...query, userId });
  }

  /**
   * Refined Date Range Query Filtering
   * Formula: (record.toDate >= fromDate) AND (record.fromDate <= toDate)
   */
  async getLeaveRequests(query: LeaveQueryDto) {
    const { status, userId, fromDate, toDate, page = 1, limit = 10 } = query;

    const safeLimit = Math.min(limit, 50);
    const skip = (page - 1) * safeLimit;

    const where: any = { deletedAt: null };

    if (status) where.status = status;
    if (userId) where.userId = userId;

    if (fromDate || toDate) {
      if (fromDate) where.toDate = { gte: parseDateVN(fromDate) };
      if (toDate) where.fromDate = { lte: parseDateVN(toDate) };
    }

    const [data, total] = await this.prisma.$transaction([
      this.prisma.leaveRequest.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, email: true } },
          processedBy: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: safeLimit,
      }),
      this.prisma.leaveRequest.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit: safeLimit,
        totalPages: Math.ceil(total / safeLimit),
      },
    };
  }

  async getPendingCount() {
    const count = await this.prisma.leaveRequest.count({
      where: { status: LeaveStatus.PENDING, deletedAt: null },
    });
    return { count };
  }

  /**
   * Refined Processing Logic
   * Atomic update with status filter ensures safety.
   */
  async processLeaveRequest(
    adminId: string,
    id: string,
    dto: ProcessLeaveRequestDto,
  ) {
    const request = await this.prisma.leaveRequest.findUnique({
      where: { id },
    });

    if (!request) {
      throw new NotFoundException({
        error: 'NOT_FOUND',
        message: 'Leave request not found',
      });
    }

    // 1. Self-Approval Prevention
    if (request.userId === adminId) {
      throw new ForbiddenException({
        error: 'SELF_APPROVAL_FORBIDDEN',
        message: 'Admin cannot approve/reject their own request',
      });
    }

    // 2. Atomic Update (Status Safety)
    const result = await this.prisma.leaveRequest.updateMany({
      where: { id, status: LeaveStatus.PENDING },
      data: {
        status: dto.status,
        rejectReason: dto.rejectReason || null,
        processedById: adminId,
        processedAt: nowVN(),
      } as any,
    });

    if (result.count === 0) {
      throw new BadRequestException({
        error: 'ALREADY_PROCESSED',
        message: 'Leave request has already been processed or does not exist',
      });
    }

    return this.prisma.leaveRequest.findUnique({
      where: { id },
      include: { processedBy: { select: { id: true, name: true } } },
    });
  }

  async cancelLeaveRequest(userId: string, id: string) {
    const request = await this.prisma.leaveRequest.findUnique({
      where: { id },
    });

    if (!request) {
      throw new NotFoundException({
        error: 'NOT_FOUND',
        message: 'Leave request not found',
      });
    }

    // 1. Ownership Validation
    if (request.userId !== userId) {
      throw new ForbiddenException({
        error: 'OWNERSHIP_REQUIRED',
        message: 'You can only cancel your own leave requests',
      });
    }

    // 2. Status Restriction
    if (request.status !== LeaveStatus.PENDING) {
      throw new BadRequestException({
        error: 'NOT_PENDING',
        message: 'Only pending leave requests can be cancelled',
      });
    }

    return this.prisma.leaveRequest.update({
      where: { id },
      data: { deletedAt: nowVN() },
    });
  }

  // --- Helpers ---

  /**
   * Refined Overlap Check
   * Strictly uses date.util.ts.
   */
  private isOverlapping(dto: CreateLeaveRequestDto, existing: any): boolean {
    const reqFrom = parseDateVN(dto.fromDate);
    const reqTo = parseDateVN(dto.toDate);
    const exFrom = existing.fromDate;
    const exTo = existing.toDate;

    // Dates intersect?
    const dateOverlap = reqFrom <= exTo && reqTo >= exFrom;
    if (!dateOverlap) return false;

    // Case 1: Either is full-day
    if (dto.isFullDay || existing.isFullDay) return true;

    // Case 2: Both are partial-day (check time on same date)
    const reqFromStr = dto.fromDate;
    const exFromStr = formatDateVN(existing.fromDate);

    if (reqFromStr === exFromStr) {
      const startA = this.normalizeTime(dto.startTime!);
      const endA = this.normalizeTime(dto.endTime!);

      const startB = this.normalizeTime(formatTimeToHHmm(existing.startTime));
      const endB = this.normalizeTime(formatTimeToHHmm(existing.endTime));

      // Overlap if max(start1, start2) < min(end1, end2)
      return startA < endB && endA > startB;
    }

    return false;
  }

  private normalizeTime(time: string): number {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
  }

  /**
   * Refined Time Parsing
   * Uses parseDateVN('1970-01-01') as safe base.
   */
  private parseTimeToDate(timeStr: string): Date {
    const [hours, minutes] = timeStr.split(':').map(Number);
    const date = parseDateVN('1970-01-01');
    date.setHours(hours, minutes, 0, 0);
    return date;
  }
}
