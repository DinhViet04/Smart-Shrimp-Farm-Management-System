import { IsEmail, IsEnum, IsNotEmpty } from 'class-validator';

export class AddChatGroupMemberDto {
  @IsEmail({}, { message: 'Email thành viên không hợp lệ' })
  @IsNotEmpty({ message: 'Vui lòng nhập email thành viên' })
  email: string;

  @IsEnum(['FARMER', 'TECHNICIAN'], {
    message: 'Vai trò thành viên phải là FARMER hoặc TECHNICIAN',
  })
  role: 'FARMER' | 'TECHNICIAN';
}

