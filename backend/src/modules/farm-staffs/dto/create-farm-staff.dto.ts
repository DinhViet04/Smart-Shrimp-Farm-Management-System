import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { Role } from '@prisma/client';

export class CreateFarmStaffDto {
  @IsString()
  @IsNotEmpty()
  farmId: string;

  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsEnum(Role)
  role: Role;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
