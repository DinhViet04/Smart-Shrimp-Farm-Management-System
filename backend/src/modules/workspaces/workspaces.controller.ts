import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { AddWorkspaceMemberDto } from './dto/add-workspace-member.dto.js';
import { CreateWorkspaceDto } from './dto/create-workspace.dto.js';
import { UpdateWorkspaceMemberDto } from './dto/update-workspace-member.dto.js';
import { UpdateWorkspaceStatusDto } from './dto/update-workspace-status.dto.js';
import { TransferWorkspaceOwnershipDto } from './dto/transfer-workspace-ownership.dto.js';
import { WorkspacesService } from './workspaces.service.js';

@Controller('workspaces')
@UseGuards(JwtAuthGuard, RolesGuard)
export class WorkspacesController {
  constructor(private readonly workspacesService: WorkspacesService) {}

  @Get()
  @Roles('ADMIN', 'FARM_MANAGER', 'TECHNICIAN', 'FARMER')
  findAll(
    @CurrentUser('userId') userId: string,
    @CurrentUser('role') role: string,
  ) {
    return this.workspacesService.findAll(userId, role);
  }

  @Post()
  @Roles('ADMIN')
  create(
    @CurrentUser('userId') adminId: string,
    @Body() dto: CreateWorkspaceDto,
  ) {
    return this.workspacesService.create(dto, adminId);
  }

  @Get(':id/members')
  @Roles('ADMIN', 'FARM_MANAGER', 'TECHNICIAN', 'FARMER')
  getMembers(
    @Param('id') workspaceId: string,
    @CurrentUser('userId') userId: string,
    @CurrentUser('role') role: string,
  ) {
    return this.workspacesService.getMembers(workspaceId, userId, role);
  }

  @Post(':id/members')
  @Roles('ADMIN', 'FARM_MANAGER', 'TECHNICIAN', 'FARMER')
  addMember(
    @Param('id') workspaceId: string,
    @CurrentUser('userId') userId: string,
    @CurrentUser('role') role: string,
    @Body() dto: AddWorkspaceMemberDto,
  ) {
    return this.workspacesService.addMember(workspaceId, dto, userId, role);
  }

  @Patch(':id/members/:memberId')
  @Roles('ADMIN', 'FARM_MANAGER', 'TECHNICIAN', 'FARMER')
  updateMember(
    @Param('id') workspaceId: string,
    @Param('memberId') memberId: string,
    @CurrentUser('userId') userId: string,
    @CurrentUser('role') role: string,
    @Body() dto: UpdateWorkspaceMemberDto,
  ) {
    return this.workspacesService.updateMember(
      workspaceId,
      memberId,
      dto,
      userId,
      role,
    );
  }

  @Patch(':id/status')
  @Roles('ADMIN')
  updateStatus(
    @Param('id') workspaceId: string,
    @CurrentUser('userId') adminId: string,
    @Body() dto: UpdateWorkspaceStatusDto,
  ) {
    return this.workspacesService.updateStatus(
      workspaceId,
      dto.status,
      adminId,
    );
  }

  @Patch(':id/owner')
  @Roles('ADMIN', 'FARM_MANAGER', 'TECHNICIAN', 'FARMER')
  transferOwnership(
    @Param('id') workspaceId: string,
    @CurrentUser('userId') actorId: string,
    @CurrentUser('role') actorRole: string,
    @Body() dto: TransferWorkspaceOwnershipDto,
  ) {
    return this.workspacesService.transferOwnership(
      workspaceId,
      dto.newOwnerId,
      actorId,
      actorRole,
    );
  }
}
