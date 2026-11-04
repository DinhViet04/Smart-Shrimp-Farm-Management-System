import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service.js';
import * as bcrypt from 'bcryptjs';
import * as nodemailer from 'nodemailer';
import { Prisma, Role } from '@prisma/client';
import { GetUsersQueryDto } from './dto/get-users-query.dto.js';
import { CreateUserByAdminDto } from './dto/create-user-by-admin.dto.js';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async findAll(query: GetUsersQueryDto = new GetUsersQueryDto()) {
    const page = query.page || 1;
    const pageSize = query.pageSize || 20;
    const search = query.search?.trim();
    const where: Prisma.UserWhereInput = {
      ...(query.role ? { role: query.role } : {}),
      ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
      ...(search
        ? {
            OR: [
              { fullName: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
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
      }),
      this.prisma.user.count({ where }),
    ]);
    return {
      items,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    };
  }

  async createByAdmin(dto: CreateUserByAdminDto, actorId: string) {
    const email = dto.email.trim().toLowerCase();
    if (await this.prisma.user.findUnique({ where: { email } }))
      throw new ConflictException('Email đã được sử dụng');
    const password = await bcrypt.hash(dto.password, 10);
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          fullName: dto.fullName.trim(),
          password,
          role: dto.role,
          isActive: true,
        },
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
      });
      await tx.adminAuditLog.create({
        data: {
          actorId,
          action: 'USER_CREATED',
          targetType: 'USER',
          targetId: user.id,
          details: { email: user.email, role: user.role },
        },
      });
      return user;
    });
  }

  async findCandidates(includeManagers = false) {
    return this.prisma.user.findMany({
      where: {
        role: {
          in: includeManagers
            ? [Role.FARMER, Role.TECHNICIAN, Role.FARM_MANAGER]
            : [Role.FARMER, Role.TECHNICIAN],
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
    const user = await this.prisma.user.findUnique({
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
        password: true,
        googleId: true,
      },
    });

    if (!user) return null;

    const { password, googleId, ...rest } = user;
    return {
      ...rest,
      hasPassword: Boolean(password),
      isGoogleAccount: Boolean(googleId),
    };
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

  async updateRole(id: string, role: Role, actorId: string) {
    if (id === actorId)
      throw new ForbiddenException(
        'Không thể tự thay đổi vai trò của chính mình',
      );
    return this.prisma.$transaction(async (tx) => {
      const target = await tx.user.findUnique({
        where: { id },
        select: {
          role: true,
          isActive: true,
          _count: { select: { farms: true } },
        },
      });
      if (!target) throw new NotFoundException('Người dùng không tồn tại');
      if (
        target.role === Role.FARM_MANAGER &&
        role !== Role.FARM_MANAGER &&
        target._count.farms > 0
      )
        throw new BadRequestException(
          'Hãy chuyển quyền sở hữu trang trại trước khi đổi vai trò quản lý',
        );
      if (
        target.role === Role.ADMIN &&
        role !== Role.ADMIN &&
        target.isActive
      ) {
        const count = await tx.user.count({
          where: { role: Role.ADMIN, isActive: true },
        });
        if (count <= 1)
          throw new BadRequestException(
            'Hệ thống phải còn ít nhất một Admin hoạt động',
          );
      }
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

      await tx.adminAuditLog.create({
        data: {
          actorId,
          action: 'USER_ROLE_CHANGED',
          targetType: 'USER',
          targetId: id,
          details: { from: target.role, to: role },
        },
      });

      return user;
    });
  }

  async updateStatus(id: string, isActive: boolean, actorId: string) {
    if (id === actorId)
      throw new ForbiddenException(
        'Không thể tự khóa tài khoản của chính mình',
      );
    return this.prisma.$transaction(async (tx) => {
      const target = await tx.user.findUnique({
        where: { id },
        select: { role: true, isActive: true },
      });
      if (!target) throw new NotFoundException('Người dùng không tồn tại');
      if (target.role === Role.ADMIN && target.isActive && !isActive) {
        const count = await tx.user.count({
          where: { role: Role.ADMIN, isActive: true },
        });
        if (count <= 1)
          throw new BadRequestException(
            'Hệ thống phải còn ít nhất một Admin hoạt động',
          );
      }
      const user = await tx.user.update({
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
      if (!isActive)
        await tx.refreshSession.updateMany({
          where: { userId: id, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      if (target.isActive !== isActive)
        await tx.adminAuditLog.create({
          data: {
            actorId,
            action: isActive ? 'USER_ACTIVATED' : 'USER_DEACTIVATED',
            targetType: 'USER',
            targetId: id,
            details: { from: target.isActive, to: isActive },
          },
        });
      return user;
    });
  }

  async updateProfile(
    id: string,
    data: {
      fullName?: string;
      phone?: string;
      address?: string;
      avatarUrl?: string;
    },
  ) {
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

  async changePassword(
    id: string,
    currentPassword?: string,
    newPassword?: string,
    confirmPassword?: string,
  ) {
    if (!newPassword || !confirmPassword) {
      throw new BadRequestException(
        'Mật khẩu mới và xác nhận mật khẩu là bắt buộc',
      );
    }

    if (newPassword !== confirmPassword) {
      throw new BadRequestException('Xác nhận mật khẩu không khớp');
    }

    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException('Người dùng không tồn tại');
    }

    const hasExistingPassword = Boolean(user.password);

    if (hasExistingPassword) {
      if (!currentPassword) {
        throw new BadRequestException('Vui lòng nhập mật khẩu hiện tại');
      }
      const isCurrentValid = await bcrypt.compare(
        currentPassword,
        user.password!,
      );
      if (!isCurrentValid) {
        throw new UnauthorizedException('Mật khẩu hiện tại không đúng');
      }
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({
      where: { id },
      data: { password: hashedPassword },
    });
    await this.prisma.refreshSession.updateMany({
      where: { userId: id, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    // Send email notification to user's Gmail
    await this.sendPasswordChangeNotification(
      user.email,
      user.fullName,
      hasExistingPassword,
    );

    return {
      message: hasExistingPassword
        ? 'Đổi mật khẩu thành công. Vui lòng đăng nhập lại.'
        : 'Tạo mật khẩu mới thành công. Vui lòng đăng nhập lại.',
    };
  }

  private async sendPasswordChangeNotification(
    email: string,
    fullName: string,
    wasChanged: boolean,
  ) {
    try {
      const host = this.configService?.get<string>('SMTP_HOST');
      const user = this.configService?.get<string>('SMTP_USER')?.trim();
      const pass = this.configService?.get<string>('SMTP_PASS')?.trim();

      if (!host || !user || !pass) {
        return;
      }

      const transporter = nodemailer.createTransport({
        host,
        port: Number(this.configService.get<string>('SMTP_PORT') ?? 587),
        secure: this.configService.get<string>('SMTP_SECURE') === 'true',
        auth: { user, pass },
      });

      const title = wasChanged
        ? 'Đổi mật khẩu tài khoản thành công'
        : 'Thiết lập mật khẩu mới thành công';
      const actionText = wasChanged
        ? 'thay đổi mật khẩu tài khoản'
        : 'thiết lập mật khẩu đăng nhập trực tiếp';
      const timeString = new Date().toLocaleString('vi-VN', {
        timeZone: 'Asia/Ho_Chi_Minh',
      });

      await transporter.sendMail({
        from: this.configService.get<string>('SMTP_FROM') || user,
        to: email,
        subject: `[SSFM] Thông báo: ${title}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
            <div style="text-align: center; padding-bottom: 20px; border-bottom: 1px solid #e2e8f0;">
              <h2 style="color: #0284c7; margin: 0;">Smart Shrimp Farm Management (SSFM)</h2>
              <p style="color: #64748b; font-size: 14px; margin-top: 4px;">Hệ thống Quản lý Trang trại Nuôi tôm Thông minh</p>
            </div>
            <div style="padding: 24px 0;">
              <p style="font-size: 16px; color: #1e293b; margin-top: 0;">Xin chào <strong>${fullName || 'Quý khách'}</strong>,</p>
              <p style="font-size: 14px; color: #334155; line-height: 1.6;">
                Hệ thống ghi nhận tài khoản của bạn (<strong>${email}</strong>) vừa <strong>${actionText}</strong> thành công vào lúc <strong>${timeString}</strong>.
              </p>
              <div style="background-color: #f8fafc; border-left: 4px solid #0284c7; padding: 12px 16px; margin: 20px 0; border-radius: 4px;">
                <p style="font-size: 13px; color: #475569; margin: 0; line-height: 1.5;">
                  🔒 <strong>Lưu ý bảo mật:</strong> Nếu bạn KHÔNG thực hiện hành động này, tài khoản của bạn có thể đã bị truy cập trái phép. Vui lòng liên hệ ngay với Quản trị viên hệ thống để được hỗ trợ khóa tài khoản khẩn cấp.
                </p>
              </div>
              <p style="font-size: 14px; color: #334155; margin-bottom: 0;">
                Trân trọng,<br/>
                <strong>Đội ngũ SSFM</strong>
              </p>
            </div>
            <div style="text-align: center; border-top: 1px solid #e2e8f0; padding-top: 16px; color: #94a3b8; font-size: 12px;">
              Email tự động từ hệ thống SSFM. Vui lòng không trả lời trực tiếp email này.
            </div>
          </div>
        `,
      });
    } catch (error) {
      console.error('Failed to send password notification email:', error);
    }
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
