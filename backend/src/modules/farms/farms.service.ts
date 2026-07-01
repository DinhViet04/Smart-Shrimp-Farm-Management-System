import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { CreateFarmDto } from './dto/create-farm.dto.js';
import { UpdateFarmDto } from './dto/update-farm.dto.js';

@Injectable()
export class FarmsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateFarmDto) {
    const exists = await this.prisma.farm.findFirst({ where: { name: data.name } });
    if (exists) throw new BadRequestException('Tên nông trại đã tồn tại!');
    
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { ponds_count, ...farmData } = data;

    return this.prisma.farm.create({ data: farmData });
  }

  async findAll(search?: string, status?: string, userId?: string, role?: string) {
    const where: any = { deletedAt: null }; 
    if (search) where.name = { contains: search, mode: 'insensitive' };
    if (status) where.status = status;

    if (role !== 'ADMIN' && userId) {
      where.ownerId = userId;
    }

    return this.prisma.farm.findMany({ 
      where, 
      include: { owner: true, ponds: true },
      orderBy: { createdAt: 'desc' }
    });
  }

  async findAllByManager(userId: string) {
    return this.prisma.farm.findMany({
      where: { ownerId: userId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, userId?: string, role?: string) {
    const where: any = { id, deletedAt: null };
    
    if (role !== 'ADMIN' && userId) {
      where.ownerId = userId;
    }

    const farm = await this.prisma.farm.findFirst({ 
      where, 
      include: { owner: true, ponds: true } 
    });
    
    if (!farm) throw new NotFoundException('Không tìm thấy nông trại hoặc bạn không có quyền truy cập');
    return farm;
  }

  async update(id: string, data: UpdateFarmDto, userId?: string, role?: string) {
    await this.findOne(id, userId, role); 
    if (data.name) {
      const exists = await this.prisma.farm.findFirst({ where: { name: data.name, id: { not: id } } });
      if (exists) throw new BadRequestException('Tên nông trại đã tồn tại!');
    }

    if (data.area !== undefined) {
      const totalPondsArea = await this.prisma.pond.aggregate({
        where: { farmId: id },
        _sum: { areaSize: true },
      });
      const currentPondsArea = totalPondsArea._sum.areaSize || 0;
      
      if (data.area < currentPondsArea) {
        throw new BadRequestException(`Không thể giảm diện tích trang trại xuống ${data.area}m² vì tổng diện tích các ao hiện tại (${currentPondsArea}m²) đã vượt quá mức này.`);
      }
    }
    
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { ponds_count, ...farmData } = data;

    return this.prisma.farm.update({ where: { id }, data: farmData });
  }

  async remove(id: string, userId?: string, role?: string) {
    const farm = await this.findOne(id, userId, role);
    
    if (farm.ponds && farm.ponds.length > 0) {
      throw new BadRequestException('Không thể xóa nông trại đang có Ao nuôi!');
    }

    return this.prisma.farm.update({
      where: { id },
      data: { deletedAt: new Date() }
    });
  }
}
