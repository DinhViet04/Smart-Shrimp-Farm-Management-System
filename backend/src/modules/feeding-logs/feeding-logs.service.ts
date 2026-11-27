import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  FarmAccessService,
  AuthUser,
} from '../farm-access/farm-access.service';
import { CreateDailyFeedingLogDto } from './dto/create-feeding-log.dto';
import { GetFeedingLogsQueryDto } from './dto/get-feeding-logs.dto';
import { FeedingStatus, CropStatus } from '@prisma/client';

/** Tiền tố ghi chú của phiếu xuất kho tự động sinh từ nhật ký cho ăn */
const FEEDING_USAGE_NOTE_PREFIX = 'Xuất kho từ Nhật ký cho ăn';

/** Ghi chú phiếu xuất kho cho 1 ao (dùng chung khi tạo/cập nhật/xoá để luôn khớp nhau) */
export const buildFeedingUsageNote = (pondName: string) => {
  const pondLabel = pondName.toLowerCase().startsWith('ao')
    ? pondName
    : `Ao ${pondName}`;
  return `${FEEDING_USAGE_NOTE_PREFIX} - ${pondLabel}`;
};

/** Khoảng [00:00, 23:59:59.999] UTC của ngày cho ăn */
const dayRange = (date: Date) => {
  const start = new Date(date);
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(date);
  end.setUTCHours(23, 59, 59, 999);
  return { gte: start, lte: end };
};

