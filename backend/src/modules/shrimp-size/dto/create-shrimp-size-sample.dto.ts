import { IsNotEmpty, IsNumber, IsOptional, IsPositive, IsString, ValidateNested, IsArray, ArrayMinSize, ArrayMaxSize } from 'class-validator';
import { Type } from 'class-transformer';

export class ShrimpCastDto {
  @IsNumber()
  @IsPositive()
  @IsNotEmpty()
  count: number;

  @IsNumber()
  @IsPositive()
  @IsNotEmpty()
  weightGram: number;

  @IsString()
  @IsOptional()
  note?: string;
}

export class CreateShrimpSizeSampleDto {
  @IsArray()
  @ArrayMinSize(5)
  @ArrayMaxSize(5)
  @ValidateNested({ each: true })
  @Type(() => ShrimpCastDto)
  casts: ShrimpCastDto[];

  @IsNumber()
  @IsPositive()
  @IsNotEmpty()
  netAreaSqM: number; // Diện tích chài

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
