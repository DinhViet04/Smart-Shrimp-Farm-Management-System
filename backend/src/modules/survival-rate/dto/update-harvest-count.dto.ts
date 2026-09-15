import { IsOptional, IsInt, IsNumber, Min } from 'class-validator';

export class UpdateHarvestCountDto {
  @IsOptional()
  @IsInt()
  @Min(0, { message: 'Số lượng tôm thu hoạch không được âm' })
  actualHarvestCount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0, { message: 'Sản lượng thu hoạch không được âm' })
  actualHarvestKg?: number;

  @IsOptional()
  @IsNumber()
  @Min(0.1, { message: 'Kích cỡ tôm thu hoạch phải lớn hơn 0' })
  actualHarvestSize?: number;
}
