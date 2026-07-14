import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { CreateSupplierDto } from './dto/create-supplier.dto.js';
import { UpdateSupplierDto } from './dto/update-supplier.dto.js';
import { AuthUser, FarmAccessService } from '../farm-access/farm-access.service.js';

@Injectable()
export class SuppliersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly farmAccess: FarmAccessService,
  ) {}

  async create(data: CreateSupplierDto, user: AuthUser) {
    await this.farmAccess.assertCanManageFarm(user, data.farmId);
    await this.ensureUniqueName(data.name, data.farmId);

    return this.prisma.supplier.create({
      data,
      include: this.defaultInclude(),
    });
  }

  async findAll(user: AuthUser, farmId?: string, search?: string) {
    const where: any = { deletedAt: null };
    const accessibleFarmIds = await this.farmAccess.getAccessibleFarmIds(user);
    if (farmId) {
      await this.farmAccess.assertCanAccessFarm(user, farmId);
      where.farmId = farmId;
    } else if (accessibleFarmIds) {
      where.farmId = { in: accessibleFarmIds };
    }
    if (search) where.name = { contains: search, mode: 'insensitive' };

    const suppliers = await this.prisma.supplier.findMany({
      where,
      include: this.defaultInclude(),
      orderBy: { name: 'asc' },
    });

    return suppliers.map((supplier) => this.toResponse(supplier));
  }

  async findOne(id: string, user?: AuthUser) {
    const supplier = await this.prisma.supplier.findFirst({
      where: { id, deletedAt: null },
      include: this.defaultInclude(),
    });

    if (!supplier) {
      throw new NotFoundException('Không tìm thấy nhà cung cấp');
    }

    if (user) {
      await this.farmAccess.assertCanAccessFarm(user, supplier.farmId);
    }

    return this.toResponse(supplier);
  }

  async update(id: string, data: UpdateSupplierDto, user: AuthUser) {
    const current = await this.prisma.supplier.findFirst({
      where: { id, deletedAt: null },
    });

    if (!current) {
      throw new NotFoundException('Không tìm thấy nhà cung cấp');
    }

    const nextFarmId = data.farmId ?? current.farmId;
    await this.farmAccess.assertCanManageFarm(user, current.farmId);
    await this.farmAccess.assertCanManageFarm(user, nextFarmId);
    if (data.name || data.farmId) {
      await this.ensureUniqueName(data.name ?? current.name, nextFarmId, id);
    }

    const supplier = await this.prisma.supplier.update({
      where: { id },
      data,
      include: this.defaultInclude(),
    });

    return this.toResponse(supplier);
  }

  async remove(id: string, user: AuthUser) {
    const supplier = await this.findOne(id);
    await this.farmAccess.assertCanManageFarm(user, supplier.farmId);

    const inventoryCount = await this.prisma.inventory.count({
      where: { supplierId: id, deletedAt: null },
    });

    if (inventoryCount > 0) {
      throw new BadRequestException('Không thể xóa nhà cung cấp đang được gán cho vật tư');
    }

    return this.prisma.supplier.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  private async ensureUniqueName(name: string, farmId: string, excludeId?: string) {
    const exists = await this.prisma.supplier.findFirst({
      where: {
        name,
        farmId,
        deletedAt: null,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    });

    if (exists) {
      throw new BadRequestException('Tên nhà cung cấp đã tồn tại trong trang trại này');
    }
  }

  private defaultInclude() {
    return {
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
    };
  }

  private toResponse(supplier: any) {
    const inventories = supplier.inventories || [];
    const latestInventory = inventories.reduce((latest: any, item: any) => {
      if (!latest || item.updatedAt > latest.updatedAt) return item;
      return latest;
    }, null);

    return {
      ...supplier,
      itemCount: inventories.length,
      lowStockCount: inventories.filter((item: any) => item.quantity <= item.minThreshold).length,
      categories: Array.from(new Set(inventories.map((item: any) => item.category))),
      latestUpdatedAt: latestInventory?.updatedAt ?? supplier.updatedAt,
    };
  }
}
