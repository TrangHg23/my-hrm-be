import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Query,
  Param,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../../global/guards/roles.guard';
import { Roles } from '../../global/decorators/roles.decorator';
import { LeaveService } from './leave.service';
import { CreateLeaveRequestDto } from './dto/create-leave-request.dto';
import { LeaveQueryDto } from './dto/leave-query.dto';
import { ProcessLeaveRequestDto } from './dto/process-leave-request.dto';

@Controller('leave')
@UseGuards(JwtAuthGuard)
export class LeaveController {
  constructor(private leaveService: LeaveService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.EMPLOYEE)
  create(@Req() req: Request, @Body() dto: CreateLeaveRequestDto) {
    const userId = (req as any).user.id;
    return this.leaveService.createLeaveRequest(userId, dto);
  }

  @Get('me')
  getMyLeaves(@Req() req: Request, @Query() query: LeaveQueryDto) {
    const userId = (req as any).user.id;
    return this.leaveService.getMyLeaveRequests(userId, query);
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  getAll(@Query() query: LeaveQueryDto) {
    return this.leaveService.getLeaveRequests(query);
  }

  @Get('pending-count')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  getPendingCount() {
    return this.leaveService.getPendingCount();
  }

  @Patch(':id/process')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  process(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: ProcessLeaveRequestDto,
  ) {
    const adminId = (req as any).user.id;
    return this.leaveService.processLeaveRequest(adminId, id, dto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.EMPLOYEE)
  cancel(@Req() req: Request, @Param('id') id: string) {
    const userId = (req as any).user.id;
    return this.leaveService.cancelLeaveRequest(userId, id);
  }
}
