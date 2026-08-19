import { IsIn, IsOptional, IsString, Length, Matches } from 'class-validator';
import { Role } from '@prisma/client';

export class UpdateProfileDto {
  @IsString()
  @Length(3, 100, { message: 'Họ và tên phải có từ 3 đến 100 ký tự' })
  fullName: string;

  @IsOptional()
  @IsString()
  @Matches(/^(0|\+84)(\d{9,10})$/, {
    message: 'Số điện thoại không đúng định dạng',
  })
  phone?: string;

  @IsOptional()
  @IsString()
  @Length(0, 100, { message: 'Địa chỉ tối đa 100 ký tự' })
  address?: string;

  @IsOptional()
  @IsString()
  avatarUrl?: string;

  @IsOptional()
  @IsIn([Role.FARM_MANAGER, Role.FARMER, Role.TECHNICIAN], {
    message: 'Vai trò chỉ được là FARM_MANAGER, FARMER hoặc TECHNICIAN',
  })
  role?: Role;
}
