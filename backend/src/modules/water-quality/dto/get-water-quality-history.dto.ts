import {
  IsOptional,
  IsUUID,
  IsDateString,
  IsString,
  IsIn,
  IsInt,
} from 'class-validator';
import { Type } from 'class-transformer';

export class GetWaterQualityHistoryDto {
  @IsOptional()
  @IsString({ message: 'farmId phải là chuỗi hợp lệ' })
  farmId?: string;

  @IsOptional()
  @IsString({ message: 'pondId phải là chuỗi hợp lệ' })
  pondId?: string;

  @IsOptional()
  @IsString({ message: 'cropId phải là chuỗi hợp lệ' })
  cropId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'year phải là số nguyên' })
  year?: number;

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
