import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import {
  AuthUser,
  FarmAccessService,
} from '../farm-access/farm-access.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { CreateCropDto } from './dto/create-crop.dto.js';
import { UpdateCropDto } from './dto/update-crop.dto.js';
import { SplitCropDto } from './dto/split-crop.dto.js';
import { HarvestCropDto } from './dto/harvest-crop.dto.js';
import { generateHarvestReview } from './crop-review.generator.js';

export interface TrajectoryItem {
  doc: number;
  sr: number;
  loss: number;
  abw: number;
  /** Giá trị Y chuẩn hóa của ABW: abw_y = min(100, abw * 2). Vạch 50g = Y 100 */
  abw_y: number;
  biomass_kg: number;
  biomass_pct: number;
  fcr_raw: number | null;
  fcr_y: number | null;
  size: number | null;
}

@Injectable()
export class CropsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly farmAccess: FarmAccessService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async findAll(
    user: AuthUser,
    query: { pondId?: string; status?: string; summary?: boolean },
  ) {
    const accessibleFarmIds = await this.farmAccess.getAccessibleFarmIds(user);

    const where: any = {};

    if (query.pondId) {
      where.pondId = query.pondId;
    }

    if (query.status) {
      where.status = query.status;
    }

    // Only apply farmId filter if user is not ADMIN (accessibleFarmIds is defined)
    if (accessibleFarmIds !== undefined) {
      where.pond = {
        ...(where.pond || {}),
        farmId: { in: accessibleFarmIds },
      };
    }

    if (query.summary) {
      return (this.prisma.crop as any).findMany({
        where,
        select: {
          id: true,
          pondId: true,
          startDate: true,
          initialShrimpCount: true,
          status: true,
          targetHarvestSize: true,
          growthMilestones: true,
          targetSurvivalRate: true,
          targetTotalFeedKg: true,
          expectedHarvestDate: true,
          expectedDurationDays: true,
          stage: true,
          expectedTransferDate: true,
          transferDate: true,
          actualHarvestDate: true,
          parentCropId: true,
          createdAt: true,
          updatedAt: true,
          pond: {
            select: {
              id: true,
              name: true,
              areaSize: true,
              depth: true,
              farmId: true,
              farm: { select: { id: true, name: true, farmingModel: true } },
            },
          },
        },
        orderBy: { startDate: 'desc' },
      });
    }

    return (this.prisma.crop as any).findMany({
      where,
      include: {
        pond: {
          select: {
            id: true,
            name: true,
            areaSize: true,
            depth: true,
            farmId: true,
            farm: { select: { id: true, name: true, farmingModel: true } },
          },
        },
        parentCrop: {
          select: {
            id: true,
            startDate: true,
            initialShrimpCount: true,
            stage: true,
            pond: { select: { id: true, name: true } },
          },
        },
        childCrops: {
          select: {
            id: true,
            startDate: true,
            initialShrimpCount: true,
            status: true,
            stage: true,
            pond: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { startDate: 'desc' },
    });
  }

  async getManagerSummary(
    user: AuthUser,
    query: { farmId?: string; year?: number; quarter?: number },
  ) {
    const year = query.year || new Date().getFullYear();
    if (
      !Number.isInteger(year) ||
      year < 2000 ||
      year > new Date().getFullYear() + 1
    ) {
      throw new BadRequestException('Năm tổng kết không hợp lệ');
    }
    if (query.quarter !== undefined && ![1, 2, 3, 4].includes(query.quarter)) {
      throw new BadRequestException('Quý tổng kết không hợp lệ');
    }

    if (query.farmId) {
      await this.farmAccess.assertCanAccessFarm(user, query.farmId);
    }
    const accessibleFarmIds = await this.farmAccess.getAccessibleFarmIds(user);
    const farmIds = query.farmId ? [query.farmId] : accessibleFarmIds;
    const startMonth = query.quarter ? (query.quarter - 1) * 3 : 0;
    const monthCount = query.quarter ? 3 : 12;
    const currentStart = new Date(Date.UTC(year, startMonth, 1));
    const currentEnd = new Date(Date.UTC(year, startMonth + monthCount, 1));
    const previousStart = new Date(Date.UTC(year - 1, startMonth, 1));
    const previousEnd = new Date(
      Date.UTC(year - 1, startMonth + monthCount, 1),
    );

    const harvested = await this.prisma.crop.findMany({
      where: {
        status: 'HARVESTED',
        OR: [
          { actualHarvestDate: { gte: previousStart, lt: previousEnd } },
          { actualHarvestDate: { gte: currentStart, lt: currentEnd } },
        ],
        ...(farmIds !== undefined ? { pond: { farmId: { in: farmIds } } } : {}),
      },
      select: {
        id: true,
        pondId: true,
        initialShrimpCount: true,
        targetSurvivalRate: true,
        targetHarvestSize: true,
        actualHarvestDate: true,
        actualHarvestKg: true,
        actualHarvestRevenue: true,
        actualHarvestCost: true,
        actualHarvestProfit: true,
        actualHarvestFcr: true,
        actualHarvestSurvivalRate: true,
        pond: {
          select: {
            id: true,
            name: true,
            farmId: true,
            farm: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { actualHarvestDate: 'desc' },
    });

    const current = harvested.filter(
      (crop) =>
        crop.actualHarvestDate &&
        crop.actualHarvestDate >= currentStart &&
        crop.actualHarvestDate < currentEnd,
    );
    const previous = harvested.filter(
      (crop) =>
        crop.actualHarvestDate &&
        crop.actualHarvestDate >= previousStart &&
        crop.actualHarvestDate < previousEnd,
    );

    const aggregate = (items: typeof harvested) => {
      const revenue = items.reduce(
        (sum, crop) => sum + (crop.actualHarvestRevenue || 0),
        0,
      );
      const cost = items.reduce(
        (sum, crop) => sum + (crop.actualHarvestCost || 0),
        0,
      );
      const profit = items.reduce(
        (sum, crop) => sum + (crop.actualHarvestProfit || 0),
        0,
      );
      const harvestKg = items.reduce(
        (sum, crop) => sum + (crop.actualHarvestKg || 0),
        0,
      );
      const fcrValues = items.flatMap((crop) =>
        crop.actualHarvestFcr === null ? [] : [crop.actualHarvestFcr],
      );
      const survivalValues = items.flatMap((crop) =>
        crop.actualHarvestSurvivalRate === null
          ? []
          : [crop.actualHarvestSurvivalRate],
      );
      const targetMet = items.filter((crop) => {
        if (
          !crop.actualHarvestKg ||
          !crop.targetSurvivalRate ||
          !crop.targetHarvestSize
        )
          return false;
        const targetKg =
          (crop.initialShrimpCount * (crop.targetSurvivalRate / 100)) /
          crop.targetHarvestSize;
        return crop.actualHarvestKg >= targetKg;
      }).length;
      return {
        harvestedCrops: items.length,
        revenue: Math.round(revenue),
        cost: Math.round(cost),
        profit: Math.round(profit),
        harvestKg: Number(harvestKg.toFixed(2)),
        profitMargin:
          revenue > 0 ? Number(((profit / revenue) * 100).toFixed(2)) : 0,
        averageFcr: fcrValues.length
          ? Number(
              (
                fcrValues.reduce((sum, value) => sum + value, 0) /
                fcrValues.length
              ).toFixed(2),
            )
          : null,
        averageSurvivalRate: survivalValues.length
          ? Number(
              (
                survivalValues.reduce((sum, value) => sum + value, 0) /
                survivalValues.length
              ).toFixed(2),
            )
          : null,
        targetMet,
      };
    };
    const totals = aggregate(current);
    const previousTotals = aggregate(previous);
    const percentChange = (value: number, oldValue: number) =>
      oldValue === 0
        ? null
        : Number((((value - oldValue) / Math.abs(oldValue)) * 100).toFixed(2));

    const farmGroups = new Map<string, typeof current>();
    current.forEach((crop) => {
      const items = farmGroups.get(crop.pond.farmId) || [];
      items.push(crop);
      farmGroups.set(crop.pond.farmId, items);
    });
    const farmSummaries = [...farmGroups.entries()].map(
      ([farmId, farmCrops]) => {
        const pondGroups = new Map<string, typeof current>();
        farmCrops.forEach((crop) => {
          const items = pondGroups.get(crop.pondId) || [];
          items.push(crop);
          pondGroups.set(crop.pondId, items);
        });
        return {
          farmId,
          farmName: farmCrops[0].pond.farm.name,
          totals: aggregate(farmCrops),
          ponds: [...pondGroups.entries()].map(([pondId, pondCrops]) => ({
            pondId,
            pondName: pondCrops[0].pond.name,
            totals: aggregate(pondCrops),
          })),
        };
      },
    );

    return {
      year,
      quarter: query.quarter ?? null,
      totals,
      comparison: {
        revenuePercent: percentChange(totals.revenue, previousTotals.revenue),
        profitPercent: percentChange(totals.profit, previousTotals.profit),
        harvestKgPercent: percentChange(
          totals.harvestKg,
          previousTotals.harvestKg,
        ),
      },
      farmSummaries,
      recentHarvests: current.slice(0, 5).map((crop) => {
        let targetMet: boolean | null = null;
        if (
          crop.actualHarvestKg &&
          crop.targetSurvivalRate &&
          crop.targetHarvestSize
        ) {
          const targetKg =
            (crop.initialShrimpCount * (crop.targetSurvivalRate / 100)) /
            crop.targetHarvestSize;
          targetMet = crop.actualHarvestKg >= targetKg;
        }
        return {
          id: crop.id,
          pondId: crop.pondId,
          pondName: crop.pond.name,
          farmId: crop.pond.farmId,
          farmName: crop.pond.farm.name,
          actualHarvestDate: crop.actualHarvestDate,
          actualHarvestKg: crop.actualHarvestKg || 0,
          actualHarvestRevenue: crop.actualHarvestRevenue || 0,
          actualHarvestCost: crop.actualHarvestCost || 0,
          actualHarvestProfit: crop.actualHarvestProfit || 0,
          actualHarvestFcr: crop.actualHarvestFcr,
          actualHarvestSurvivalRate: crop.actualHarvestSurvivalRate,
          targetMet,
        };
      }),
    };
  }

  async findOne(user: AuthUser, id: string) {
    const crop: any = await (this.prisma.crop as any).findUnique({
      where: { id },
      include: {
        pond: {
          include: {
            farm: true,
          },
        },
        parentCrop: {
          include: {
            pond: true,
          },
        },
        childCrops: {
          include: {
            pond: true,
          },
        },
      },
    });

    if (!crop) {
      throw new NotFoundException('Không tìm thấy vụ nuôi');
    }

    await this.farmAccess.assertCanAccessFarm(user, crop.pond.farmId);
    return crop;
  }

  async create(user: AuthUser, dto: CreateCropDto) {
    const pond = await this.prisma.pond.findUnique({
      where: { id: dto.pondId },
      include: { farm: true },
    });

    if (!pond) {
      throw new NotFoundException('Không tìm thấy ao nuôi');
    }

    await this.farmAccess.assertCanAccessFarm(user, pond.farmId);

    // Validation mật độ thả tôm theo tiêu chuẩn an toàn
    if (pond.areaSize && pond.areaSize > 0) {
      const density = dto.initialShrimpCount / pond.areaSize;
      if (density > 250) {
        throw new BadRequestException(
          `Mật độ thả tôm (${density.toFixed(1)} con/m²) vượt ngưỡng báo động tối đa (> 250 con/m²). Tuyệt đối không được thả!`,
        );
      }
    }

    const status = (dto.status as any) || 'ACTIVE';

    // If new crop is ACTIVE, check if there's already an active crop in this pond
    if (status === 'ACTIVE') {
      const activeCrop = await this.prisma.crop.findFirst({
        where: { pondId: dto.pondId, status: 'ACTIVE' },
      });
      if (activeCrop) {
        throw new BadRequestException(
          'Ao nuôi này đang có vụ nuôi đang hoạt động. Vui lòng kết thúc vụ cũ trước khi tạo vụ mới.',
        );
      }
    }

    const startDate = new Date(dto.startDate);

    // Validation & Tự động tính số ngày nuôi dự kiến: (expectedHarvestDate - startDate)
    let expectedHarvestDate: Date | undefined = undefined;
    let expectedDurationDays: number | undefined = undefined;

    if (dto.expectedHarvestDate) {
      expectedHarvestDate = new Date(dto.expectedHarvestDate);
      if (isNaN(expectedHarvestDate.getTime())) {
        throw new BadRequestException('Ngày thu hoạch dự kiến không hợp lệ.');
      }
      if (expectedHarvestDate <= startDate) {
        throw new BadRequestException(
          'Ngày thu hoạch dự kiến phải sau ngày thả giống ít nhất 1 ngày.',
        );
      }
      // Tự động tính số ngày nuôi bằng ngày thu hoạch trừ ngày thả giống
      const diffTime = expectedHarvestDate.getTime() - startDate.getTime();
      expectedDurationDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
    } else if (dto.expectedDurationDays) {
      expectedDurationDays = dto.expectedDurationDays;
    }

    // Xử lý và validate mốc tăng trưởng
    let growthMilestones: any = undefined;
    if (dto.growthMilestones && Array.isArray(dto.growthMilestones)) {
      this.validateGrowthMilestones(dto.growthMilestones);
      growthMilestones = [...dto.growthMilestones].sort(
        (a, b) => a.day - b.day,
      );
    }

    // Validate farmingModel and stage
    let stage = dto.stage || 'COMMERCIAL';

    if (pond.farm.farmingModel === 'TRADITIONAL') {
      if (dto.stage && dto.stage !== 'COMMERCIAL') {
        throw new BadRequestException(
          'Mô hình nuôi truyền thống không hỗ trợ chia giai đoạn (NURSERY). Vui lòng để trống hoặc chọn COMMERCIAL.',
        );
      }
      stage = 'COMMERCIAL'; // Force to COMMERCIAL for traditional
    }

    if (pond.farm.farmingModel === 'HIGH_TECH') {
      if (stage !== 'NURSERY') {
        throw new BadRequestException(
          'Đối với trang trại mô hình Công nghệ cao, vụ nuôi mới bắt buộc phải bắt đầu là ao Ương dưỡng (NURSERY).',
        );
      }
    }

    // Validate expectedTransferDate (nếu là ao ương dưỡng)
    let expectedTransferDate: Date | undefined = undefined;

    if (stage === 'NURSERY' && dto.expectedTransferDate) {
      expectedTransferDate = new Date(dto.expectedTransferDate);
      if (isNaN(expectedTransferDate.getTime())) {
        throw new BadRequestException('Ngày dự tính tách ao không hợp lệ.');
      }
      if (expectedTransferDate <= startDate) {
        throw new BadRequestException(
          'Ngày dự tính tách ao phải sau ngày thả giống ít nhất 1 ngày.',
        );
      }
    }

    const crop = await (this.prisma.crop.create as any)({
      data: {
        pondId: dto.pondId,
        startDate,
        initialShrimpCount: dto.initialShrimpCount,
        status,
        targetHarvestSize: dto.targetHarvestSize,
        growthMilestones: growthMilestones ?? undefined,
        targetSurvivalRate: dto.targetSurvivalRate,
        targetTotalFeedKg: dto.targetTotalFeedKg,
        expectedHarvestDate,
        expectedDurationDays,
        stage,
        expectedTransferDate:
          stage === 'NURSERY' ? expectedTransferDate : undefined,
      },
      include: {
        pond: {
          select: {
            id: true,
            name: true,
            areaSize: true,
            depth: true,
            farmId: true,
          },
        },
      },
    });

    // Thông báo realtime cho Manager
    if (user.role === 'FARM_MANAGER') {
      await this.notificationsService.createCropCreatedNotification(
        user.userId,
        crop.pondId,
        pond.name,
        pond.farmId,
        pond.farm.name,
      );
    }

    return crop;
  }

  async update(user: AuthUser, id: string, dto: UpdateCropDto) {
    const crop = await this.prisma.crop.findUnique({
      where: { id },
      include: { pond: { include: { farm: true } } },
    });

    if (!crop) {
      throw new NotFoundException('Không tìm thấy vụ nuôi');
    }

    await this.farmAccess.assertCanAccessFarm(user, crop.pond.farmId);

    if (dto.status === 'ACTIVE' && crop.status !== 'ACTIVE') {
      const existingActive = await this.prisma.crop.findFirst({
        where: { pondId: crop.pondId, status: 'ACTIVE', NOT: { id } },
      });
      if (existingActive) {
        throw new BadRequestException(
          'Ao nuôi này đang có vụ nuôi khác đang hoạt động.',
        );
      }
    }

    const data: any = {};
    const effectiveStartDate = dto.startDate
      ? new Date(dto.startDate)
      : crop.startDate;

    if (dto.startDate) {
      data.startDate = effectiveStartDate;
    }

    if (dto.initialShrimpCount !== undefined) {
      if (crop.pond?.areaSize && crop.pond.areaSize > 0) {
        const density = dto.initialShrimpCount / crop.pond.areaSize;
        if (density > 250) {
          throw new BadRequestException(
            `Mật độ thả tôm (${density.toFixed(1)} con/m²) vượt ngưỡng báo động tối đa (> 250 con/m²). Tuyệt đối không được thả!`,
          );
        }
      }
      data.initialShrimpCount = dto.initialShrimpCount;
    }
    if (dto.status) data.status = dto.status;

    let currentStage =
      dto.stage !== undefined ? dto.stage : (crop as any).stage;

    if (crop.pond.farm.farmingModel === 'TRADITIONAL') {
      if (dto.stage === 'NURSERY') {
        throw new BadRequestException(
          'Mô hình nuôi truyền thống không hỗ trợ chia giai đoạn (NURSERY).',
        );
      }
      currentStage = 'COMMERCIAL';
      if (dto.stage !== undefined) {
        data.stage = 'COMMERCIAL';
      }
    } else {
      if (dto.stage !== undefined) data.stage = dto.stage;
    }

    if (currentStage === 'NURSERY') {
      if (dto.expectedTransferDate !== undefined) {
        if (dto.expectedTransferDate) {
          const tDate = new Date(dto.expectedTransferDate);
          if (isNaN(tDate.getTime())) {
            throw new BadRequestException('Ngày dự tính tách ao không hợp lệ.');
          }
          if (tDate <= effectiveStartDate) {
            throw new BadRequestException(
              'Ngày dự tính tách ao phải sau ngày thả giống.',
            );
          }
          data.expectedTransferDate = tDate;
        } else {
          data.expectedTransferDate = null;
        }
      }
    } else if (dto.stage === 'COMMERCIAL') {
      data.expectedTransferDate = null;
    }

    if (dto.targetHarvestSize !== undefined)
      data.targetHarvestSize = dto.targetHarvestSize;
    if (dto.targetSurvivalRate !== undefined)
      data.targetSurvivalRate = dto.targetSurvivalRate;
    if (dto.targetTotalFeedKg !== undefined)
      data.targetTotalFeedKg = dto.targetTotalFeedKg;

    const existingHarvestDate = (crop as any).expectedHarvestDate;

    if (dto.expectedHarvestDate !== undefined) {
      if (dto.expectedHarvestDate) {
        const hDate = new Date(dto.expectedHarvestDate);
        if (isNaN(hDate.getTime())) {
          throw new BadRequestException('Ngày thu hoạch dự kiến không hợp lệ.');
        }
        if (hDate <= effectiveStartDate) {
          throw new BadRequestException(
            'Ngày thu hoạch dự kiến phải sau ngày thả giống ít nhất 1 ngày.',
          );
        }
        data.expectedHarvestDate = hDate;
        // Tự động tính số ngày nuôi
        const diffTime = hDate.getTime() - effectiveStartDate.getTime();
        data.expectedDurationDays = Math.round(
          diffTime / (1000 * 60 * 60 * 24),
        );
      } else {
        data.expectedHarvestDate = null;
        data.expectedDurationDays = null;
      }
    } else if (dto.startDate && existingHarvestDate) {
      // Nếu đổi startDate nhưng giữ nguyên expectedHarvestDate
      const hDate = new Date(existingHarvestDate);
      if (hDate <= effectiveStartDate) {
        throw new BadRequestException(
          'Ngày thu hoạch dự kiến phải sau ngày thả giống mới.',
        );
      }
      const diffTime = hDate.getTime() - effectiveStartDate.getTime();
      data.expectedDurationDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
    } else if (dto.expectedDurationDays !== undefined) {
      data.expectedDurationDays = dto.expectedDurationDays;
    }

    if (dto.growthMilestones !== undefined) {
      if (Array.isArray(dto.growthMilestones)) {
        this.validateGrowthMilestones(dto.growthMilestones);
        data.growthMilestones = [...dto.growthMilestones].sort(
          (a, b) => a.day - b.day,
        );
      } else {
        data.growthMilestones = dto.growthMilestones;
      }
    }

    return (this.prisma.crop.update as any)({
      where: { id },
      data,
      include: {
        pond: {
          select: {
            id: true,
            name: true,
            areaSize: true,
            depth: true,
            farmId: true,
          },
        },
      },
    });
  }

  private validateGrowthMilestones(milestones?: any[]) {
    if (!milestones || !Array.isArray(milestones) || milestones.length === 0)
      return;

    for (const m of milestones) {
      if (typeof m.day !== 'number' || m.day <= 0) {
        throw new BadRequestException(
          `Mốc ngày nuôi (DOC) phải là số nguyên dương lớn hơn 0 (nhận được: ${m.day}).`,
        );
      }
      if (typeof m.weight !== 'number' || m.weight <= 0) {
        throw new BadRequestException(
          `Trọng lượng mục tiêu phải là số dương lớn hơn 0 (nhận được: ${m.weight}g).`,
        );
      }
    }

    const sorted = [...milestones].sort((a, b) => a.day - b.day);

    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].day === sorted[i - 1].day) {
        throw new BadRequestException(
          `Không được trùng mốc ngày nuôi (Mốc DOC ${sorted[i].day} ngày bị lặp lại).`,
        );
      }
      if (sorted[i].weight <= sorted[i - 1].weight) {
        throw new BadRequestException(
          `Trọng lượng mục tiêu ở mốc ${sorted[i].day} ngày (${sorted[i].weight}g) phải lớn hơn mốc ${sorted[i - 1].day} ngày (${sorted[i - 1].weight}g).`,
        );
      }
    }
  }

  async remove(user: AuthUser, id: string) {
    const crop = await this.prisma.crop.findUnique({
      where: { id },
      include: { pond: true },
    });

    if (!crop) {
      throw new NotFoundException('Không tìm thấy vụ nuôi');
    }

    await this.farmAccess.assertCanAccessFarm(user, crop.pond.farmId);

    await this.prisma.crop.delete({
      where: { id },
    });

    return { message: 'Xóa vụ nuôi thành công' };
  }

  async getHarvestSummary(user: AuthUser, id: string) {
    const crop = await (this.prisma.crop as any).findUnique({
      where: { id },
      include: {
        pond: {
          include: {
            farm: true,
          },
        },
        feedingLogs: {
          include: {
            feedProduct: true,
          },
        },
      },
    });

    if (!crop) {
      throw new NotFoundException('Không tìm thấy vụ nuôi');
    }

    await this.farmAccess.assertCanAccessFarm(user, crop.pond.farmId);

    // 1. Calculate Feed usage from feeding logs
    const feedMap = new Map<
      string,
      {
        inventoryId: string;
        itemName: string;
        category: string;
        quantityUsed: number;
        unit: string;
        unitPrice: number;
        totalCost: number;
      }
    >();

    let totalFeedKg = 0;
    for (const log of crop.feedingLogs || []) {
      if (
        log.feedingStatus !== 'SKIPPED' &&
        log.feedProductId &&
        log.feedProduct
      ) {
        const amt = Number(log.feedAmount) || 0;
        totalFeedKg += amt;
        const prod = log.feedProduct;
        const pkgWeight = Number(prod.weightPerPkg) || 1;
        const pricePerPkg = Number(prod.pricePerPackage) || 0;
        const unitPrice = pkgWeight > 0 ? pricePerPkg / pkgWeight : pricePerPkg;

        const existing = feedMap.get(prod.id);
        if (existing) {
          existing.quantityUsed += amt;
          existing.totalCost += amt * unitPrice;
        } else {
          feedMap.set(prod.id, {
            inventoryId: prod.id,
            itemName: prod.itemName,
            category: 'FEED',
            quantityUsed: amt,
            unit: prod.unit || 'kg',
            unitPrice: Math.round(unitPrice),
            totalCost: Math.round(amt * unitPrice),
          });
        }
      }
    }

    const feedLogs = Array.from(feedMap.values());
    const totalFeedCost = feedLogs.reduce((sum, f) => sum + f.totalCost, 0);

    // 2. Fetch warehouse usage logs for MEDICINE & CHEMICAL related to this pond/farm during crop lifecycle
    const startDate = new Date(crop.startDate);
    const endDate = crop.actualHarvestDate
      ? new Date(crop.actualHarvestDate)
      : new Date();

    const usageLogs = await (this.prisma.inventoryUsageLog as any).findMany({
      where: {
        OR: [{ cropId: crop.id }, { cropId: null, pondId: crop.pondId }],
        usageDate: { gte: startDate, lte: endDate },
      },
      include: {
        inventory: true,
      },
      orderBy: { usageDate: 'asc' },
    });

    const medicineMap = new Map<string, any>();
    const chemicalMap = new Map<string, any>();

    for (const u of usageLogs) {
      const inv = u.inventory;
      if (!inv || inv.deletedAt) continue;

      const qty = Number(u.quantityUsed) || 0;
      const pkgWeight = Number(inv.weightPerPkg) || 1;
      const pricePerPkg = Number(inv.pricePerPackage) || 0;
      const unitPrice = pkgWeight > 0 ? pricePerPkg / pkgWeight : pricePerPkg;
      const cost = Math.round(qty * unitPrice);

      const targetMap =
        inv.category === 'MEDICINE'
          ? medicineMap
          : inv.category === 'CHEMICAL'
            ? chemicalMap
            : null;
      if (targetMap) {
        const existing = targetMap.get(inv.id);
        if (existing) {
          existing.quantityUsed += qty;
          existing.totalCost += cost;
        } else {
          targetMap.set(inv.id, {
            inventoryId: inv.id,
            itemName: inv.itemName,
            category: inv.category,
            quantityUsed: qty,
            unit: inv.unit || 'đơn vị',
            unitPrice: Math.round(unitPrice),
            totalCost: cost,
          });
        }
      }
    }

    const medicineLogs = Array.from(medicineMap.values());
    const chemicalLogs = Array.from(chemicalMap.values());
    const totalMedicineCost = medicineLogs.reduce(
      (sum, m) => sum + m.totalCost,
      0,
    );
    const totalChemicalCost = chemicalLogs.reduce(
      (sum, c) => sum + c.totalCost,
      0,
    );

    const totalCost = totalFeedCost + totalMedicineCost + totalChemicalCost;

    // 3. Available inventory items in the farm
    const availableInventory = await this.prisma.inventory.findMany({
      where: {
        farmId: crop.pond.farmId,
        deletedAt: null,
      },
      orderBy: { itemName: 'asc' },
    });

    // 4. Calculate DOC
    const now = new Date();
    const diffDays = Math.max(
      1,
      Math.round((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)),
    );

    return {
      crop,
      doc: diffDays,
      summary: {
        totalFeedKg: Math.round(totalFeedKg * 100) / 100,
        totalFeedCost,
        totalMedicineCost,
        totalChemicalCost,
        totalCost,
        feedLogs,
        medicineLogs,
        chemicalLogs,
        availableInventory,
      },
    };
  }

  async getDetailedReport(user: AuthUser, id: string) {
    const crop = await (this.prisma.crop as any).findUnique({
      where: { id },
      include: {
        pond: {
          include: {
            farm: true,
          },
        },
        parentCrop: {
          include: {
            pond: true,
          },
        },
        childCrops: {
          include: {
            pond: true,
          },
          orderBy: { startDate: 'asc' },
        },
      },
    });

    if (!crop) {
      throw new NotFoundException('Không tìm thấy vụ nuôi');
    }

    await this.farmAccess.assertCanAccessFarm(user, crop.pond.farmId);

    const startDate = new Date(crop.startDate);
    const endDate = crop.actualHarvestDate
      ? new Date(crop.actualHarvestDate)
      : crop.transferDate && crop.stage === 'NURSERY'
        ? new Date(crop.transferDate)
        : new Date();

    const diffDays = Math.max(
      1,
      Math.ceil(
        Math.abs(endDate.getTime() - startDate.getTime()) /
          (1000 * 60 * 60 * 24),
      ),
    );

    // Run parallel queries across all operational tables for this crop and pond
    const [
      feedingLogsRaw,
      waterQualityRaw,
      growthSamplesRaw,
      healthRecordsRaw,
      incidentsRaw,
      usageLogsRaw,
      mortalityLogsRaw,
    ] = await Promise.all([
      // 1. Feeding logs
      (this.prisma.feedingLog as any).findMany({
        where: { cropId: crop.id },
        include: {
          feedProduct: true,
          creator: { select: { id: true, fullName: true, role: true } },
        },
        orderBy: [{ feedingDate: 'desc' }, { feedingSession: 'desc' }],
      }),
      // 2. Water quality measurements for this pond during crop lifecycle
      (this.prisma.waterQualityRecord as any).findMany({
        where: {
          pondId: crop.pondId,
          recordTime: {
            gte: startDate,
            lte: endDate,
          },
        },
        include: {
          creator: { select: { id: true, fullName: true, role: true } },
        },
        orderBy: { recordTime: 'desc' },
      }),
      // 3. Shrimp size & biomass samples
      (this.prisma.shrimpSizeSample as any).findMany({
        where: {
          pondId: crop.pondId,
          samplingDate: {
            gte: startDate,
            lte: endDate,
          },
        },
        orderBy: { samplingDate: 'asc' },
      }),
      // 4. Shrimp health clinical checks
      (this.prisma.shrimpHealthRecord as any).findMany({
        where: {
          OR: [
            { cropId: crop.id },
            {
              pondId: crop.pondId,
              recordTime: { gte: startDate, lte: endDate },
            },
          ],
        },
        include: {
          recorder: { select: { id: true, fullName: true, role: true } },
        },
        orderBy: { recordTime: 'desc' },
      }),
      // 5. Incidents
      (this.prisma.incident as any).findMany({
        where: { cropId: crop.id },
        include: {
          reporter: { select: { id: true, fullName: true } },
          assignedTo: { select: { id: true, fullName: true } },
          updates: {
            include: {
              author: { select: { id: true, fullName: true } },
            },
            orderBy: { createdAt: 'desc' },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      // 6. Inventory usage (medicine, chemical, water treatment)
      (this.prisma.inventoryUsageLog as any).findMany({
        where: {
          OR: [{ cropId: crop.id }, { cropId: null, pondId: crop.pondId }],
          usageDate: { gte: startDate, lte: endDate },
        },
        include: {
          inventory: true,
          creator: { select: { id: true, fullName: true } },
        },
        orderBy: { usageDate: 'desc' },
      }),
      // 7. Mortality logs
      (this.prisma.mortalityLog as any).findMany({
        where: { cropId: crop.id },
        include: {
          creator: { select: { id: true, fullName: true } },
        },
        orderBy: { recordedDate: 'desc' },
      }),
    ]);

    // ── 1. Feeding Aggregation ──
    let totalFeedKg = 0;
    let completedSessions = 0;
    let skippedSessions = 0;
    let delayedSessions = 0;
    const feedByProductMap = new Map<string, any>();

    for (const f of feedingLogsRaw) {
      const amt = Number(f.feedAmount) || 0;
      if (f.feedingStatus === 'SKIPPED') {
        skippedSessions++;
      } else {
        if (f.feedingStatus === 'COMPLETED') completedSessions++;
        if (f.feedingStatus === 'DELAYED') delayedSessions++;
        totalFeedKg += amt;

        if (f.feedProduct) {
          const prod = f.feedProduct;
          const pkgWeight = Number(prod.weightPerPkg) || 1;
          const pricePerPkg = Number(prod.pricePerPackage) || 0;
          const unitPrice =
            pkgWeight > 0 ? pricePerPkg / pkgWeight : pricePerPkg;
          const cost = amt * unitPrice;

          const existing = feedByProductMap.get(prod.id);
          if (existing) {
            existing.totalKg += amt;
            existing.totalCost += cost;
            existing.sessionCount += 1;
          } else {
            feedByProductMap.set(prod.id, {
              productId: prod.id,
              itemName: prod.itemName,
              unit: prod.unit || 'kg',
              unitPrice: Math.round(unitPrice),
              totalKg: amt,
              totalCost: cost,
              sessionCount: 1,
            });
          }
        }
      }
    }

    const feedProductsSummary = Array.from(feedByProductMap.values()).map(
      (p) => ({
        ...p,
        totalKg: Math.round(p.totalKg * 100) / 100,
        totalCost: Math.round(p.totalCost),
      }),
    );
    const totalFeedCost = feedProductsSummary.reduce(
      (acc, curr) => acc + curr.totalCost,
      0,
    );

    // ── 2. Water Quality Aggregation ──
    const wqCount = waterQualityRaw.length;
    let sumPh = 0,
      sumDo = 0,
      sumSal = 0,
      sumTemp = 0,
      sumAlk = 0,
      sumNh3 = 0,
      sumNo2 = 0;
    let validAlkCount = 0;
    let phAlerts = 0,
      doAlerts = 0,
      nh3Alerts = 0,
      no2Alerts = 0;

    for (const w of waterQualityRaw) {
      const ph = Number(w.ph) || 0;
      const doVal = Number(w.dissolvedOxygen) || 0;
      const sal = Number(w.salinity) || 0;
      const temp = Number(w.temperature) || 0;
      const alk = Number(w.alkalinity) || 0;
      const nh3 = Number(w.nh3) || 0;
      const no2 = Number(w.no2) || 0;

      sumPh += ph;
      sumDo += doVal;
      sumSal += sal;
      sumTemp += temp;
      sumNh3 += nh3;
      sumNo2 += no2;
      if (alk > 0) {
        sumAlk += alk;
        validAlkCount++;
      }

      if (ph < 7.5 || ph > 8.5) phAlerts++;
      if (doVal < 4.0) doAlerts++;
      if (nh3 > 0.1) nh3Alerts++;
      if (no2 > 0.2) no2Alerts++;
    }

    const waterQualityAverages =
      wqCount > 0
        ? {
            ph: Number((sumPh / wqCount).toFixed(2)),
            dissolvedOxygen: Number((sumDo / wqCount).toFixed(2)),
            salinity: Number((sumSal / wqCount).toFixed(1)),
            temperature: Number((sumTemp / wqCount).toFixed(1)),
            alkalinity:
              validAlkCount > 0
                ? Number((sumAlk / validAlkCount).toFixed(1))
                : null,
            nh3: Number((sumNh3 / wqCount).toFixed(3)),
            no2: Number((sumNo2 / wqCount).toFixed(3)),
          }
        : null;

    // ── 3. Growth & Biomass Aggregation ──
    const latestSample =
      growthSamplesRaw.length > 0
        ? growthSamplesRaw[growthSamplesRaw.length - 1]
        : null;
    const initialSample =
      growthSamplesRaw.length > 0 ? growthSamplesRaw[0] : null;

    // ── 4. Health & Mortality Aggregation ──
    let healthNormal = 0,
      healthLethargic = 0,
      healthEdge = 0,
      healthLossAppetite = 0;
    for (const h of healthRecordsRaw) {
      if (h.healthStatus === 'NORMAL') healthNormal++;
      else if (h.healthStatus === 'LETHARGIC') healthLethargic++;
      else if (h.healthStatus === 'EDGE_GATHERING') healthEdge++;
      else if (h.healthStatus === 'LOSS_OF_APPETITE') healthLossAppetite++;
    }

    const totalDeadShrimp = mortalityLogsRaw.reduce(
      (sum: number, m: any) => sum + (Number(m.deadQuantityPcs) || 0),
      0,
    );

    // ── 5. Treatments, Chemical & Medicine Usage ──
    const treatmentsSummary: any[] = [];
    let totalMedicineCost = 0;
    let totalChemicalCost = 0;

    for (const u of usageLogsRaw) {
      const inv = u.inventory;
      if (!inv || inv.deletedAt) continue;
      const qty = Number(u.quantityUsed) || 0;
      const pkgWeight = Number(inv.weightPerPkg) || 1;
      const pricePerPkg = Number(inv.pricePerPackage) || 0;
      const unitPrice = pkgWeight > 0 ? pricePerPkg / pkgWeight : pricePerPkg;
      const cost = Math.round(qty * unitPrice);

      if (inv.category === 'MEDICINE') totalMedicineCost += cost;
      if (inv.category === 'CHEMICAL') totalChemicalCost += cost;

      treatmentsSummary.push({
        id: u.id,
        inventoryId: inv.id,
        itemName: inv.itemName,
        category: inv.category,
        quantityUsed: qty,
        unit: inv.unit || 'đơn vị',
        unitPrice: Math.round(unitPrice),
        totalCost: cost,
        usageDate: u.usageDate,
        notes: u.notes,
        creatorName: u.creator?.fullName || 'Hệ thống',
      });
    }

    // ── 6. Incidents Overview ──
    const incidentsSummary = {
      total: incidentsRaw.length,
      open: incidentsRaw.filter((i: any) => i.status === 'OPEN' || i.status === 'TREATING').length,
      treating: 0,
      resolved: incidentsRaw.filter((i: any) => i.status === 'RESOLVED').length,
      list: incidentsRaw,
    };

    // ── 7. Transfer & Nursery Relationship ──
    const transferInfo = {
      isNursery: crop.stage === 'NURSERY',
      // If this crop was split from a nursery pond
      splitFromParent: crop.parentCrop
        ? {
            parentCropId: crop.parentCrop.id,
            pondId: crop.parentCrop.pond?.id,
            pondName: crop.parentCrop.pond?.name || 'Ao ươm',
            transferDate: crop.transferDate || crop.startDate,
            transferSize: crop.transferSize || null,
            initialCountReceived: crop.initialShrimpCount,
            splitNote: crop.splitNote || null,
          }
        : null,
      // If this crop was a nursery and transferred to child ponds
      splitToChildren:
        crop.childCrops && crop.childCrops.length > 0
          ? {
              totalChildPonds: crop.childCrops.length,
              transferDate: crop.transferDate || crop.expectedTransferDate,
              actualNurseryHarvest: crop.actualNurseryHarvest,
              nurserySurvivalRate: crop.nurserySurvivalRate,
              transferSize: crop.transferSize,
              splitNote: crop.splitNote,
              children: crop.childCrops.map((c: any) => ({
                id: c.id,
                pondId: c.pond?.id,
                pondName: c.pond?.name,
                startDate: c.startDate,
                initialShrimpCount: c.initialShrimpCount,
                status: c.status,
              })),
            }
          : null,
    };

    // ── 8. Financial Summary ──
    const actualKg = crop.actualHarvestKg || 0;
    const actualSize = crop.actualHarvestSize || 0;
    const actualRevenue = crop.actualHarvestRevenue || 0;
    const finalFeedCost = crop.harvestFeedCost || totalFeedCost;
    const finalMedicineCost = crop.harvestMedicineCost || totalMedicineCost;
    const finalChemicalCost = crop.harvestChemicalCost || totalChemicalCost;
    const seedCost = crop.harvestSeedCost || 0;
    const electricityCost = crop.harvestElectricityCost || 0;
    const laborCost = crop.harvestLaborCost || 0;
    const otherCost = crop.harvestOtherCost || 0;

    const totalOperationalCost =
      crop.actualHarvestCost ||
      finalFeedCost +
        finalMedicineCost +
        finalChemicalCost +
        seedCost +
        electricityCost +
        laborCost +
        otherCost;
    const profit =
      crop.actualHarvestProfit !== null &&
      crop.actualHarvestProfit !== undefined
        ? crop.actualHarvestProfit
        : actualRevenue > 0
          ? actualRevenue - totalOperationalCost
          : 0;

    const fcr =
      crop.actualHarvestFcr ||
      (actualKg > 0 && totalFeedKg > 0
        ? Number((totalFeedKg / actualKg).toFixed(2))
        : null);
    const survivalRate =
      crop.actualHarvestSurvivalRate ||
      (crop.initialShrimpCount > 0 && crop.actualHarvestCount
        ? Number(
            ((crop.actualHarvestCount / crop.initialShrimpCount) * 100).toFixed(
              1,
            ),
          )
        : null);

    return {
      crop,
      doc: diffDays,
      transferInfo,
      feeding: {
        totalFeedKg: Math.round(totalFeedKg * 100) / 100,
        totalFeedCost,
        totalSessions: feedingLogsRaw.length,
        completedSessions,
        skippedSessions,
        delayedSessions,
        productsSummary: feedProductsSummary,
        recentLogs: feedingLogsRaw,
      },
      waterQuality: {
        totalMeasurements: wqCount,
        averages: waterQualityAverages,
        alerts: {
          ph: phAlerts,
          dissolvedOxygen: doAlerts,
          nh3: nh3Alerts,
          no2: no2Alerts,
          total: phAlerts + doAlerts + nh3Alerts + no2Alerts,
        },
        recentRecords: waterQualityRaw,
      },
      growth: {
        totalSamples: growthSamplesRaw.length,
        initialSample,
        latestSample,
        samples: growthSamplesRaw,
      },
      health: {
        totalInspections: healthRecordsRaw.length,
        summary: {
          normal: healthNormal,
          lethargic: healthLethargic,
          edgeGathering: healthEdge,
          lossOfAppetite: healthLossAppetite,
        },
        records: healthRecordsRaw,
        totalDeadShrimp,
        mortalityLogs: mortalityLogsRaw,
      },
      treatmentsAndSupplies: {
        totalMaterialsUsed: treatmentsSummary.length,
        totalMedicineCost,
        totalChemicalCost,
        totalTreatmentCost: totalMedicineCost + totalChemicalCost,
        items: treatmentsSummary,
      },
      incidents: incidentsSummary,
      financial: {
        actualKg,
        actualSize,
        actualRevenue,
        costs: {
          feed: finalFeedCost,
          medicine: finalMedicineCost,
          chemical: finalChemicalCost,
          seed: seedCost,
          electricity: electricityCost,
          labor: laborCost,
          other: otherCost,
          total: totalOperationalCost,
        },
        profit,
        fcr,
        survivalRate,
      },
    };
  }

  async harvest(user: AuthUser, id: string, dto: HarvestCropDto) {
    const crop = await this.prisma.crop.findUnique({
      where: { id },
      include: { pond: true },
    });

    if (!crop) {
      throw new NotFoundException('Không tìm thấy vụ nuôi');
    }

    await this.farmAccess.assertCanAccessFarm(user, crop.pond.farmId);

    if (crop.status !== 'ACTIVE' && crop.status !== 'HARVESTED') {
      throw new BadRequestException(
        'Chỉ có thể thu hoạch hoặc chỉnh sửa thông tin thu hoạch cho vụ nuôi đang hoạt động hoặc đã thu hoạch',
      );
    }

    const harvestDate = dto.actualHarvestDate
      ? new Date(dto.actualHarvestDate)
      : crop.actualHarvestDate || new Date();
    const startDate = new Date(crop.startDate);
    const tomorrow = new Date();
    tomorrow.setHours(23, 59, 59, 999);
    if (harvestDate < startDate) {
      throw new BadRequestException(
        'Ngày thu hoạch không được trước ngày bắt đầu vụ nuôi',
      );
    }
    if (harvestDate > tomorrow) {
      throw new BadRequestException('Ngày thu hoạch không được ở tương lai');
    }

    const actualHarvestCount = Math.round(
      dto.actualHarvestKg * dto.actualHarvestSize,
    );
    const actualHarvestSurvivalRate = Number(
      ((actualHarvestCount / crop.initialShrimpCount) * 100).toFixed(2),
    );
    if (actualHarvestSurvivalRate > 100) {
      throw new BadRequestException(
        'Sản lượng và kích cỡ thu hoạch tạo ra tỷ lệ sống lớn hơn 100%. Vui lòng kiểm tra lại số liệu',
      );
    }

    const feedCost = dto.harvestFeedCost || 0;
    const medicineCost = dto.harvestMedicineCost || 0;
    const chemicalCost = dto.harvestChemicalCost || 0;
    const seedCost = dto.harvestSeedCost || 0;
    const electricityCost = dto.harvestElectricityCost || 0;
    const laborCost = dto.harvestLaborCost || 0;
    const otherCost = dto.harvestOtherCost || 0;
    const actualHarvestCost = Math.round(
      feedCost +
        medicineCost +
        chemicalCost +
        seedCost +
        electricityCost +
        laborCost +
        otherCost,
    );
    const actualHarvestRevenue = Math.round(
      dto.actualHarvestKg * dto.actualHarvestPricePerKg,
    );
    const actualHarvestProfit = actualHarvestRevenue - actualHarvestCost;
    const actualHarvestFcr = dto.harvestFeedKg
      ? Number((dto.harvestFeedKg / dto.actualHarvestKg).toFixed(2))
      : null;

    const previousHarvest = await this.prisma.crop.findFirst({
      where: {
        id: { not: id },
        pondId: crop.pondId,
        status: 'HARVESTED',
        actualHarvestDate: { not: null },
      },
      orderBy: { actualHarvestDate: 'desc' },
      select: {
        actualHarvestKg: true,
        actualHarvestProfit: true,
        actualHarvestFcr: true,
        actualHarvestSurvivalRate: true,
      },
    });
    const generatedReview = generateHarvestReview(
      {
        initialShrimpCount: crop.initialShrimpCount,
        targetHarvestSize: crop.targetHarvestSize,
        targetSurvivalRate: crop.targetSurvivalRate,
        actualHarvestKg: dto.actualHarvestKg,
        actualHarvestRevenue,
        actualHarvestCost,
        actualHarvestProfit,
        actualHarvestFcr,
        actualHarvestSurvivalRate,
      },
      previousHarvest,
    );

    return this.prisma.crop.update({
      where: { id },
      data: {
        status: 'HARVESTED',
        actualHarvestKg: dto.actualHarvestKg,
        actualHarvestSize: dto.actualHarvestSize,
        actualHarvestCount,
        actualHarvestDate: harvestDate,
        actualHarvestPricePerKg: dto.actualHarvestPricePerKg,
        actualHarvestRevenue,
        actualHarvestCost,
        actualHarvestProfit,
        actualHarvestFcr,
        actualHarvestSurvivalRate,
        harvestFeedCost: feedCost,
        harvestMedicineCost: medicineCost,
        harvestChemicalCost: chemicalCost,
        harvestSeedCost: seedCost,
        harvestElectricityCost: electricityCost,
        harvestLaborCost: laborCost,
        harvestOtherCost: otherCost,
        harvestFeedKg: dto.harvestFeedKg || 0,
        harvestNote: dto.harvestNote,
        harvestEvaluation: generatedReview.evaluation,
        harvestLessonsLearned: generatedReview.lessonsLearned,
        harvestNextRecommendation: generatedReview.nextRecommendation,
      },
      include: {
        pond: {
          select: {
            id: true,
            name: true,
            areaSize: true,
            depth: true,
            farmId: true,
          },
        },
      },
    });
  }

  async splitCrop(user: AuthUser, id: string, dto: SplitCropDto) {
    const crop = await this.prisma.crop.findUnique({
      where: { id },
      include: {
        pond: {
          include: {
            farm: true,
          },
        },
      },
    });

    if (!crop) {
      throw new NotFoundException('Không tìm thấy vụ nuôi');
    }

    await this.farmAccess.assertCanAccessFarm(user, crop.pond.farmId);

    // 1. Validate status & stage
    if (crop.status !== 'ACTIVE') {
      throw new BadRequestException(
        'Chỉ có thể tách ao đối với vụ nuôi đang hoạt động (ACTIVE).',
      );
    }

    if (crop.stage !== 'NURSERY') {
      throw new BadRequestException(
        'Chỉ có vụ nuôi ở giai đoạn Ương dưỡng (NURSERY) mới được phép thực hiện tách ao.',
      );
    }

    // 2. Validate Farm farming model (High tech)
    const farmModel = crop.pond.farm?.farmingModel || 'HIGH_TECH';
    if (farmModel !== 'HIGH_TECH') {
      throw new BadRequestException(
        'Tính năng tách ao chỉ áp dụng cho trang trại thuộc mô hình Công nghệ cao (HIGH_TECH).',
      );
    }

    // 3. Validate shrimp numbers
    if (dto.actualNurseryHarvest > crop.initialShrimpCount) {
      throw new BadRequestException(
        `Số lượng tôm thu được thực tế (${dto.actualNurseryHarvest.toLocaleString()} con) không được lớn hơn số lượng thả giống ban đầu của ao ương (${crop.initialShrimpCount.toLocaleString()} con).`,
      );
    }

    const totalAllocated = dto.destinations.reduce(
      (sum, dest) => sum + dest.shrimpCount,
      0,
    );
    if (totalAllocated !== dto.actualNurseryHarvest) {
      throw new BadRequestException(
        `Tổng số lượng tôm phân bổ vào các ao (${totalAllocated.toLocaleString()} con) phải bằng chính xác số lượng tôm thu được thực tế (${dto.actualNurseryHarvest.toLocaleString()} con).`,
      );
    }

    // 4. Validate destinations
    const destinationPondIds = dto.destinations.map((d) => d.pondId);
    const uniqueDestinationPondIds = new Set(destinationPondIds);
    if (uniqueDestinationPondIds.size !== destinationPondIds.length) {
      throw new BadRequestException(
        'Các ao đích nhận tôm không được trùng lặp nhau.',
      );
    }

    // Check all ponds belong to the same farm
    const targetPonds = await this.prisma.pond.findMany({
      where: {
        id: { in: destinationPondIds },
        farmId: crop.pond.farmId,
      },
    });

    if (targetPonds.length !== destinationPondIds.length) {
      throw new BadRequestException(
        'Một hoặc nhiều ao đích không tồn tại hoặc không thuộc cùng trang trại.',
      );
    }

    // Check if any target pond is currently active (excluding current nursery crop being split/harvested)
    const activeTargetCrops = await this.prisma.crop.findMany({
      where: {
        pondId: { in: destinationPondIds },
        status: 'ACTIVE',
        NOT: { id: crop.id },
      },
      include: {
        pond: { select: { name: true } },
      },
    });

    if (activeTargetCrops.length > 0) {
      const activePondNames = activeTargetCrops
        .map((c) => c.pond?.name || c.pondId)
        .join(', ');
      throw new BadRequestException(
        `Ao [${activePondNames}] hiện đang có vụ nuôi hoạt động. Chỉ được tách sang ao đang trống.`,
      );
    }

    // Density validation for each destination
    const pondMap = new Map(targetPonds.map((p) => [p.id, p]));
    for (const dest of dto.destinations) {
      const p = pondMap.get(dest.pondId);
      if (p && p.areaSize && p.areaSize > 0) {
        const density = dest.shrimpCount / p.areaSize;
        if (density > 250) {
          throw new BadRequestException(
            `Mật độ thả của ao "${p.name}" (${density.toFixed(1)} con/m²) vượt ngưỡng tối đa cho phép (> 250 con/m²).`,
          );
        }
      }
    }

    const transferDate = new Date(dto.transferDate);
    if (isNaN(transferDate.getTime())) {
      throw new BadRequestException('Ngày tách ao không hợp lệ.');
    }

    const nurserySurvivalRate =
      crop.initialShrimpCount > 0
        ? Number(
            (
              (dto.actualNurseryHarvest / crop.initialShrimpCount) *
              100
            ).toFixed(2),
          )
        : 0;

    // 5. Execute transaction
    return (this.prisma as any).$transaction(async (tx: any) => {
      // Mark nursery crop as HARVESTED with transfer details
      const updatedSourceCrop = await tx.crop.update({
        where: { id: crop.id },
        data: {
          status: 'HARVESTED',
          transferDate,
          actualNurseryHarvest: dto.actualNurseryHarvest,
          nurserySurvivalRate,
          transferSize: dto.transferSize,
          splitNote: dto.splitNote,
        },
      });

      // Create new commercial crops for each destination
      const createdCrops = [];
      for (const dest of dto.destinations) {
        let expectedHarvestDate: Date | undefined = undefined;
        let expectedDurationDays: number | undefined = undefined;

        if (dest.expectedHarvestDate) {
          expectedHarvestDate = new Date(dest.expectedHarvestDate);
          if (expectedHarvestDate > transferDate) {
            const diffTime =
              expectedHarvestDate.getTime() - transferDate.getTime();
            expectedDurationDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
          }
        } else if (dest.expectedDurationDays) {
          expectedDurationDays = dest.expectedDurationDays;
        }

        const newCrop = await tx.crop.create({
          data: {
            pondId: dest.pondId,
            startDate: transferDate,
            initialShrimpCount: dest.shrimpCount,
            status: 'ACTIVE',
            stage: 'COMMERCIAL',
            parentCropId: crop.id,
            targetHarvestSize: dest.targetHarvestSize,
            targetSurvivalRate: dest.targetSurvivalRate,
            targetTotalFeedKg: dest.targetTotalFeedKg,
            expectedHarvestDate,
            expectedDurationDays,
          },
          include: {
            pond: {
              select: {
                id: true,
                name: true,
                areaSize: true,
                depth: true,
                farmId: true,
                farm: { select: { id: true, name: true, farmingModel: true } },
              },
            },
          },
        });
        createdCrops.push(newCrop);
      }

      return {
        message: `Đã tách ao thành công sang ${createdCrops.length} ao thương phẩm.`,
        sourceCrop: updatedSourceCrop,
        newCrops: createdCrops,
      };
    });
  }

  /**
   * Tính toán chuỗi tăng trưởng 90 ngày chuẩn hóa (0 - 100) phục vụ Dashboard Kỹ thuật viên (Technician Overview)
   * Tối ưu hóa truy vấn O(1) và kết hợp thông minh giữa dữ liệu thực tế + đường chuẩn 5T
   */
  async getGrowthTrajectory90d(
    user: AuthUser,
    query: {
      farmId?: string;
      pondId?: string;
      cropId?: string;
      timeRange?: string;
      year?: string;
    },
  ) {
    const accessibleFarmIds = await this.farmAccess.getAccessibleFarmIds(user);

    let targetFarmId = query.farmId;
    if (!targetFarmId) {
      if (accessibleFarmIds && accessibleFarmIds.length > 0) {
        targetFarmId = accessibleFarmIds[0];
      } else {
        const firstFarm = await this.prisma.farm.findFirst({
          where: { deletedAt: null },
          select: { id: true },
        });
        targetFarmId = firstFarm?.id;
      }
    }

    if (targetFarmId) {
      await this.farmAccess.assertCanAccessFarm(user, targetFarmId);
    }

    const farm = targetFarmId
      ? await this.prisma.farm.findUnique({
          where: { id: targetFarmId },
          select: { id: true, name: true },
        })
      : null;

    let scopeName = farm ? `${farm.name} - Toàn Trang Trại` : 'Toàn Trang Trại';
    if (query.year && query.year !== 'ALL') {
      scopeName += ` (Năm ${query.year})`;
    }
    let selectedPondName: string | undefined = undefined;
    let selectedCropName: string | undefined = undefined;
    let trajectory: TrajectoryItem[] = [];

    // A. XỬ LÝ KHI CHỌN MỘT AO CỤ THỂ
    if (query.pondId && query.pondId !== 'ALL') {
      const pond = await this.prisma.pond.findUnique({
        where: { id: query.pondId },
        select: { id: true, name: true, areaSize: true, farmId: true },
      });

      if (pond) {
        selectedPondName = pond.name;
        scopeName = `${farm?.name || 'Trại'} • Ao ${pond.name}`;

        // 1. Tìm vụ nuôi tương ứng
        const cropWhere: any = { pondId: query.pondId };
        if (query.year && query.year !== 'ALL') {
          const y = parseInt(query.year, 10);
          if (!isNaN(y)) {
            cropWhere.startDate = {
              gte: new Date(`${y}-01-01T00:00:00.000Z`),
              lte: new Date(`${y}-12-31T23:59:59.999Z`),
            };
          }
        }

        if (query.cropId && query.cropId !== 'CURRENT') {
          cropWhere.id = query.cropId;
        }

        const activeCrop = await this.prisma.crop.findFirst({
          where: cropWhere,
          include: {
            feedingLogs: {
              select: { feedAmount: true, feedingDate: true },
              orderBy: { feedingDate: 'asc' },
            },
            mortalityLogs: {
              select: { deadQuantityPcs: true, recordedDate: true },
              orderBy: { recordedDate: 'asc' },
            },
          },
          orderBy: [
            { status: 'asc' }, // ACTIVE trước HARVESTED
            { startDate: 'desc' },
          ],
        });

        if (activeCrop) {
          const stageName =
            activeCrop.stage === 'NURSERY' ? 'Vụ Ương Dưỡng' : 'Vụ Thương Phẩm';
          const startDateStr = new Date(
            activeCrop.startDate,
          ).toLocaleDateString('vi-VN');
          selectedCropName = `${stageName} (Thả ${startDateStr})`;
          scopeName = `${pond.name} • ${selectedCropName}`;

          // Tính toán sản lượng mục tiêu thực tế của vụ (kg)
          const initialShrimp = activeCrop.initialShrimpCount || 0;
          const targetSurvival = activeCrop.targetSurvivalRate || 80.0;
          const targetSize = activeCrop.targetHarvestSize || 25; // con/kg
          const targetBiomassKg =
            initialShrimp > 0
              ? Math.round(
                  (initialShrimp * (targetSurvival / 100)) /
                    (targetSize > 0 ? targetSize : 25),
                )
              : 0;

          // 2. Lấy mẫu đo đạc kích cỡ thực tế của ao
          const realSamples = await this.prisma.shrimpSizeSample.findMany({
            where: { pondId: query.pondId },
            orderBy: [{ doc: 'asc' }, { samplingDate: 'asc' }],
          });

          if (realSamples.length > 0) {
            const feedingLogs = activeCrop.feedingLogs || [];
            const cropStartDate = new Date(activeCrop.startDate).getTime();

            // Điểm xuất phát DOC 0
            trajectory.push({
              doc: 0,
              sr: 100.0,
              loss: 0.0,
              abw: 0.0,
              abw_y: 0.0,
              biomass_kg: 0,
              biomass_pct: 0.0,
              fcr_raw: null,
              fcr_y: null,
              size: null,
            });

            // Chỉ nạp các điểm DOC thực tế có trong bảng shrimp_size_samples
            realSamples.forEach((s) => {
              const doc = s.doc !== null && s.doc !== undefined ? s.doc : 0;
              if (doc === 0) return;

              const abw = Number(s.abwGram) || 0;
              const size =
                Number(s.sizePerKg) ||
                (abw > 0 ? Math.round(1000 / abw) : null);

              // Sinh khối thực tế (kg)
              let biomassKg = s.estimatedBiomassKg
                ? Number(s.estimatedBiomassKg)
                : abw > 0
                  ? (initialShrimp * abw) / 1000
                  : 0;
              biomassKg = Math.round(biomassKg * 10) / 10;

              // Tỉ lệ sống thực tế (SR %)
              let sr = 100.0;
              if (s.estimatedTotalShrimp && initialShrimp > 0) {
                sr = Math.min(
                  100,
                  Number(
                    ((s.estimatedTotalShrimp / initialShrimp) * 100).toFixed(1),
                  ),
                );
              } else if (biomassKg > 0 && abw > 0 && initialShrimp > 0) {
                const estimatedShrimpCount = (biomassKg * 1000) / abw;
                sr = Math.min(
                  100,
                  Math.max(
                    10,
                    Number(
                      ((estimatedShrimpCount / initialShrimp) * 100).toFixed(1),
                    ),
                  ),
                );
              }
              const loss = Number((100 - sr).toFixed(1));

              // Sinh khối % so với kế hoạch
              const biomassPct =
                targetBiomassKg > 0
                  ? Math.min(
                      100,
                      Number(((biomassKg / targetBiomassKg) * 100).toFixed(2)),
                    )
                  : 0;

              // Tính FCR thực tế từ FeedingLogs tính đến ngày doc
              let fcrRaw: number | null = null;
              let fcrY: number | null = null;

              if (doc >= 10 && feedingLogs.length > 0) {
                const targetTime = cropStartDate + doc * 24 * 60 * 60 * 1000;
                const cumFeed = feedingLogs
                  .filter(
                    (f) => new Date(f.feedingDate).getTime() <= targetTime,
                  )
                  .reduce((sum, f) => sum + (Number(f.feedAmount) || 0), 0);

                if (cumFeed > 0 && biomassKg > 0) {
                  fcrRaw = Number((cumFeed / biomassKg).toFixed(2));
                  fcrY = Number((fcrRaw * 50).toFixed(1));
                }
              }

              const abwY = Math.min(100, Number((abw * 2).toFixed(1)));
              trajectory.push({
                doc,
                sr,
                loss,
                abw: Number(abw.toFixed(2)),
                abw_y: abwY,
                size,
                biomass_kg: biomassKg,
                biomass_pct: biomassPct,
                fcr_raw: fcrRaw,
                fcr_y: fcrY,
              });
            });
          }
        }
      }
    }
    // B. XỬ LÝ KHI CHỌN TOÀN TRANG TRẠI (CHỈ TỔNG HỢP NẾU CÓ DỮ LIỆU THẬT)
    else if (targetFarmId) {
      const farmSamples = await this.prisma.shrimpSizeSample.findMany({
        where: {
          pond: { farmId: targetFarmId },
        },
        include: {
          pond: { select: { id: true, name: true } },
        },
        orderBy: [{ doc: 'asc' }, { samplingDate: 'asc' }],
      });

      if (farmSamples.length > 0) {
        // Nhóm mẫu theo DOC
        const docSamplesMap = new Map<number, any[]>();
        farmSamples.forEach((s) => {
          if (s.doc !== null && s.doc !== undefined) {
            if (!docSamplesMap.has(s.doc)) docSamplesMap.set(s.doc, []);
            docSamplesMap.get(s.doc)!.push(s);
          }
        });

        trajectory.push({
          doc: 0,
          sr: 100.0,
          loss: 0.0,
          abw: 0.0,
          abw_y: 0.0,
          biomass_kg: 0,
          biomass_pct: 0.0,
          fcr_raw: null,
          fcr_y: null,
          size: null,
        });

        const maxFarmBiomass = Math.max(
          ...farmSamples.map((s) => Number(s.estimatedBiomassKg || 0)),
          1,
        );
        const sortedDocs = Array.from(docSamplesMap.keys()).sort(
          (a, b) => a - b,
        );
        sortedDocs.forEach((d) => {
          if (d === 0) return;
          const samples = docSamplesMap.get(d)!;
          const avgAbw =
            samples.reduce((acc, s) => acc + Number(s.abwGram || 0), 0) /
            samples.length;
          const avgBiomass =
            samples.reduce(
              (acc, s) => acc + Number(s.estimatedBiomassKg || 0),
              0,
            ) / samples.length;
          const size = avgAbw > 0 ? Math.round(1000 / avgAbw) : null;
          const biomassPct = Math.min(
            100,
            Number(((avgBiomass / maxFarmBiomass) * 100).toFixed(2)),
          );

          const avgAbwY = Math.min(100, Number((avgAbw * 2).toFixed(1)));
          trajectory.push({
            doc: d,
            sr: 85.0, // Ước lượng chuẩn
            loss: 15.0,
            abw: Number(avgAbw.toFixed(2)),
            abw_y: avgAbwY,
            size,
            biomass_kg: Math.round(avgBiomass),
            biomass_pct: biomassPct,
            fcr_raw: null,
            fcr_y: null,
          });
        });
      }
    }

    // Lọc theo mốc thời gian nếu được chỉ định
    if (query.timeRange === '30') {
      trajectory = trajectory.filter((d) => d.doc <= 30);
    } else if (query.timeRange === '60') {
      trajectory = trajectory.filter((d) => d.doc >= 30 && d.doc <= 60);
    } else if (query.timeRange === '90_END') {
      trajectory = trajectory.filter((d) => d.doc >= 60 && d.doc <= 90);
    }

    // Nếu không có dữ liệu thực tế nào được ghi nhận
    if (trajectory.length === 0) {
      return {
        scopeName: selectedPondName
          ? `Ao ${selectedPondName} (Chưa có dữ liệu mẫu đo)`
          : farm
            ? `${farm.name} (Chưa có dữ liệu mẫu đo)`
            : 'Chưa có dữ liệu',
        farmName: farm?.name || '',
        pondName: selectedPondName,
        cropName: selectedCropName,
        kpis: {
          sr: 0,
          loss: 0,
          abw: 0,
          biomass_kg: 0,
          fcr_raw: null,
        },
        trajectory: [],
      };
    }

    // Tính toán KPI từ điểm đo mới nhất thực tế
    const latest = trajectory[trajectory.length - 1];

    return {
      scopeName,
      farmName: farm?.name || 'Trang Trại SSFM',
      pondName: selectedPondName,
      cropName: selectedCropName,
      kpis: {
        sr: latest.sr,
        loss: latest.loss,
        abw: latest.abw,
        biomass_kg: latest.biomass_kg,
        fcr_raw: latest.fcr_raw,
      },
      trajectory,
    };
  }
}
