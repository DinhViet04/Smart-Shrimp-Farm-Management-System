import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
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

  async lookupStaff(email: string, expectedRole?: string) {
    if (!email || !email.trim()) {
      throw new BadRequestException(
        'Vui lòng nhập địa chỉ email/gmail cần tìm kiếm',
      );
    }

    const trimmedEmail = email.trim().toLowerCase();
    const user = await this.prisma.user.findFirst({
      where: {
        email: { equals: trimmedEmail, mode: 'insensitive' },
        isActive: true,
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        phone: true,
        role: true,
        isActive: true,
      },
    });

    if (!user) {
      throw new NotFoundException(
        `Không tìm thấy tài khoản hoạt động nào với email "${email}". Người dùng cần đăng ký tài khoản trước.`,
      );
    }

    if (user.role !== Role.FARMER && user.role !== Role.TECHNICIAN) {
      throw new BadRequestException(
        `Tài khoản "${email}" có vai trò ${user.role}, không thể phân công làm nhân sự trang trại.`,
      );
    }

    if (expectedRole && user.role !== expectedRole) {
      const roleName =
        user.role === Role.TECHNICIAN
          ? 'Kỹ thuật viên (Technician)'
          : 'Nông dân (Farmer)';
      const expectedName =
        expectedRole === Role.TECHNICIAN
          ? 'Kỹ thuật viên (Technician)'
          : 'Nông dân (Farmer)';
      throw new BadRequestException(
        `Tài khoản "${email}" là ${roleName}, không khớp với danh sách ${expectedName} bạn đang chọn!`,
      );
    }

    return user;
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
    const hashedPassword = data.password
      ? await bcrypt.hash(data.password, 10)
      : null;
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

  async updateProfile(
    id: string,
    data: {
      fullName?: string;
      phone?: string;
      address?: string;
      avatarUrl?: string;
      role?: Role;
    },
  ) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new BadRequestException('Người dùng không tồn tại');
    }

    let updatedRole = user.role;
    if (
      data.role &&
      ['FARM_MANAGER', 'FARMER', 'TECHNICIAN'].includes(data.role)
    ) {
      // Don't modify role if current user is ADMIN, otherwise allow switching non-admin roles
      if (user.role !== Role.ADMIN) {
        updatedRole = data.role;
      }
    }

    return this.prisma.user.update({
      where: { id },
      data: {
        fullName: data.fullName,
        phone: data.phone ?? null,
        address: data.address ?? null,
        avatarUrl: data.avatarUrl ?? null,
        role: updatedRole,
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

  async changePassword(
    id: string,
    currentPassword: string,
    newPassword: string,
    confirmPassword: string,
  ) {
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
