import { IsString, IsInt, IsOptional, IsDateString, Min } from 'class-validator';

export class CreateMortalityLogDto {
  @IsString()
  cropId: string;

  @IsInt()
  @Min(1, { message: 'Số lượng tôm chết phải lớn hơn 0' })
  deadQuantityPcs: number;

  @IsOptional()
  @IsDateString()
  recordedDate?: string;

  @IsOptional()
  @IsString()
  cause?: string;

  @IsOptional()
  @IsString()
  note?: string;
}
