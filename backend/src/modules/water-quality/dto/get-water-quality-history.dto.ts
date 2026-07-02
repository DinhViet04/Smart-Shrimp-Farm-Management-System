import { IsOptional, IsUUID, IsDateString, IsString, IsIn } from 'class-validator';
import { Type } from 'class-transformer';

export class GetWaterQualityHistoryDto {
  @IsOptional()
  @IsUUID('4', { message: 'farmId phải là UUID hợp lệ' })
  farmId?: string;

  @IsOptional()
  @IsUUID('4', { message: 'pondId phải là UUID hợp lệ' })
  pondId?: string;

  @IsOptional()
  @IsDateString({}, { message: 'fromDate phải là định dạng ngày hợp lệ' })
  fromDate?: string;

  @IsOptional()
  @IsDateString({}, { message: 'toDate phải là định dạng ngày hợp lệ' })
  toDate?: string;

  @IsOptional()
  @Type(() => Number)
  page?: number = 0;

  @IsOptional()
  @Type(() => Number)
  size?: number = 10;

  @IsOptional()
  @IsString()
  @IsIn(['asc', 'desc'], { message: 'sort chỉ nhận giá trị asc hoặc desc' })
  sort?: string = 'desc';
}
