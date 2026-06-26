import { IsEnum, IsNotEmpty } from 'class-validator';
import { Role } from '@prisma/client';

export class UpdateRoleDto {
  @IsNotEmpty({ message: 'Role không được để trống' })
  @IsEnum(Role, { message: 'Role không hợp lệ' })
  role: Role;
}
