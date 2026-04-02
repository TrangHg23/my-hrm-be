import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { User, Role, Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { CreateAdminDto } from './dto/create-admin.dto';
import { SearchEmployeeDto } from './dto/search-employee.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async createUser(adminId: string, dto: CreateAdminDto | CreateEmployeeDto) {
    const { email, password, role } = dto;

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.user.findUnique({
        where: { email },
      });

      if (existing) {
        throw new ConflictException('Email already exists');
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      
      let userData: Prisma.UserCreateInput = {
        email,
        password: hashedPassword,
        role,
        name: (dto as CreateEmployeeDto).name || 'Admin',
        phone: (dto as CreateEmployeeDto).phone,
        creator: { connect: { id: adminId } },
      };

      if (role === Role.ADMIN) {
        userData.status = null;
        userData.empCode = null;
      } else {
        userData.status = (dto as CreateEmployeeDto).status || 'PROBATION';
        userData.empCode = await this.generateEmpCode(tx, new Date());
      }

      const user = await tx.user.create({
        data: userData,
      });

      return this.sanitizeUserResponse(user);
    });
  }

  // Backward compatibility or internal use
  async createEmployee(adminId: string, dto: CreateEmployeeDto) {
    return this.createUser(adminId, { ...dto, role: Role.EMPLOYEE });
  }

  sanitizeUserResponse<T extends Partial<User>>(user: T): T | Omit<T, 'status' | 'empCode'> {
    if (!user) return user;
    
    const { password, ...result } = user;
    
    if (user.role === Role.ADMIN) {
      const { status, empCode, ...adminResult } = result as any;
      return adminResult;
    }
    
    return result as T;
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
    });

    if (!user) throw new NotFoundException('User not found');

    return this.sanitizeUserResponse(user);
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
    });

    return this.sanitizeUserResponse(updated);
  }

  async getEmployees(query: SearchEmployeeDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const q = query.q;
    const skip = (page - 1) * limit;

    const where: any = {
      role: 'EMPLOYEE',
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: 'insensitive' } },
              { email: { contains: q, mode: 'insensitive' } },
              { empCode: { contains: q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data: data.map((u) => this.sanitizeUserResponse(u)),
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
      where: { id: employeeId, role: Role.EMPLOYEE },
    });

    if (!employee) throw new NotFoundException('Employee not found');

    return this.sanitizeUserResponse(employee);
  }

  async updateEmployee(
    employeeId: string,
    dto: import('./dto/update-employee.dto').UpdateEmployeeDto,
  ) {
    const currentEmployee = await this.prisma.user.findUnique({
      where: { id: employeeId, role: 'EMPLOYEE' },
    });

    if (!currentEmployee) {
      throw new NotFoundException('Employee not found');
    }

    if (currentEmployee.status === 'RESIGNED') {
      throw new BadRequestException(
        'Cannot update an employee who has already resigned.',
      );
    }

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

    if (data.status === 'RESIGNED') {
      data.isActive = false;
    } else if (data.isActive === true) {
      const targetStatus = data.status || currentEmployee.status;
      if (targetStatus === 'RESIGNED') {
        throw new BadRequestException(
          'Cannot reactivate an account of an employee who has resigned.',
        );
      }
    }

    try {
      const updated = await this.prisma.user.update({
        where: { id: employeeId, role: Role.EMPLOYEE },
        data,
      });
      return this.sanitizeUserResponse(updated);
    } catch (e) {
      throw new NotFoundException('Employee not found');
    }
  }

  async toggleEmployeeActive(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) throw new NotFoundException('Employee not found');

    if (user.role === 'ADMIN') {
      throw new ForbiddenException('Admin accounts cannot be deactivated.');
    }

    if (user.status === 'RESIGNED') {
      throw new BadRequestException(
        'Cannot reactivate an account of an employee who has resigned.',
      );
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: { isActive: !user.isActive },
    });

    return this.sanitizeUserResponse(updated);
  }
}
