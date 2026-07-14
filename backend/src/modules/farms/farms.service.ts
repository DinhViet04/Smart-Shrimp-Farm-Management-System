import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import { CreateFarmDto } from './dto/create-farm.dto.js';
import { UpdateFarmDto } from './dto/update-farm.dto.js';
import { FarmAccessService } from '../farm-access/farm-access.service.js';

@Injectable()
export class FarmsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly farmAccess: FarmAccessService,
  ) {}

  async create(data: CreateFarmDto) {
    const exists = await this.prisma.farm.findFirst({ where: { name: data.name } });
    if (exists) throw new BadRequestException('Ten nong trai da ton tai');

    const { ponds_count, staffIds, ...farmData } = data;
    void ponds_count;

    const farm = await this.prisma.farm.create({ data: farmData });

    if (staffIds?.length) {
      await this.prisma.farmStaff.createMany({
        data: await this.buildStaffAssignments(farm.id, staffIds),
      });
    }

    return farm;
  }

  async findAll(search?: string, status?: string, userId?: string, role?: string) {
    const where: any = { deletedAt: null };
    if (search) where.name = { contains: search, mode: 'insensitive' };
    if (status) where.status = status;

    if (role && role !== 'ADMIN' && userId) {
      const accessibleFarmIds = await this.farmAccess.getAccessibleFarmIds({ userId, role });
      where.id = { in: accessibleFarmIds };
    }

    return this.prisma.farm.findMany({
      where,
      include: { owner: true, ponds: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findAllByManager(userId: string) {
    return this.prisma.farm.findMany({
      where: { ownerId: userId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, userId?: string, role?: string) {
    const farm = await this.prisma.farm.findFirst({
      where: { id, deletedAt: null },
      include: { owner: true, ponds: true },
    });

    if (!farm) throw new NotFoundException('Khong tim thay nong trai');

    if (userId && role) {
      await this.farmAccess.assertCanAccessFarm({ userId, role }, id);
    }

    return farm;
  }

  async update(id: string, data: UpdateFarmDto, userId?: string, role?: string) {
    const farm = await this.findOne(id, userId, role);
    if (userId && role) {
      await this.farmAccess.assertCanManageFarm({ userId, role }, id);
    } else if (farm.ownerId !== userId) {
      throw new ForbiddenException('Ban khong co quyen cap nhat trang trai nay');
    }

    if (data.name) {
      const exists = await this.prisma.farm.findFirst({ where: { name: data.name, id: { not: id } } });
      if (exists) throw new BadRequestException('Ten nong trai da ton tai');
    }

    if (data.area !== undefined) {
      const totalPondsArea = await this.prisma.pond.aggregate({
        where: { farmId: id },
        _sum: { areaSize: true },
      });
      const currentPondsArea = totalPondsArea._sum.areaSize || 0;

      if (data.area < currentPondsArea) {
        throw new BadRequestException(
          `Khong the giam dien tich trang trai xuong ${data.area}m2 vi tong dien tich cac ao hien tai (${currentPondsArea}m2) da vuot qua muc nay.`,
        );
      }
    }

    const { ponds_count, staffIds, ...farmData } = data;
    void ponds_count;

    const updatedFarm = await this.prisma.farm.update({ where: { id }, data: farmData });

    if (staffIds) {
      await this.prisma.farmStaff.deleteMany({ where: { farmId: id } });
      if (staffIds.length > 0) {
        await this.prisma.farmStaff.createMany({
          data: await this.buildStaffAssignments(id, staffIds),
        });
      }
    }

    return updatedFarm;
  }

  async remove(id: string, userId?: string, role?: string) {
    const farm = await this.findOne(id, userId, role);
    if (userId && role) {
      await this.farmAccess.assertCanManageFarm({ userId, role }, id);
    } else if (farm.ownerId !== userId) {
      throw new ForbiddenException('Ban khong co quyen xoa trang trai nay');
    }

    if (farm.ponds && farm.ponds.length > 0) {
      throw new BadRequestException('Khong the xoa nong trai dang co ao nuoi');
    }

    return this.prisma.farm.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async getStaff(farmId: string, userId: string, role: string) {
    await this.findOne(farmId, userId, role);
    if (role !== 'ADMIN') {
      await this.farmAccess.assertCanManageFarm({ userId, role }, farmId);
    }

    return this.prisma.farmStaff.findMany({
      where: { farmId, isActive: true },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            fullName: true,
            role: true,
            phone: true,
          },
        },
      },
      orderBy: { assignedAt: 'desc' },
    });
  }

  async assignStaff(farmId: string, userIdToAssign: string, requesterId: string, role: string) {
    await this.farmAccess.assertCanManageFarm({ userId: requesterId, role }, farmId);

    const userToAssign = await this.prisma.user.findUnique({ where: { id: userIdToAssign } });
    if (!userToAssign) throw new NotFoundException('Khong tim thay tai khoan nhan su');
    if (userToAssign.role !== Role.FARMER && userToAssign.role !== Role.TECHNICIAN) {
      throw new BadRequestException('Chi co the phan cong tai khoan Farmer hoac Technician');
    }

    const existing = await this.prisma.farmStaff.findUnique({
      where: {
        farmId_userId: {
          farmId,
          userId: userIdToAssign,
        },
      },
    });
    if (existing) {
      throw new BadRequestException('Nhan su nay da duoc phan cong vao trang trai tu truoc');
    }

    return this.prisma.farmStaff.create({
      data: {
        farmId,
        userId: userIdToAssign,
        role: userToAssign.role,
        isActive: true,
      },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            role: true,
          },
        },
      },
    });
  }

  async unassignStaff(farmId: string, userIdToUnassign: string, requesterId: string, role: string) {
    await this.farmAccess.assertCanManageFarm({ userId: requesterId, role }, farmId);

    const assignment = await this.prisma.farmStaff.findUnique({
      where: {
        farmId_userId: {
          farmId,
          userId: userIdToUnassign,
        },
      },
    });
    if (!assignment) {
      throw new NotFoundException('Nhan su nay chua tung duoc phan cong vao trang trai');
    }

    return this.prisma.farmStaff.delete({
      where: {
        farmId_userId: {
          farmId,
          userId: userIdToUnassign,
        },
      },
    });
  }

  private async buildStaffAssignments(farmId: string, staffIds: string[]) {
    const users = await this.prisma.user.findMany({
      where: { id: { in: staffIds }, isActive: true },
      select: { id: true, role: true },
    });

    if (users.length !== staffIds.length) {
      throw new BadRequestException('Danh sach nhan su khong hop le');
    }

    const invalid = users.find((user) => user.role !== Role.FARMER && user.role !== Role.TECHNICIAN);
    if (invalid) {
      throw new BadRequestException('Chi duoc phan cong Farmer hoac Technician vao trang trai');
    }

    return users.map((user) => ({
      farmId,
      userId: user.id,
      role: user.role,
      isActive: true,
    }));
  }
}
