import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { CreatePondDto } from './dto/create-pond.dto.js';
import {
  AuthUser,
  FarmAccessService,
} from '../farm-access/farm-access.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';

@Injectable()
export class PondsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly farmAccess: FarmAccessService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async create(user: AuthUser, dto: CreatePondDto) {
    await this.farmAccess.assertCanManageFarm(user, dto.farmId);

    const farm = await this.prisma.farm.findUnique({
      where: { id: dto.farmId },
    });

    if (!farm) {
      throw new NotFoundException('Khong tim thay trang trai');
    }

    const totalPondsArea = await this.prisma.pond.aggregate({
      where: { farmId: dto.farmId },
      _sum: { areaSize: true },
    });
    const currentTotalArea = totalPondsArea._sum.areaSize || 0;

    if (currentTotalArea + dto.areaSize > farm.area) {
      throw new BadRequestException(
        `Tong dien tich cac ao (${currentTotalArea + dto.areaSize}) khong duoc vuot qua dien tich trang trai (${farm.area})`,
      );
    }

    const pond = await this.prisma.pond.create({
      data: {
        name: dto.name,
        areaSize: dto.areaSize,
        depth: dto.depth,
        farmId: dto.farmId,
      },
    });

    // Thông báo realtime nếu người tạo là FARM_MANAGER
    if (user.role === 'FARM_MANAGER') {
      await this.notificationsService.createPondCreatedNotification(
        user.userId,
        pond.id,
        pond.name,
        farm.id,
        farm.name,
      );
    }

    return pond;
  }

  async findAll(user: AuthUser) {
    const accessibleFarmIds = await this.farmAccess.getAccessibleFarmIds(user);

    return this.prisma.pond.findMany({
      where: {
        ...(accessibleFarmIds ? { farmId: { in: accessibleFarmIds } } : {}),
      },
      include: {
        farm: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findOverview(user: AuthUser) {
    const accessWhere =
      user.role === 'ADMIN'
        ? {}
        : user.role === 'FARM_MANAGER'
          ? { ownerId: user.userId }
          : {
              staff: {
                some: { userId: user.userId, isActive: true },
              },
            };

    const farmWhere = { deletedAt: null, ...accessWhere };
    const [farms, ponds, crops] = await Promise.all([
      this.prisma.farm.findMany({
        where: farmWhere,
        select: {
          id: true,
          name: true,
          location: true,
          address: true,
          area: true,
          description: true,
          status: true,
          ownerId: true,
          farmingModel: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.pond.findMany({
        where: { farm: farmWhere },
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
      this.prisma.crop.findMany({
        where: { pond: { farm: farmWhere } },
        distinct: ['pondId'],
        orderBy: [{ pondId: 'asc' }, { startDate: 'desc' }],
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
          transferDate: true,
          actualNurseryHarvest: true,
          nurserySurvivalRate: true,
          transferSize: true,
          splitNote: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
    ]);

    const farmById = new Map(farms.map((farm) => [farm.id, farm]));
    const overviewPonds = ponds.map((pond) => ({
      ...pond,
      farm: farmById.get(pond.farmId),
    }));
    const pondById = new Map(overviewPonds.map((pond) => [pond.id, pond]));
    const overviewCrops = crops.map((crop) => ({
      ...crop,
      pond: pondById.get(crop.pondId),
    }));

    return { farms, ponds: overviewPonds, crops: overviewCrops };
  }

  async findAllByManager(userId: string) {
    return this.prisma.pond.findMany({
      where: {
        farm: {
          ownerId: userId,
          deletedAt: null,
        },
      },
      include: {
        farm: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findOne(pondId: string, user: AuthUser) {
    const pond = await this.prisma.pond.findUnique({
      where: { id: pondId },
      include: { farm: true },
    });

    if (!pond) {
      throw new NotFoundException('Khong tim thay ao nuoi');
    }

    await this.farmAccess.assertCanAccessFarm(user, pond.farmId);
    return pond;
  }

  async update(pondId: string, user: AuthUser, data: any) {
    const pond = await this.findOne(pondId, user);
    await this.farmAccess.assertCanManageFarm(user, pond.farmId);

    if (data.areaSize) {
      const totalPondsArea = await this.prisma.pond.aggregate({
        where: { farmId: pond.farmId, id: { not: pondId } },
        _sum: { areaSize: true },
      });
      const currentTotalArea = totalPondsArea._sum.areaSize || 0;

      if (currentTotalArea + data.areaSize > pond.farm.area) {
        throw new BadRequestException(
          `Tong dien tich cac ao (${currentTotalArea + data.areaSize}) khong duoc vuot qua dien tich trang trai (${pond.farm.area})`,
        );
      }
    }

    return this.prisma.pond.update({
      where: { id: pondId },
      data,
    });
  }

  async remove(pondId: string, user: AuthUser) {
    const pond = await this.findOne(pondId, user);
    await this.farmAccess.assertCanManageFarm(user, pond.farmId);

    return this.prisma.pond.delete({
      where: { id: pondId },
    });
  }
}
