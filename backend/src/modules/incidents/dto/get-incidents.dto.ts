import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

export class GetIncidentsDto {
  @IsOptional()
  @IsUUID('4')
  farmId?: string;

  @IsOptional()
  @IsUUID('4')
  pondId?: string;

  @IsOptional()
  @IsUUID('4')
  cropId?: string;

  @IsOptional()
  @IsIn(['OPEN', 'TREATING', 'RESOLVED'])
  status?: string;

  @IsOptional()
  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  assignedToMe?: boolean;

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
  @Max(100)
  size?: number;
}
