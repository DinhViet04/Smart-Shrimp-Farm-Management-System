import { IsEnum, IsUUID } from 'class-validator';
import { WorkspaceRole } from '@prisma/client';

export class AddWorkspaceMemberDto {
  @IsUUID()
  userId: string;

  @IsEnum(WorkspaceRole)
  role: WorkspaceRole = WorkspaceRole.MEMBER;
}
