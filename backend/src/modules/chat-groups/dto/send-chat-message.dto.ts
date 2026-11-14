import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class SendChatMessageDto {
  @IsOptional()
  @IsString({ message: 'Nội dung tin nhắn phải là chuỗi ký tự' })
  @MaxLength(2000, { message: 'Tin nhắn không được vượt quá 2000 ký tự' })
  content?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  attachmentUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  attachmentName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  attachmentType?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(20 * 1024 * 1024)
  attachmentSize?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  replyToId?: string;
}
