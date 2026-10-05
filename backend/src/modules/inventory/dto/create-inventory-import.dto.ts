import {
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateInventoryImportDto {
  @IsOptional()
  @IsNumber()
  @Min(0.01)
  quantityAdded?: number;

  @IsOptional()
  @IsNumber()
  @Min(0.01)
  packagesAdded?: number;

  @IsOptional()
  @IsDateString()
  importDate?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
