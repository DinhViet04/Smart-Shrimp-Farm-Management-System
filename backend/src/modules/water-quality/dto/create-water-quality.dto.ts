import {
  IsUUID,
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  Max,
} from 'class-validator';

/**
 * DTO for creating a new water quality record.
 * Validation ranges match the business rules defined in FE-23.
 */
export class CreateWaterQualityDto {
  /** UUID of the pond this measurement belongs to */
  @IsUUID('4', { message: 'pondId phải là UUID hợp lệ' })
  pondId: string;

  /** ISO 8601 timestamp of when the measurement was taken */
  @IsDateString({}, { message: 'recordTime phải là chuỗi ngày/giờ hợp lệ (ISO 8601)' })
  recordTime: string;

  /** Water temperature in °C — valid range: 15–40 */
  @IsNumber({}, { message: 'Nhiệt độ phải là số' })
  @Min(15, { message: 'Nhiệt độ tối thiểu là 15°C' })
  @Max(40, { message: 'Nhiệt độ tối đa là 40°C' })
  temperature: number;

  /** pH level — valid range: 5–10 */
  @IsNumber({}, { message: 'pH phải là số' })
  @Min(5, { message: 'pH tối thiểu là 5' })
  @Max(10, { message: 'pH tối đa là 10' })
  ph: number;

  /** Dissolved Oxygen in mg/L — valid range: 0–20 */
  @IsNumber({}, { message: 'Oxy hòa tan phải là số' })
  @Min(0, { message: 'Oxy hòa tan không được âm' })
  @Max(20, { message: 'Oxy hòa tan tối đa là 20 mg/L' })
  dissolvedOxygen: number;

  /** Salinity in ppt — valid range: 0–50 */
  @IsNumber({}, { message: 'Độ mặn phải là số' })
  @Min(0, { message: 'Độ mặn không được âm' })
  @Max(50, { message: 'Độ mặn tối đa là 50 ppt' })
  salinity: number;

  /** Alkalinity in mg/L — valid range: 0–300 */
  @IsNumber({}, { message: 'Độ kiềm phải là số' })
  @Min(0, { message: 'Độ kiềm không được âm' })
  @Max(300, { message: 'Độ kiềm tối đa là 300 mg/L' })
  alkalinity: number;

  /** Ammonia (NH3) in mg/L — must be >= 0 */
  @IsNumber({}, { message: 'NH3 phải là số' })
  @Min(0, { message: 'NH3 không được âm' })
  nh3: number;

  /** Hydrogen Sulfide (H2S) in mg/L — must be >= 0 */
  @IsOptional()
  @IsNumber({}, { message: 'H2S phải là số' })
  @Min(0, { message: 'H2S không được âm' })
  h2s?: number;

  /** Nitrite (NO2) in mg/L — optional for legacy support */
  @IsOptional()
  @IsNumber({}, { message: 'NO2 phải là số' })
  @Min(0, { message: 'NO2 không được âm' })
  no2?: number;

  /** Water transparency in cm — must be >= 0 */
  @IsNumber({}, { message: 'Độ trong phải là số' })
  @Min(0, { message: 'Độ trong không được âm' })
  transparency: number;

  /** Water color (e.g., Xanh lục, Xanh vỏ đậu, Màu nâu nhạt...) */
  @IsOptional()
  @IsString({ message: 'Màu nước phải là chuỗi ký tự' })
  waterColor?: string;

  /** Optional observation note */
  @IsOptional()
  @IsString({ message: 'Ghi chú phải là chuỗi ký tự' })
  note?: string;
}
