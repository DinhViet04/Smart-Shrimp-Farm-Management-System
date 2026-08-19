import { IsDateString, IsInt, IsOptional, IsIn, Min } from 'class-validator';

export class UpdateCropDto {
  @IsOptional()
  @IsDateString(
    {},
    { message: 'startDate phải là định dạng ngày hợp lệ (ISO 8601)' },
  )
  startDate?: string;

  @IsOptional()
  @IsInt({ message: 'Số lượng tôm thả phải là số nguyên' })
  @Min(1, { message: 'Số lượng tôm thả phải lớn hơn 0' })
  initialShrimpCount?: number;

  @IsOptional()
  @IsIn(['ACTIVE', 'HARVESTED', 'FAILED'], {
    message: 'Trạng thái phải là: ACTIVE, HARVESTED hoặc FAILED',
  })
  status?: string;
}
