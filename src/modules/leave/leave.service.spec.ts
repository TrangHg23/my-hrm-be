import { Test, TestingModule } from '@nestjs/testing';
import { LeaveService } from './leave.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { LeaveStatus } from '@prisma/client';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { parseDateVN } from '../../global/utils/date.util';

describe('LeaveService', () => {
  let service: LeaveService;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let prisma: PrismaService;

  const mockPrisma = {
    leaveRequest: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
      updateMany: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn((promises) => Promise.all(promises)),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LeaveService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<LeaveService>(LeaveService);
    prisma = module.get<PrismaService>(PrismaService);

    mockPrisma.leaveRequest.findMany.mockResolvedValue([]);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createLeaveRequest', () => {
    const userId = 'user-1';
    
    it('should create a valid full-day leave', async () => {
      const dto = {
        fromDate: '2026-04-01',
        toDate: '2026-04-02',
        isFullDay: true,
        reason: 'Holiday',
      };

      mockPrisma.leaveRequest.create.mockResolvedValue({ id: 'leave-1', ...dto });

      const result = await service.createLeaveRequest(userId, dto as any);

      expect(result).toBeDefined();
      expect(mockPrisma.leaveRequest.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          fromDate: parseDateVN(dto.fromDate),
          toDate: parseDateVN(dto.toDate),
          isFullDay: true,
        }),
      });
    });

    it('should create a valid partial-day leave', async () => {
      const dto = {
        fromDate: '2026-04-01',
        toDate: '2026-04-01',
        isFullDay: false,
        startTime: '09:00',
        endTime: '12:00',
      };

      mockPrisma.leaveRequest.create.mockResolvedValue({ id: 'leave-2', ...dto });

      await service.createLeaveRequest(userId, dto as any);

      expect(mockPrisma.leaveRequest.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          startTime: expect.any(Date),
          endTime: expect.any(Date),
        }),
      });
    });

    it('should fail if toDate < fromDate', async () => {
      const dto = {
        fromDate: '2026-04-02',
        toDate: '2026-04-01',
        isFullDay: true,
      };

      try {
        await service.createLeaveRequest(userId, dto as any);
        throw new Error('Should have thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(BadRequestException);
        expect((e as any).getResponse().error).toBe('INVALID_RANGE');
      }
    });

    it('should fail if partial-day has different dates', async () => {
      const dto = {
        fromDate: '2026-04-01',
        toDate: '2026-04-02',
        isFullDay: false,
        startTime: '09:00',
        endTime: '12:00',
      };

      try {
        await service.createLeaveRequest(userId, dto as any);
        throw new Error('Should have thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(BadRequestException);
        expect((e as any).getResponse().error).toBe('INVALID_CONSTRAINTS');
      }
    });
  });

  describe('Overlap Detection', () => {
    const userId = 'user-1';

    it('should detect full-day vs full-day overlap', async () => {
      const existing = {
        fromDate: parseDateVN('2026-04-01'),
        toDate: parseDateVN('2026-04-05'),
        isFullDay: true,
      };
      const dto = {
        fromDate: '2026-04-03',
        toDate: '2026-04-04',
        isFullDay: true,
      };

      mockPrisma.leaveRequest.findMany.mockResolvedValue([existing]);

      await expect(service.createLeaveRequest(userId, dto as any)).rejects.toThrow(
        new BadRequestException({
          error: 'LEAVE_OVERLAP',
          message: 'Leave request overlaps with existing request',
        }),
      );
    });

    it('should detect full-day vs partial-day overlap (same date)', async () => {
      const existing = {
        fromDate: parseDateVN('2026-04-01'),
        toDate: parseDateVN('2026-04-01'),
        isFullDay: true,
      };
      const dto = {
        fromDate: '2026-04-01',
        toDate: '2026-04-01',
        isFullDay: false,
        startTime: '09:00',
        endTime: '12:00',
      };

      mockPrisma.leaveRequest.findMany.mockResolvedValue([existing]);

      await expect(service.createLeaveRequest(userId, dto as any)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should detect partial-day vs partial-day overlap (overlapping time)', async () => {
      const existing = {
        fromDate: parseDateVN('2026-04-01'),
        toDate: parseDateVN('2026-04-01'),
        isFullDay: false,
        startTime: parseDateVN('1970-01-01'), 
        endTime: parseDateVN('1970-01-01'),
      };
      existing.startTime.setHours(10, 0);
      existing.endTime.setHours(14, 0);

      const dto = {
        fromDate: '2026-04-01',
        toDate: '2026-04-01',
        isFullDay: false,
        startTime: '13:00',
        endTime: '15:00',
      };

      mockPrisma.leaveRequest.findMany.mockResolvedValue([existing]);

      await expect(service.createLeaveRequest(userId, dto as any)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should pass partial-day vs partial-day (non-overlapping time)', async () => {
      const existing = {
        fromDate: parseDateVN('2026-04-01'),
        toDate: parseDateVN('2026-04-01'),
        isFullDay: false,
        startTime: parseDateVN('1970-01-01'),
        endTime: parseDateVN('1970-01-01'),
      };
      existing.startTime.setHours(9, 0);
      existing.endTime.setHours(11, 0);

      const dto = {
        fromDate: '2026-04-01',
        toDate: '2026-04-01',
        isFullDay: false,
        startTime: '13:00',
        endTime: '15:00',
      };

      mockPrisma.leaveRequest.findMany.mockResolvedValue([existing]);
      mockPrisma.leaveRequest.create.mockResolvedValue({});

      await expect(service.createLeaveRequest(userId, dto as any)).resolves.toBeDefined();
    });
  });

  describe('processLeaveRequest', () => {
    const adminId = 'admin-1';
    const leaveId = 'leave-1';

    it('should approve a request successfully', async () => {
      const request = { id: leaveId, userId: 'user-1', status: LeaveStatus.PENDING };
      const dto = { status: LeaveStatus.APPROVED };

      mockPrisma.leaveRequest.findUnique.mockResolvedValue(request);
      mockPrisma.leaveRequest.updateMany.mockResolvedValue({ count: 1 });

      await service.processLeaveRequest(adminId, leaveId, dto as any);

      expect(mockPrisma.leaveRequest.updateMany).toHaveBeenCalledWith({
        where: { id: leaveId, status: LeaveStatus.PENDING },
        data: expect.objectContaining({
          status: LeaveStatus.APPROVED,
          processedById: adminId,
          processedAt: expect.any(Date),
        }),
      });
    });

    it('should reject a request with reason successfully', async () => {
      const request = { id: leaveId, userId: 'user-1', status: LeaveStatus.PENDING };
      const dto = { status: LeaveStatus.REJECTED, rejectReason: 'Mismatch' };

      mockPrisma.leaveRequest.findUnique.mockResolvedValue(request);
      mockPrisma.leaveRequest.updateMany.mockResolvedValue({ count: 1 });

      await service.processLeaveRequest(adminId, leaveId, dto as any);

      expect(mockPrisma.leaveRequest.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: LeaveStatus.REJECTED,
            rejectReason: 'Mismatch',
          }),
        }),
      );
    });

    it('should fail if admin tries to process their own request', async () => {
      const request = { id: leaveId, userId: adminId, status: LeaveStatus.PENDING };
      const dto = { status: LeaveStatus.APPROVED };

      mockPrisma.leaveRequest.findUnique.mockResolvedValue(request);

      await expect(service.processLeaveRequest(adminId, leaveId, dto as any)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should fail if request is already processed', async () => {
      const request = { id: leaveId, userId: 'user-1', status: LeaveStatus.APPROVED };
      const dto = { status: LeaveStatus.REJECTED };

      mockPrisma.leaveRequest.findUnique.mockResolvedValue(request);
      mockPrisma.leaveRequest.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.processLeaveRequest(adminId, leaveId, dto as any)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('cancelLeaveRequest', () => {
    const userId = 'user-1';
    const leaveId = 'leave-1';

    it('should cancel a PENDING request', async () => {
      const request = { id: leaveId, userId, status: LeaveStatus.PENDING };
      mockPrisma.leaveRequest.findUnique.mockResolvedValue(request);
      mockPrisma.leaveRequest.update.mockResolvedValue({ ...request, deletedAt: new Date() });

      const result = await service.cancelLeaveRequest(userId, leaveId);
      expect(result).toBeDefined();
    });

    it('should fail to cancel an APPROVED request', async () => {
      const request = { id: leaveId, userId, status: LeaveStatus.APPROVED };
      mockPrisma.leaveRequest.findUnique.mockResolvedValue(request);

      await expect(service.cancelLeaveRequest(userId, leaveId)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should fail to cancel other user\'s request', async () => {
      const request = { id: leaveId, userId: 'other-user', status: LeaveStatus.PENDING };
      mockPrisma.leaveRequest.findUnique.mockResolvedValue(request);

      await expect(service.cancelLeaveRequest(userId, leaveId)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('getLeaveRequests Query Filtering', () => {
    it('should filter by range overlap', async () => {
      const query = {
        fromDate: '2026-04-01',
        toDate: '2026-04-10',
      };

      mockPrisma.leaveRequest.findMany.mockResolvedValue([]);
      mockPrisma.leaveRequest.count.mockResolvedValue(0);

      await service.getLeaveRequests(query as any);

      expect(mockPrisma.leaveRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            toDate: { gte: parseDateVN(query.fromDate) },
            fromDate: { lte: parseDateVN(query.toDate) },
          }),
        }),
      );
    });
  });
});
