import { ConflictException, Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';

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
        name: dto.email, 
        creatorId: adminId,
      },
    });

    const { password: _, ...result } = user;
    return result;
  }
}
