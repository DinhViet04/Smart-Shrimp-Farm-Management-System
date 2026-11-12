import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class SendChatMessageDto {
  @IsString({ message: 'Nội dung tin nhắn phải là chuỗi ký tự' })
  @IsNotEmpty({ message: 'Nội dung tin nhắn không được để trống' })
  @MaxLength(2000, { message: 'Tin nhắn không được vượt quá 2000 ký tự' })
  content: string;
}

