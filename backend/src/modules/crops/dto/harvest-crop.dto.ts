import {
  IsNumber,
  IsOptional,
  IsString,
  IsDateString,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class HarvestCropDto {
  @Type(() => Number)
  @IsNumber({}, { message: 'Sản lượng thu hoạch phải là số hợp lệ' })
  @Min(0.01, { message: 'Sản lượng thu hoạch phải lớn hơn 0' })
  actualHarvestKg: number;

  @Type(() => Number)
  @IsNumber({}, { message: 'Kích cỡ tôm thu hoạch phải là số hợp lệ' })
  @Min(1, { message: 'Kích cỡ tôm thu hoạch phải lớn hơn 0 con/kg' })
  actualHarvestSize: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'Giá bán phải là số hợp lệ' })
  @Min(0, { message: 'Giá bán không được âm' })
  actualHarvestPricePerKg?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'Tổng số con tôm thu hoạch phải là số hợp lệ' })
  actualHarvestCount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'Doanh thu phải là số hợp lệ' })
  actualHarvestRevenue?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'Chi phí phải là số hợp lệ' })
  actualHarvestCost?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'Lợi nhuận phải là số hợp lệ' })
  actualHarvestProfit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'Hệ số FCR phải là số hợp lệ' })
  actualHarvestFcr?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'Tỷ lệ sống phải là số hợp lệ' })
  actualHarvestSurvivalRate?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  harvestFeedCost?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  harvestMedicineCost?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  harvestChemicalCost?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  harvestFeedKg?: number;

  @IsOptional()
  @IsDateString({}, { message: 'Ngày thu hoạch không đúng định dạng' })
  actualHarvestDate?: string;

  @IsOptional()
  @IsString({ message: 'Ghi chú thu hoạch phải là chuỗi văn bản' })
  harvestNote?: string;
}