/** Làm tròn số kg để tránh sai số dấu phẩy động (0.1 + 0.2) */
const roundKg = (n: number) => Math.round(n * 1000) / 1000;

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
      throw new NotFoundException(
        'Ao nuôi không tồn tại hoặc không thuộc trang trại này',
      );
    }

    // 3. Verify Crop exists, belongs to Pond, and is ACTIVE
    const crop = await this.prisma.crop.findFirst({
      where: { id: dto.cropId, pondId: dto.pondId },
    });
    if (!crop) {
      throw new NotFoundException('Vụ nuôi không tồn tại');
    }
    if (crop.status !== CropStatus.ACTIVE) {
      throw new BadRequestException(
        'Chỉ có thể ghi nhận nhật ký thức ăn cho vụ nuôi ĐANG HOẠT ĐỘNG (ACTIVE)',
      );
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
      const oldAmount =
        existingLog && existingLog.feedingStatus !== FeedingStatus.SKIPPED
          ? Number(existingLog.feedAmount) || 0
          : 0;
      const oldProductId = existingLog ? existingLog.feedProductId : null;

      const newAmount =
        session.feedingStatus !== FeedingStatus.SKIPPED
          ? Number(session.feedAmount) || 0
          : 0;
      const newProductId = session.feedProductId;

      if (oldProductId && oldProductId !== newProductId) {
        // Credit oldAmount back to oldProductId
        netDeltas.set(
          oldProductId,
          (netDeltas.get(oldProductId) || 0) - oldAmount,
        );
        // Deduct newAmount from newProductId if newProductId present
        if (newProductId) {
          netDeltas.set(
            newProductId,
            (netDeltas.get(newProductId) || 0) + newAmount,
          );
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
          throw new NotFoundException(
            `Sản phẩm thức ăn không tồn tại trong kho`,
          );
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
        const amount =
          session.feedingStatus === FeedingStatus.SKIPPED
            ? 0
            : Number(session.feedAmount) || 0;

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

      // Apply net inventory adjustments — only deduct kg, package count = ceil(kg / weightPerPkg)
      for (const [inventoryId, rawDelta] of netDeltas.entries()) {
        const netDelta = roundKg(rawDelta);
        if (netDelta !== 0) {
          if (netDelta > 0) {
            // Trừ kho có điều kiện ngay trong DB: nếu 2 yêu cầu đồng thời cùng trừ
            // thì yêu cầu sau sẽ thất bại thay vì làm tồn kho âm / bị kẹp về 0.
            const deducted = await tx.inventory.updateMany({
              where: {
                id: inventoryId,
                farmId: dto.farmId,
                deletedAt: null,
                quantity: { gte: netDelta },
              },
              data: { quantity: { decrement: netDelta } },
            });
            if (deducted.count === 0) {
              throw new BadRequestException(
                'Số lượng thức ăn trong kho không đủ (có thể vừa được người khác xuất). Vui lòng tải lại và thử lại.',
              );
            }
          } else {
            // Hoàn kho (giảm/bỏ cử). updateMany: không lỗi nếu sản phẩm đã bị xoá khỏi kho
            await tx.inventory.updateMany({
              where: { id: inventoryId },
              data: { quantity: { increment: -netDelta } },
            });
          }

          const inv = await tx.inventory.findUnique({
            where: { id: inventoryId },
          });

          if (inv) {
            const nextQuantity = roundKg(Math.max(0, inv.quantity));
            const updatePayload: { quantity: number; packageQty?: number } = {
              quantity: nextQuantity,
            };

            // Package count: round up — bag still counts until fully consumed
            if (
              inv.packageQty !== null &&
              inv.weightPerPkg &&
              inv.weightPerPkg > 0
            ) {
              updatePayload.packageQty = Math.ceil(
                nextQuantity / inv.weightPerPkg,
              );
            }

            await tx.inventory.update({
              where: { id: inventoryId },
              data: updatePayload,
            });
          }
        }
      }

      // Tổng lượng đã cho ăn theo từng sản phẩm của CẢ NGÀY (đọc lại sau khi upsert),
      // để lưu từng cử riêng lẻ vẫn ra đúng tổng — trước đây chỉ cộng các cử trong request
      // nên lưu cử 2 sẽ ghi đè phiếu xuất của cử 1.
      const dayLogs = await tx.feedingLog.findMany({
        where: {
          farmId: dto.farmId,
          pondId: dto.pondId,
          cropId: dto.cropId,
          feedingDate: feedingDateObj,
        },
      });
      const productTotals = new Map<string, number>();
      for (const log of dayLogs) {
        if (log.feedingStatus !== FeedingStatus.SKIPPED && log.feedProductId) {
          const amt = Number(log.feedAmount) || 0;
          if (amt > 0) {
            productTotals.set(
              log.feedProductId,
              roundKg((productTotals.get(log.feedProductId) || 0) + amt),
            );
          }
        }
      }

      const notePrefix = buildFeedingUsageNote(pond.name);

      // Chỉ lấy phiếu của đúng ao này: so khớp ghi chú chính xác (không dùng "contains"
      // vì "Ao A1" khớp nhầm "Ao A10") và chỉ trong kho của trang trại này.
      const existingUsageLogs = await tx.inventoryUsageLog.findMany({
        where: {
          usageDate: dayRange(feedingDateObj),
          notes: notePrefix,
          inventory: { farmId: dto.farmId },
        },
        orderBy: { createdAt: 'asc' },
      });

      const existingUsageMap = new Map<string, { id: string }>();
      for (const ul of existingUsageLogs) {
        if (existingUsageMap.has(ul.inventoryId)) {
          // Dọn phiếu trùng do lỗi cũ: mỗi sản phẩm/ao/ngày chỉ giữ 1 phiếu
          await tx.inventoryUsageLog.delete({ where: { id: ul.id } });
        } else {
          existingUsageMap.set(ul.inventoryId, ul);
        }
      }

      const allProductIds = new Set<string>([
        ...Array.from(productTotals.keys()),
        ...Array.from(existingUsageMap.keys()),
      ]);

      for (const inventoryId of allProductIds) {
        const currentTotal = productTotals.get(inventoryId) || 0;
        const existingLog = existingUsageMap.get(inventoryId);

        if (currentTotal > 0) {
          if (existingLog) {
            await tx.inventoryUsageLog.update({
              where: { id: existingLog.id },
              data: {
                quantityUsed: currentTotal,
                notes: notePrefix,
                pondId: dto.pondId,
                cropId: dto.cropId,
              },
            });
          } else {
            await tx.inventoryUsageLog.create({
              data: {
                inventoryId,
                quantityUsed: currentTotal,
                usageDate: feedingDateObj,
                notes: notePrefix,
                pondId: dto.pondId,
                cropId: dto.cropId,
                createdBy: user.userId,
              },
            });
          }
        } else if (existingLog) {
          await tx.inventoryUsageLog.delete({
            where: { id: existingLog.id },
          });
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
    const accessibleFarmIds =
      await this.farmAccessService.getAccessibleFarmIds(user);
    if (accessibleFarmIds !== undefined && accessibleFarmIds.length === 0) {
      return { data: [], total: 0, page: query.page, size: query.size };
    }

    const where: any = {};
    if (accessibleFarmIds !== undefined) {
      where.farmId = { in: accessibleFarmIds };
    }

    if (query.farmId) {
      await this.farmAccessService.assertCanAccessFarm(user, query.farmId);
      where.farmId = query.farmId;
    }
    if (query.pondId) where.pondId = query.pondId;
    if (query.cropId) {
      const crop = await this.prisma.crop.findUnique({
        where: { id: query.cropId },
        select: { id: true, parentCropId: true },
      });
      if (crop) {
        const rootId = crop.parentCropId || crop.id;
        const seasonCrops = await this.prisma.crop.findMany({
          where: { OR: [{ id: rootId }, { parentCropId: rootId }] },
          select: { id: true },
        });
        where.cropId = { in: seasonCrops.map((c) => c.id) };
      } else {
        where.cropId = query.cropId;
      }
    }

    if (query.search) {
      where.OR = [
        { pond: { name: { contains: query.search, mode: 'insensitive' } } },
        { farm: { name: { contains: query.search, mode: 'insensitive' } } },
      ];
    }

    const page = query.page ?? 0;
    const size = query.size ?? 10;
    const groupKeys = await this.prisma.feedingLog.groupBy({
      by: ['feedingDate', 'farmId', 'pondId', 'cropId'],
      where,
      orderBy: { feedingDate: 'desc' },
      skip: page * size,
      take: size,
    });

    // Trang chưa đầy và không rỗng ở trang sau → đã biết chính xác tổng số nhóm,
    // khỏi phải quét lại toàn bộ lịch sử chỉ để đếm.
    const total =
      groupKeys.length < size && (groupKeys.length > 0 || page === 0)
        ? page * size + groupKeys.length
        : (
            await this.prisma.feedingLog.groupBy({
              by: ['feedingDate', 'farmId', 'pondId', 'cropId'],
              where,
            })
          ).length;

    if (groupKeys.length === 0) {
      return { data: [], total, page, size };
    }

    const allLogs = await this.prisma.feedingLog.findMany({
      where: {
        AND: [
          where,
          {
            OR: groupKeys.map((key) => ({
              feedingDate: key.feedingDate,
              farmId: key.farmId,
              pondId: key.pondId,
              cropId: key.cropId,
            })),
          },
        ],
      },
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

      if (log.feedingStatus === FeedingStatus.COMPLETED)
        entry.completedSessions += 1;
      if (log.feedingStatus === FeedingStatus.SKIPPED)
        entry.skippedSessions += 1;
      if (log.feedingStatus === FeedingStatus.DELAYED)
        entry.delayedSessions += 1;

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
    const groupOrder = new Map(
      groupKeys.map((key, index) => [
        `${key.feedingDate.toISOString().slice(0, 10)}_${key.pondId}_${key.cropId}`,
        index,
      ]),
    );
    groupedList.sort(
      (a, b) =>
        (groupOrder.get(a.id) ?? Number.MAX_SAFE_INTEGER) -
        (groupOrder.get(b.id) ?? Number.MAX_SAFE_INTEGER),
    );

    return {
      data: groupedList,
      total,
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

  /**
   * Delete daily feeding logs (all 7 sessions) and restore inventory
   */
  async deleteDailyLog(
    user: AuthUser,
    farmId: string,
    pondId: string,
    cropId: string,
    dateStr: string,
  ) {
    await this.farmAccessService.assertCanAccessFarm(user, farmId);

    const feedingDateObj = new Date(dateStr);

    const logsToDelete = await this.prisma.feedingLog.findMany({
      where: {
        farmId,
        pondId,
        cropId,
        feedingDate: feedingDateObj,
      },
      include: {
        pond: { select: { name: true } },
      },
    });

    if (logsToDelete.length === 0) {
      throw new NotFoundException('Không tìm thấy nhật ký cho ăn cho ngày này');
    }

    const amountsToReturn = new Map<string, number>();

    for (const log of logsToDelete) {
      if (
        log.feedingStatus !== FeedingStatus.SKIPPED &&
        Number(log.feedAmount) > 0
      ) {
        const amt = Number(log.feedAmount);
        const pid = log.feedProductId;
        if (pid) {
          amountsToReturn.set(pid, (amountsToReturn.get(pid) || 0) + amt);
        }
      }
    }

    const pondName = logsToDelete[0].pond.name;

    return await this.prisma.$transaction(async (tx) => {
      await tx.feedingLog.deleteMany({
        where: {
          farmId,
          pondId,
          cropId,
          feedingDate: feedingDateObj,
        },
      });

      for (const [inventoryId, amount] of amountsToReturn.entries()) {
        const inv = await tx.inventory.findUnique({
          where: { id: inventoryId },
        });

        if (inv) {
          const nextQuantity = inv.quantity + amount;
          const updatePayload: any = { quantity: nextQuantity };

          if (
            inv.packageQty !== null &&
            inv.weightPerPkg &&
            inv.weightPerPkg > 0
          ) {
            updatePayload.packageQty = Math.ceil(
              nextQuantity / inv.weightPerPkg,
            );
          }

          await tx.inventory.update({
            where: { id: inventoryId },
            data: updatePayload,
          });
        }
      }

      // Delete auto-generated inventory usage logs for this pond and date
      // (dùng cùng hàm tạo ghi chú với lúc ghi nhận -> trước đây tên ao bắt đầu bằng "Ao"
      // bị thành "Ao Ao ..." nên phiếu xuất không bị xoá dù kho đã được hoàn)
      await tx.inventoryUsageLog.deleteMany({
        where: {
          usageDate: dayRange(feedingDateObj),
          notes: buildFeedingUsageNote(pondName),
          inventory: { farmId },
        },
      });

      return {
        message: 'Xoá nhật ký cho ăn và hoàn trả kho thành công',
      };
    });
  }
}
