import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

export class GetManagerWaterTrendsDto {
  @IsOptional()
  @IsUUID('4', { message: 'farmId phải là UUID hợp lệ' })
  farmId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Số ngày phải là số nguyên' })
  @Min(1, { message: 'Số ngày tối thiểu là 1' })
  @Max(31, { message: 'Số ngày tối đa là 31' })
  days?: number = 7;
}
