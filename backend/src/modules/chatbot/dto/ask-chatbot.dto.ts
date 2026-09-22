import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class AskChatbotDto {
  @IsString()
  @IsNotEmpty({ message: 'Câu hỏi không được để trống' })
  question: string;

  @IsString()
  @IsOptional()
  pondId?: string;

  @IsString()
  @IsOptional()
  farmId?: string;
}
