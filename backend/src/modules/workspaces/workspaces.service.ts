import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Role, WorkspaceRole, WorkspaceStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AddWorkspaceMemberDto } from './dto/add-workspace-member.dto.js';
import { CreateWorkspaceDto } from './dto/create-workspace.dto.js';
import { UpdateWorkspaceMemberDto } from './dto/update-workspace-member.dto.js';

@Injectable()
export class WorkspacesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(userId: string, role: string) {
    return this.prisma.workspace.findMany({
      where:
        role === Role.ADMIN
          ? undefined
          : { members: { some: { userId, isActive: true } } },
      include: {
        _count: { select: { members: true, farms: true, tickets: true } },
        members: {
          where: { role: WorkspaceRole.OWNER, isActive: true },
          take: 1,
          select: {
            user: { select: { id: true, fullName: true, email: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(dto: CreateWorkspaceDto, adminId: string) {
    const owner = await this.prisma.user.findUnique({
      where: { id: dto.ownerId },
      select: { id: true, role: true, isActive: true },
    });
    if (!owner || owner.role !== Role.FARM_MANAGER || !owner.isActive) {
      throw new BadRequestException(
        'Chủ workspace phải là Farm Manager đang hoạt động',
      );
    }
    const slug = this.createSlug(dto.name, owner.id);
    return this.prisma.$transaction(async (tx) => {
      const workspace = await tx.workspace.create({
        data: {
          name: dto.name.trim(),
          slug,
          createdById: adminId,
          members: {
            create: { userId: owner.id, role: WorkspaceRole.OWNER },
          },
        },
        include: { _count: { select: { members: true, farms: true } } },
      });
      await tx.adminAuditLog.create({
        data: {
          actorId: adminId,
          action: 'WORKSPACE_CREATED',
          targetType: 'WORKSPACE',
          targetId: workspace.id,
          details: { name: workspace.name, ownerId: owner.id },
        },
      });
      return workspace;
    });
  }

  async getMembers(workspaceId: string, userId: string, role: string) {
    await this.assertCanManage(workspaceId, userId, role);
    return this.prisma.workspaceMember.findMany({
      where: { workspaceId },
      select: {
        id: true,
        role: true,
        isActive: true,
        joinedAt: true,
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            role: true,
            isActive: true,
          },
        },
      },
      orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
    });
  }

  async addMember(
    workspaceId: string,
    dto: AddWorkspaceMemberDto,
    actorId: string,
    actorRole: string,
  ) {
    await this.assertCanManage(workspaceId, actorId, actorRole);
    const user = await this.prisma.user.findUnique({
      where: { id: dto.userId },
      select: { id: true, isActive: true },
    });
    if (!user?.isActive)
      throw new BadRequestException('Người dùng không tồn tại hoặc đã bị khóa');
    if (dto.role === WorkspaceRole.OWNER)
      throw new BadRequestException(
        'Hãy dùng chức năng chuyển chủ sở hữu workspace',
      );
    return this.prisma.$transaction(async (tx) => {
      const member = await tx.workspaceMember.upsert({
        where: { workspaceId_userId: { workspaceId, userId: dto.userId } },
        create: {
          workspaceId,
          userId: dto.userId,
          role: dto.role,
          isActive: true,
        },
        update: { role: dto.role, isActive: true },
      });
      await tx.adminAuditLog.create({
        data: {
          actorId,
          action: 'WORKSPACE_MEMBER_ADDED_OR_REACTIVATED',
          targetType: 'WORKSPACE_MEMBER',
          targetId: member.id,
          details: { workspaceId, userId: dto.userId, role: dto.role },
        },
      });
      return member;
    });
  }

  async updateMember(
    workspaceId: string,
    memberId: string,
    dto: UpdateWorkspaceMemberDto,
    actorId: string,
    actorRole: string,
  ) {
    await this.assertCanManage(workspaceId, actorId, actorRole);
    const member = await this.prisma.workspaceMember.findFirst({
      where: { id: memberId, workspaceId },
    });
    if (!member) throw new NotFoundException('Không tìm thấy thành viên');
    if (member.role === WorkspaceRole.OWNER)
      throw new ForbiddenException('Không thể sửa hoặc vô hiệu hóa chủ sở hữu');
    if (dto.role === WorkspaceRole.OWNER)
      throw new BadRequestException(
        'Hãy dùng chức năng chuyển chủ sở hữu workspace',
      );
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.workspaceMember.update({
        where: { id: member.id },
        data: dto,
      });
      await tx.adminAuditLog.create({
        data: {
          actorId,
          action: 'WORKSPACE_MEMBER_UPDATED',
          targetType: 'WORKSPACE_MEMBER',
          targetId: member.id,
          details: {
            workspaceId,
            userId: member.userId,
            fromRole: member.role,
            toRole: updated.role,
            fromActive: member.isActive,
            toActive: updated.isActive,
          },
        },
      });
      return updated;
    });
  }

  async transferOwnership(
    workspaceId: string,
    newOwnerId: string,
    actorId: string,
    actorRole: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const workspace = await tx.workspace.findUnique({
        where: { id: workspaceId },
        select: { id: true, name: true, status: true },
      });
      if (!workspace) throw new NotFoundException('Không tìm thấy workspace');
      if (workspace.status !== WorkspaceStatus.ACTIVE)
        throw new BadRequestException(
          'Phải kích hoạt workspace trước khi chuyển chủ sở hữu',
        );

      const currentOwner = await tx.workspaceMember.findFirst({
        where: {
          workspaceId,
          role: WorkspaceRole.OWNER,
          isActive: true,
        },
        include: { user: { select: { fullName: true } } },
      });
      if (!currentOwner)
        throw new BadRequestException(
          'Workspace chưa có chủ sở hữu đang hoạt động',
        );
      if (actorRole !== Role.ADMIN && currentOwner.userId !== actorId)
        throw new ForbiddenException(
          'Chỉ chủ sở hữu hoặc Quản trị viên hệ thống được bàn giao workspace',
        );
      if (currentOwner.userId === newOwnerId)
        throw new BadRequestException('Người dùng đã là chủ sở hữu workspace');

      const newOwner = await tx.workspaceMember.findFirst({
        where: { workspaceId, userId: newOwnerId, isActive: true },
        include: {
          user: {
            select: { id: true, fullName: true, role: true, isActive: true },
          },
        },
      });
      if (
        !newOwner ||
        !newOwner.user.isActive ||
        newOwner.user.role !== Role.FARM_MANAGER
      )
        throw new BadRequestException(
          'Chủ sở hữu mới phải là Farm Manager đang hoạt động trong workspace',
        );

      await tx.workspaceMember.update({
        where: { id: currentOwner.id },
        data: { role: WorkspaceRole.ADMIN },
      });
      const updatedOwner = await tx.workspaceMember.update({
        where: { id: newOwner.id },
        data: { role: WorkspaceRole.OWNER },
        include: {
          user: { select: { id: true, fullName: true, email: true } },
        },
      });
      await tx.adminAuditLog.create({
        data: {
          actorId,
          action: 'WORKSPACE_OWNERSHIP_TRANSFERRED',
          targetType: 'WORKSPACE',
          targetId: workspaceId,
          details: {
            workspaceName: workspace.name,
            fromOwnerId: currentOwner.userId,
            fromOwnerName: currentOwner.user.fullName,
            toOwnerId: newOwner.userId,
            toOwnerName: newOwner.user.fullName,
          },
        },
      });
      return updatedOwner;
    });
  }

  async updateStatus(
    workspaceId: string,
    status: WorkspaceStatus,
    adminId: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const workspace = await tx.workspace.findUnique({
        where: { id: workspaceId },
      });
      if (!workspace) throw new NotFoundException('Không tìm thấy workspace');
      const updated = await tx.workspace.update({
        where: { id: workspaceId },
        data: { status },
      });
      await tx.adminAuditLog.create({
        data: {
          actorId: adminId,
          action: 'WORKSPACE_STATUS_CHANGED',
          targetType: 'WORKSPACE',
          targetId: workspaceId,
          details: { from: workspace.status, to: status },
        },
      });
      return updated;
    });
  }

  private async assertCanManage(
    workspaceId: string,
    userId: string,
    role: string,
  ) {
    if (role === Role.ADMIN) return;
    const membership = await this.prisma.workspaceMember.findFirst({
      where: {
        workspaceId,
        userId,
        isActive: true,
        role: { in: [WorkspaceRole.OWNER, WorkspaceRole.ADMIN] },
        workspace: { status: WorkspaceStatus.ACTIVE },
      },
    });
    if (!membership)
      throw new ForbiddenException('Bạn không có quyền quản lý workspace này');
  }

  private createSlug(name: string, ownerId: string) {
    const base = name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 60);
    return `${base || 'workspace'}-${ownerId.slice(0, 8)}-${Date.now()}`;
  }
}
