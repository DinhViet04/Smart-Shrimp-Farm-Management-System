import { IsUUID } from 'class-validator';

export class TransferWorkspaceOwnershipDto {
  @IsUUID('4', { message: 'Chủ sở hữu mới không hợp lệ' })
  newOwnerId: string;
}
