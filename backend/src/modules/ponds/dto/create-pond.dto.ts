import { IsString, IsNotEmpty, IsNumber, Min } from 'class-validator';

export class CreatePondDto {
  @IsString()
  @IsNotEmpty({ message: 'Tên ao không được để trống' })
  name: string;

  @IsNumber()
  @Min(1, { message: 'Diện tích phải lớn hơn 0' })
  areaSize: number;

  @IsNumber()
  @Min(0.1, { message: 'Độ sâu phải lớn hơn 0' })
  depth: number;

  @IsString()
  @IsNotEmpty({ message: 'Vui lòng chọn trang trại' })
  farmId: string;
}
