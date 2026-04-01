import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../../global/guards/roles.guard';
import { Roles } from '../../global/decorators/roles.decorator';
import { UsersService } from './users.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { PaginationQueryDto } from './dto/pagination-query.dto';
import { SearchEmployeeDto } from './dto/search-employee.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';

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
  getEmployees(@Query() query: SearchEmployeeDto) {
    return this.usersService.getEmployees(query);
  }
  @Get('employees/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  getEmployeeById(@Param('id') id: string) {
    return this.usersService.getEmployeeById(id);
  }

  @Patch('employees/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  updateEmployee(@Param('id') id: string, @Body() dto: UpdateEmployeeDto) {
    return this.usersService.updateEmployee(id, dto);
  }
}
