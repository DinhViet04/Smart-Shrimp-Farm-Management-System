import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import * as bcrypt from 'bcryptjs';
import { Prisma, Role } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.user.findMany({
      select: {
        id: true,
        email: true,
        fullName: true,
        phone: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findCandidates() {
    return this.prisma.user.findMany({
      where: {
        role: {
          in: [Role.FARMER, Role.TECHNICIAN],
        },
        isActive: true,
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        isActive: true,
      },
      orderBy: { fullName: 'asc' },
    });
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  async findById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        fullName: true,
        phone: true,
        address: true,
        avatarUrl: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        // Exclude password from default query
      },
    });
  }

  async create(data: Prisma.UserCreateInput) {
    const hashedPassword = data.password ? await bcrypt.hash(data.password, 10) : null;
    return this.prisma.user.create({
      data: {
        ...data,
        password: hashedPassword,
      },
    });
  }

  async updateRole(id: string, role: Role) {
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { id },
        data: { role },
        select: {
          id: true,
          email: true,
          fullName: true,
          role: true,
          isActive: true,
        },
      });

      if (role === Role.FARMER || role === Role.TECHNICIAN) {
        await tx.farmStaff.updateMany({
          where: { userId: id },
          data: { role },
        });
      } else {
        await tx.farmStaff.updateMany({
          where: { userId: id },
          data: { isActive: false },
        });
      }

      return user;
    });
  }

  async updateStatus(id: string, isActive: boolean) {
    return this.prisma.user.update({
      where: { id },
      data: { isActive },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        isActive: true,
      },
    });
  }

  async updateProfile(id: string, data: { fullName?: string; phone?: string; address?: string; avatarUrl?: string }) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new BadRequestException('Người dùng không tồn tại');
    }

    return this.prisma.user.update({
      where: { id },
      data: {
        fullName: data.fullName,
        phone: data.phone ?? null,
        address: data.address ?? null,
        avatarUrl: data.avatarUrl ?? null,
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        phone: true,
        address: true,
        avatarUrl: true,
        role: true,
        isActive: true,
      },
    });
  }

  async changePassword(id: string, currentPassword: string, newPassword: string, confirmPassword: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user || !user.password) {
      throw new BadRequestException('Tài khoản này không hỗ trợ đổi mật khẩu');
    }

    if (newPassword !== confirmPassword) {
      throw new BadRequestException('Xác nhận mật khẩu không khớp');
    }

    const isCurrentValid = await bcrypt.compare(currentPassword, user.password);
    if (!isCurrentValid) {
      throw new UnauthorizedException('Mật khẩu hiện tại không đúng');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({
      where: { id },
      data: { password: hashedPassword },
    });

    return { message: 'Đổi mật khẩu thành công' };
  }

  async updatePasswordByEmail(email: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new BadRequestException('Người dùng không tồn tại');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    return this.prisma.user.update({
      where: { email },
      data: { password: hashedPassword },
    });
  }

  async updateGoogleId(id: string, googleId: string) {
    return this.prisma.user.update({
      where: { id },
      data: { googleId },
    });
  }
}
