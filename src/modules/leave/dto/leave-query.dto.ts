import {
  IsEnum,
  IsInt,
  IsOptional,
  Matches,
  Max,
  Min,
  IsUUID,
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';
import { Type } from 'class-transformer';
import { LeaveStatus } from '@prisma/client';

/**
 * Cross-field validation for date range
 */
@ValidatorConstraint({ name: 'dateRangeValid', async: false })
class DateRangeValidator implements ValidatorConstraintInterface {
  validate(_: any, args: ValidationArguments) {
    const o = args.object as any;

    if (o.fromDate && o.toDate) {
      return o.fromDate <= o.toDate;
    }

    return true;
  }

  defaultMessage() {
    return 'fromDate must be less than or equal to toDate';
  }
}

export class LeaveQueryDto {
  @IsOptional()
  @IsEnum(LeaveStatus)
  status?: LeaveStatus;

  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'fromDate must be YYYY-MM-DD',
  })
  fromDate?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'toDate must be YYYY-MM-DD',
  })
  toDate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit: number = 10;

  // attach cross-field validation
  @Validate(DateRangeValidator)
  _dateRangeCheck!: any;
}
