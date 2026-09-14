import {
  IsUUID,
  IsDateString,
  IsInt,
  IsOptional,
  IsIn,
  Min,
  Max,
  IsNumber,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class GrowthMilestoneDto {
  @IsInt({ message: 'Mốc ngày nuôi phải là số nguyên' })
  @Min(1, { message: 'Mốc ngày nuôi phải lớn hơn 0' })
  day: number;

  @IsNumber({}, { message: 'Trọng lượng tôm phải là số hợp lệ' })
  @Min(0.01, { message: 'Trọng lượng tôm phải lớn hơn 0' })
  weight: number;
}

export class CreateCropDto {
  @IsUUID('4', { message: 'pondId phải là UUID hợp lệ' })
  pondId: string;

  @IsDateString(
    {},
    { message: 'startDate phải là định dạng ngày hợp lệ (ISO 8601)' },
  )
  startDate: string;

  @IsInt({ message: 'Số lượng tôm thả phải là số nguyên' })
  @Min(1, { message: 'Số lượng tôm thả phải lớn hơn 0' })
  initialShrimpCount: number;

  @IsOptional()
  @IsIn(['ACTIVE', 'HARVESTED', 'FAILED'], {
    message: 'Trạng thái phải là: ACTIVE, HARVESTED hoặc FAILED',
  })
  status?: string;

  @IsOptional()
  @IsNumber({}, { message: 'Kích thước thu hoạch dự kiến phải là số' })
  @Min(1, { message: 'Kích thước thu hoạch dự kiến phải lớn hơn 0' })
  targetHarvestSize?: number;

  @IsOptional()
  @IsArray({ message: 'Danh sách mốc tăng trưởng phải là mảng' })
  @ValidateNested({ each: true })
  @Type(() => GrowthMilestoneDto)
  growthMilestones?: GrowthMilestoneDto[];

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

  @IsOptional()
  @IsIn(['NURSERY', 'COMMERCIAL'], {
    message: 'Giai đoạn vụ nuôi phải là NURSERY (Ương dưỡng) hoặc COMMERCIAL (Nuôi thương phẩm)',
  })
  stage?: string;

  @IsOptional()
  @IsDateString(
    {},
    { message: 'expectedTransferDate phải là định dạng ngày hợp lệ (ISO 8601)' },
  )
  expectedTransferDate?: string;
}

