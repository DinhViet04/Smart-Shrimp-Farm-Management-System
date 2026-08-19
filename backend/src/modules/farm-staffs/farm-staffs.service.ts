import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import {
  AuthUser,
  FarmAccessService,
} from '../farm-access/farm-access.service.js';
import { CreateFarmStaffDto } from './dto/create-farm-staff.dto.js';
import { UpdateFarmStaffDto } from './dto/update-farm-staff.dto.js';

@Injectable()
export class FarmStaffsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly farmAccess: FarmAccessService,
  ) {}

  async findAll(user: AuthUser, farmId?: string) {
    const where: any = {};
    const accessibleFarmIds = await this.farmAccess.getAccessibleFarmIds(user);

    if (farmId) {
      await this.farmAccess.assertCanAccessFarm(user, farmId);
      where.farmId = farmId;
    } else if (accessibleFarmIds) {
      where.farmId = { in: accessibleFarmIds };
    }

    return this.prisma.farmStaff.findMany({
      where,
      include: {
        farm: { select: { id: true, name: true } },
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            role: true,
            isActive: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(data: CreateFarmStaffDto, user: AuthUser) {
    await this.farmAccess.assertCanManageFarm(user, data.farmId);
    this.assertAssignableRole(data.role);

    const staffUser = await this.prisma.user.findFirst({
      where: { id: data.userId, isActive: true },
    });

    if (!staffUser) {
      throw new NotFoundException('Không tìm thấy người dùng');
    }

    if (staffUser.role !== data.role) {
      throw new BadRequestException(
        'Vai trò phân công phải trùng với vai trò tài khoản',
      );
    }

    return this.prisma.farmStaff.upsert({
      where: { farmId_userId: { farmId: data.farmId, userId: data.userId } },
      create: {
        farmId: data.farmId,
        userId: data.userId,
        role: data.role,
        isActive: data.isActive ?? true,
      },
      update: {
        role: data.role,
        isActive: data.isActive ?? true,
      },
    });
  }

  async update(id: string, data: UpdateFarmStaffDto, user: AuthUser) {
    const current = await this.prisma.farmStaff.findUnique({ where: { id } });
    if (!current) {
      throw new NotFoundException('Không tìm thấy phân công nhân sự');
    }

    await this.farmAccess.assertCanManageFarm(user, current.farmId);
    if (data.farmId)
      await this.farmAccess.assertCanManageFarm(user, data.farmId);
    if (data.role) this.assertAssignableRole(data.role);

    return this.prisma.farmStaff.update({
      where: { id },
      data,
    });
  }

  async remove(id: string, user: AuthUser) {
    const current = await this.prisma.farmStaff.findUnique({ where: { id } });
    if (!current) {
      throw new NotFoundException('Không tìm thấy phân công nhân sự');
    }

    await this.farmAccess.assertCanManageFarm(user, current.farmId);
    return this.prisma.farmStaff.delete({ where: { id } });
  }

  private assertAssignableRole(role: Role) {
    if (role !== Role.FARMER && role !== Role.TECHNICIAN) {
      throw new BadRequestException(
        'Chỉ được phân công Farmer hoặc Technician vào trang trại',
      );
    }
  }
}
