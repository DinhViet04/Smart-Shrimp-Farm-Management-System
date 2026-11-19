import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { NotificationsGateway } from '../notifications/notifications.gateway.js';
import {
  DATA_CHANGED_EVENT,
  DataChangedEvent,
  RELATED_RESOURCES,
  RealtimeAction,
  RealtimeResource,
} from './realtime.types.js';

export type RealtimeAudience =
  /** Mọi người có quyền với trang trại (chủ + nhân sự) và admin. */
  | { kind: 'farm'; farmId: string }
  /** Thành viên của workspace và admin. */
  | { kind: 'workspace'; workspaceId: string }
  /** Những người làm cùng workspace với người thực hiện (fallback). */
  | { kind: 'actor-scope'; actorId: string }
  /** Chỉ những người dùng được chỉ định. */
  | { kind: 'users'; userIds: string[]; includeAdmins?: boolean }
  /** Toàn bộ người dùng đang kết nối. */
  | { kind: 'all' };

export interface PublishInput {
  resource: RealtimeResource;
  action: RealtimeAction;
  audience: RealtimeAudience;
  farmId?: string | null;
  entityId?: string | null;
  actorId?: string | null;
  /** Người dùng bổ sung luôn nhận sự kiện (vd: nhân sự vừa bị gỡ khỏi trại). */
  extraUserIds?: string[];
}

const isUuidLike = (value: unknown): value is string =>
  typeof value === 'string' && value.length >= 8 && value.length <= 64;

@Injectable()
export class RealtimeService {
  private readonly logger = new Logger(RealtimeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: NotificationsGateway,
  ) {}

  /**
   * Phát sự kiện `dataChanged`. Không bao giờ ném lỗi — realtime là
   * best-effort và không được ảnh hưởng tới nghiệp vụ chính.
   */
  async publish(input: PublishInput): Promise<void> {
    try {
      const resources = Array.from(
        new Set<RealtimeResource>([
          input.resource,
          ...(RELATED_RESOURCES[input.resource] ?? []),
        ]),
      );
      const event: DataChangedEvent = {
        resource: input.resource,
        resources,
        action: input.action,
        farmId: input.farmId ?? null,
        entityId: input.entityId ?? null,
        actorId: input.actorId ?? null,
        at: new Date().toISOString(),
      };

      if (input.audience.kind === 'all') {
        this.gateway.emitToAll(DATA_CHANGED_EVENT, event);
        return;
      }

      const { userIds, includeAdmins } = await this.resolveAudience(
        input.audience,
      );
      const recipients = [
        ...userIds,
        ...(input.extraUserIds ?? []),
        ...(input.actorId ? [input.actorId] : []),
      ];
      this.gateway.emitToUsers(recipients, DATA_CHANGED_EVENT, event, {
        includeAdmins,
      });
    } catch (err: any) {
      this.logger.warn(
        `Không thể phát sự kiện realtime (${input.resource}): ${err?.message || err}`,
      );
    }
  }

  private async resolveAudience(
    audience: Exclude<RealtimeAudience, { kind: 'all' }>,
  ): Promise<{ userIds: string[]; includeAdmins: boolean }> {
    switch (audience.kind) {
      case 'farm':
        return {
          userIds: await this.getFarmUserIds(audience.farmId),
          includeAdmins: true,
        };
      case 'workspace':
        return {
          userIds: await this.getWorkspaceUserIds([audience.workspaceId]),
          includeAdmins: true,
        };
      case 'actor-scope': {
        const memberships = await this.prisma.workspaceMember.findMany({
          where: { userId: audience.actorId, isActive: true },
          select: { workspaceId: true },
        });
        return {
          userIds: await this.getWorkspaceUserIds(
            memberships.map((m) => m.workspaceId),
          ),
          includeAdmins: true,
        };
      }
      case 'users':
        return {
          userIds: audience.userIds,
          includeAdmins: Boolean(audience.includeAdmins),
        };
    }
  }

  async getFarmUserIds(farmId: string): Promise<string[]> {
    const farm = await this.prisma.farm.findUnique({
      where: { id: farmId },
      select: {
        ownerId: true,
        staff: { where: { isActive: true }, select: { userId: true } },
      },
    });
    if (!farm) return [];
    return [farm.ownerId, ...farm.staff.map((s) => s.userId)];
  }

  private async getWorkspaceUserIds(workspaceIds: string[]) {
    if (!workspaceIds.length) return [];
    const members = await this.prisma.workspaceMember.findMany({
      where: { workspaceId: { in: workspaceIds }, isActive: true },
      select: { userId: true },
    });
    return members.map((m) => m.userId);
  }

  // ---------------------------------------------------------------------
  // Tra cứu farmId từ các khóa liên quan
  // ---------------------------------------------------------------------

  async farmIdFromPond(pondId: unknown): Promise<string | null> {
    if (!isUuidLike(pondId)) return null;
    const pond = await this.prisma.pond.findUnique({
      where: { id: pondId },
      select: { farmId: true },
    });
    return pond?.farmId ?? null;
  }

  async farmIdFromCrop(cropId: unknown): Promise<string | null> {
    if (!isUuidLike(cropId)) return null;
    const crop = await this.prisma.crop.findUnique({
      where: { id: cropId },
      select: { pond: { select: { farmId: true } } },
    });
    return crop?.pond?.farmId ?? null;
  }

  /** Tra farmId theo id bản ghi của một resource (dùng cho PUT/PATCH/DELETE :id). */
  async farmIdFromEntity(
    resource: RealtimeResource,
    id: unknown,
  ): Promise<string | null> {
    if (!isUuidLike(id)) return null;
    switch (resource) {
      case 'farms': {
        const farm = await this.prisma.farm.findUnique({
          where: { id },
          select: { id: true },
        });
        return farm?.id ?? null;
      }
      case 'ponds':
        return this.farmIdFromPond(id);
      case 'crops':
        return this.farmIdFromCrop(id);
      case 'environment': {
        const rec = await this.prisma.environmentRecord.findUnique({
          where: { id },
          select: { cropId: true },
        });
        return rec ? this.farmIdFromCrop(rec.cropId) : null;
      }
      case 'incidents': {
        const inc = await this.prisma.incident.findUnique({
          where: { id },
          select: { cropId: true },
        });
        return inc ? this.farmIdFromCrop(inc.cropId) : null;
      }
      case 'inventory': {
        const item = await this.prisma.inventory.findUnique({
          where: { id },
          select: { farmId: true },
        });
        return item?.farmId ?? null;
      }
      case 'suppliers': {
        const sup = await this.prisma.supplier.findUnique({
          where: { id },
          select: { farmId: true },
        });
        return sup?.farmId ?? null;
      }
      case 'farm-staffs': {
        const staff = await this.prisma.farmStaff.findUnique({
          where: { id },
          select: { farmId: true },
        });
        return staff?.farmId ?? null;
      }
      case 'shrimp-size': {
        const sample = await this.prisma.shrimpSizeSample.findUnique({
          where: { id },
          select: { pondId: true },
        });
        return sample ? this.farmIdFromPond(sample.pondId) : null;
      }
      default:
        return null;
    }
  }
}
