import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class GetIncidentsDto {
  @IsOptional()
  @IsString()
  farmId?: string;

  @IsOptional()
  @IsString()
  pondId?: string;

  @IsOptional()
  @IsString()
  cropId?: string;

  @IsOptional()
  @IsIn(['OPEN', 'TREATING', 'RESOLVED'])
  status?: string;

  @IsOptional()
  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  assignedToMe?: boolean;

  @IsOptional()
  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  activeOnly?: boolean;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  size?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  year?: number;

  @IsOptional()
  @IsString()
  fromDate?: string;

  @IsOptional()
  @IsString()
  toDate?: string;
}
