import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
  Matches,
  IsIn,
} from 'class-validator';
import { Role } from '@prisma/client';

export class RegisterDto {
  @IsEmail({}, { message: 'Email không hợp lệ' })
  email: string;

  @IsString()
  @MinLength(8, { message: 'Mật khẩu phải có ít nhất 8 ký tự' })
  @Matches(/((?=.*\d)|(?=.*\W+))(?![.\n])(?=.*[A-Z])(?=.*[a-z]).*$/, {
    message: 'Mật khẩu phải chứa chữ hoa, chữ thường và số hoặc ký tự đặc biệt',
  })
  password: string;

  @IsString()
  @IsNotEmpty({ message: 'Họ tên không được để trống' })
  fullName: string;

  @IsOptional()
  @IsString()
  @Matches(/^0[35789][0-9]{8}$/, {
    message: 'Số điện thoại phải có 10 chữ số và bắt đầu bằng 0',
  })
  phone?: string;

  @IsOptional()
  @IsIn([Role.FARM_MANAGER, Role.FARMER, Role.TECHNICIAN], {
    message: 'Vai trò phải là FARM_MANAGER, FARMER hoặc TECHNICIAN',
  })
  role?: Role;
}
