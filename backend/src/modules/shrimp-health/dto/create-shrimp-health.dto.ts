import {
  IsUUID,
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  IsIn,
  Min,
  Max,
  MaxLength,
} from 'class-validator';

/**
 * DTO for creating a new shrimp health record (FE-21).
 */
export class CreateShrimpHealthDto {
  @IsUUID('4', { message: 'farmId phải là UUID hợp lệ' })
  farmId: string;

  @IsUUID('4', { message: 'pondId phải là UUID hợp lệ' })
  pondId: string;

  @IsUUID('4', { message: 'cropId phải là UUID hợp lệ' })
  cropId: string;

  @IsDateString(
    {},
    { message: 'recordTime phải là chuỗi ngày/giờ hợp lệ (ISO 8601)' },
  )
  recordTime: string;

  @IsString({ message: 'healthStatus phải là chuỗi ký tự' })
  @IsIn(['NORMAL', 'LETHARGIC', 'EDGE_GATHERING', 'LOSS_OF_APPETITE'], {
    message:
      'healthStatus phải là: NORMAL, LETHARGIC, EDGE_GATHERING hoặc LOSS_OF_APPETITE',
  })
  healthStatus: string;

  @IsString({ message: 'severity phải là chuỗi ký tự' })
  @IsIn(['NORMAL', 'MILD', 'MODERATE', 'SEVERE'], {
    message: 'severity phải là: NORMAL, MILD, MODERATE hoặc SEVERE',
  })
  severity: string;

  @IsNumber({}, { message: 'affectedPercentage phải là số' })
  @Min(0, { message: 'Tỷ lệ ảnh hưởng tối thiểu là 0%' })
  @Max(100, { message: 'Tỷ lệ ảnh hưởng tối đa là 100%' })
  affectedPercentage: number;

  @IsOptional()
  @IsString({ message: 'Ghi chú phải là chuỗi ký tự' })
  @MaxLength(500, { message: 'Ghi chú tối đa 500 ký tự' })
  note?: string;
}
