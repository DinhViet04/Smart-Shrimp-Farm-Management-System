import {
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
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

  @Type(() => Number)
  @IsNumber({}, { message: 'Giá bán phải là số hợp lệ' })
  @Min(0.01, { message: 'Giá bán phải lớn hơn 0' })
  actualHarvestPricePerKg: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  harvestFeedCost?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  harvestMedicineCost?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  harvestChemicalCost?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  harvestSeedCost?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  harvestElectricityCost?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  harvestLaborCost?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  harvestOtherCost?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  harvestFeedKg?: number;

  @IsOptional()
  @IsDateString({}, { message: 'Ngày thu hoạch không đúng định dạng' })
  actualHarvestDate?: string;

  @IsOptional()
  @IsString({ message: 'Ghi chú thu hoạch phải là chuỗi văn bản' })
  @MaxLength(1000, { message: 'Ghi chú thu hoạch tối đa 1000 ký tự' })
  harvestNote?: string;
}
