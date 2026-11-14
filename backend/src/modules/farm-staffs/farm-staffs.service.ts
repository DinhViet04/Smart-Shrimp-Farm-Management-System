import {
  BadRequestException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import {
  AuthUser,
  FarmAccessService,
} from '../farm-access/farm-access.service.js';
import { CreateFarmStaffDto } from './dto/create-farm-staff.dto.js';
import { UpdateFarmStaffDto } from './dto/update-farm-staff.dto.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { ChatGroupsService } from '../chat-groups/chat-groups.service.js';

@Injectable()
export class FarmStaffsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly farmAccess: FarmAccessService,
    private readonly notificationsService: NotificationsService,
    @Optional() private readonly chatGroupsService?: ChatGroupsService,
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
      if (staffUser.role !== Role.ADMIN) {
        await this.prisma.user.update({
          where: { id: staffUser.id },
          data: { role: data.role },
        });
        staffUser.role = data.role;
      } else {
        throw new BadRequestException(
          'Không thể phân công tài khoản Admin làm nhân sự trang trại',
        );
      }
    }

    const farm = await this.prisma.farm.findUnique({
      where: { id: data.farmId },
    });
    if (!farm) {
      throw new NotFoundException('Không tìm thấy trang trại');
    }
    if (farm.ownerId === staffUser.id) {
      throw new BadRequestException(
        'Không thể thêm chính chủ trang trại vào danh sách nhân sự',
      );
    }

    const existingStaff = await this.prisma.farmStaff.findUnique({
      where: { farmId_userId: { farmId: data.farmId, userId: data.userId } },
    });

    const staff = await this.prisma.farmStaff.upsert({
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

    if ((data.isActive ?? true) && this.chatGroupsService) {
      await this.chatGroupsService.addMemberToFarmChatGroup(
        data.farmId,
        data.userId,
        data.role as 'FARMER' | 'TECHNICIAN',
        staffUser.fullName || staffUser.email,
      );
    }

    // Notify if they are newly added
    if (!existingStaff && farm) {
      await this.notificationsService.createFarmJoinNotification(
        data.userId,
        data.farmId,
        farm.name,
        data.role,
      );
    }

    return staff;
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

    const updated = await this.prisma.farmStaff.update({
      where: { id },
      data,
    });

    if (this.chatGroupsService) {
      if (updated.isActive === false) {
        await this.chatGroupsService.removeMemberFromFarmChatGroup(
          updated.farmId,
          updated.userId,
        );
      } else {
        await this.chatGroupsService.addMemberToFarmChatGroup(
          updated.farmId,
          updated.userId,
          updated.role as 'FARMER' | 'TECHNICIAN',
        );
      }
    }

    return updated;
  }

  async remove(id: string, user: AuthUser) {
    const current = await this.prisma.farmStaff.findUnique({ where: { id } });
    if (!current) {
      throw new NotFoundException('Không tìm thấy phân công nhân sự');
    }

    await this.farmAccess.assertCanManageFarm(user, current.farmId);
    const removed = await this.prisma.farmStaff.delete({ where: { id } });
    if (this.chatGroupsService) {
      await this.chatGroupsService.removeMemberFromFarmChatGroup(
        current.farmId,
        current.userId,
      );
    }
    return removed;
  }

  private assertAssignableRole(role: Role) {
    if (role !== Role.FARMER && role !== Role.TECHNICIAN) {
      throw new BadRequestException(
        'Chỉ được phân công Farmer hoặc Technician vào trang trại',
      );
    }
  }
}
