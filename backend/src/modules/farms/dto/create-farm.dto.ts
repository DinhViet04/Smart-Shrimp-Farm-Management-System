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
  @IsOptional()
  @IsUUID('4', { message: 'Workspace không hợp lệ' })
  workspaceId?: string;

  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập tên trang trại' })
  name: string;

  @IsString()
  @IsNotEmpty({ message: 'Vui lòng chọn Tỉnh/Thành phố cho trang trại' })
  address: string;

  @IsNumber()
  @Min(1, { message: 'Diện tích trang trại phải lớn hơn 0 m²' })
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
