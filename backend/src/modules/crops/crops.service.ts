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
      growthMilestones = [...dto.growthMilestones].sort((a, b) => a.day - b.day);
    }

    // Validate farmingModel and stage
    let stage = dto.stage || 'COMMERCIAL';

    if (pond.farm.farmingModel === 'TRADITIONAL') {
      if (dto.stage && dto.stage !== 'COMMERCIAL') {
        throw new BadRequestException('Mô hình nuôi truyền thống không hỗ trợ chia giai đoạn (NURSERY). Vui lòng để trống hoặc chọn COMMERCIAL.');
      }
      stage = 'COMMERCIAL'; // Force to COMMERCIAL for traditional
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
        expectedTransferDate: stage === 'NURSERY' ? expectedTransferDate : undefined,
      },
      include: {
        pond: {
          select: { id: true, name: true, areaSize: true, depth: true, farmId: true },
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
    const effectiveStartDate = dto.startDate ? new Date(dto.startDate) : crop.startDate;

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
    
    let currentStage = dto.stage !== undefined ? dto.stage : (crop as any).stage;

    if (crop.pond.farm.farmingModel === 'TRADITIONAL') {
      if (dto.stage === 'NURSERY') {
        throw new BadRequestException('Mô hình nuôi truyền thống không hỗ trợ chia giai đoạn (NURSERY).');
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

    if (dto.targetHarvestSize !== undefined) data.targetHarvestSize = dto.targetHarvestSize;
    if (dto.targetSurvivalRate !== undefined) data.targetSurvivalRate = dto.targetSurvivalRate;
    if (dto.targetTotalFeedKg !== undefined) data.targetTotalFeedKg = dto.targetTotalFeedKg;

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
        data.expectedDurationDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
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
        data.growthMilestones = [...dto.growthMilestones].sort((a, b) => a.day - b.day);
      } else {
        data.growthMilestones = dto.growthMilestones;
      }
    }

    return (this.prisma.crop.update as any)({
      where: { id },
      data,
      include: {
        pond: {
          select: { id: true, name: true, areaSize: true, depth: true, farmId: true },
        },
      },
    });
  }

  private validateGrowthMilestones(milestones?: any[]) {
    if (!milestones || !Array.isArray(milestones) || milestones.length === 0) return;

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

  async harvest(user: AuthUser, id: string) {
    const crop = await this.prisma.crop.findUnique({
      where: { id },
      include: { pond: true },
    });

    if (!crop) {
      throw new NotFoundException('Không tìm thấy vụ nuôi');
    }

    await this.farmAccess.assertCanAccessFarm(user, crop.pond.farmId);

    if (crop.status !== 'ACTIVE') {
      throw new BadRequestException(
        'Chỉ có thể thu hoạch vụ nuôi đang hoạt động',
      );
    }

    return this.prisma.crop.update({
      where: { id },
      data: { status: 'HARVESTED' },
      include: { pond: { select: { id: true, name: true, areaSize: true, depth: true, farmId: true } } },
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
            ((dto.actualNurseryHarvest / crop.initialShrimpCount) * 100).toFixed(
              2,
            ),
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
            expectedDurationDays = Math.round(
              diffTime / (1000 * 60 * 60 * 24),
            );
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
    query: { farmId?: string; pondId?: string; cropId?: string; timeRange?: string; year?: string },
  ) {
    const accessibleFarmIds = await this.farmAccess.getAccessibleFarmIds(user);

    let targetFarmId = query.farmId;
    if (!targetFarmId) {
      if (accessibleFarmIds && accessibleFarmIds.length > 0) {
        targetFarmId = accessibleFarmIds[0];
      } else {
        const firstFarm = await this.prisma.farm.findFirst({
          where: { deletedAt: null },
          select: { id: true }
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
          const stageName = activeCrop.stage === 'NURSERY' ? 'Vụ Ương Dưỡng' : 'Vụ Thương Phẩm';
          const startDateStr = new Date(activeCrop.startDate).toLocaleDateString('vi-VN');
          selectedCropName = `${stageName} (Thả ${startDateStr})`;
          scopeName = `${pond.name} • ${selectedCropName}`;

          // Tính toán sản lượng mục tiêu thực tế của vụ (kg)
          const initialShrimp = activeCrop.initialShrimpCount || 0;
          const targetSurvival = activeCrop.targetSurvivalRate || 80.0;
          const targetSize = activeCrop.targetHarvestSize || 25; // con/kg
          const targetBiomassKg = initialShrimp > 0
            ? Math.round((initialShrimp * (targetSurvival / 100)) / (targetSize > 0 ? targetSize : 25))
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
            realSamples.forEach(s => {
              const doc = s.doc !== null && s.doc !== undefined ? s.doc : 0;
              if (doc === 0) return;

              const abw = Number(s.abwGram) || 0;
              const size = Number(s.sizePerKg) || (abw > 0 ? Math.round(1000 / abw) : null);
              
              // Sinh khối thực tế (kg)
              let biomassKg = s.estimatedBiomassKg 
                ? Number(s.estimatedBiomassKg) 
                : (abw > 0 ? (initialShrimp * abw) / 1000 : 0);
              biomassKg = Math.round(biomassKg * 10) / 10;

              // Tỉ lệ sống thực tế (SR %)
              let sr = 100.0;
              if (s.estimatedTotalShrimp && initialShrimp > 0) {
                sr = Math.min(100, Number(((s.estimatedTotalShrimp / initialShrimp) * 100).toFixed(1)));
              } else if (biomassKg > 0 && abw > 0 && initialShrimp > 0) {
                const estimatedShrimpCount = (biomassKg * 1000) / abw;
                sr = Math.min(100, Math.max(10, Number(((estimatedShrimpCount / initialShrimp) * 100).toFixed(1))));
              }
              const loss = Number((100 - sr).toFixed(1));

              // Sinh khối % so với kế hoạch
              const biomassPct = targetBiomassKg > 0
                ? Math.min(100, Number(((biomassKg / targetBiomassKg) * 100).toFixed(2)))
                : 0;

              // Tính FCR thực tế từ FeedingLogs tính đến ngày doc
              let fcrRaw: number | null = null;
              let fcrY: number | null = null;

              if (doc >= 10 && feedingLogs.length > 0) {
                const targetTime = cropStartDate + doc * 24 * 60 * 60 * 1000;
                const cumFeed = feedingLogs
                  .filter(f => new Date(f.feedingDate).getTime() <= targetTime)
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
        farmSamples.forEach(s => {
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

        const maxFarmBiomass = Math.max(...farmSamples.map(s => Number(s.estimatedBiomassKg || 0)), 1);
        const sortedDocs = Array.from(docSamplesMap.keys()).sort((a, b) => a - b);
        sortedDocs.forEach(d => {
          if (d === 0) return;
          const samples = docSamplesMap.get(d)!;
          const avgAbw = samples.reduce((acc, s) => acc + Number(s.abwGram || 0), 0) / samples.length;
          const avgBiomass = samples.reduce((acc, s) => acc + Number(s.estimatedBiomassKg || 0), 0) / samples.length;
          const size = avgAbw > 0 ? Math.round(1000 / avgAbw) : null;
          const biomassPct = Math.min(100, Number(((avgBiomass / maxFarmBiomass) * 100).toFixed(2)));

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
      trajectory = trajectory.filter(d => d.doc <= 30);
    } else if (query.timeRange === '60') {
      trajectory = trajectory.filter(d => d.doc >= 30 && d.doc <= 60);
    } else if (query.timeRange === '90_END') {
      trajectory = trajectory.filter(d => d.doc >= 60 && d.doc <= 90);
    }

    // Nếu không có dữ liệu thực tế nào được ghi nhận
    if (trajectory.length === 0) {
      return {
        scopeName: selectedPondName 
          ? `Ao ${selectedPondName} (Chưa có dữ liệu mẫu đo)` 
          : (farm ? `${farm.name} (Chưa có dữ liệu mẫu đo)` : 'Chưa có dữ liệu'),
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
