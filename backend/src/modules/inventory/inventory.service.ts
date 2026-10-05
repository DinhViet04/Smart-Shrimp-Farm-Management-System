import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { CreateInventoryDto } from './dto/create-inventory.dto.js';
import { UpdateInventoryDto } from './dto/update-inventory.dto.js';
import { CreateInventoryUsageDto } from './dto/create-inventory-usage.dto.js';
import { CreateInventoryImportDto } from './dto/create-inventory-import.dto.js';
import { InventoryCategory } from '@prisma/client';
import {
  AuthUser,
  FarmAccessService,
} from '../farm-access/farm-access.service.js';

@Injectable()
export class InventoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly farmAccess: FarmAccessService,
  ) {}

  async create(data: CreateInventoryDto, user: AuthUser) {
    await this.farmAccess.assertCanManageFarm(user, data.farmId);

    if (data.supplierId) {
      await this.ensureSupplierInFarm(data.supplierId, data.farmId);
    }

    const exists = await this.prisma.inventory.findFirst({
      where: { itemName: data.itemName, farmId: data.farmId, deletedAt: null },
    });
    if (exists) {
      throw new BadRequestException(
        'Tên vật tư đã tồn tại trong trang trại này!',
      );
    }

    if (data.packageQty !== undefined && data.weightPerPkg !== undefined) {
      data.quantity = data.packageQty * data.weightPerPkg;
    }

    return this.prisma.$transaction(async (tx) => {
      const inventory = await tx.inventory.create({
        data: { ...data, supplierId: data.supplierId || null },
        include: { supplier: true },
      });

      if (inventory.quantity && inventory.quantity > 0) {
        const packageType = inventory.packageType || 'đơn vị';
        const packageInfo = inventory.packageQty ? `+${inventory.packageQty} ${packageType}` : '';
        await tx.inventoryUsageLog.create({
          data: {
            inventoryId: inventory.id,
            quantityUsed: inventory.quantity,
            usageDate: new Date(),
            notes: `[NHẬP KHO${packageInfo ? `: ${packageInfo}` : ''}] — Khởi tạo tồn kho ban đầu`,
            createdBy: user.userId,
          },
        });
      }

      return inventory;
    });
  }

  async findAll(
    user: AuthUser,
    search?: string,
    category?: InventoryCategory,
    farmId?: string,
    skip?: number,
    take?: number,
  ) {
    const where: any = { deletedAt: null };
    const accessibleFarmIds = await this.farmAccess.getAccessibleFarmIds(user);

    if (search) {
      where.itemName = { contains: search, mode: 'insensitive' };
    }

    if (category) {
      where.category = category;
    }

    if (farmId) {
      await this.farmAccess.assertCanAccessFarm(user, farmId);
      where.farmId = farmId;
    } else if (accessibleFarmIds) {
      where.farmId = { in: accessibleFarmIds };
    }

    const [data, total] = await Promise.all([
      this.prisma.inventory.findMany({
        where,
        skip: skip ? Number(skip) : undefined,
        take: take ? Number(take) : undefined,
        include: { supplier: true },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.inventory.count({ where }),
    ]);

    return { data, total };
  }

  async findOne(id: string, user?: AuthUser) {
    const inventory = await this.prisma.inventory.findFirst({
      where: { id, deletedAt: null },
      include: { supplier: true },
    });

    if (!inventory) {
      throw new NotFoundException('Không tìm thấy vật tư');
    }
    if (user) {
      await this.farmAccess.assertCanAccessFarm(user, inventory.farmId);
    }
    return inventory;
  }

  async recordUsage(id: string, data: CreateInventoryUsageDto, user: AuthUser) {
    const inventory = await this.findOne(id);
    await this.farmAccess.assertCanAccessFarm(user, inventory.farmId);

    if (data.quantityUsed > inventory.quantity) {
      throw new BadRequestException(
        'Số lượng sử dụng vượt quá tồn kho hiện có!',
      );
    }

    const nextQuantity = inventory.quantity - data.quantityUsed;
    const updateData: any = { quantity: nextQuantity };

    if (
      inventory.packageQty !== null &&
      inventory.weightPerPkg &&
      inventory.weightPerPkg > 0
    ) {
      updateData.packageQty = Number(
        (nextQuantity / inventory.weightPerPkg).toFixed(2),
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const usageLog = await tx.inventoryUsageLog.create({
        data: {
          inventoryId: id,
          quantityUsed: data.quantityUsed,
          usageDate: data.usageDate ? new Date(data.usageDate) : new Date(),
          notes: data.notes,
          createdBy: user.userId,
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
          creator: {
            select: {
              id: true,
              fullName: true,
              role: true,
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

  async recordImport(id: string, data: CreateInventoryImportDto, user: AuthUser) {
    const inventory = await this.findOne(id);
    await this.farmAccess.assertCanAccessFarm(user, inventory.farmId);

    let packagesAdded = data.packagesAdded;
    let quantityAdded = data.quantityAdded;

    if (packagesAdded !== undefined && packagesAdded > 0) {
      if (inventory.weightPerPkg && inventory.weightPerPkg > 0) {
        quantityAdded = packagesAdded * inventory.weightPerPkg;
      } else {
        quantityAdded = quantityAdded || packagesAdded;
      }
    } else if (quantityAdded !== undefined && quantityAdded > 0) {
      if (inventory.weightPerPkg && inventory.weightPerPkg > 0) {
        packagesAdded = quantityAdded / inventory.weightPerPkg;
      }
    }

    if (!quantityAdded || quantityAdded <= 0) {
      throw new BadRequestException('Số lượng nhập phải lớn hơn 0');
    }

    const nextQuantity = inventory.quantity + quantityAdded;
    const updateData: any = { quantity: nextQuantity };

    if (
      inventory.weightPerPkg &&
      inventory.weightPerPkg > 0
    ) {
      updateData.packageQty = Number(
        (nextQuantity / inventory.weightPerPkg).toFixed(2),
      );
    } else if (inventory.packageQty !== null && packagesAdded !== undefined) {
      updateData.packageQty = (inventory.packageQty || 0) + packagesAdded;
    }

    return this.prisma.$transaction(async (tx) => {
      const packageType = inventory.packageType || 'đơn vị';
      const packageInfo = packagesAdded ? `+${packagesAdded} ${packageType}` : '';
      const noteText = data.notes?.trim() ? ` — ${data.notes.trim()}` : '';
      const formattedNotes = `[NHẬP KHO${packageInfo ? `: ${packageInfo}` : ''}]${noteText}`;

      const usageLog = await tx.inventoryUsageLog.create({
        data: {
          inventoryId: id,
          quantityUsed: quantityAdded,
          usageDate: data.importDate ? new Date(data.importDate) : new Date(),
          notes: formattedNotes,
          createdBy: user.userId,
        },
        include: {
          inventory: {
            select: {
              id: true,
              itemName: true,
              category: true,
              unit: true,
              packageType: true,
              weightPerPkg: true,
              farmId: true,
            },
          },
          creator: {
            select: {
              id: true,
              fullName: true,
              role: true,
            },
          },
        },
      });

      const updatedInventory = await tx.inventory.update({
        where: { id },
        data: updateData,
      });

      return {
        ...updatedInventory,
        usageLog,
      };
    });
  }

  async findUsageLogs(
    user: AuthUser,
    farmId?: string,
    inventoryId?: string,
    from?: string,
    to?: string,
    category?: InventoryCategory,
    take = 500,
    type?: 'ALL' | 'IMPORT' | 'EXPORT',
  ) {
    const where: any = {
      inventory: {
        is: {
          deletedAt: null,
          ...(category ? { category } : {}),
        },
      },
    };
    const accessibleFarmIds = await this.farmAccess.getAccessibleFarmIds(user);

    if (inventoryId) {
      where.inventoryId = inventoryId;
    }

    if (farmId) {
      await this.farmAccess.assertCanAccessFarm(user, farmId);
      where.inventory.is.farmId = farmId;
    } else if (accessibleFarmIds) {
      where.inventory.is.farmId = { in: accessibleFarmIds };
    }

    if (from || to) {
      where.usageDate = {};
      if (from) where.usageDate.gte = new Date(from);
      if (to) where.usageDate.lte = new Date(to);
    }

    if (type === 'IMPORT') {
      where.notes = { startsWith: '[NHẬP KHO' };
    } else if (type === 'EXPORT') {
      where.OR = [
        { notes: null },
        { NOT: { notes: { startsWith: '[NHẬP KHO' } } },
      ];
    }

    const logs = await this.prisma.inventoryUsageLog.findMany({
      where,
      include: {
        inventory: {
          select: {
            id: true,
            itemName: true,
            category: true,
            unit: true,
            packageType: true,
            weightPerPkg: true,
            farmId: true,
          },
        },
        creator: {
          select: {
            id: true,
            fullName: true,
            role: true,
          },
        },
      },
      orderBy: { usageDate: 'desc' },
      take: Math.min(take || 500, 1000),
    });

    return logs.map((log) => ({
      ...log,
      type: log.notes?.startsWith('[NHẬP KHO') ? 'IMPORT' : 'EXPORT',
    }));
  }

  async getConsumptionSummary(
    user: AuthUser,
    farmId?: string,
    days?: number,
    category?: InventoryCategory,
  ) {
    const accessibleFarmIds = await this.farmAccess.getAccessibleFarmIds(user);

    const where: any = {
      inventory: {
        is: {
          deletedAt: null,
          ...(category ? { category } : {}),
        },
      },
    };

    if (days !== undefined && days !== null && days > 0) {
      const since = new Date();
      since.setDate(since.getDate() - days);
      where.usageDate = { gte: since };
    }

    if (farmId) {
      await this.farmAccess.assertCanAccessFarm(user, farmId);
      where.inventory.is.farmId = farmId;
    } else if (accessibleFarmIds) {
      where.inventory.is.farmId = { in: accessibleFarmIds };
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
          creator: {
            select: {
              id: true,
              fullName: true,
              role: true,
            },
          },
        },
        orderBy: { usageDate: 'desc' },
      }),
      this.prisma.inventory.findMany({
        where: {
          deletedAt: null,
          ...(category ? { category } : {}),
          ...(farmId ? { farmId } : {}),
          ...(!farmId && accessibleFarmIds
            ? { farmId: { in: accessibleFarmIds } }
            : {}),
        },
        orderBy: { quantity: 'asc' },
      }),
    ]);

    const exportLogs = logs.filter((log) => !log.notes?.startsWith('[NHẬP KHO'));
    const importLogs = logs.filter((log) => log.notes?.startsWith('[NHẬP KHO'));

    const totalUsed = exportLogs.reduce((sum, log) => sum + log.quantityUsed, 0);
    const totalImported = importLogs.reduce((sum, log) => sum + log.quantityUsed, 0);

    const consumptionByItem = exportLogs.reduce((acc: any[], log) => {
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

    let effectiveDays = days && days > 0 ? days : 0;
    if (!effectiveDays && exportLogs.length > 0) {
      const dates = exportLogs
        .map((l) => new Date(l.usageDate).getTime())
        .filter((t) => !isNaN(t));
      if (dates.length > 0) {
        const earliest = Math.min(...dates);
        const latest = Math.max(...dates);
        effectiveDays = Math.max(1, Math.ceil((latest - earliest) / (1000 * 60 * 60 * 24)));
      }
    }

    return {
      days: days || 0,
      totalUsed,
      totalImported,
      averageDailyUsage: effectiveDays > 0 ? totalUsed / effectiveDays : 0,
      lowStockCount: lowStockItems.filter(
        (item) => item.quantity <= item.minThreshold,
      ).length,
      consumptionByItem: consumptionByItem.sort(
        (a, b) => b.quantityUsed - a.quantityUsed,
      ),
      recentLogs: logs.slice(0, 10).map((log) => ({
        ...log,
        type: log.notes?.startsWith('[NHẬP KHO') ? 'IMPORT' : 'EXPORT',
      })),
    };
  }

  async findSuppliers(user: AuthUser, farmId?: string, search?: string) {
    const accessibleFarmIds = await this.farmAccess.getAccessibleFarmIds(user);
    if (farmId) {
      await this.farmAccess.assertCanAccessFarm(user, farmId);
    }

    const suppliers = await this.prisma.supplier.findMany({
      where: {
        deletedAt: null,
        ...(farmId ? { farmId } : {}),
        ...(!farmId && accessibleFarmIds
          ? { farmId: { in: accessibleFarmIds } }
          : {}),
        ...(search ? { name: { contains: search, mode: 'insensitive' } } : {}),
      },
      include: {
        inventories: {
          where: { deletedAt: null },
          select: {
            id: true,
            itemName: true,
            category: true,
            quantity: true,
            unit: true,
            minThreshold: true,
            updatedAt: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    return suppliers.map((supplier) => {
      const latestInventory = supplier.inventories.reduce(
        (latest: any, item: any) => {
          if (!latest || item.updatedAt > latest.updatedAt) return item;
          return latest;
        },
        null,
      );

      return {
        ...supplier,
        items: supplier.inventories,
        itemCount: supplier.inventories.length,
        totalQuantity: supplier.inventories.reduce(
          (sum, item) => sum + item.quantity,
          0,
        ),
        lowStockCount: supplier.inventories.filter(
          (item) => item.quantity <= item.minThreshold,
        ).length,
        categories: Array.from(
          new Set(supplier.inventories.map((item) => item.category)),
        ),
        latestUpdatedAt: latestInventory?.updatedAt ?? supplier.updatedAt,
      };
    });
  }

  async update(id: string, data: UpdateInventoryDto, user: AuthUser) {
    const inventory = await this.findOne(id); // Check exists
    await this.farmAccess.assertCanManageFarm(user, inventory.farmId);
    const nextFarmId = data.farmId ?? inventory.farmId;
    await this.farmAccess.assertCanManageFarm(user, nextFarmId);

    if (data.supplierId) {
      await this.ensureSupplierInFarm(data.supplierId, nextFarmId);
    }

    if (data.itemName) {
      const exists = await this.prisma.inventory.findFirst({
        where: {
          itemName: data.itemName,
          farmId: inventory.farmId,
          id: { not: id },
          deletedAt: null,
        },
      });
      if (exists) {
        throw new BadRequestException(
          'Tên vật tư đã tồn tại trong trang trại này!',
        );
      }
    }

    if (data.packageQty !== undefined || data.weightPerPkg !== undefined) {
      const pkgQty =
        data.packageQty !== undefined ? data.packageQty : inventory.packageQty;
      const weight =
        data.weightPerPkg !== undefined
          ? data.weightPerPkg
          : inventory.weightPerPkg;
      if (pkgQty !== null && weight !== null) {
        data.quantity = pkgQty * weight;
      }
    }

    const updatePayload: any = { ...data };
    if ('supplierId' in updatePayload) {
      updatePayload.supplierId = updatePayload.supplierId || null;
    }

    return this.prisma.inventory.update({
      where: { id },
      data: updatePayload,
      include: { supplier: true },
    });
  }

  private async ensureSupplierInFarm(supplierId: string, farmId: string) {
    const supplier = await this.prisma.supplier.findFirst({
      where: { id: supplierId, farmId, deletedAt: null },
    });

    if (!supplier) {
      throw new BadRequestException('Nhà cung cấp không thuộc trang trại này');
    }
  }

  async remove(id: string, user: AuthUser) {
    const inventory = await this.findOne(id); // Check exists
    await this.farmAccess.assertCanManageFarm(user, inventory.farmId);

    // Check usage logs
    const usageLogsCount = await this.prisma.inventoryUsageLog.count({
      where: { inventoryId: id },
    });

    if (usageLogsCount > 0) {
      throw new BadRequestException(
        'Không thể xóa vật tư này vì đã có dữ liệu nhật ký sử dụng liên quan!',
      );
    }

    return this.prisma.inventory.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
