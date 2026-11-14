import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
  Optional,
  ServiceUnavailableException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { ChatGroupType, Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import {
  AuthUser,
  FarmAccessService,
} from '../farm-access/farm-access.service.js';
import { NotificationsGateway } from '../notifications/notifications.gateway.js';

interface CachedSenderInfo {
  id: string;
  fullName: string;
  email: string;
  role: Role;
  avatarUrl: string | null;
}

interface CachedGroupMeta {
  id: string;
  type: ChatGroupType;
  farmId: string | null;
  farmDeletedAt: Date | null;
  workspaceStatus: string | null;
  memberIds: string[];
  memberSenders: Map<string, CachedSenderInfo>;
}

const GROUP_CACHE_TTL_MS = 60_000;

@Injectable()
export class ChatGroupsService implements OnModuleInit {
  private readonly logger = new Logger(ChatGroupsService.name);
  private readonly groupMetaCache = new Map<
    string,
    { meta: CachedGroupMeta; expiresAt: number }
  >();

  constructor(
    private readonly prisma: PrismaService,
    private readonly farmAccess: FarmAccessService,
    @Optional() private readonly notificationsGateway?: NotificationsGateway,
  ) {}

  private cacheGroupMeta(group: any): CachedGroupMeta {
    const memberSenders = new Map<string, CachedSenderInfo>();
    const memberIds: string[] = [];
    for (const m of group.members || []) {
      if (m.userId) memberIds.push(m.userId);
      if (m.user?.id) {
        memberSenders.set(m.user.id, {
          id: m.user.id,
          fullName: m.user.fullName,
          email: m.user.email,
          role: m.user.role,
          avatarUrl: m.user.avatarUrl ?? null,
        });
      }
    }
    const meta: CachedGroupMeta = {
      id: group.id,
      type: group.type || ChatGroupType.FARM_GROUP,
      farmId: group.farmId ?? null,
      farmDeletedAt: group.farm?.deletedAt ?? null,
      workspaceStatus: group.farm?.workspace?.status ?? null,
      memberIds,
      memberSenders,
    };
    const entry = { meta, expiresAt: Date.now() + GROUP_CACHE_TTL_MS };
    this.groupMetaCache.set(group.id, entry);
    if (group.farmId) {
      this.groupMetaCache.set(group.farmId, entry);
    }
    return meta;
  }

  private invalidateGroupCache(groupId?: string | null, farmId?: string | null) {
    if (groupId) this.groupMetaCache.delete(groupId);
    if (farmId) this.groupMetaCache.delete(farmId);
  }

  async onModuleInit() {
    this.notificationsGateway?.registerChatMessageHandler(
      async ({
        groupId,
        content,
        attachmentUrl,
        attachmentName,
        attachmentType,
        attachmentSize,
        replyToId,
        user,
      }) =>
        this.sendMessage(groupId, content, user, {
          asyncPersist: true,
          attachmentUrl,
          attachmentName,
          attachmentType,
          attachmentSize,
          replyToId,
        }),
    );
    this.notificationsGateway?.registerChatReceiptHandler(
      async ({ groupId, type, user }) =>
        this.markChatReceipt(groupId, user, type),
    );
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
      await this.prisma.$executeRawUnsafe(`
        DO $$ BEGIN
          CREATE TYPE "ChatGroupType" AS ENUM ('FARM_GROUP', 'DIRECT');
        EXCEPTION
          WHEN duplicate_object THEN null;
        END $$;
      `);
      await this.prisma.$executeRawUnsafe(`
        ALTER TABLE "chat_groups" ADD COLUMN IF NOT EXISTS "type" "ChatGroupType" NOT NULL DEFAULT 'FARM_GROUP';
      `);
      await this.prisma.$executeRawUnsafe(`
        ALTER TABLE "chat_groups" ADD COLUMN IF NOT EXISTS "direct_key" TEXT;
      `);
      await this.prisma.$executeRawUnsafe(`
        ALTER TABLE "chat_groups" ALTER COLUMN "farm_id" DROP NOT NULL;
      `);
      await this.prisma.$executeRawUnsafe(`
        CREATE UNIQUE INDEX IF NOT EXISTS "chat_groups_direct_key_key" ON "chat_groups"("direct_key");
      `);
      await this.prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "chat_groups_type_idx" ON "chat_groups"("type");
      `);
      await this.prisma.$executeRawUnsafe(`
        ALTER TABLE "chat_messages" ADD COLUMN IF NOT EXISTS "attachment_url" TEXT;
      `);
      await this.prisma.$executeRawUnsafe(`
        ALTER TABLE "chat_messages" ADD COLUMN IF NOT EXISTS "attachment_name" TEXT;
      `);
      await this.prisma.$executeRawUnsafe(`
        ALTER TABLE "chat_messages" ADD COLUMN IF NOT EXISTS "attachment_type" TEXT;
      `);
      await this.prisma.$executeRawUnsafe(`
        ALTER TABLE "chat_messages" ADD COLUMN IF NOT EXISTS "attachment_size" INTEGER;
      `);
      await this.prisma.$executeRawUnsafe(`
        ALTER TABLE "chat_messages" ADD COLUMN IF NOT EXISTS "reply_to_id" TEXT;
      `);
      await this.prisma.$executeRawUnsafe(`
        ALTER TABLE "chat_group_members" ADD COLUMN IF NOT EXISTS "last_delivered_at" TIMESTAMP(3);
      `);
      await this.prisma.$executeRawUnsafe(`
        ALTER TABLE "chat_group_members" ADD COLUMN IF NOT EXISTS "last_read_at" TIMESTAMP(3);
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

    // 1. Đảm bảo Quản lý trang trại (Owner) và toàn bộ nhân sự đang hoạt động có mặt trong nhóm (1 query)
    const membersToEnsure: Array<{
      groupId: string;
      userId: string;
      role: Role;
    }> = [
      {
        groupId: group.id,
        userId: farm.ownerId,
        role: Role.FARM_MANAGER,
      },
    ];
    for (const s of farm.staff || []) {
      if (s.userId && s.user?.isActive !== false && s.userId !== farm.ownerId) {
        membersToEnsure.push({
          groupId: group.id,
          userId: s.userId,
          role: s.role === Role.TECHNICIAN ? Role.TECHNICIAN : Role.FARMER,
        });
      }
    }
    await this.prisma.chatGroupMember.createMany({
      data: membersToEnsure,
      skipDuplicates: true,
    });

    // 3. Nếu nhóm mới được tạo lần đầu, tạo tin nhắn hệ thống chào mừng và thông báo realtime
    if (!existingGroup) {
      await this.prisma.chatMessage.create({
        data: {
          groupId: group.id,
          senderId: farm.ownerId,
          content: `🎉 Nhóm chat trang trại "${farm.name}" đã được khởi tạo tự động. Các thành viên được phân công vào trang trại sẽ tự động tham gia nhóm này.`,
          isSystem: true,
        },
      });

      const initialMemberIds = [
        farm.ownerId,
        ...(farm.staff || [])
          .filter((s) => s.userId && s.user?.isActive !== false)
          .map((s) => s.userId),
      ];
      this.notificationsGateway?.sendChatGroupUpdatedToUsers(initialMemberIds, {
        groupId: group.id,
        farmId: farm.id,
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
      this.invalidateGroupCache(group.id, farmId);
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
    this.invalidateGroupCache(group.id, farmId);
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

  private readonly groupInclude = {
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
      orderBy: { joinedAt: 'asc' as const },
    },
    messages: {
      orderBy: { createdAt: 'desc' as const },
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
  };

  private formatGroupItem(g: any) {
    this.cacheGroupMeta(g);
    return {
      id: g.id,
      type: g.type || ChatGroupType.FARM_GROUP,
      farmId: g.farmId,
      directKey: g.directKey ?? null,
      name: g.name,
      createdAt: g.createdAt,
      updatedAt: g.updatedAt,
      farm: g.farm ?? null,
      memberCount: g.members.length,
      _count: {
        members: g.members.length,
      },
      members: g.members.map((m: any) => ({
        id: m.id,
        userId: m.userId,
        role: m.role,
        joinedAt: m.joinedAt,
        lastDeliveredAt: m.lastDeliveredAt ?? null,
        lastReadAt: m.lastReadAt ?? null,
        user: m.user,
      })),
      messages: g.messages,
      lastMessage: g.messages[0] || null,
    };
  }

  /**
   * Tạo hoặc lấy cuộc trò chuyện riêng 1-1 giữa 2 thành viên cùng trang trại
   */
  async createOrGetDirectGroup(targetUserId: string, user: AuthUser) {
    const cleanTargetId = targetUserId?.trim();
    if (!cleanTargetId) {
      throw new BadRequestException('Vui lòng chọn người nhận tin nhắn riêng');
    }
    if (cleanTargetId === user.userId) {
      throw new BadRequestException(
        'Không thể tự nhắn tin riêng cho chính mình',
      );
    }

    const [currentUser, targetUser] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: user.userId },
        select: { id: true, role: true, isActive: true },
      }),
      this.prisma.user.findUnique({
        where: { id: cleanTargetId },
        select: { id: true, fullName: true, role: true, isActive: true },
      }),
    ]);

    if (!targetUser || !targetUser.isActive) {
      throw new NotFoundException(
        'Không tìm thấy người dùng để nhắn tin riêng',
      );
    }

    if (user.role !== Role.ADMIN) {
      const sharedFarm = await this.prisma.farm.findFirst({
        where: {
          deletedAt: null,
          AND: [
            {
              OR: [
                { ownerId: user.userId },
                { staff: { some: { userId: user.userId, isActive: true } } },
              ],
            },
            {
              OR: [
                { ownerId: cleanTargetId },
                { staff: { some: { userId: cleanTargetId, isActive: true } } },
              ],
            },
          ],
        },
        select: { id: true },
      });

      if (!sharedFarm) {
        throw new ForbiddenException(
          'Chỉ có thể nhắn riêng với thành viên cùng trang trại',
        );
      }
    }

    const directKey = [user.userId, cleanTargetId].sort().join(':');

    let group: any = await this.prisma.chatGroup.findUnique({
      where: { directKey },
      include: this.groupInclude,
    });

    const isNew = !group;
    if (!group) {
      group = await this.prisma.chatGroup.create({
        data: {
          type: ChatGroupType.DIRECT,
          directKey,
          name: targetUser.fullName || 'Tin nhắn riêng',
          members: {
            create: [
              {
                userId: user.userId,
                role: (currentUser?.role || user.role) as Role,
              },
              {
                userId: cleanTargetId,
                role: targetUser.role,
              },
            ],
          },
        },
        include: this.groupInclude,
      });
    }

    if (isNew) {
      this.notificationsGateway?.sendChatGroupUpdatedToUsers(
        [user.userId, cleanTargetId],
        {
          groupId: group.id,
          farmId: null,
        },
      );
    }

    return this.formatGroupItem(group);
  }

  /**
   * Lấy danh sách các nhóm chat trang trại và tin nhắn riêng của người dùng hiện tại
   */
  async findMyGroups(user: AuthUser, workspaceId?: string) {
    const accessibleFarmIds = await this.farmAccess.getAccessibleFarmIds(user);

    const farmWhere: any = {
      deletedAt: null,
      ...(workspaceId ? { workspaceId } : {}),
      ...(Array.isArray(accessibleFarmIds)
        ? { id: { in: accessibleFarmIds } }
        : {}),
    };

    const farms = await this.prisma.farm.findMany({
      where: farmWhere,
      select: { id: true },
      orderBy: { createdAt: 'desc' },
    });

    // Chỉ khởi tạo nhóm chat cho các trang trại chưa có nhóm (tránh N+1 query mỗi lần tải danh sách)
    const farmIds = farms.map((f) => f.id);
    if (farmIds.length > 0) {
      const existingGroups = await this.prisma.chatGroup.findMany({
        where: { farmId: { in: farmIds } },
        select: { farmId: true },
      });
      const existingFarmIdSet = new Set(existingGroups.map((g) => g.farmId));
      const missingFarmIds = farmIds.filter((id) => !existingFarmIdSet.has(id));
      if (missingFarmIds.length > 0) {
        await Promise.all(
          missingFarmIds.map((farmId) => this.ensureFarmChatGroup(farmId)),
        );
      }
    }

    const orFilters: any[] = [
      {
        type: ChatGroupType.DIRECT,
        members: { some: { userId: user.userId } },
      },
    ];

    if (farms.length > 0) {
      orFilters.push({
        farmId: { in: farms.map((f) => f.id) },
      });
    }

    const groups = await this.prisma.chatGroup.findMany({
      where: {
        OR: orFilters,
      },
      include: this.groupInclude,
      orderBy: { updatedAt: 'desc' },
    });

    // Đánh dấu đã nhận (delivered) ở nền cho các nhóm của user khi tải danh sách
    const now = new Date();
    void this.prisma.chatGroupMember
      .updateMany({
        where: { userId: user.userId },
        data: { lastDeliveredAt: now },
      })
      .then(() => {
        for (const g of groups) {
          const memberIds = g.members.map((m: any) => m.userId);
          this.notificationsGateway?.sendChatReceiptToUsers(memberIds, {
            groupId: g.id,
            userId: user.userId,
            lastDeliveredAt: now.toISOString(),
          });
        }
      })
      .catch(() => {});

    const formatted = groups.map((g) => this.formatGroupItem(g));
    return formatted.sort((a, b) => {
      const timeA = new Date(
        a.lastMessage?.createdAt || a.updatedAt || a.createdAt,
      ).getTime();
      const timeB = new Date(
        b.lastMessage?.createdAt || b.updatedAt || b.createdAt,
      ).getTime();
      return timeB - timeA;
    });
  }

  /**
   * Lấy lịch sử tin nhắn của một nhóm chat hoặc cuộc trò chuyện riêng
   */
  async getGroupMessages(groupIdOrFarmId: string, user: AuthUser) {
    let group = await this.prisma.chatGroup.findFirst({
      where: {
        OR: [{ id: groupIdOrFarmId }, { farmId: groupIdOrFarmId }],
      },
      include: {
        members: { select: { userId: true } },
      },
    });

    if (!group) {
      // Thử khởi tạo nếu groupIdOrFarmId là farmId hợp lệ
      await this.farmAccess.assertCanAccessFarm(user, groupIdOrFarmId);
      const ensured = await this.ensureFarmChatGroup(groupIdOrFarmId);
      group = { ...ensured, members: [] };
    } else {
      const isMember = group.members.some((m) => m.userId === user.userId);
      if (group.type === ChatGroupType.DIRECT) {
        if (!isMember && user.role !== Role.ADMIN) {
          throw new ForbiddenException(
            'Bạn không có quyền xem cuộc trò chuyện riêng tư này',
          );
        }
      } else if (!isMember && user.role !== Role.ADMIN && group.farmId) {
        await this.farmAccess.assertCanAccessFarm(user, group.farmId);
      }
    }

    // Đánh dấu đã xem ở nền khi mở xem lịch sử tin nhắn
    void this.markChatReceipt(group.id, user, 'READ').catch(() => {});

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
        replyTo: {
          select: {
            id: true,
            content: true,
            attachmentName: true,
            attachmentType: true,
            senderId: true,
            sender: {
              select: {
                id: true,
                fullName: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
      take: 200,
    });
  }

  /**
   * Cập nhật trạng thái Đã nhận / Đã xem của thành viên trong nhóm chat và phát realtime
   */
  async markChatReceipt(
    groupIdOrFarmId: string,
    user: AuthUser,
    type: 'DELIVERED' | 'READ',
  ) {
    const meta = await this.resolveAuthorizedGroupMeta(groupIdOrFarmId, user);
    const now = new Date();
    const data =
      type === 'READ'
        ? { lastDeliveredAt: now, lastReadAt: now }
        : { lastDeliveredAt: now };

    await this.prisma.chatGroupMember.updateMany({
      where: { groupId: meta.id, userId: user.userId },
      data,
    });

    const receiptPayload = {
      groupId: meta.id,
      userId: user.userId,
      lastDeliveredAt: now.toISOString(),
      ...(type === 'READ' ? { lastReadAt: now.toISOString() } : {}),
    };

    this.notificationsGateway?.sendChatReceiptToUsers(
      meta.memberIds,
      receiptPayload,
    );

    return receiptPayload;
  }

  private async resolveAuthorizedGroupMeta(
    groupIdOrFarmId: string,
    user: AuthUser,
  ): Promise<CachedGroupMeta> {
    const cachedEntry = this.groupMetaCache.get(groupIdOrFarmId);
    let meta: CachedGroupMeta | null =
      cachedEntry && cachedEntry.expiresAt > Date.now()
        ? cachedEntry.meta
        : null;

    if (!meta) {
      const group = await this.prisma.chatGroup.findFirst({
        where: {
          OR: [{ id: groupIdOrFarmId }, { farmId: groupIdOrFarmId }],
        },
        include: {
          farm: {
            select: {
              id: true,
              deletedAt: true,
              workspace: { select: { status: true } },
            },
          },
          members: {
            select: {
              userId: true,
              user: {
                select: {
                  id: true,
                  fullName: true,
                  email: true,
                  role: true,
                  avatarUrl: true,
                },
              },
            },
          },
        },
      });

      if (!group) {
        throw new NotFoundException('Không tìm thấy cuộc trò chuyện');
      }

      meta = this.cacheGroupMeta(group);
    }

    if (meta.type !== ChatGroupType.DIRECT) {
      if (meta.farmDeletedAt) {
        throw new NotFoundException('Không tìm thấy nhóm chat trang trại');
      }

      if (
        user.role !== Role.ADMIN &&
        meta.workspaceStatus &&
        meta.workspaceStatus !== 'ACTIVE'
      ) {
        throw new ForbiddenException('Không gian làm việc không còn hoạt động');
      }
    }

    const isMember = meta.memberIds.includes(user.userId);
    if (!isMember && user.role !== Role.ADMIN) {
      throw new ForbiddenException(
        'Bạn không phải là thành viên của cuộc trò chuyện này',
      );
    }

    return meta;
  }

  /**
   * Tải ảnh hoặc tài liệu (PDF/Word/Excel) lên Supabase Storage
   */
  async uploadAttachment(
    groupIdOrFarmId: string,
    file:
      | {
          originalname: string;
          mimetype: string;
          size: number;
          buffer: Buffer;
        }
      | undefined,
    user: AuthUser,
  ) {
    if (!file || !file.buffer) {
      throw new BadRequestException('Vui lòng chọn tệp hoặc hình ảnh cần gửi');
    }

    if (file.size > 10 * 1024 * 1024) {
      throw new BadRequestException('Dung lượng tệp tối đa là 10MB');
    }

    const allowedMimeTypes = new Set([
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/csv',
      'text/plain',
    ]);
    const allowedExt = /\.(jpe?g|png|webp|gif|pdf|docx?|xlsx?|csv|txt)$/i;

    if (
      !allowedMimeTypes.has(file.mimetype) &&
      !allowedExt.test(file.originalname || '')
    ) {
      throw new BadRequestException(
        'Chỉ hỗ trợ ảnh (JPG, PNG, WEBP, GIF) và tài liệu (PDF, Word, Excel, CSV, TXT)',
      );
    }

    const meta = await this.resolveAuthorizedGroupMeta(groupIdOrFarmId, user);

    const rawSupabaseUrl = process.env.SUPABASE_URL?.trim();
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
    const bucket =
      process.env.SUPABASE_STORAGE_BUCKET?.trim() || 'chat-attachments';

    if (!rawSupabaseUrl || !serviceKey) {
      throw new ServiceUnavailableException(
        'Chưa cấu hình SUPABASE_URL hoặc SUPABASE_SERVICE_ROLE_KEY trên server để tải tệp.',
      );
    }

    let supabaseUrl: string;
    try {
      const normalizedInput = /^https?:\/\//i.test(rawSupabaseUrl)
        ? rawSupabaseUrl
        : `https://${rawSupabaseUrl}`;
      const parsed = new URL(normalizedInput);
      const dashboardMatch = parsed.pathname.match(/\/project\/([a-z0-9]+)/i);
      if (parsed.hostname === 'supabase.com' && dashboardMatch?.[1]) {
        supabaseUrl = `https://${dashboardMatch[1]}.supabase.co`;
      } else {
        supabaseUrl = parsed.origin.replace('.storage.supabase.co', '.supabase.co');
      }
    } catch {
      throw new ServiceUnavailableException(
        'SUPABASE_URL trong backend/.env không hợp lệ (cần dạng https://<project-ref>.supabase.co).',
      );
    }

    const safeName = (file.originalname || 'file')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9._-]/g, '_');
    const objectPath = `${meta.id}/${Date.now()}-${randomUUID().slice(0, 8)}-${safeName}`;
    const encodedPath = objectPath
      .split('/')
      .map((seg) => encodeURIComponent(seg))
      .join('/');
    const uploadUrl = `${supabaseUrl}/storage/v1/object/${encodeURIComponent(bucket)}/${encodedPath}`;

    const doUpload = async () =>
      fetch(uploadUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${serviceKey}`,
          apikey: serviceKey,
          'Content-Type': file.mimetype || 'application/octet-stream',
          'x-upsert': 'true',
        },
        body: new Uint8Array(file.buffer),
      });

    let res = await doUpload();
    if (!res.ok && (res.status === 404 || res.status === 400)) {
      const errText = await res.text();
      if (errText.toLowerCase().includes('bucket')) {
        await fetch(`${supabaseUrl}/storage/v1/bucket`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${serviceKey}`,
            apikey: serviceKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ id: bucket, name: bucket, public: true }),
        });
        res = await doUpload();
      } else {
        throw new ServiceUnavailableException(
          `Không thể tải tệp lên Supabase Storage: ${errText}`,
        );
      }
    }

    if (!res.ok) {
      const errText = await res.text();
      throw new ServiceUnavailableException(
        `Không thể tải tệp lên Supabase Storage (${res.status}): ${errText}`,
      );
    }

    const attachmentUrl = `${supabaseUrl}/storage/v1/object/public/${encodeURIComponent(bucket)}/${encodedPath}`;

    return {
      attachmentUrl,
      attachmentName: file.originalname || safeName,
      attachmentType: file.mimetype || 'application/octet-stream',
      attachmentSize: file.size,
    };
  }

  /**
   * Gửi tin nhắn với cache in-memory + phát Socket.IO ngay trước khi ghi DB
   */
  async sendMessage(
    groupIdOrFarmId: string,
    content: string,
    user: AuthUser,
    options?: {
      asyncPersist?: boolean;
      attachmentUrl?: string;
      attachmentName?: string;
      attachmentType?: string;
      attachmentSize?: number;
      replyToId?: string;
    },
  ) {
    const trimmed = content?.trim() || '';
    const attachmentUrl = options?.attachmentUrl?.trim() || null;

    if (!trimmed && !attachmentUrl) {
      throw new BadRequestException('Nội dung tin nhắn không được để trống');
    }
    if (trimmed.length > 2000) {
      throw new BadRequestException(
        'Nội dung tin nhắn không được vượt quá 2000 ký tự',
      );
    }

    const meta = await this.resolveAuthorizedGroupMeta(groupIdOrFarmId, user);

    let replyTo: {
      id: string;
      content: string;
      attachmentName: string | null;
      attachmentType: string | null;
      senderId: string | null;
      sender: { id: string; fullName: string } | null;
    } | null = null;
    const rawReplyId = options?.replyToId?.trim();
    if (rawReplyId) {
      replyTo = await this.prisma.chatMessage.findFirst({
        where: { id: rawReplyId, groupId: meta.id },
        select: {
          id: true,
          content: true,
          attachmentName: true,
          attachmentType: true,
          senderId: true,
          sender: {
            select: {
              id: true,
              fullName: true,
            },
          },
        },
      });
    }

    const attachmentData = {
      attachmentUrl,
      attachmentName: options?.attachmentName?.trim() || null,
      attachmentType: options?.attachmentType?.trim() || null,
      attachmentSize:
        typeof options?.attachmentSize === 'number'
          ? options.attachmentSize
          : null,
      replyToId: replyTo?.id || null,
    };

    const cachedSender = meta.memberSenders.get(user.userId);
    const messageId = randomUUID();
    const createdAt = new Date();

    if (cachedSender) {
      const instantMessage = {
        id: messageId,
        groupId: meta.id,
        senderId: user.userId,
        content: trimmed,
        ...attachmentData,
        replyTo,
        isSystem: false,
        createdAt,
        sender: cachedSender,
      };

      // Phát ngay qua WebSocket cho tất cả thành viên trước khi chờ Supabase ghi xong
      this.notificationsGateway?.sendChatMessageToUsers(meta.memberIds, {
        ...instantMessage,
        farmId: meta.farmId,
      });

      const persistPromise = this.prisma.chatMessage
        .create({
          data: {
            id: messageId,
            groupId: meta.id,
            senderId: user.userId,
            content: trimmed,
            ...attachmentData,
            isSystem: false,
            createdAt,
          },
        })
        .then(() => {
          void this.prisma.chatGroup
            .update({
              where: { id: meta.id },
              data: { updatedAt: createdAt },
            })
            .catch(() => {});
        });

      if (options?.asyncPersist) {
        void persistPromise.catch((err) => {
          this.logger.error(`Async chatMessage persist failed: ${err}`);
        });
        return instantMessage;
      }

      await persistPromise;
      return instantMessage;
    }

    const message = await this.prisma.chatMessage.create({
      data: {
        id: messageId,
        groupId: meta.id,
        senderId: user.userId,
        content: trimmed,
        ...attachmentData,
        isSystem: false,
        createdAt,
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
        replyTo: {
          select: {
            id: true,
            content: true,
            attachmentName: true,
            attachmentType: true,
            senderId: true,
            sender: {
              select: {
                id: true,
                fullName: true,
              },
            },
          },
        },
      },
    });

    void this.prisma.chatGroup
      .update({
        where: { id: meta.id },
        data: { updatedAt: createdAt },
      })
      .catch(() => {});

    this.notificationsGateway?.sendChatMessageToUsers(meta.memberIds, {
      ...message,
      farmId: meta.farmId,
    });

    return message;
  }
}

