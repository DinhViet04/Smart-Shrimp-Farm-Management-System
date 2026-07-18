import { IsString, IsNotEmpty, IsEnum, IsNumber, Min, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';
import { InventoryCategory } from '@prisma/client';

export class CreateInventoryDto {
  @IsString()
  @IsNotEmpty()
  itemName: string;

  @IsString()
  @IsNotEmpty()
  farmId: string;

  @IsEnum(InventoryCategory)
  category: InventoryCategory;

  @IsNumber()
  @Type(() => Number)
  @Min(0)
  quantity: number;

  @IsString()
  @IsNotEmpty()
  unit: string;

  @IsOptional()
  @IsString()
  packageType?: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(0)
  packageQty?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(0)
  weightPerPkg?: number;

  @IsNumber()
  @Type(() => Number)
  @Min(0)
  minThreshold: number;

  @IsString()
  @IsOptional()
  supplierId?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  imageUrl?: string;

  @IsString()
  @IsOptional()
  shape?: string;

  @IsString()
  @IsOptional()
  sizeSpec?: string;
}
