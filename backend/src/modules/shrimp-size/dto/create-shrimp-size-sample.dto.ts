import { IsNotEmpty, IsNumber, IsOptional, IsPositive, IsString } from 'class-validator';

export class CreateShrimpSizeSampleDto {
  @IsNumber()
  @IsPositive()
  @IsNotEmpty()
  sampleCount: number;

  @IsNumber()
  @IsPositive()
  @IsNotEmpty()
  sampleWeightGram: number;

  @IsNumber()
  @IsPositive()
  @IsOptional()
  sampleLengthCm?: number;

  @IsString()
  @IsOptional()
  samplingDate?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}
