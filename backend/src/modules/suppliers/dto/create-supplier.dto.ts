import { IsEmail, IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class CreateSupplierDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  farmId: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  @Matches(/^0\d{9}$/, {
    message: 'Số điện thoại nhà cung cấp phải có đúng 10 chữ số và bắt đầu bằng 0',
  })
  phone?: string;

  @IsOptional()
  @IsEmail({}, { message: 'Email nhà cung cấp không hợp lệ' })
  @MaxLength(100)
  email?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  note?: string;
}
