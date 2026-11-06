import { IsString, IsNotEmpty, IsObject, IsIn } from 'class-validator';

export class ExecuteActionDto {
  @IsString()
  @IsNotEmpty({ message: 'Loại hành động không được để trống' })
  @IsIn(['CREATE_FARM', 'CREATE_POND', 'CREATE_CROP'], {
    message: 'Hành động phải là: CREATE_FARM, CREATE_POND hoặc CREATE_CROP',
  })
  intent: 'CREATE_FARM' | 'CREATE_POND' | 'CREATE_CROP';

  @IsObject({ message: 'Dữ liệu hành động phải là một đối tượng' })
  data: Record<string, any>;
}

