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
    const { ponds_count, staffIds, ...farmData } = data;

    const farm = await this.prisma.farm.create({ data: farmData });

    if (staffIds && staffIds.length > 0) {
      await this.prisma.farmStaff.createMany({
        data: staffIds.map((userId) => ({ farmId: farm.id, userId })),
      });
    }

    return farm;
  }

  async findAll(search?: string, status?: string, userId?: string, role?: string) {
    const where: any = { deletedAt: null }; 
    if (search) where.name = { contains: search, mode: 'insensitive' };
    if (status) where.status = status;

    if (role !== 'ADMIN' && userId) {
      where.OR = [
        { ownerId: userId },
        { staff: { some: { userId } } }
      ];
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
    const farm = await this.prisma.farm.findFirst({ 
      where: { id, deletedAt: null }, 
      include: { owner: true, ponds: true } 
    });
    
    if (!farm) throw new NotFoundException('Không tìm thấy nông trại');

    if (role !== 'ADMIN' && userId && farm.ownerId !== userId) {
      const isStaff = await this.prisma.farmStaff.findUnique({
        where: {
          farmId_userId: {
            farmId: id,
            userId,
          },
        },
      });
      if (!isStaff) {
        throw new ForbiddenException('Bạn không có quyền truy cập nông trại này');
      }
    }

    return farm;
  }

  async update(id: string, data: UpdateFarmDto, userId?: string, role?: string) {
    const farm = await this.findOne(id, userId, role); 
    if (role !== 'ADMIN' && userId && farm.ownerId !== userId) {
      throw new ForbiddenException('Chỉ chủ trang trại hoặc quản trị viên mới có quyền chỉnh sửa trang trại này');
    }

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
    const { ponds_count, staffIds, ...farmData } = data;

    const updatedFarm = await this.prisma.farm.update({ where: { id }, data: farmData });

    if (staffIds) {
      await this.prisma.farmStaff.deleteMany({ where: { farmId: id } });
      if (staffIds.length > 0) {
        await this.prisma.farmStaff.createMany({
          data: staffIds.map((userId) => ({ farmId: id, userId })),
        });
      }
    }

    return updatedFarm;
  }

  async remove(id: string, userId?: string, role?: string) {
    const farm = await this.findOne(id, userId, role);
    if (role !== 'ADMIN' && userId && farm.ownerId !== userId) {
      throw new ForbiddenException('Chỉ chủ trang trại hoặc quản trị viên mới có quyền xóa trang trại này');
    }
    
    if (farm.ponds && farm.ponds.length > 0) {
      throw new BadRequestException('Không thể xóa nông trại đang có Ao nuôi!');
    }

    return this.prisma.farm.update({
      where: { id },
      data: { deletedAt: new Date() }
    });
  }

  async getStaff(farmId: string, userId: string, role: string) {
    await this.findOne(farmId, userId, role);

    return this.prisma.farmStaff.findMany({
      where: { farmId },
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
    const farm = await this.prisma.farm.findUnique({ where: { id: farmId } });
    if (!farm) throw new NotFoundException('Không tìm thấy trang trại');
    if (role !== 'ADMIN' && farm.ownerId !== requesterId) {
      throw new ForbiddenException('Chỉ chủ trang trại hoặc quản trị viên mới được phép phân công nhân sự');
    }

    const userToAssign = await this.prisma.user.findUnique({ where: { id: userIdToAssign } });
    if (!userToAssign) throw new NotFoundException('Không tìm thấy tài khoản nhân sự');
    if (userToAssign.role !== 'FARMER' && userToAssign.role !== 'TECHNICIAN') {
      throw new BadRequestException('Chỉ có thể phân công tài khoản Nông dân hoặc Kỹ thuật viên');
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
      throw new BadRequestException('Nhân sự này đã được phân công vào trang trại từ trước');
    }

    return this.prisma.farmStaff.create({
      data: {
        farmId,
        userId: userIdToAssign,
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
    const farm = await this.prisma.farm.findUnique({ where: { id: farmId } });
    if (!farm) throw new NotFoundException('Không tìm thấy trang trại');
    if (role !== 'ADMIN' && farm.ownerId !== requesterId) {
      throw new ForbiddenException('Chỉ chủ trang trại hoặc quản trị viên mới được phép gỡ phân công nhân sự');
    }

    const assignment = await this.prisma.farmStaff.findUnique({
      where: {
        farmId_userId: {
          farmId,
          userId: userIdToUnassign,
        },
      },
    });
    if (!assignment) {
      throw new NotFoundException('Nhân sự này chưa từng được phân công vào trang trại');
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
}
