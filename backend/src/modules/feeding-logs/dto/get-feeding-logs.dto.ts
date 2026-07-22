import { IsOptional, IsString, IsUUID, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class GetFeedingLogsQueryDto {
  @IsUUID()
  @IsOptional()
  farmId?: string;

  @IsUUID()
  @IsOptional()
  pondId?: string;

  @IsUUID()
  @IsOptional()
  cropId?: string;

  @IsString()
  @IsOptional()
  search?: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @IsOptional()
  page?: number = 0;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  size?: number = 10;
}
