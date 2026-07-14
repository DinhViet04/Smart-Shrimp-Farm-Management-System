import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { CreatePondDto } from './dto/create-pond.dto.js';
import { AuthUser, FarmAccessService } from '../farm-access/farm-access.service.js';

@Injectable()
export class PondsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly farmAccess: FarmAccessService,
  ) {}

  async create(user: AuthUser, dto: CreatePondDto) {
    await this.farmAccess.assertCanManageFarm(user, dto.farmId);

    const farm = await this.prisma.farm.findUnique({
      where: { id: dto.farmId },
    });

    if (!farm) {
      throw new NotFoundException('Không tìm thấy trang trại');
    }

    const totalPondsArea = await this.prisma.pond.aggregate({
      where: { farmId: dto.farmId },
      _sum: { areaSize: true },
    });
    const currentTotalArea = totalPondsArea._sum.areaSize || 0;

    if (currentTotalArea + dto.areaSize > farm.area) {
      throw new BadRequestException(`Tổng diện tích các ao (${currentTotalArea + dto.areaSize}) không được vượt quá diện tích trang trại (${farm.area})`);
    }

    return this.prisma.pond.create({
      data: {
        name: dto.name,
        areaSize: dto.areaSize,
        depth: dto.depth,
        farmId: dto.farmId,
      },
    });
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

  async findOne(pondId: string, user: AuthUser) {
    const pond = await this.prisma.pond.findUnique({
      where: { id: pondId },
      include: { farm: true },
    });

    if (!pond) {
      throw new NotFoundException('Không tìm thấy ao nuôi');
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
        throw new BadRequestException(`Tổng diện tích các ao (${currentTotalArea + data.areaSize}) không được vượt quá diện tích trang trại (${pond.farm.area})`);
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
