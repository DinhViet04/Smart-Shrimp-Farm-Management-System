import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { SupportTicketPriority, SupportTicketScope } from '@prisma/client';

export class CreateSupportTicketDto {
  @IsEnum(SupportTicketScope)
  scope: SupportTicketScope = SupportTicketScope.WORKSPACE;

  @ValidateIf(
    (dto: CreateSupportTicketDto) => dto.scope === SupportTicketScope.WORKSPACE,
  )
  @IsOptional()
  @IsUUID()
  workspaceId?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  subject: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  description: string;

  @IsEnum(SupportTicketPriority)
  priority: SupportTicketPriority = SupportTicketPriority.MEDIUM;
}
