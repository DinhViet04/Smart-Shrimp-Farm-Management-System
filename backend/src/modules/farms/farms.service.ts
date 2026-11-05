import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
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

@Injectable()
export class FarmsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly farmAccess: FarmAccessService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly emailService: EmailService,
    private readonly notificationsService: NotificationsService,
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

    const membership = await this.prisma.workspaceMember.findFirst({
      where: {
        workspaceId: data.workspaceId,
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
      where: { workspaceId: membership.workspaceId, name: data.name },
    });
    if (exists)
      throw new BadRequestException(
        'Tên trang trại đã tồn tại trong workspace',
      );

    const { ponds_count, staffIds, workspaceId, ...farmData } = data;
    void ponds_count;

    const farm = await this.prisma.farm.create({
      data: {
        ...farmData,
        ownerId: data.ownerId,
        workspaceId,
      },
    });

    void staffIds;

    // Thông báo realtime cho Manager
    if (farm.ownerId) {
      const owner = await this.prisma.user.findUnique({
        where: { id: farm.ownerId },
        select: { role: true },
      });
      if (owner?.role === 'FARM_MANAGER') {
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

    if (data.name) {
      const exists = await this.prisma.farm.findFirst({
        where: {
          name: data.name,
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
    return this.prisma.$transaction(async (tx) => {
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
      const updated = await tx.farm.update({
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
      return updated;
    });
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

    return this.prisma.farmStaff.delete({
      where: {
        farmId_userId: {
          farmId,
          userId: userIdToUnassign,
        },
      },
    });
  }

  /** Mời nhân sự qua email; tài khoản chỉ được thêm sau khi tự chấp nhận. */
  async inviteStaffByEmail(
    farmId: string,
    email: string,
    role: 'FARMER' | 'TECHNICIAN',
    requesterId: string,
    requesterRole: string,
  ): Promise<{
    status: 'invited';
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

    const managerName = farm.owner?.fullName ?? 'Quản lý trang trại';

    // 3. Tìm user theo email
    const existingUser = await this.prisma.user.findFirst({
      where: {
        email: { equals: normalizedEmail, mode: 'insensitive' },
        isActive: true,
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
        status: 'invited',
        email: existingUser.email,
        message: `Đã gửi lời mời tới ${existingUser.email}. Người nhận cần đăng nhập và chấp nhận để tham gia.`,
      };
    }

    // ── NHÁNH B: User chưa tồn tại ──
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
      email: normalizedEmail,
      message: `Đã gửi email mời tới ${normalizedEmail}. Người nhận cần đăng ký tài khoản để tham gia.`,
    };
  }
}
