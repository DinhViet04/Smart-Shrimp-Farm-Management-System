import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { CreateInventoryDto } from './dto/create-inventory.dto.js';
import { UpdateInventoryDto } from './dto/update-inventory.dto.js';
import { CreateInventoryUsageDto } from './dto/create-inventory-usage.dto.js';
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

  async recordUsage(id: string, data: CreateInventoryUsageDto) {
    const inventory = await this.findOne(id);

    if (data.quantityUsed > inventory.quantity) {
      throw new BadRequestException('Số lượng sử dụng vượt quá tồn kho hiện có!');
    }

    const nextQuantity = inventory.quantity - data.quantityUsed;
    const updateData: any = { quantity: nextQuantity };

    if (inventory.packageQty !== null && inventory.weightPerPkg && inventory.weightPerPkg > 0) {
      updateData.packageQty = Number((nextQuantity / inventory.weightPerPkg).toFixed(2));
    }

    return this.prisma.$transaction(async (tx) => {
      const usageLog = await tx.inventoryUsageLog.create({
        data: {
          inventoryId: id,
          quantityUsed: data.quantityUsed,
          usageDate: data.usageDate ? new Date(data.usageDate) : new Date(),
          notes: data.notes,
        },
        include: {
          inventory: {
            select: {
              id: true,
              itemName: true,
              category: true,
              unit: true,
              farmId: true,
            },
          },
        },
      });

      await tx.inventory.update({
        where: { id },
        data: updateData,
      });

      return usageLog;
    });
  }

  async findUsageLogs(farmId?: string, inventoryId?: string, from?: string, to?: string) {
    const where: any = {
      inventory: {
        is: {
          deletedAt: null,
        },
      },
    };

    if (inventoryId) {
      where.inventoryId = inventoryId;
    }

    if (farmId) {
      where.inventory.is.farmId = farmId;
    }

    if (from || to) {
      where.usageDate = {};
      if (from) where.usageDate.gte = new Date(from);
      if (to) where.usageDate.lte = new Date(to);
    }

    return this.prisma.inventoryUsageLog.findMany({
      where,
      include: {
        inventory: {
          select: {
            id: true,
            itemName: true,
            category: true,
            unit: true,
            farmId: true,
          },
        },
      },
      orderBy: { usageDate: 'desc' },
      take: 50,
    });
  }

  async getConsumptionSummary(farmId?: string, days = 30) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const where: any = {
      usageDate: { gte: since },
      inventory: {
        is: {
          deletedAt: null,
          category: InventoryCategory.FEED,
        },
      },
    };

    if (farmId) {
      where.inventory.is.farmId = farmId;
    }

    const [logs, lowStockItems] = await Promise.all([
      this.prisma.inventoryUsageLog.findMany({
        where,
        include: {
          inventory: {
            select: {
              id: true,
              itemName: true,
              unit: true,
              quantity: true,
              minThreshold: true,
            },
          },
        },
        orderBy: { usageDate: 'desc' },
      }),
      this.prisma.inventory.findMany({
        where: {
          deletedAt: null,
          category: InventoryCategory.FEED,
          ...(farmId ? { farmId } : {}),
        },
        orderBy: { quantity: 'asc' },
      }),
    ]);

    const totalUsed = logs.reduce((sum, log) => sum + log.quantityUsed, 0);
    const consumptionByItem = logs.reduce((acc: any[], log) => {
      const existing = acc.find((item) => item.inventoryId === log.inventoryId);
      if (existing) {
        existing.quantityUsed += log.quantityUsed;
        return acc;
      }
      acc.push({
        inventoryId: log.inventoryId,
        itemName: log.inventory.itemName,
        unit: log.inventory.unit,
        quantityUsed: log.quantityUsed,
        currentQuantity: log.inventory.quantity,
        minThreshold: log.inventory.minThreshold,
      });
      return acc;
    }, []);

    return {
      days,
      totalUsed,
      averageDailyUsage: days > 0 ? totalUsed / days : 0,
      lowStockCount: lowStockItems.filter((item) => item.quantity <= item.minThreshold).length,
      consumptionByItem: consumptionByItem.sort((a, b) => b.quantityUsed - a.quantityUsed),
      recentLogs: logs.slice(0, 10),
    };
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
