import {
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateInventoryUsageDto {
  @Type(() => Number)
  @IsNumber({}, { message: 'Số lượng sử dụng phải là số hợp lệ' })
  @Min(0.01, { message: 'Số lượng sử dụng phải lớn hơn hoặc bằng 0.01' })
  quantityUsed: number;

  @IsOptional()
  @IsDateString({}, { message: 'Ngày sử dụng không đúng định dạng ngày tháng' })
  usageDate?: string;

  @IsOptional()
  @IsString({ message: 'Ghi chú phải là chuỗi văn bản' })
  notes?: string;

  @IsOptional()
  @IsString({ message: 'ID ao nuôi phải là chuỗi văn bản' })
  pondId?: string;
}
