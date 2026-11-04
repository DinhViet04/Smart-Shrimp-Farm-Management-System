import { IsEnum } from 'class-validator';
import { WorkspaceStatus } from '@prisma/client';

export class UpdateWorkspaceStatusDto {
  @IsEnum(WorkspaceStatus)
  status: WorkspaceStatus;
}
