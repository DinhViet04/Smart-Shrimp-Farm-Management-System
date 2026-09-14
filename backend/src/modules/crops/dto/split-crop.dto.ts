import {
  IsUUID,
  IsDateString,
  IsInt,
  IsOptional,
  Min,
  Max,
  IsNumber,
  IsArray,
  ValidateNested,
  ArrayMinSize,
  IsString,
} from 'class-validator';
import { Type } from 'class-transformer';

export class SplitDestinationDto {
  @IsUUID('4', { message: 'pondId phải là UUID hợp lệ' })
  pondId: string;

  @IsInt({ message: 'Số lượng tôm chuyển vào phải là số nguyên' })
  @Min(1, { message: 'Số lượng tôm chuyển vào ao phải lớn hơn 0' })
  shrimpCount: number;

  @IsOptional()
  @IsNumber({}, { message: 'Kích thước thu hoạch dự kiến phải là số' })
  @Min(1, { message: 'Kích thước thu hoạch dự kiến phải lớn hơn 0' })
  targetHarvestSize?: number;

  @IsOptional()
  @IsNumber({}, { message: 'Tỷ lệ sống dự kiến phải là số' })
  @Min(0, { message: 'Tỷ lệ sống dự kiến không được nhỏ hơn 0%' })
  @Max(100, { message: 'Tỷ lệ sống dự kiến không được vượt quá 100%' })
  targetSurvivalRate?: number;

  @IsOptional()
  @IsNumber({}, { message: 'Tổng lượng thức ăn dự kiến phải là số' })
  @Min(0, { message: 'Tổng lượng thức ăn dự kiến không được nhỏ hơn 0' })
  targetTotalFeedKg?: number;

  @IsOptional()
  @IsDateString(
    {},
    { message: 'expectedHarvestDate phải là định dạng ngày hợp lệ (ISO 8601)' },
  )
  expectedHarvestDate?: string;

  @IsOptional()
  @IsInt({ message: 'Số ngày nuôi dự kiến phải là số nguyên' })
  @Min(1, { message: 'Số ngày nuôi dự kiến phải lớn hơn 0' })
  expectedDurationDays?: number;
}

export class SplitCropDto {
  @IsDateString(
    {},
    { message: 'transferDate phải là định dạng ngày hợp lệ (ISO 8601)' },
  )
  transferDate: string;

  @IsInt({ message: 'Số lượng tôm thu được thực tế phải là số nguyên' })
  @Min(1, { message: 'Số lượng tôm thu được thực tế phải lớn hơn 0' })
  actualNurseryHarvest: number;

  @IsOptional()
  @IsNumber({}, { message: 'Kích thước tôm lúc tách phải là số' })
  @Min(0.01, { message: 'Kích thước tôm lúc tách phải lớn hơn 0' })
  transferSize?: number;

  @IsOptional()
  @IsString({ message: 'Ghi chú tách ao phải là chuỗi ký tự' })
  splitNote?: string;

  @IsArray({ message: 'Danh sách ao nhận tôm phải là một mảng' })
  @ArrayMinSize(1, { message: 'Cần ít nhất 1 ao thành phẩm để tách/chuyển tôm' })
  @ValidateNested({ each: true })
  @Type(() => SplitDestinationDto)
  destinations: SplitDestinationDto[];
}
