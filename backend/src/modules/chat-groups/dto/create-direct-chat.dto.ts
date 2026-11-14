import { IsNotEmpty, IsString } from 'class-validator';

export class CreateDirectChatDto {
  @IsString({ message: 'Mã người nhận phải là chuỗi ký tự' })
  @IsNotEmpty({ message: 'Vui lòng chọn người nhận tin nhắn riêng' })
  targetUserId: string;
}

