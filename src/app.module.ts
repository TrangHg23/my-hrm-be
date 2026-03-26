import { Module } from '@nestjs/common';
import { AuthModule } from 'src/modules/auth/auth.module';
import { UsersModule } from 'src/modules/users/users.module';
import { AttendanceModule } from 'src/modules/attendance/attendance.module';
import { PrismaModule } from '../prisma/prisma.module';
import { LeaveModule } from './modules/leave/leave.module';

@Module({
  imports: [PrismaModule, AuthModule, UsersModule, AttendanceModule, LeaveModule],
})
export class AppModule {}
