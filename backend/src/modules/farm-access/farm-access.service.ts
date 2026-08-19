import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';

export interface AuthUser {
  userId: string;
  role: string;
}

@Injectable()
export class FarmAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async getAccessibleFarmIds(user: AuthUser) {
    if (user.role === 'ADMIN') return undefined;

    const ownedFarmIds =
      user.role === 'FARM_MANAGER'
        ? (
            await this.prisma.farm.findMany({
              where: { ownerId: user.userId, deletedAt: null },
              select: { id: true },
            })
          ).map((farm) => farm.id)
        : [];

    const assignedFarmIds =
      user.role === 'FARMER' || user.role === 'TECHNICIAN'
        ? (
            await this.prisma.farmStaff.findMany({
              where: {
                userId: user.userId,
                isActive: true,
                farm: { deletedAt: null },
              },
              select: { farmId: true },
            })
          ).map((staff) => staff.farmId)
        : [];

    return Array.from(new Set([...ownedFarmIds, ...assignedFarmIds]));
  }

  async assertCanAccessFarm(user: AuthUser, farmId: string) {
    if (user.role === 'ADMIN') return;

    const allowedFarmIds = await this.getAccessibleFarmIds(user);
    if (!allowedFarmIds?.includes(farmId)) {
      throw new ForbiddenException(
        'Bạn không có quyền truy cập trang trại này',
      );
    }
  }

  async assertCanManageFarm(user: AuthUser, farmId: string) {
    if (user.role === 'ADMIN') return;

    if (user.role !== 'FARM_MANAGER') {
      throw new ForbiddenException(
        'Chỉ quản lý trang trại được thực hiện thao tác này',
      );
    }

    const farm = await this.prisma.farm.findFirst({
      where: { id: farmId, ownerId: user.userId, deletedAt: null },
      select: { id: true },
    });

    if (!farm) {
      throw new ForbiddenException('Bạn không có quyền quản lý trang trại này');
    }
  }

  async assertCanRecordUsage(user: AuthUser, farmId: string) {
    if (user.role !== 'FARMER') {
      throw new ForbiddenException(
        'Chỉ nông dân được ghi nhận tiêu thụ thức ăn',
      );
    }

    const staff = await this.prisma.farmStaff.findFirst({
      where: {
        farmId,
        userId: user.userId,
        isActive: true,
      },
      select: { id: true },
    });

    if (!staff) {
      throw new ForbiddenException(
        'Bạn chưa được phân công vào trang trại này',
      );
    }
  }
}
