import { IsUUID } from 'class-validator';

export class TransferFarmOwnershipDto {
  @IsUUID('4', { message: 'Quản lý mới không hợp lệ' })
  newOwnerId: string;
}
