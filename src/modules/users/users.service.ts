import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { PaginationQueryDto } from './dto/pagination-query.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async createEmployee(adminId: string, dto: CreateEmployeeDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existing) {
      throw new ConflictException('Email already exists');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        password: hashedPassword,
        role: 'EMPLOYEE',
        name: dto.name,
        phone: dto.phone,
        creatorId: adminId,
      },
    });

    const { password: _, ...result } = user;
    return result;
  }

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      omit: { password: true },
    });

    if (!user) throw new NotFoundException('User not found');

    return user;
  }

  async updateMe(userId: string, dto: UpdateProfileDto) {
    const { password, ...rest } = dto;

    const data: Record<string, any> = { ...rest };

    if (password) {
      data.password = await bcrypt.hash(password, 10);
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data,
      omit: { password: true },
    });

    return updated;
  }

  async getEmployees(query: PaginationQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;

    const [data, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where: { role: 'EMPLOYEE' },
        omit: { password: true },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.user.count({ where: { role: 'EMPLOYEE' } }),
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

  async getEmployeeById(employeeId: string) {
    const employee = await this.prisma.user.findUnique({
      where: { id: employeeId, role: 'EMPLOYEE' },
      omit: { password: true },
    });

    if (!employee) throw new NotFoundException('Employee not found');

    return employee;
  }

  async updateEmployee(
    employeeId: string,
    dto: import('./dto/update-employee.dto').UpdateEmployeeDto,
  ) {
    const dtoAny = dto as any;
    const { password, ...rest } = dtoAny;
    const data: Record<string, any> = { ...rest };

    if (password) {
      data.password = await bcrypt.hash(password, 10);
    }

    if (dtoAny.email) {
      const existing = await this.prisma.user.findUnique({
        where: { email: dtoAny.email },
      });
      if (existing && existing.id !== employeeId) {
        throw new ConflictException('Email already exists');
      }
    }

    try {
      const updated = await this.prisma.user.update({
        where: { id: employeeId, role: 'EMPLOYEE' },
        data,
        omit: { password: true },
      });
      return updated;
    } catch (e) {
      throw new NotFoundException('Employee not found');
    }
  }
}
