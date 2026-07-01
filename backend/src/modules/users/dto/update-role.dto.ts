import { IsIn, IsNotEmpty } from 'class-validator';
import { Role } from '@prisma/client';

export class UpdateRoleDto {
  @IsNotEmpty({ message: 'Role không được để trống' })
  @IsIn(['ADMIN', 'FARM_MANAGER', 'TECHNICIAN', 'FARMER'], { message: 'Role không hợp lệ' })
  role: Role;
}
