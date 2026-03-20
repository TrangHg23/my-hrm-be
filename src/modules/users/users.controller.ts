import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../../global/guards/roles.guard';
import { Roles } from '../../global/decorators/roles.decorator';
import { UsersService } from './users.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';

@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Post('employees')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  createEmployee(@Req() req: Request, @Body() dto: CreateEmployeeDto) {
    const adminId = (req as any).user.id;
    return this.usersService.createEmployee(adminId, dto);
  }
}
