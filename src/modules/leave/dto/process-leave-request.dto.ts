import {
  IsEnum,
  IsNotEmpty,
  IsString,
  Matches,
  ValidateIf,
} from 'class-validator';
import { LeaveStatus } from '@prisma/client';

export class ProcessLeaveRequestDto {
  @IsNotEmpty()
  @IsEnum(LeaveStatus, {
    message: 'status must be PENDING, APPROVED, or REJECTED',
  })
  status!: LeaveStatus;

  @ValidateIf((o) => o.status === LeaveStatus.REJECTED)
  @IsNotEmpty({ message: 'rejectReason is required when status is REJECTED' })
  @IsString()
  @Matches(/\S/, {
    message: 'rejectReason must not be empty or whitespace only',
  })
  rejectReason?: string;
}
