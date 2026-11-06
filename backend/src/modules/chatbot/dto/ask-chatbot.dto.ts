import { IsString, IsNotEmpty, IsOptional, IsArray, IsObject } from 'class-validator';

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

  @IsArray()
  @IsOptional()
  history?: Array<{ sender: 'user' | 'ai'; text: string }>;

  @IsObject()
  @IsOptional()
  pendingAction?: {
    intent: 'CREATE_FARM' | 'CREATE_POND' | 'CREATE_CROP';
    collectedData: Record<string, any>;
  };
}
