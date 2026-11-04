import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  Min,
  IsEnum,
  IsArray,
  IsUUID,
} from 'class-validator';

export class CreateFarmDto {
  @IsUUID('4', { message: 'Workspace không hợp lệ' })
  workspaceId: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  address: string;

  @IsNumber()
  @Min(0)
  area: number;

  @IsOptional()
  @IsString()
  ownerId?: string;

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

  @IsString()
  @IsOptional()
  farmingModel?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  staffIds?: string[];
}
