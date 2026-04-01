import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { SearchEmployeeDto } from './dto/search-employee.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async createEmployee(adminId: string, dto: CreateEmployeeDto) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.user.findUnique({
        where: { email: dto.email },
      });

      if (existing) {
        throw new ConflictException('Email already exists');
      }

      const hashedPassword = await bcrypt.hash(dto.password, 10);
      const empCode = await this.generateEmpCode(tx, new Date());

      const user = await tx.user.create({
        data: {
          email: dto.email,
          password: hashedPassword,
          role: 'EMPLOYEE',
          name: dto.name,
          phone: dto.phone,
          creatorId: adminId,
          empCode,
        },
      });

      const { password: _, ...result } = user;
      return result;
    });
  }

  private async generateEmpCode(
    tx: Prisma.TransactionClient,
    date: Date,
  ): Promise<string> {
    const yy = date.getFullYear().toString().slice(-2);
    const mm = (date.getMonth() + 1).toString().padStart(2, '0');
    const dd = date.getDate().toString().padStart(2, '0');
    const prefix = `NV${yy}${mm}${dd}`;

    const count = await tx.user.count({
      where: {
        empCode: {
          startsWith: prefix,
        },
      },
    });

    const xx = (count + 1).toString().padStart(2, '0');
    return `${prefix}${xx}`;
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

  async getEmployees(query: SearchEmployeeDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const q = query.q;
    const skip = (page - 1) * limit;

    const where: any = { role: 'EMPLOYEE' };

    if (q) {
      where.name = {
        contains: q,
        mode: 'insensitive',
      };
    }

    const [data, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        omit: { password: true },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.user.count({ where }),
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
    const { password, empCode, role, ...rest } = dto as any;
    const data: Record<string, any> = { ...rest };

    if (password) {
      data.password = await bcrypt.hash(password, 10);
    }

    if (rest.email) {
      const existing = await this.prisma.user.findUnique({
        where: { email: rest.email },
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
