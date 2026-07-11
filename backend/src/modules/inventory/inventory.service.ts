import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { CreateInventoryDto } from './dto/create-inventory.dto.js';
import { UpdateInventoryDto } from './dto/update-inventory.dto.js';
import { InventoryCategory } from '@prisma/client';

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateInventoryDto) {
    const exists = await this.prisma.inventory.findFirst({
      where: { itemName: data.itemName, farmId: data.farmId, deletedAt: null },
    });
    if (exists) {
      throw new BadRequestException('Tên vật tư đã tồn tại trong trang trại này!');
    }

    if (data.packageQty !== undefined && data.weightPerPkg !== undefined) {
      data.quantity = data.packageQty * data.weightPerPkg;
    }

    return this.prisma.inventory.create({ data });
  }

  async findAll(search?: string, category?: InventoryCategory, farmId?: string, skip?: number, take?: number) {
    const where: any = { deletedAt: null };
    
    if (search) {
      where.itemName = { contains: search, mode: 'insensitive' };
    }
    
    if (category) {
      where.category = category;
    }

    if (farmId) {
      where.farmId = farmId;
    }

    const [data, total] = await Promise.all([
      this.prisma.inventory.findMany({
        where,
        skip: skip ? Number(skip) : undefined,
        take: take ? Number(take) : undefined,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.inventory.count({ where }),
    ]);

    return { data, total };
  }

  async findOne(id: string) {
    const inventory = await this.prisma.inventory.findFirst({
      where: { id, deletedAt: null },
    });
    
    if (!inventory) {
      throw new NotFoundException('Không tìm thấy vật tư');
    }
    return inventory;
  }

  async update(id: string, data: UpdateInventoryDto) {
    const inventory = await this.findOne(id); // Check exists

    if (data.itemName) {
      const exists = await this.prisma.inventory.findFirst({
        where: { 
          itemName: data.itemName, 
          farmId: inventory.farmId, 
          id: { not: id }, 
          deletedAt: null 
        },
      });
      if (exists) {
        throw new BadRequestException('Tên vật tư đã tồn tại trong trang trại này!');
      }
    }

    if (data.packageQty !== undefined || data.weightPerPkg !== undefined) {
      const pkgQty = data.packageQty !== undefined ? data.packageQty : inventory.packageQty;
      const weight = data.weightPerPkg !== undefined ? data.weightPerPkg : inventory.weightPerPkg;
      if (pkgQty !== null && weight !== null) {
        data.quantity = pkgQty * weight;
      }
    }

    return this.prisma.inventory.update({
      where: { id },
      data,
    });
  }

  async remove(id: string) {
    await this.findOne(id); // Check exists

    // Check usage logs
    const usageLogsCount = await this.prisma.inventoryUsageLog.count({
      where: { inventoryId: id },
    });

    if (usageLogsCount > 0) {
      throw new BadRequestException('Không thể xóa vật tư này vì đã có dữ liệu nhật ký sử dụng liên quan!');
    }

    return this.prisma.inventory.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
