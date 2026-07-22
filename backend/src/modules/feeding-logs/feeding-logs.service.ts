import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { FarmAccessService, AuthUser } from '../farm-access/farm-access.service';
import { CreateDailyFeedingLogDto } from './dto/create-feeding-log.dto';
import { GetFeedingLogsQueryDto } from './dto/get-feeding-logs.dto';
import { FeedingStatus, CropStatus } from '@prisma/client';

@Injectable()
export class FeedingLogsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly farmAccessService: FarmAccessService,
  ) {}

  /**
   * Save daily feeding log (batch of 1-7 sessions for a pond/crop on a specific date)
   */
  async createOrUpdateDailyLog(user: AuthUser, dto: CreateDailyFeedingLogDto) {
    // 1. Verify Farm Access
    await this.farmAccessService.assertCanAccessFarm(user, dto.farmId);

    // 2. Verify Pond exists and belongs to Farm
    const pond = await this.prisma.pond.findFirst({
      where: { id: dto.pondId, farmId: dto.farmId },
    });
    if (!pond) {
      throw new NotFoundException('Ao nuôi không tồn tại hoặc không thuộc trang trại này');
    }

    // 3. Verify Crop exists, belongs to Pond, and is ACTIVE
    const crop = await this.prisma.crop.findFirst({
      where: { id: dto.cropId, pondId: dto.pondId },
    });
    if (!crop) {
      throw new NotFoundException('Vụ nuôi không tồn tại');
    }
    if (crop.status !== CropStatus.ACTIVE) {
      throw new BadRequestException('Chỉ có thể ghi nhận nhật ký thức ăn cho vụ nuôi ĐANG HOẠT ĐỘNG (ACTIVE)');
    }

    const feedingDateObj = new Date(dto.feedingDate);

    // 4. Fetch existing feeding logs for this date/pond/crop to calculate exact net inventory changes
    const existingLogs = await this.prisma.feedingLog.findMany({
      where: {
        farmId: dto.farmId,
        pondId: dto.pondId,
        cropId: dto.cropId,
        feedingDate: feedingDateObj,
      },
    });

    const existingLogMap = new Map<string, any>();
    existingLogs.forEach((log) => {
      existingLogMap.set(log.feedingSession, log);
    });

    // Map: productId -> netDelta (positive = need to deduct from stock, negative = credit back to stock)
    const netDeltas = new Map<string, number>();

    for (const session of dto.sessions) {
      if (session.feedingStatus === FeedingStatus.SKIPPED) {
        session.feedAmount = 0;
      }

      const existingLog = existingLogMap.get(session.feedingSession);
      const oldAmount = existingLog && existingLog.feedingStatus !== FeedingStatus.SKIPPED
        ? Number(existingLog.feedAmount) || 0
        : 0;
      const oldProductId = existingLog ? existingLog.feedProductId : null;

      const newAmount = session.feedingStatus !== FeedingStatus.SKIPPED ? Number(session.feedAmount) || 0 : 0;
      const newProductId = session.feedProductId;

      if (oldProductId && oldProductId !== newProductId) {
        // Credit oldAmount back to oldProductId
        netDeltas.set(oldProductId, (netDeltas.get(oldProductId) || 0) - oldAmount);
        // Deduct newAmount from newProductId if newProductId present
        if (newProductId) {
          netDeltas.set(newProductId, (netDeltas.get(newProductId) || 0) + newAmount);
        }
      } else if (newProductId) {
        // Same product or new log
        const diff = newAmount - oldAmount;
        netDeltas.set(newProductId, (netDeltas.get(newProductId) || 0) + diff);
      }
    }

    // Validate stock for all inventory items requiring additional stock (netDelta > 0)
    for (const [inventoryId, netDelta] of netDeltas.entries()) {
      if (netDelta > 0) {
        const inventoryItem = await this.prisma.inventory.findFirst({
          where: { id: inventoryId, farmId: dto.farmId, deletedAt: null },
        });

        if (!inventoryItem) {
          throw new NotFoundException(`Sản phẩm thức ăn không tồn tại trong kho`);
        }

        if (inventoryItem.quantity < netDelta) {
          throw new BadRequestException(
            `Số lượng thức ăn "${inventoryItem.itemName}" trong kho (${inventoryItem.quantity} ${inventoryItem.unit}) không đủ để xuất (cần thêm ${netDelta} ${inventoryItem.unit})`,
          );
        }
      }
    }

    // 5. Execute DB Transaction with net inventory adjustments
    return await this.prisma.$transaction(async (tx) => {
      const results = [];

      for (const session of dto.sessions) {
        const amount = session.feedingStatus === FeedingStatus.SKIPPED ? 0 : Number(session.feedAmount) || 0;

        // Upsert FeedingLog
        const log = await tx.feedingLog.upsert({
          where: {
            farmId_pondId_cropId_feedingDate_feedingSession: {
              farmId: dto.farmId,
              pondId: dto.pondId,
              cropId: dto.cropId,
              feedingDate: feedingDateObj,
              feedingSession: session.feedingSession,
            },
          },
          update: {
            feedProductId: session.feedProductId,
            feedingTime: session.feedingTime,
            feedAmount: amount,
            feedingMethod: session.feedingMethod,
            feedingStatus: session.feedingStatus,
            note: session.note ?? null,
            createdBy: user.userId,
          },
          create: {
            farmId: dto.farmId,
            pondId: dto.pondId,
            cropId: dto.cropId,
            feedProductId: session.feedProductId,
            feedingDate: feedingDateObj,
            feedingSession: session.feedingSession,
            feedingTime: session.feedingTime,
            feedAmount: amount,
            feedingMethod: session.feedingMethod,
            feedingStatus: session.feedingStatus,
            note: session.note ?? null,
            createdBy: user.userId,
          },
        });

        results.push(log);
      }

      // Apply net inventory adjustments — only deduct kg, package count = floor(kg / weightPerPkg)
      for (const [inventoryId, netDelta] of netDeltas.entries()) {
        if (netDelta !== 0) {
          const inv = await tx.inventory.findUnique({
            where: { id: inventoryId },
          });

          if (inv) {
            const nextQuantity = Math.max(0, inv.quantity - netDelta);
            const updatePayload: any = { quantity: nextQuantity };

            // Package count: round up — bag still counts until fully consumed
            if (inv.packageQty !== null && inv.weightPerPkg && inv.weightPerPkg > 0) {
              updatePayload.packageQty = Math.ceil(nextQuantity / inv.weightPerPkg);
            }

            await tx.inventory.update({
              where: { id: inventoryId },
              data: updatePayload,
            });

            // Record usage log if netDelta > 0
            if (netDelta > 0) {
              await tx.inventoryUsageLog.create({
                data: {
                  inventoryId,
                  quantityUsed: netDelta,
                  usageDate: feedingDateObj,
                  notes: `Xuất kho từ Nhật ký cho ăn - Ao ${pond.name}`,
                  createdBy: user.userId,
                },
              });
            }
          }
        }
      }

      return {
        message: 'Ghi nhận nhật ký cho ăn và cập nhật kho thành công',
        count: results.length,
      };
    });
  }

  /**
   * Get list of daily feeding summaries (grouped by Date + Pond + Crop)
   */
  async findAllGrouped(user: AuthUser, query: GetFeedingLogsQueryDto) {
    const accessibleFarmIds = await this.farmAccessService.getAccessibleFarmIds(user);
    if (accessibleFarmIds !== undefined && accessibleFarmIds.length === 0) {
      return { data: [], total: 0, page: query.page, size: query.size };
    }

    const where: any = {};
    if (accessibleFarmIds !== undefined) {
      where.farmId = { in: accessibleFarmIds };
    }

    if (query.farmId) where.farmId = query.farmId;
    if (query.pondId) where.pondId = query.pondId;
    if (query.cropId) where.cropId = query.cropId;

    if (query.search) {
      where.OR = [
        { pond: { name: { contains: query.search, mode: 'insensitive' } } },
        { farm: { name: { contains: query.search, mode: 'insensitive' } } },
      ];
    }

    const allLogs = await this.prisma.feedingLog.findMany({
      where,
      include: {
        farm: { select: { id: true, name: true } },
        pond: { select: { id: true, name: true } },
        crop: { select: { id: true, startDate: true, status: true } },
        creator: { select: { id: true, fullName: true } },
        feedProduct: { select: { id: true, itemName: true, unit: true } },
      },
      orderBy: { feedingDate: 'desc' },
    });

    // Group logs by `${feedingDate}_${farmId}_${pondId}_${cropId}`
    const groupedMap = new Map<string, any>();

    for (const log of allLogs) {
      const dateStr = log.feedingDate.toISOString().slice(0, 10);
      const groupKey = `${dateStr}_${log.pondId}_${log.cropId}`;

      if (!groupedMap.has(groupKey)) {
        groupedMap.set(groupKey, {
          id: groupKey,
          feedingDate: dateStr,
          farmId: log.farmId,
          farmName: log.farm.name,
          pondId: log.pondId,
          pondName: log.pond.name,
          cropId: log.cropId,
          cropStartDate: log.crop.startDate,
          totalFeedKg: 0,
          completedSessions: 0,
          skippedSessions: 0,
          delayedSessions: 0,
          createdBy: log.creator?.fullName || 'Nông dân',
          createdAt: log.createdAt,
          sessions: [],
        });
      }

      const entry = groupedMap.get(groupKey);
      const amountNum = Number(log.feedAmount) || 0;
      entry.totalFeedKg += amountNum;

      if (log.feedingStatus === FeedingStatus.COMPLETED) entry.completedSessions += 1;
      if (log.feedingStatus === FeedingStatus.SKIPPED) entry.skippedSessions += 1;
      if (log.feedingStatus === FeedingStatus.DELAYED) entry.delayedSessions += 1;

      entry.sessions.push({
        id: log.id,
        feedingSession: log.feedingSession,
        feedingTime: log.feedingTime,
        feedProductId: log.feedProductId,
        feedProductName: log.feedProduct?.itemName || 'N/A',
        feedAmount: amountNum,
        feedingMethod: log.feedingMethod,
        feedingStatus: log.feedingStatus,
        note: log.note,
      });
    }

    const groupedList = Array.from(groupedMap.values());
    const page = query.page ?? 0;
    const size = query.size ?? 10;
    const paginated = groupedList.slice(page * size, (page + 1) * size);

    return {
      data: paginated,
      total: groupedList.length,
      page,
      size,
    };
  }

  /**
   * Get single day's 7 session logs for a pond and date
   */
  async getDailyDetails(user: AuthUser, pondId: string, dateStr: string) {
    const pond = await this.prisma.pond.findUnique({
      where: { id: pondId },
      select: { farmId: true },
    });
    if (!pond) throw new NotFoundException('Ao nuôi không tồn tại');

    await this.farmAccessService.assertCanAccessFarm(user, pond.farmId);

    const feedingDateObj = new Date(dateStr);

    const logs = await this.prisma.feedingLog.findMany({
      where: {
        pondId,
        feedingDate: feedingDateObj,
      },
      include: {
        farm: { select: { id: true, name: true } },
        pond: { select: { id: true, name: true } },
        crop: { select: { id: true, startDate: true, status: true } },
        creator: { select: { id: true, fullName: true } },
        feedProduct: { select: { id: true, itemName: true, unit: true } },
      },
      orderBy: { feedingSession: 'asc' },
    });

    return logs;
  }
}
