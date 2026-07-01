import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { CreatePondDto } from './dto/create-pond.dto.js';

@Injectable()
export class PondsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreatePondDto) {
    // Check if farm exists and belongs to the user
    const farm = await this.prisma.farm.findUnique({
      where: { id: dto.farmId },
    });

    if (!farm) {
      throw new NotFoundException('Không tìm thấy trang trại');
    }

    // Kiểm tra quyền sở hữu
    if (farm.ownerId !== userId) {
      throw new ForbiddenException('Bạn không có quyền thêm ao vào trang trại này');
    }

    const totalPondsArea = await this.prisma.pond.aggregate({
      where: { farmId: dto.farmId },
      _sum: { areaSize: true },
    });
    const currentTotalArea = totalPondsArea._sum.areaSize || 0;

    if (currentTotalArea + dto.areaSize > farm.area) {
      throw new BadRequestException(`Tổng diện tích các ao (${currentTotalArea + dto.areaSize}) không được vượt quá diện tích trang trại (${farm.area})`);
    }

    // Create pond
    return this.prisma.pond.create({
      data: {
        name: dto.name,
        areaSize: dto.areaSize,
        depth: dto.depth,
        farmId: dto.farmId,
      },
    });
  }

  async findAllByManager(userId: string) {
    // Return all ponds that belong to any farm owned by this manager
    return this.prisma.pond.findMany({
      where: {
        farm: {
          ownerId: userId,
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

  async findOne(pondId: string, userId: string) {
    const pond = await this.prisma.pond.findUnique({
      where: { id: pondId },
      include: { farm: true },
    });

    if (!pond) {
      throw new NotFoundException('Không tìm thấy ao nuôi');
    }

    if (pond.farm.ownerId !== userId) {
      throw new ForbiddenException('Bạn không có quyền truy cập ao nuôi này');
    }

    return pond;
  }

  async update(pondId: string, userId: string, data: any) {
    // Use findOne to ensure the pond exists and belongs to the user
    const pond = await this.findOne(pondId, userId);

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

  async remove(pondId: string, userId: string) {
    // Use findOne to ensure the pond exists and belongs to the user
    const pond = await this.findOne(pondId, userId);

    // Check if there are active crops, maybe prevent deletion if crops exist?
    // For now, allow deletion if prisma cascade rules are set, otherwise it will fail.
    // The requirement is simple CRUD.
    
    return this.prisma.pond.delete({
      where: { id: pondId },
    });
  }
}
