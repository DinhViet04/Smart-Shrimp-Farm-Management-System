import { IsString, IsNotEmpty, IsNumber, IsOptional, Min, IsEnum } from 'class-validator';

export class CreateFarmDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  address: string;

  @IsNumber()
  @Min(0)
  area: number;

  @IsString()
  @IsNotEmpty()
  ownerId: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  ponds_count?: number; 

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(['ACTIVE', 'INACTIVE'])
  @IsOptional()
  status?: string;
}
