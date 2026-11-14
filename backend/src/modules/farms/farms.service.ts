import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Role, WorkspaceRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import { CreateFarmDto } from './dto/create-farm.dto.js';
import { UpdateFarmDto } from './dto/update-farm.dto.js';
import { FarmAccessService } from '../farm-access/farm-access.service.js';
import { EmailService } from '../email/email.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { ChatGroupsService } from '../chat-groups/chat-groups.service.js';

@Injectable()
export class FarmsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly farmAccess: FarmAccessService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly emailService: EmailService,
    private readonly notificationsService: NotificationsService,
    @Optional() private readonly chatGroupsService?: ChatGroupsService,
  ) {}

  async create(data: CreateFarmDto) {
    if (data.staffIds?.length) {
      throw new BadRequestException(
        'Vui lòng mời nhân viên qua email sau khi tạo trang trại',
      );
    }
    if (!data.ownerId) {
      throw new BadRequestException(
        'Vui lòng chỉ định chủ trang trại (ownerId)',
      );
    }

    const trimmedName = data.name?.trim();
    if (!trimmedName || trimmedName.length < 2) {
      throw new BadRequestException('Tên trang trại phải có ít nhất 2 ký tự');
    }

    const trimmedAddress = data.address?.trim();
    if (!trimmedAddress) {
      throw new BadRequestException(
        'Vui lòng chọn Tỉnh/Thành phố cho trang trại',
      );
    }

    const numericArea = Number(data.area);
    if (Number.isNaN(numericArea) || numericArea <= 0) {
      throw new BadRequestException(
        'Diện tích trang trại phải lớn hơn 0 m²',
      );
    }

    const membership = await this.prisma.workspaceMember.findFirst({
      where: {
        ...(data.workspaceId ? { workspaceId: data.workspaceId } : {}),
        userId: data.ownerId,
        isActive: true,
        role: { in: [WorkspaceRole.OWNER, WorkspaceRole.ADMIN] },
        workspace: { status: 'ACTIVE' },
      },
      select: { workspaceId: true },
    });
    if (!membership)
      throw new ForbiddenException(
        'Bạn không có quyền tạo trang trại trong workspace đã chọn',
      );
    const exists = await this.prisma.farm.findFirst({
      where: {
        workspaceId: membership.workspaceId,
        name: { equals: trimmedName, mode: 'insensitive' },
        deletedAt: null,
      },
    });
    if (exists)
      throw new BadRequestException(
        'Tên trang trại đã tồn tại trong workspace',
      );

    const { ponds_count, staffIds, workspaceId: _wsId, ...farmData } = data;
    void ponds_count;
    void _wsId;

    const farm = await this.prisma.farm.create({
      data: {
        ...farmData,
        name: trimmedName,
        address: trimmedAddress,
        area: numericArea,
        ownerId: data.ownerId,
        workspaceId: membership.workspaceId,
      },
    });

    void staffIds;

    // Tự động khởi tạo nhóm chat trang trại và thêm chủ trại làm chủ nhóm
    if (this.chatGroupsService) {
      await this.chatGroupsService.ensureFarmChatGroup(farm.id);
    }

    // Thông báo realtime cho Manager
    if (farm.ownerId && this.prisma.user?.findUnique) {
      const owner = await this.prisma.user.findUnique({
        where: { id: farm.ownerId },
        select: { role: true },
      });
      if (owner?.role === 'FARM_MANAGER' && this.notificationsService?.createFarmCreatedNotification) {
        await this.notificationsService.createFarmCreatedNotification(
          farm.ownerId,
          farm.id,
          farm.name,
        );
      }
    }

    return farm;
  }

  async findAll(
    search?: string,
    status?: string,
    userId?: string,
    role?: string,
    workspaceId?: string,
  ) {
    const accessWhere =
      role === 'ADMIN'
        ? {}
        : role === 'FARM_MANAGER' && userId
          ? { ownerId: userId }
          : userId
            ? { staff: { some: { userId, isActive: true } } }
            : { id: { in: [] } };
    const workspaceWhere =
      role === 'ADMIN'
        ? {}
        : {
            workspace: {
              status: 'ACTIVE',
              members: { some: { userId, isActive: true } },
            },
          };
    const where: any = {
      deletedAt: null,
      ...accessWhere,
      ...workspaceWhere,
    };
    if (search) where.name = { contains: search, mode: 'insensitive' };
    if (status) where.status = status;
    if (workspaceId) where.workspaceId = workspaceId;

    const [farms, ponds, owners] = await Promise.all([
      this.prisma.farm.findMany({
        where,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.pond.findMany({
        where: { farm: where },
        select: {
          id: true,
          name: true,
          areaSize: true,
          depth: true,
          farmId: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      role === 'ADMIN'
        ? this.prisma.user.findMany({
            select: { id: true, fullName: true, email: true },
          })
        : Promise.resolve([]),
    ]);

    const pondsByFarm = new Map<string, typeof ponds>();
    for (const pond of ponds) {
      const farmPonds = pondsByFarm.get(pond.farmId) ?? [];
      farmPonds.push(pond);
      pondsByFarm.set(pond.farmId, farmPonds);
    }
    const ownerById = new Map(owners.map((owner) => [owner.id, owner]));

    return farms.map((farm) => ({
      ...farm,
      owner: ownerById.get(farm.ownerId),
      ponds: pondsByFarm.get(farm.id) ?? [],
    }));
  }

  async findAllByManager(userId: string, workspaceId?: string) {
    return this.prisma.farm.findMany({
      where: {
        ownerId: userId,
        deletedAt: null,
        ...(workspaceId ? { workspaceId } : {}),
        workspace: {
          status: 'ACTIVE',
          members: { some: { userId, isActive: true } },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, userId?: string, role?: string) {
    const farm = await this.prisma.farm.findFirst({
      where: { id, deletedAt: null },
      include: { owner: true, ponds: true },
    });

    if (!farm) throw new NotFoundException('Khong tim thay nong trai');

    if (userId && role) {
      await this.farmAccess.assertCanAccessFarm({ userId, role }, id);
    }

    return farm;
  }

  async update(
    id: string,
    data: UpdateFarmDto,
    userId?: string,
    role?: string,
  ) {
    if (data.staffIds !== undefined) {
      throw new BadRequestException(
        'Không thể gán nhân viên trực tiếp; vui lòng sử dụng lời mời email',
      );
    }
    const farm = await this.findOne(id, userId, role);
    if (userId && role) {
      await this.farmAccess.assertCanManageFarm({ userId, role }, id);
    } else if (farm.ownerId !== userId) {
      throw new ForbiddenException(
        'Ban khong co quyen cap nhat trang trai nay',
      );
    }

    if (data.name !== undefined) {
      const trimmedName = data.name.trim();
      if (trimmedName.length < 2) {
        throw new BadRequestException(
          'Tên trang trại phải có ít nhất 2 ký tự',
        );
      }
      data.name = trimmedName;
      const exists = await this.prisma.farm.findFirst({
        where: {
          name: { equals: trimmedName, mode: 'insensitive' },
          workspaceId: farm.workspaceId,
          id: { not: id },
        },
      });
      if (exists) throw new BadRequestException('Ten nong trai da ton tai');
    }

    if (data.area !== undefined) {
      const totalPondsArea = await this.prisma.pond.aggregate({
        where: { farmId: id },
        _sum: { areaSize: true },
      });
      const currentPondsArea = totalPondsArea._sum.areaSize || 0;

      if (data.area < currentPondsArea) {
        throw new BadRequestException(
          `Khong the giam dien tich trang trai xuong ${data.area}m2 vi tong dien tich cac ao hien tai (${currentPondsArea}m2) da vuot qua muc nay.`,
        );
      }
    }

    const { ponds_count, staffIds, ...farmData } = data;
    void ponds_count;

    const updatedFarm = await this.prisma.farm.update({
      where: { id },
      data: farmData,
    });

    void staffIds;

    if (this.chatGroupsService) {
      await this.chatGroupsService.ensureFarmChatGroup(updatedFarm.id);
    }

    return updatedFarm;
  }

  async remove(id: string, userId?: string, role?: string) {
    const farm = await this.findOne(id, userId, role);
    if (userId && role) {
      await this.farmAccess.assertCanManageFarm({ userId, role }, id);
    } else if (farm.ownerId !== userId) {
      throw new ForbiddenException('Ban khong co quyen xoa trang trai nay');
    }

    return this.prisma.farm.delete({
      where: { id },
    });
  }

  async transferOwnership(farmId: string, newOwnerId: string, adminId: string) {
    const updated = await this.prisma.$transaction(async (tx) => {
      const farm = await tx.farm.findFirst({
        where: { id: farmId, deletedAt: null },
        select: {
          id: true,
          name: true,
          ownerId: true,
          workspaceId: true,
          owner: { select: { fullName: true } },
        },
      });
      if (!farm) throw new NotFoundException('Không tìm thấy trang trại');
      if (farm.ownerId === newOwnerId)
        throw new BadRequestException(
          'Người dùng đã là quản lý trang trại này',
        );
      const owner = await tx.user.findUnique({
        where: { id: newOwnerId },
        select: { id: true, fullName: true, role: true, isActive: true },
      });
      if (!owner || owner.role !== Role.FARM_MANAGER || !owner.isActive)
        throw new BadRequestException(
          'Quản lý mới phải là Farm Manager đang hoạt động',
        );
      const membership = await tx.workspaceMember.findFirst({
        where: {
          workspaceId: farm.workspaceId,
          userId: newOwnerId,
          isActive: true,
        },
      });
      if (!membership)
        throw new BadRequestException(
          'Quản lý mới phải là thành viên đang hoạt động của cùng workspace',
        );
      const updatedFarm = await tx.farm.update({
        where: { id: farmId },
        data: { ownerId: newOwnerId },
        include: {
          owner: { select: { id: true, fullName: true, email: true } },
        },
      });
      await tx.adminAuditLog.create({
        data: {
          actorId: adminId,
          action: 'FARM_OWNERSHIP_TRANSFERRED',
          targetType: 'FARM',
          targetId: farmId,
          details: {
            farmName: farm.name,
            fromOwnerId: farm.ownerId,
            fromOwnerName: farm.owner.fullName,
            toOwnerId: owner.id,
            toOwnerName: owner.fullName,
          },
        },
      });
      return updatedFarm;
    });

    if (this.chatGroupsService) {
      await this.chatGroupsService.ensureFarmChatGroup(farmId);
    }

    return updated;
  }

  async getStaff(farmId: string, userId: string, role: string) {
    await this.findOne(farmId, userId, role);
    if (role !== 'ADMIN') {
      await this.farmAccess.assertCanManageFarm({ userId, role }, farmId);
    }

    return this.prisma.farmStaff.findMany({
      where: { farmId, isActive: true },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            fullName: true,
            role: true,
            phone: true,
          },
        },
      },
      orderBy: { assignedAt: 'desc' },
    });
  }

  async assignStaff(
    farmId: string,
    userIdToAssign: string,
    requesterId: string,
    role: string,
  ) {
    await this.farmAccess.assertCanManageFarm(
      { userId: requesterId, role },
      farmId,
    );
    void userIdToAssign;
    throw new BadRequestException(
      'Không thể gán nhân viên trực tiếp; vui lòng mời nhân viên qua email',
    );
  }

  async unassignStaff(
    farmId: string,
    userIdToUnassign: string,
    requesterId: string,
    role: string,
  ) {
    await this.farmAccess.assertCanManageFarm(
      { userId: requesterId, role },
      farmId,
    );

    const assignment = await this.prisma.farmStaff.findUnique({
      where: {
        farmId_userId: {
          farmId,
          userId: userIdToUnassign,
        },
      },
    });
    if (!assignment) {
      throw new NotFoundException(
        'Nhan su nay chua tung duoc phan cong vao trang trai',
      );
    }

    const removed = await this.prisma.farmStaff.delete({
      where: {
        farmId_userId: {
          farmId,
          userId: userIdToUnassign,
        },
      },
    });

    if (this.chatGroupsService) {
      await this.chatGroupsService.removeMemberFromFarmChatGroup(
        farmId,
        userIdToUnassign,
      );
    }

    return removed;
  }

  /** Thêm hoặc mời nhân sự qua email và tự động đồng bộ vào nhóm chat của trang trại. */
  async inviteStaffByEmail(
    farmId: string,
    email: string,
    role: 'FARMER' | 'TECHNICIAN',
    requesterId: string,
    requesterRole: string,
  ): Promise<{
    status: 'invited' | 'assigned';
    addedToChatGroup?: boolean;
    message: string;
    email: string;
  }> {
    const normalizedEmail = email?.trim().toLowerCase();
    if (
      !normalizedEmail ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)
    ) {
      throw new BadRequestException('Email nhân viên không hợp lệ');
    }
    if (role !== Role.FARMER && role !== Role.TECHNICIAN) {
      throw new BadRequestException('Vai trò lời mời không hợp lệ');
    }

    // 1. Kiểm tra quyền quản lý farm
    await this.farmAccess.assertCanManageFarm(
      { userId: requesterId, role: requesterRole },
      farmId,
    );

    // 2. Lấy thông tin farm + manager
    const farm = await this.prisma.farm.findUnique({
      where: { id: farmId },
      include: { owner: { select: { id: true, fullName: true, email: true } } },
    });
    if (!farm) throw new NotFoundException('Không tìm thấy trang trại');

    if (farm.owner?.email?.toLowerCase() === normalizedEmail) {
      throw new BadRequestException(
        'Không thể thêm chính chủ trang trại vào danh sách nhân sự',
      );
    }

    const managerName = farm.owner?.fullName ?? 'Quản lý trang trại';

    // 3. Tìm user theo email
    const existingUser = await this.prisma.user.findFirst({
      where: {
        email: { equals: normalizedEmail, mode: 'insensitive' },
      },
    });

    // Lấy URL frontend
    const frontendUrl =
      this.configService.get<string>('FRONTEND_URL') ?? 'http://localhost:5173';

    // Tạo JWT invite token (7 ngày)
    const inviteToken = await this.jwtService.signAsync(
      { email: normalizedEmail, farmId, role, type: 'farm_invite' },
      {
        secret: this.configService.get<string>('JWT_SECRET'),
        expiresIn: '7d',
      },
    );

    // ── NHÁNH A: User đã tồn tại ──
    if (existingUser) {
      if (existingUser.isActive === false) {
        throw new BadRequestException('Tài khoản nhân sự này đang bị khóa');
      }
      if (existingUser.id === farm.ownerId) {
        throw new BadRequestException(
          'Không thể thêm chính chủ trang trại vào danh sách nhân sự',
        );
      }
      if (
        existingUser.role === Role.ADMIN ||
        existingUser.role === Role.FARM_MANAGER
      ) {
        throw new BadRequestException(
          'Chỉ có thể thêm tài khoản Nông dân hoặc Kỹ thuật viên vào trang trại',
        );
      }

      if (this.prisma.farmStaff?.findUnique) {
        const existingStaff = await this.prisma.farmStaff.findUnique({
          where: {
            farmId_userId: { farmId: farm.id, userId: existingUser.id },
          },
        });
        if (existingStaff?.isActive) {
          throw new BadRequestException(
            'Thành viên này đã có trong trang trại và nhóm chat',
          );
        }
      }

      if (existingUser.role !== role && this.prisma.user?.update) {
        await this.prisma.user.update({
          where: { id: existingUser.id },
          data: { role },
        });
      }

      if (this.prisma.farmStaff?.upsert) {
        await this.prisma.farmStaff.upsert({
          where: {
            farmId_userId: { farmId: farm.id, userId: existingUser.id },
          },
          create: {
            farmId: farm.id,
            userId: existingUser.id,
            role,
            isActive: true,
          },
          update: {
            role,
            isActive: true,
          },
        });
      }

      if (farm.workspaceId && this.prisma.workspaceMember?.upsert) {
        await this.prisma.workspaceMember.upsert({
          where: {
            workspaceId_userId: {
              workspaceId: farm.workspaceId,
              userId: existingUser.id,
            },
          },
          create: {
            workspaceId: farm.workspaceId,
            userId: existingUser.id,
            role: WorkspaceRole.MEMBER,
            isActive: true,
          },
          update: { isActive: true },
        });
      }

      if (this.chatGroupsService) {
        await this.chatGroupsService.addMemberToFarmChatGroup(
          farm.id,
          existingUser.id,
          role,
          existingUser.fullName || existingUser.email,
        );
      }

      if (this.notificationsService?.createFarmJoinNotification) {
        await this.notificationsService.createFarmJoinNotification(
          existingUser.id,
          farm.id,
          farm.name,
          role,
        );
      }

      const inviteLink = `${frontendUrl}/login?inviteToken=${inviteToken}`;

      // Gửi email thông báo (fire & forget)
      void this.emailService.sendFarmInvitationExistingUser({
        toEmail: existingUser.email,
        toName: existingUser.fullName,
        farmName: farm.name,
        managerName,
        role,
        inviteLink,
      });

      return {
        status: 'assigned',
        addedToChatGroup: true,
        email: existingUser.email,
        message: `Đã thêm ${existingUser.fullName || existingUser.email} vào trang trại "${farm.name}" và tự động thêm vào nhóm chat.`,
      };
    }

    // ── NHÁNH B: User chưa tồn tại ──
    if (this.chatGroupsService) {
      await this.chatGroupsService.ensureFarmChatGroup(farm.id);
    }

    const inviteLink = `${frontendUrl}/register?inviteToken=${inviteToken}`;

    // Gửi email mời (fire & forget)
    void this.emailService.sendFarmInvitationNewUser({
      toEmail: normalizedEmail,
      farmName: farm.name,
      managerName,
      role,
      inviteLink,
      expiresInDays: 7,
    });

    return {
      status: 'invited',
      addedToChatGroup: false,
      email: normalizedEmail,
      message: `Đã gửi email mời tới ${normalizedEmail}. Khi đăng ký thành công, hệ thống sẽ tự động thêm vào trang trại và nhóm chat.`,
    };
  }
}
