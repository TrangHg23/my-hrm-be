import { Body, Controller, Get, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../../global/guards/roles.guard';
import { Roles } from '../../global/decorators/roles.decorator';
import { UsersService } from './users.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { PaginationQueryDto } from './dto/pagination-query.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  getMe(@Req() req: Request) {
    const userId = (req as any).user.id;
    return this.usersService.getMe(userId);
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  updateMe(@Req() req: Request, @Body() dto: UpdateProfileDto) {
    const userId = (req as any).user.id;
    return this.usersService.updateMe(userId, dto);
  }

  @Post('employees')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  createEmployee(@Req() req: Request, @Body() dto: CreateEmployeeDto) {
    const adminId = (req as any).user.id;
    return this.usersService.createEmployee(adminId, dto);
  }

  @Get('employees')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  getEmployees(@Query() query: PaginationQueryDto) {
    return this.usersService.getEmployees(query);
  }
}
