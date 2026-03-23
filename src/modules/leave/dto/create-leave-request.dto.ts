import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  ValidateIf,
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';

/**
 * Cross-field validation
 */
@ValidatorConstraint({ name: 'leaveRequestValidation', async: false })
class LeaveRequestValidator implements ValidatorConstraintInterface {
  validate(_: any, args: ValidationArguments) {
    const o = args.object as any;

    // 1. fromDate <= toDate
    if (o.fromDate && o.toDate && o.fromDate > o.toDate) {
      return false;
    }

    // 2. fullDay must NOT have time
    if (o.isFullDay && (o.startTime || o.endTime)) {
      return false;
    }

    // 3. partial day rules
    if (!o.isFullDay) {
      if (o.fromDate !== o.toDate) return false;
      if (!o.startTime || !o.endTime) return false;
      if (o.startTime >= o.endTime) return false;
    }

    return true;
  }

  defaultMessage() {
    return 'Invalid leave request data';
  }
}

export class CreateLeaveRequestDto {
  @IsNotEmpty()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'fromDate must be YYYY-MM-DD',
  })
  fromDate!: string;

  @IsNotEmpty()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'toDate must be YYYY-MM-DD',
  })
  toDate!: string;

  @IsNotEmpty()
  @IsBoolean()
  isFullDay!: boolean;

  @ValidateIf((o) => !o.isFullDay)
  @IsNotEmpty({ message: 'startTime is required for partial day leave' })
  @Matches(/^\d{2}:\d{2}$/, {
    message: 'startTime must be HH:mm',
  })
  startTime?: string;

  @ValidateIf((o) => !o.isFullDay)
  @IsNotEmpty({ message: 'endTime is required for partial day leave' })
  @Matches(/^\d{2}:\d{2}$/, {
    message: 'endTime must be HH:mm',
  })
  endTime?: string;

  @IsOptional()
  @IsString()
  reason?: string;

  // attach cross-field validator
  @Validate(LeaveRequestValidator)
  _validation!: any;
}
