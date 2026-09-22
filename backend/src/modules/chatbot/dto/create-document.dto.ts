import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class CreateDocumentDto {
  @IsString()
  @IsNotEmpty({ message: 'Tiêu đề tài liệu không được để trống' })
  title: string;

  @IsString()
  @IsOptional()
  category?: string;

  @IsString()
  @IsNotEmpty({ message: 'Nội dung tài liệu không được để trống' })
  content: string;

  @IsString()
  @IsOptional()
  fileName?: string;

  @IsString()
  @IsOptional()
  fileType?: string;
}
