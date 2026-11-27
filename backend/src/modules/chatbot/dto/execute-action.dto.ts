import { IsString, IsNotEmpty, IsObject, IsIn, IsOptional, IsUUID } from 'class-validator';

export class ExecuteActionDto {
  @IsString()
  @IsNotEmpty({ message: 'Loại hành động không được để trống' })
  @IsIn(
    [
      'CREATE_FARM',
      'CREATE_POND',
      'CREATE_CROP',
      'IMPORT_INVENTORY',
      'EXPORT_INVENTORY',
      'RECORD_WATER_QUALITY',
      'RECORD_FEEDING',
    ],
    {
      message:
        'Hành động phải là: CREATE_FARM, CREATE_POND, CREATE_CROP, IMPORT_INVENTORY, EXPORT_INVENTORY, RECORD_WATER_QUALITY hoặc RECORD_FEEDING',
    },
  )
  intent:
    | 'CREATE_FARM'
    | 'CREATE_POND'
    | 'CREATE_CROP'
    | 'IMPORT_INVENTORY'
    | 'EXPORT_INVENTORY'
    | 'RECORD_WATER_QUALITY'
    | 'RECORD_FEEDING';

  @IsObject({ message: 'Dữ liệu hành động phải là một đối tượng' })
  data: Record<string, any>;

  /** Mã phiếu do backend cấp khi trả phiếu; mỗi phiếu chỉ được thực thi 1 lần */
  @IsOptional()
  @IsUUID('4', { message: 'Mã phiếu không hợp lệ' })
  draftId?: string;
}
