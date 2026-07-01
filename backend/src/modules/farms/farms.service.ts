import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateFarmDto } from './dto/create-farm.dto';
import { UpdateFarmDto } from './dto/update-farm.dto';

@Injectable()
export class FarmsService {
  constructor(private prisma: PrismaService) {}

  async create(data: CreateFarmDto) {
    const exists = await this.prisma.farm.findFirst({ where: { name: data.name } });
    if (exists) throw new BadRequestException('Tên nông trại đã tồn tại!');
    
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { ponds_count, ...farmData } = data;

    return this.prisma.farm.create({ data: farmData });
  }

  async findAll(search?: string, status?: string) {
    const where: any = { deletedAt: null }; 
    if (search) where.name = { contains: search, mode: 'insensitive' };
    if (status) where.status = status;
    return this.prisma.farm.findMany({ where, include: { owner: true, ponds: true } });
  }

  async findOne(id: string) {
    const farm = await this.prisma.farm.findFirst({ where: { id, deletedAt: null }, include: { owner: true, ponds: true } });
    if (!farm) throw new NotFoundException('Không tìm thấy nông trại');
    return farm;
  }

  async update(id: string, data: UpdateFarmDto) {
    await this.findOne(id); 
    if (data.name) {
      const exists = await this.prisma.farm.findFirst({ where: { name: data.name, id: { not: id } } });
      if (exists) throw new BadRequestException('Tên nông trại đã tồn tại!');
    }
    
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { ponds_count, ...farmData } = data;

    return this.prisma.farm.update({ where: { id }, data: farmData });
  }

  async remove(id: string) {
    const farm = await this.prisma.farm.findUnique({ 
      where: { id }, 
      include: { ponds: true } 
    });
    
    if (!farm || farm.deletedAt) throw new NotFoundException('Không tìm thấy nông trại');
    
    if (farm.ponds.length > 0) {
      throw new BadRequestException('Không thể xóa nông trại đang có Ao nuôi!');
    }

    return this.prisma.farm.update({
      where: { id },
      data: { deletedAt: new Date() }
    });
  }
}
