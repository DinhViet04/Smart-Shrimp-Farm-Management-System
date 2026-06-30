import { IsEmail, IsNotEmpty, IsString, Length, Matches } from 'class-validator';

export class ResetPasswordDto {
  @IsEmail({}, { message: 'Email không hợp lệ' })
  @IsNotEmpty({ message: 'Email không được để trống' })
  email: string;

  @IsString()
  @IsNotEmpty({ message: 'OTP không được để trống' })
  @Length(6, 6, { message: 'OTP phải gồm 6 chữ số' })
  otp: string;

  @IsString()
  @IsNotEmpty({ message: 'Mật khẩu mới không được để trống' })
  @Matches(/((?=.*\d)|(?=.*\W+))(?![.\n])(?=.*[A-Z])(?=.*[a-z]).*$/, {
    message: 'Mật khẩu phải chứa chữ hoa, chữ thường và số hoặc ký tự đặc biệt',
  })
  password: string;

  @IsString()
  @IsNotEmpty({ message: 'Xác nhận mật khẩu không được để trống' })
  confirmPassword: string;
}
