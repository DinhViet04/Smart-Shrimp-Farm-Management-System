import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service.js';
import * as bcrypt from 'bcryptjs';
import * as nodemailer from 'nodemailer';
import { Prisma, Role } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

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
    currentPassword?: string,
    newPassword?: string,
    confirmPassword?: string,
  ) {
    if (!newPassword || !confirmPassword) {
      throw new BadRequestException('Mật khẩu mới và xác nhận mật khẩu là bắt buộc');
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
      const isCurrentValid = await bcrypt.compare(currentPassword, user.password!);
      if (!isCurrentValid) {
        throw new UnauthorizedException('Mật khẩu hiện tại không đúng');
      }
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({
      where: { id },
      data: { password: hashedPassword },
    });

    // Send email notification to user's Gmail
    await this.sendPasswordChangeNotification(user.email, user.fullName, hasExistingPassword);

    return {
      message: hasExistingPassword
        ? 'Đổi mật khẩu thành công. Thông báo đã được gửi đến email của bạn.'
        : 'Tạo mật khẩu mới thành công. Thông báo đã được gửi đến email của bạn.',
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
