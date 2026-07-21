import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuthUser, FarmAccessService } from '../farm-access/farm-access.service.js';
import { CreateCropDto } from './dto/create-crop.dto.js';
import { UpdateCropDto } from './dto/update-crop.dto.js';

@Injectable()
export class CropsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly farmAccess: FarmAccessService,
  ) {}

  async findAll(
    user: AuthUser,
    query: { pondId?: string; status?: string },
  ) {
    const accessibleFarmIds = await this.farmAccess.getAccessibleFarmIds(user);

    const where: any = {};

    if (query.pondId) {
      where.pondId = query.pondId;
    }

    if (query.status) {
      where.status = query.status;
    }

    // Only apply farmId filter if user has a specific list of accessible farm IDs
    if (accessibleFarmIds && accessibleFarmIds.length > 0) {
      where.pond = {
        ...(where.pond || {}),
        farmId: { in: accessibleFarmIds },
      };
    }

    return this.prisma.crop.findMany({
      where,
      include: {
        pond: {
          select: {
            id: true,
            name: true,
            farmId: true,
            farm: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { startDate: 'desc' },
    });
  }

  async findOne(user: AuthUser, id: string) {
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
    return crop;
  }

  async create(user: AuthUser, dto: CreateCropDto) {
    const pond = await this.prisma.pond.findUnique({
      where: { id: dto.pondId },
    });

    if (!pond) {
      throw new NotFoundException('Không tìm thấy ao nuôi');
    }

    await this.farmAccess.assertCanAccessFarm(user, pond.farmId);

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

    const crop = await this.prisma.crop.create({
      data: {
        pondId: dto.pondId,
        startDate: new Date(dto.startDate),
        initialShrimpCount: dto.initialShrimpCount,
        status,
      },
      include: {
        pond: {
          select: { id: true, name: true, farmId: true },
        },
      },
    });

    return crop;
  }

  async update(user: AuthUser, id: string, dto: UpdateCropDto) {
    const crop = await this.prisma.crop.findUnique({
      where: { id },
      include: { pond: true },
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
    if (dto.startDate) data.startDate = new Date(dto.startDate);
    if (dto.initialShrimpCount !== undefined) data.initialShrimpCount = dto.initialShrimpCount;
    if (dto.status) data.status = dto.status;

    return this.prisma.crop.update({
      where: { id },
      data,
      include: {
        pond: {
          select: { id: true, name: true, farmId: true },
        },
      },
    });
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
      throw new BadRequestException('Chỉ có thể thu hoạch vụ nuôi đang hoạt động');
    }

    return this.prisma.crop.update({
      where: { id },
      data: { status: 'HARVESTED' },
      include: { pond: { select: { id: true, name: true, farmId: true } } },
    });
  }
}
