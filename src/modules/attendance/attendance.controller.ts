import { Controller, Post, Get, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../../global/guards/roles.guard';
import { Roles } from '../../global/decorators/roles.decorator';
import { AttendanceService } from './attendance.service';
import { AttendanceQueryDto } from './dto/attendance-query.dto';
import { MyAttendanceQueryDto } from './dto/my-attendance-query.dto';

@Controller('attendance')
@UseGuards(JwtAuthGuard)
export class AttendanceController {
  constructor(private attendanceService: AttendanceService) {}

  /**
   * Employee: Check-in to start a work session
   * POST /attendance/checkin
   */
  @Post('checkin')
  @UseGuards(RolesGuard)
  @Roles(Role.EMPLOYEE)
  checkIn(@Req() req: Request) {
    const userId = (req as any).user.id;
    return this.attendanceService.checkIn(userId);
  }

  /**
   * Employee: Check-out to end the current work session (min 30 min since checkin)
   * POST /attendance/checkout
   */
  @Post('checkout')
  @UseGuards(RolesGuard)
  @Roles(Role.EMPLOYEE)
  checkOut(@Req() req: Request) {
    const userId = (req as any).user.id;
    return this.attendanceService.checkOut(userId);
  }

  /**
   * Employee: Unified punch — auto-detects check-in or check-out based on current state
   * This is what the UI button should call.
   * POST /attendance/punch
   */
  @Post('punch')
  @UseGuards(RolesGuard)
  @Roles(Role.EMPLOYEE)
  punch(@Req() req: Request) {
    const userId = (req as any).user.id;
    return this.attendanceService.punch(userId);
  }

  /**
   * Admin: Get today's attendance report for all employees
   * GET /attendance/today
   */
  @Get('today')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  getTodayAttendance(@Query() query: AttendanceQueryDto) {
    return this.attendanceService.getTodayAttendance(query);
  }

  /**
   * Employee/Admin: Get own attendance for a given month/year (full list, no pagination)
   * GET /attendance/me?month=3&year=2026
   */
  @Get('me')
  getMyAttendance(@Req() req: Request, @Query() query: MyAttendanceQueryDto) {
    const userId = (req as any).user.id;
    return this.attendanceService.getMyAttendance(userId, query);
  }

  /**
   * Admin: Get all employees' attendance, paginated, filterable by userId / date
   * GET /attendance?page=1&limit=20&userId=xxx&date=2026-03-21
   */
  @Get()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  getAllAttendance(@Query() query: AttendanceQueryDto) {
    return this.attendanceService.getAllAttendance(query);
  }
}
