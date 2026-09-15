import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { FarmAccessService, AuthUser } from '../farm-access/farm-access.service.js';
import { CreateMortalityLogDto } from './dto/create-mortality-log.dto.js';
import { UpdateHarvestCountDto } from './dto/update-harvest-count.dto.js';

@Injectable()
export class SurvivalRateService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly farmAccess: FarmAccessService,
  ) {}

  /**
   * Calculate survival rate percentage strictly based on Initial Stocking and Harvest Count.
   *
   * Formula: Survival_Rate = (Harvest_Count / Initial_Stocking) * 100
   * Constraints:
   * - Strictly uses initial stocking count (from crop creation) and harvest count.
   * - Clamped between 0% and 100%.
   * - Throws BadRequestException("Chưa có dữ liệu thả giống") if Initial_Stocking is missing or <= 0.
   */
  async calculateSurvivalRate(user?: AuthUser, cropId?: string) {
    if (!cropId) {
      throw new BadRequestException('ID vụ nuôi không được để trống');
    }

    const crop = await this.prisma.crop.findUnique({
      where: { id: cropId },
      include: {
        pond: {
          select: { id: true, name: true, farmId: true },
        },
      },
    });

    if (!crop) {
      throw new NotFoundException('Không tìm thấy vụ nuôi');
    }

    if (user && crop.pond?.farmId) {
      await this.farmAccess.assertCanAccessFarm(user, crop.pond.farmId);
    }

    const initialStocking = crop.initialShrimpCount;

    // Constraint: Check for missing or zero initial stocking quantity
    if (initialStocking === undefined || initialStocking === null || initialStocking <= 0) {
      throw new BadRequestException('Chưa có dữ liệu thả giống');
    }

    // Determine Harvest Count strictly from crop harvest records:
    // 1. Explicit actualHarvestCount (con)
    // 2. Calculated from actualHarvestKg * actualHarvestSize (kg * con/kg)
    // 3. actualNurseryHarvest if stage === 'NURSERY'
    // 4. Default to 0 if not yet recorded
    let harvestCount = 0;
    let isRecordedHarvest = false;

    if (crop.actualHarvestCount !== null && crop.actualHarvestCount !== undefined) {
      harvestCount = crop.actualHarvestCount;
      isRecordedHarvest = true;
    } else if (
      crop.actualHarvestKg !== null &&
      crop.actualHarvestKg !== undefined &&
      crop.actualHarvestSize !== null &&
      crop.actualHarvestSize !== undefined
    ) {
      harvestCount = Math.round(crop.actualHarvestKg * crop.actualHarvestSize);
      isRecordedHarvest = true;
    } else if (
      crop.stage === 'NURSERY' &&
      crop.actualNurseryHarvest !== null &&
      crop.actualNurseryHarvest !== undefined
    ) {
      harvestCount = crop.actualNurseryHarvest;
      isRecordedHarvest = true;
    }

    // Formula calculation: Survival_Rate = (Harvest_Count / Initial_Stocking) * 100
    const rawRate = initialStocking > 0 ? (harvestCount / initialStocking) * 100 : 0;

    // Clamp between 0% and 100%
    const survivalRate = Math.min(100, Math.max(0, Number(rawRate.toFixed(2))));

    const targetSurvivalRate = crop.targetSurvivalRate ?? 85;

    let status = 'OPTIMAL';
    if (survivalRate < targetSurvivalRate) {
      status = survivalRate < 70 ? 'DANGER' : 'WARNING';
    }

    return {
      cropId: crop.id,
      pondName: crop.pond?.name || '',
      startDate: crop.startDate,
      initialStocking,
      harvestCount,
      survivalRate,
      targetSurvivalRate,
      isHarvested: crop.status === 'HARVESTED' || isRecordedHarvest,
      status,
    };
  }

  /**
   * Update actual harvest count / yield for a crop.
   */
  async updateHarvestCount(user: AuthUser, cropId: string, dto: UpdateHarvestCountDto) {
    const crop = await this.prisma.crop.findUnique({
      where: { id: cropId },
      include: { pond: { select: { farmId: true } } },
    });

    if (!crop) {
      throw new NotFoundException('Không tìm thấy vụ nuôi');
    }

    if (crop.pond?.farmId) {
      await this.farmAccess.assertCanAccessFarm(user, crop.pond.farmId);
    }

    let actualHarvestCount = dto.actualHarvestCount;
    if (actualHarvestCount === undefined && dto.actualHarvestKg && dto.actualHarvestSize) {
      actualHarvestCount = Math.round(dto.actualHarvestKg * dto.actualHarvestSize);
    }

    await this.prisma.crop.update({
      where: { id: cropId },
      data: {
        actualHarvestCount: actualHarvestCount ?? crop.actualHarvestCount,
        actualHarvestKg: dto.actualHarvestKg ?? crop.actualHarvestKg,
        actualHarvestSize: dto.actualHarvestSize ?? crop.actualHarvestSize,
      },
    });

    return this.calculateSurvivalRate(user, cropId);
  }

  /**
   * Get all detailed mortality logs for a specific crop.
   */
  async getMortalityLogs(user?: AuthUser, cropId?: string) {
    if (!cropId) {
      throw new BadRequestException('ID vụ nuôi không được để trống');
    }

    const crop = await this.prisma.crop.findUnique({
      where: { id: cropId },
      include: { pond: { select: { farmId: true } } },
    });

    if (!crop) {
      throw new NotFoundException('Không tìm thấy vụ nuôi');
    }

    if (user && crop.pond?.farmId) {
      await this.farmAccess.assertCanAccessFarm(user, crop.pond.farmId);
    }

    return this.prisma.mortalityLog.findMany({
      where: { cropId },
      include: {
        creator: {
          select: { id: true, fullName: true, role: true },
        },
      },
      orderBy: { recordedDate: 'desc' },
    });
  }

  /**
   * Record a new mortality event (dead shrimp count) for a crop.
   */
  async createMortalityLog(user: AuthUser, dto: CreateMortalityLogDto) {
    const crop = await this.prisma.crop.findUnique({
      where: { id: dto.cropId },
      include: { pond: { select: { farmId: true } } },
    });

    if (!crop) {
      throw new NotFoundException('Không tìm thấy vụ nuôi');
    }

    if (crop.pond?.farmId) {
      await this.farmAccess.assertCanAccessFarm(user, crop.pond.farmId);
    }

    const recordedDate = dto.recordedDate ? new Date(dto.recordedDate) : new Date();

    const log = await this.prisma.mortalityLog.create({
      data: {
        cropId: dto.cropId,
        deadQuantityPcs: dto.deadQuantityPcs,
        recordedDate,
        cause: dto.cause ?? null,
        note: dto.note ?? null,
        createdBy: user.userId,
      },
      include: {
        creator: {
          select: { id: true, fullName: true, role: true },
        },
      },
    });

    return log;
  }
}
