import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';
import { Role } from '@prisma/client';

export class CreateAdminDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(6)
  password!: string;

  @IsNotEmpty()
  role!: Role; // Always ADMIN, but kept in DTO per user request
}
