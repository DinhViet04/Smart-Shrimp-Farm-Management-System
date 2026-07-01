import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
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
    await this.findOne(pondId, userId);

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
