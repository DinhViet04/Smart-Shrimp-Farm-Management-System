import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
  Optional,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import {
  AuthUser,
  FarmAccessService,
} from '../farm-access/farm-access.service.js';
import { NotificationsGateway } from '../notifications/notifications.gateway.js';

@Injectable()
export class ChatGroupsService implements OnModuleInit {
  private readonly logger = new Logger(ChatGroupsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly farmAccess: FarmAccessService,
    @Optional() private readonly notificationsGateway?: NotificationsGateway,
  ) {}

  async onModuleInit() {
    if (typeof (this.prisma as any).$executeRawUnsafe !== 'function') return;
    try {
      await this.prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "chat_groups" (
          "id" TEXT NOT NULL,
          "farm_id" TEXT NOT NULL,
          "name" TEXT NOT NULL,
          "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "chat_groups_pkey" PRIMARY KEY ("id")
        );
      `);
      await this.prisma.$executeRawUnsafe(`
        CREATE UNIQUE INDEX IF NOT EXISTS "chat_groups_farm_id_key" ON "chat_groups"("farm_id");
      `);
      await this.prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "chat_group_members" (
          "id" TEXT NOT NULL,
          "group_id" TEXT NOT NULL,
          "user_id" TEXT NOT NULL,
          "role" "Role" NOT NULL DEFAULT 'FARMER',
          "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "chat_group_members_pkey" PRIMARY KEY ("id")
        );
      `);
      await this.prisma.$executeRawUnsafe(`
        CREATE UNIQUE INDEX IF NOT EXISTS "chat_group_members_group_id_user_id_key" ON "chat_group_members"("group_id", "user_id");
      `);
      await this.prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "chat_group_members_user_id_idx" ON "chat_group_members"("user_id");
      `);
      await this.prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "chat_messages" (
          "id" TEXT NOT NULL,
          "group_id" TEXT NOT NULL,
          "sender_id" TEXT,
          "content" TEXT NOT NULL,
          "is_system" BOOLEAN NOT NULL DEFAULT false,
          "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id")
        );
      `);
      await this.prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "chat_messages_group_id_created_at_idx" ON "chat_messages"("group_id", "created_at");
      `);
    } catch (err) {
      this.logger.warn(`ChatGroup table initialization skipped: ${err}`);
    }
  }

  /**
   * Tự động khởi tạo hoặc đồng bộ nhóm chat cho một Trang trại (Farm),
   * đảm bảo Chủ trại (Manager) và toàn bộ nhân sự đang hoạt động (Farmer, Technician)
   * đều có mặt trong nhóm chat.
   */
  async ensureFarmChatGroup(farmId: string) {
    if (!farmId?.trim()) {
      throw new BadRequestException('Mã trang trại (farmId) không hợp lệ');
    }

    const farm = await this.prisma.farm.findFirst({
      where: { id: farmId, deletedAt: null },
      include: {
        owner: {
          select: {
            id: true,
            fullName: true,
            email: true,
            role: true,
            isActive: true,
          },
        },
        staff: {
          where: { isActive: true },
          include: {
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
        },
      },
    });

    if (!farm) {
      throw new NotFoundException('Không tìm thấy trang trại để tạo nhóm chat');
    }

    if (!farm.name?.trim()) {
      throw new BadRequestException('Tên trang trại không hợp lệ khi tạo nhóm chat');
    }

    if (!farm.ownerId) {
      throw new BadRequestException('Trang trại chưa có chủ quản lý hợp lệ');
    }

    const existingGroup = await this.prisma.chatGroup.findUnique({
      where: { farmId: farm.id },
    });

    const group = await this.prisma.chatGroup.upsert({
      where: { farmId: farm.id },
      create: {
        farmId: farm.id,
        name: farm.name.trim(),
      },
      update: {
        name: farm.name.trim(),
      },
    });

    // 1. Đảm bảo Quản lý trang trại (Owner) luôn ở trong nhóm
    await this.prisma.chatGroupMember.upsert({
      where: {
        groupId_userId: {
          groupId: group.id,
          userId: farm.ownerId,
        },
      },
      create: {
        groupId: group.id,
        userId: farm.ownerId,
        role: Role.FARM_MANAGER,
      },
      update: {
        role: Role.FARM_MANAGER,
      },
    });

    // 2. Đồng bộ toàn bộ nhân sự đang hoạt động của trang trại vào nhóm chat
    for (const s of farm.staff || []) {
      if (s.userId && s.user?.isActive !== false) {
        const staffRole =
          s.role === Role.TECHNICIAN ? Role.TECHNICIAN : Role.FARMER;
        await this.prisma.chatGroupMember.upsert({
          where: {
            groupId_userId: {
              groupId: group.id,
              userId: s.userId,
            },
          },
          create: {
            groupId: group.id,
            userId: s.userId,
            role: staffRole,
          },
          update: {
            role: staffRole,
          },
        });
      }
    }

    // 3. Nếu nhóm mới được tạo lần đầu, tạo tin nhắn hệ thống chào mừng
    if (!existingGroup) {
      await this.prisma.chatMessage.create({
        data: {
          groupId: group.id,
          senderId: farm.ownerId,
          content: `🎉 Nhóm chat trang trại "${farm.name}" đã được khởi tạo tự động. Các thành viên được phân công vào trang trại sẽ tự động tham gia nhóm này.`,
          isSystem: true,
        },
      });
    }

    return group;
  }

  /**
   * Tự động thêm thành viên vào nhóm chat của trang trại sau khi thêm vào FarmStaff
   */
  async addMemberToFarmChatGroup(
    farmId: string,
    userId: string,
    role: Role,
    memberDisplayName?: string,
  ) {
    if (!farmId || !userId) {
      throw new BadRequestException(
        'Thiếu thông tin trang trại hoặc người dùng khi thêm vào nhóm chat',
      );
    }
    if (
      role !== Role.FARMER &&
      role !== Role.TECHNICIAN &&
      role !== Role.FARM_MANAGER
    ) {
      throw new BadRequestException(
        'Vai trò thành viên nhóm chat không hợp lệ',
      );
    }

    const group = await this.ensureFarmChatGroup(farmId);

    const existingMember = await this.prisma.chatGroupMember.findUnique({
      where: {
        groupId_userId: {
          groupId: group.id,
          userId,
        },
      },
    });

    const member = await this.prisma.chatGroupMember.upsert({
      where: {
        groupId_userId: {
          groupId: group.id,
          userId,
        },
      },
      create: {
        groupId: group.id,
        userId,
        role,
      },
      update: {
        role,
      },
    });

    if (!existingMember) {
      const roleLabel =
        role === Role.TECHNICIAN
          ? 'Kỹ thuật viên'
          : role === Role.FARM_MANAGER
            ? 'Quản lý trang trại'
            : 'Nông dân';
      const sysMsg = await this.prisma.chatMessage.create({
        data: {
          groupId: group.id,
          senderId: userId,
          content: `👋 ${memberDisplayName || 'Thành viên mới'} (${roleLabel}) đã được tự động thêm vào nhóm chat trang trại.`,
          isSystem: true,
        },
        include: {
          sender: {
            select: {
              id: true,
              fullName: true,
              email: true,
              role: true,
              avatarUrl: true,
            },
          },
        },
      });

      const allMembers = await this.prisma.chatGroupMember.findMany({
        where: { groupId: group.id },
        select: { userId: true },
      });
      const memberIds = allMembers.map((m) => m.userId);
      this.notificationsGateway?.sendChatMessageToUsers(memberIds, {
        ...sysMsg,
        farmId,
      });
      this.notificationsGateway?.sendChatGroupUpdatedToUsers(memberIds, {
        groupId: group.id,
        farmId,
      });
    }

    return member;
  }

  /**
   * Tự động gỡ thành viên khỏi nhóm chat khi gỡ khỏi trang trại
   */
  async removeMemberFromFarmChatGroup(
    farmId: string,
    userId: string,
    memberDisplayName?: string,
  ) {
    const group = await this.prisma.chatGroup.findUnique({
      where: { farmId },
    });
    if (!group) return;

    const existing = await this.prisma.chatGroupMember.findUnique({
      where: {
        groupId_userId: {
          groupId: group.id,
          userId,
        },
      },
    });
    if (!existing) return;

    await this.prisma.chatGroupMember.delete({
      where: {
        groupId_userId: {
          groupId: group.id,
          userId,
        },
      },
    });

    const sysMsg = await this.prisma.chatMessage.create({
      data: {
        groupId: group.id,
        content: `📤 ${memberDisplayName || 'Một thành viên'} đã được gỡ khỏi trang trại và rời nhóm chat.`,
        isSystem: true,
      },
    });

    const remainingMembers = await this.prisma.chatGroupMember.findMany({
      where: { groupId: group.id },
      select: { userId: true },
    });
    const notifyIds = [...remainingMembers.map((m) => m.userId), userId];
    this.notificationsGateway?.sendChatMessageToUsers(notifyIds, {
      ...sysMsg,
      farmId,
    });
    this.notificationsGateway?.sendChatGroupUpdatedToUsers(notifyIds, {
      groupId: group.id,
      farmId,
    });
  }

  /**
   * Lấy danh sách các nhóm chat trang trại của người dùng hiện tại
   */
  async findMyGroups(user: AuthUser, workspaceId?: string) {
    const accessibleFarmIds = await this.farmAccess.getAccessibleFarmIds(user);

    const farmWhere: any = {
      deletedAt: null,
      ...(workspaceId ? { workspaceId } : {}),
      ...(accessibleFarmIds !== null ? { id: { in: accessibleFarmIds } } : {}),
    };

    const farms = await this.prisma.farm.findMany({
      where: farmWhere,
      select: { id: true },
      orderBy: { createdAt: 'desc' },
    });

    // Đồng bộ đảm bảo mỗi trang trại đều có nhóm chat và đủ thành viên
    for (const f of farms) {
      await this.ensureFarmChatGroup(f.id);
    }

    const groups = await this.prisma.chatGroup.findMany({
      where: {
        farmId: { in: farms.map((f) => f.id) },
      },
      include: {
        farm: {
          select: {
            id: true,
            name: true,
            address: true,
            area: true,
            status: true,
            ownerId: true,
            farmingModel: true,
            workspaceId: true,
          },
        },
        members: {
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
                email: true,
                role: true,
                phone: true,
                avatarUrl: true,
              },
            },
          },
          orderBy: { joinedAt: 'asc' },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: {
            sender: {
              select: {
                id: true,
                fullName: true,
                email: true,
                role: true,
              },
            },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return groups.map((g) => ({
      id: g.id,
      farmId: g.farmId,
      name: g.name,
      createdAt: g.createdAt,
      updatedAt: g.updatedAt,
      farm: g.farm,
      memberCount: g.members.length,
      members: g.members.map((m) => ({
        id: m.id,
        userId: m.userId,
        role: m.role,
        joinedAt: m.joinedAt,
        user: m.user,
      })),
      lastMessage: g.messages[0] || null,
    }));
  }

  /**
   * Lấy lịch sử tin nhắn của một nhóm chat
   */
  async getGroupMessages(groupIdOrFarmId: string, user: AuthUser) {
    let group = await this.prisma.chatGroup.findUnique({
      where: { id: groupIdOrFarmId },
    });

    if (!group) {
      group = await this.prisma.chatGroup.findUnique({
        where: { farmId: groupIdOrFarmId },
      });
    }

    if (!group) {
      // Thử khởi tạo nếu groupIdOrFarmId là farmId hợp lệ
      await this.farmAccess.assertCanAccessFarm(user, groupIdOrFarmId);
      group = await this.ensureFarmChatGroup(groupIdOrFarmId);
    } else {
      await this.farmAccess.assertCanAccessFarm(user, group.farmId);
    }

    return this.prisma.chatMessage.findMany({
      where: { groupId: group.id },
      include: {
        sender: {
          select: {
            id: true,
            fullName: true,
            email: true,
            role: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
      take: 200,
    });
  }

  /**
   * Gửi tin nhắn vào nhóm chat của trang trại
   */
  async sendMessage(groupIdOrFarmId: string, content: string, user: AuthUser) {
    const trimmed = content?.trim();
    if (!trimmed) {
      throw new BadRequestException('Nội dung tin nhắn không được để trống');
    }
    if (trimmed.length > 2000) {
      throw new BadRequestException(
        'Nội dung tin nhắn không được vượt quá 2000 ký tự',
      );
    }

    let group = await this.prisma.chatGroup.findUnique({
      where: { id: groupIdOrFarmId },
    });

    if (!group) {
      group = await this.prisma.chatGroup.findUnique({
        where: { farmId: groupIdOrFarmId },
      });
    }

    if (!group) {
      throw new NotFoundException('Không tìm thấy nhóm chat trang trại');
    }

    // Kiểm tra quyền truy cập trang trại và tư cách thành viên trong nhóm
    await this.farmAccess.assertCanAccessFarm(user, group.farmId);

    const isMember = await this.prisma.chatGroupMember.findUnique({
      where: {
        groupId_userId: {
          groupId: group.id,
          userId: user.userId,
        },
      },
    });

    if (!isMember && user.role !== Role.ADMIN) {
      throw new ForbiddenException(
        'Bạn không phải là thành viên của nhóm chat trang trại này',
      );
    }

    const [message] = await Promise.all([
      this.prisma.chatMessage.create({
        data: {
          groupId: group.id,
          senderId: user.userId,
          content: trimmed,
          isSystem: false,
        },
        include: {
          sender: {
            select: {
              id: true,
              fullName: true,
              email: true,
              role: true,
              avatarUrl: true,
            },
          },
        },
      }),
      this.prisma.chatGroup.update({
        where: { id: group.id },
        data: { updatedAt: new Date() },
      }),
    ]);

    const allMembers = await this.prisma.chatGroupMember.findMany({
      where: { groupId: group.id },
      select: { userId: true },
    });
    const memberIds = allMembers.map((m) => m.userId);
    this.notificationsGateway?.sendChatMessageToUsers(memberIds, {
      ...message,
      farmId: group.farmId,
    });

    return message;
  }
}

