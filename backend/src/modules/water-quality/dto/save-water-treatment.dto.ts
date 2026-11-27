import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class WaterTreatmentChemicalDto {
  @IsOptional()
  @IsString()
  inventoryId?: string;

  @IsString()
  @MaxLength(200)
  name: string;

  @IsNumber()
  @Min(0)
  quantity: number;

  @IsString()
  @MaxLength(20)
  unit: string;
}

/** Ghi nhận đã xử lý 1 cảnh báo môi trường nước */
export class SaveWaterTreatmentDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => WaterTreatmentChemicalDto)
  chemicals?: WaterTreatmentChemicalDto[];
}
