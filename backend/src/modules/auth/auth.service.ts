import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import * as nodemailer from 'nodemailer';
import { randomInt, randomUUID } from 'crypto';
import { Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import { UsersService } from '../users/users.service.js';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { ForgotPasswordDto } from './dto/forgot-password.dto.js';
import { ResetPasswordDto } from './dto/reset-password.dto.js';
import { NotificationsService } from '../notifications/notifications.service.js';



@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) { }

  async register(dto: RegisterDto) {
    // ── Xử LÝ INVITE TOKEN (nếu có) ──
    let invitePayload: { email: string; farmId: string; role: string; type: string } | null = null;

    if (dto.inviteToken) {
      try {
        invitePayload = (await this.jwtService.verifyAsync(dto.inviteToken, {
          secret: this.configService.get<string>('JWT_SECRET'),
        })) as { email: string; farmId: string; role: string; type: string };
        if (invitePayload?.type !== 'farm_invite') {
          throw new BadRequestException('Token mời không hợp lệ');
        }
        if (
          !invitePayload.farmId ||
          (invitePayload.role !== Role.FARMER &&
            invitePayload.role !== Role.TECHNICIAN)
        ) {
          throw new BadRequestException('Thông tin lời mời không hợp lệ');
        }
        // Email đăng ký phải trùng với email trong token
        if (invitePayload.email.toLowerCase() !== dto.email.toLowerCase()) {
          throw new BadRequestException(
            `Token mời chỉ dành cho email ${invitePayload.email}. Vui lòng đăng ký bằng đúng email đó.`,
          );
        }
      } catch (err: any) {
        if (err instanceof BadRequestException) throw err;
        throw new BadRequestException('Token mời không hợp lệ hoặc đã hết hạn');
      }
    }

    // Check if user already exists
    const existingUser = await this.usersService.findByEmail(dto.email);
    if (existingUser) {
      throw new ConflictException('Email đã được sử dụng');
    }

    // Determine role: invite token overrides request role
    let role: string;
    if (invitePayload) {
      role = invitePayload.role; // Force role từ invitation
    } else {
      const allowedRoles = ['FARM_MANAGER', 'FARMER', 'TECHNICIAN'];
      role = dto.role && allowedRoles.includes(dto.role) ? dto.role : 'FARM_MANAGER';
    }

    // Create new user (password is hashed inside UsersService.create)
    const user = await this.usersService.create({
      email: dto.email,
      password: dto.password,
      fullName: dto.fullName,
      phone: dto.phone,
      role: role as Role,
    });

    // ── Nếu có invite token: tự động join farm ──
    let joinedFarm: { id: string; name: string } | null = null;
    if (invitePayload) {
      try {
        const farm = await this.prisma.farm.findUnique({
          where: { id: invitePayload.farmId },
          select: { id: true, name: true, ownerId: true },
        });
        if (farm) {
          const existingStaff = await this.prisma.farmStaff.findUnique({
            where: { farmId_userId: { farmId: farm.id, userId: user.id } },
          });
          const isNewlyJoined = !existingStaff || !existingStaff.isActive;

          await this.prisma.farmStaff.upsert({
            where: { farmId_userId: { farmId: farm.id, userId: user.id } },
            create: { farmId: farm.id, userId: user.id, role: user.role, isActive: true },
            update: { isActive: true, role: user.role },
          });

          if (isNewlyJoined) {
            await this.notificationsService.createFarmJoinNotification(
              user.id,
              farm.id,
              farm.name,
              user.role,
            );
            if (farm.ownerId && farm.ownerId !== user.id) {
              await this.notificationsService.createStaffJoinedNotification(
                farm.ownerId,
                farm.id,
                user.fullName || user.email,
                user.email,
                user.role,
                farm.name,
              );
            }
          }

          joinedFarm = { id: farm.id, name: farm.name };
        }
      } catch {
        // Không dừng đăng ký nếu join farm thất bại
      }
    }

    // Generate tokens
    const tokens = await this.generateTokens({
      sub: user.id,
      email: user.email,
      role: user.role,
    });

    const { password: _, ...userWithoutPassword } = user;

    // Chỉ gửi welcome notification chung nếu user đăng ký tự do (không tham gia qua link mời trang trại)
    if (!invitePayload) {
      await this.notificationsService.createWelcomeNotification(user.id);
    }

    return {
      user: userWithoutPassword,
      joinedFarm,
      ...tokens,
    };
  }

  async login(dto: LoginDto) {
    // Find user by email (need password for comparison)
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) {
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng');
    }
    if (!user.isActive) {
      throw new UnauthorizedException('Tài khoản của bạn đã bị khóa');
    }

    if (!user.password) {
      throw new UnauthorizedException(
        'Tài khoản này được liên kết với Google. Vui lòng đăng nhập bằng tài khoản Google của bạn.',
      );
    }

    // Compare passwords
    const isPasswordValid = await bcrypt.compare(dto.password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng');
    }

    // ── XỬ LÝ INVITE TOKEN (nếu có) ──
    let joinedFarm: { id: string; name: string } | null = null;
    if (dto.inviteToken) {
      try {
        const invitePayload = await this.jwtService.verifyAsync<{
          email: string;
          farmId: string;
          role: string;
          type: string;
        }>(dto.inviteToken, {
          secret: this.configService.get<string>('JWT_SECRET'),
        });

        if (
          invitePayload?.type !== 'farm_invite' ||
          !invitePayload.farmId ||
          (invitePayload.role !== Role.FARMER &&
            invitePayload.role !== Role.TECHNICIAN)
        ) {
          throw new BadRequestException('Token mời không hợp lệ');
        }

        if (invitePayload.email.toLowerCase() !== user.email.toLowerCase()) {
          throw new BadRequestException(
            `Token mời chỉ dành cho email ${invitePayload.email}.`,
          );
        }

        if (invitePayload.role !== user.role) {
          throw new BadRequestException(
            'Vai trò tài khoản không phù hợp với lời mời',
          );
        }

        {
          const farm = await this.prisma.farm.findUnique({
            where: { id: invitePayload.farmId },
            select: { id: true, name: true, ownerId: true },
          });

          if (farm) {
            const existingStaff = await this.prisma.farmStaff.findUnique({
              where: { farmId_userId: { farmId: farm.id, userId: user.id } },
            });
            const isNewlyJoined = !existingStaff || !existingStaff.isActive;

            await this.prisma.farmStaff.upsert({
              where: { farmId_userId: { farmId: farm.id, userId: user.id } },
              create: { farmId: farm.id, userId: user.id, role: user.role, isActive: true },
              update: { isActive: true, role: user.role },
            });

            if (isNewlyJoined) {
              await this.notificationsService.createFarmJoinNotification(
                user.id,
                farm.id,
                farm.name,
                user.role,
              );
              if (farm.ownerId && farm.ownerId !== user.id) {
                await this.notificationsService.createStaffJoinedNotification(
                  farm.ownerId,
                  farm.id,
                  user.fullName || user.email,
                  user.email,
                  user.role,
                  farm.name,
                );
              }
            }

            joinedFarm = { id: farm.id, name: farm.name };
          }
        }
      } catch (err) {
        if (err instanceof BadRequestException) throw err;
        this.logger.warn(`Failed to process invite token during login: ${err}`);
      }
    }

    // Generate tokens
    const tokens = await this.generateTokens({
      sub: user.id,
      email: user.email,
      role: user.role,
    });

    // Return user info without password
    const { password: _, ...userWithoutPassword } = user;

    return {
      user: userWithoutPassword,
      joinedFarm,
      ...tokens,
    };
  }

  async loginWithGoogle(credential: string) {
    let payload;
    try {
      const response = await fetch(
        `https://oauth2.googleapis.com/tokeninfo?id_token=${credential}`,
      );
      if (!response.ok) {
        throw new UnauthorizedException(
          'Token Google không hợp lệ hoặc đã hết hạn',
        );
      }
      payload = await response.json();
    } catch (error) {
      throw new UnauthorizedException(
        'Không thể xác thực token Google. Vui lòng thử lại.',
      );
    }

    const { sub: googleId, email, name, email_verified } = payload;

    if (!email) {
      throw new UnauthorizedException(
        'Không thể lấy thông tin email từ Google.',
      );
    }

    if (email_verified !== 'true' && email_verified !== true) {
      throw new UnauthorizedException('Email Google chưa được xác minh');
    }

    // Find user by email
    const existingUser = await this.usersService.findByEmail(email);
    let user;

    if (existingUser) {
      user = existingUser;
      // If user exists but googleId is not set, update it
      if (!user.googleId) {
        user = await this.usersService.updateGoogleId(user.id, googleId);
      }
    } else {
      // Create a new user
      user = await this.usersService.create({
        email,
        googleId,
        fullName: name || email.split('@')[0],
        password: '', // Empty password
      });
      // Send welcome notification for new google user
      await this.notificationsService.createWelcomeNotification(user.id);
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Tài khoản của bạn đã bị khóa');
    }

    // Generate tokens
    const tokens = await this.generateTokens({
      sub: user.id,
      email: user.email,
      role: user.role,
    });

    // Return user info without password
    const { password: _, ...userWithoutPassword } = user;

    return {
      user: userWithoutPassword,
      ...tokens,
    };
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const normalizedEmail = dto.email.toLowerCase();
    const user = await this.usersService.findByEmail(normalizedEmail);
    const response = {
      message:
        'Nếu email tồn tại trong hệ thống, mã OTP sẽ được gửi đến hộp thư của bạn.',
    };

    if (!user) {
      return response;
    }

    const existingOtp = await this.prisma.passwordResetOtp.findUnique({
      where: { email: normalizedEmail },
      select: { lastSentAt: true },
    });
    if (
      existingOtp &&
      Date.now() - existingOtp.lastSentAt.getTime() < 60_000
    ) {
      return response;
    }

    const otp = this.generateOtp();
    const otpHash = await bcrypt.hash(otp, 10);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 5 * 60 * 1000);
    await this.prisma.passwordResetOtp.upsert({
      where: { email: normalizedEmail },
      create: {
        email: normalizedEmail,
        otpHash,
        expiresAt,
        lastSentAt: now,
      },
      update: {
        otpHash,
        expiresAt,
        attempts: 0,
        lastSentAt: now,
        usedAt: null,
      },
    });

    const transporter = nodemailer.createTransport({
      host: this.configService.get<string>('SMTP_HOST'),
      port: Number(this.configService.get<string>('SMTP_PORT') ?? 587),
      secure: this.configService.get<string>('SMTP_SECURE') === 'true',
      auth: {
        user: this.configService.get<string>('SMTP_USER'),
        pass: this.configService.get<string>('SMTP_PASS'),
      },
    });

    try {
      await transporter.sendMail({
        from: this.configService.get<string>('SMTP_FROM'),
        to: normalizedEmail,
        subject: 'Mã OTP đặt lại mật khẩu SSFM',
        html: `<p>Xin chào ${user.fullName || 'bạn'},</p><p>Mã OTP của bạn là <strong>${otp}</strong>. Mã này có hiệu lực trong 5 phút.</p><p>Nếu bạn không yêu cầu, hãy bỏ qua email này.</p>`,
      });
    } catch (error) {
      await this.prisma.passwordResetOtp.delete({
        where: { email: normalizedEmail },
      });
      throw error;
    }

    return response;
  }

  async resetPassword(dto: ResetPasswordDto) {
    const normalizedEmail = dto.email.toLowerCase();
    const resetEntry = await this.prisma.passwordResetOtp.findUnique({
      where: { email: normalizedEmail },
    });

    if (!resetEntry) {
      throw new BadRequestException('Không tìm thấy yêu cầu đặt lại mật khẩu');
    }

    if (resetEntry.usedAt) {
      throw new BadRequestException('OTP đã được sử dụng');
    }

    if (new Date() > resetEntry.expiresAt) {
      throw new BadRequestException('OTP đã hết hạn');
    }

    const isOtpValid = await bcrypt.compare(dto.otp, resetEntry.otpHash);
    if (!isOtpValid) {
      const attempts = resetEntry.attempts + 1;
      await this.prisma.passwordResetOtp.update({
        where: { id: resetEntry.id },
        data: {
          attempts,
          usedAt: attempts >= 5 ? new Date() : null,
        },
      });
      if (attempts >= 5) {
        throw new BadRequestException(
          'Bạn đã nhập sai OTP quá số lần cho phép. Vui lòng yêu cầu mã mới.',
        );
      }
      throw new BadRequestException('OTP không đúng');
    }

    if (dto.password !== dto.confirmPassword) {
      throw new BadRequestException('Xác nhận mật khẩu không khớp');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);
    const claimedAt = new Date();
    await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.passwordResetOtp.updateMany({
        where: {
          id: resetEntry.id,
          usedAt: null,
          expiresAt: { gt: claimedAt },
          attempts: { lt: 5 },
        },
        data: { usedAt: claimedAt },
      });
      if (claimed.count !== 1) {
        throw new BadRequestException('OTP không còn hiệu lực');
      }

      const updatedUser = await tx.user.update({
        where: { email: normalizedEmail },
        data: { password: hashedPassword },
        select: { id: true },
      });
      await tx.refreshSession.updateMany({
        where: { userId: updatedUser.id, revokedAt: null },
        data: { revokedAt: claimedAt },
      });
    });

    return {
      message: 'Đặt lại mật khẩu thành công. Vui lòng đăng nhập lại.',
    };
  }

  async refreshToken(refreshToken: string) {
    try {
      const payload = await this.jwtService.verifyAsync<{
        sub: string;
        email: string;
        role: string;
        jti: string;
        type: string;
      }>(refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      });

      if (payload.type !== 'refresh' || !payload.jti) {
        throw new UnauthorizedException('Refresh token không hợp lệ');
      }

      const session = await this.prisma.refreshSession.findUnique({
        where: { id: payload.jti },
      });
      if (
        !session ||
        session.userId !== payload.sub ||
        session.revokedAt ||
        session.expiresAt <= new Date()
      ) {
        throw new UnauthorizedException('Phiên đăng nhập không còn hiệu lực');
      }

      const user = await this.usersService.findById(payload.sub);
      if (!user) {
        throw new UnauthorizedException('User không tồn tại');
      }
      if (!user.isActive) {
        throw new UnauthorizedException('Tài khoản của bạn đã bị khóa');
      }

      const tokens = await this.generateTokens({
        sub: user.id,
        email: user.email,
        role: user.role,
      }, session.id);

      return tokens;
    } catch {
      throw new UnauthorizedException(
        'Refresh token không hợp lệ hoặc đã hết hạn',
      );
    }
  }

  async logout(refreshToken?: string) {
    if (refreshToken) {
      try {
        const payload = await this.jwtService.verifyAsync<{
          sub: string;
          jti: string;
          type: string;
        }>(refreshToken, {
          secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
          ignoreExpiration: true,
        });
        if (payload.type === 'refresh' && payload.jti) {
          await this.prisma.refreshSession.updateMany({
            where: {
              id: payload.jti,
              userId: payload.sub,
              revokedAt: null,
            },
            data: { revokedAt: new Date() },
          });
        }
      } catch {
        // Logout is idempotent and must not reveal token details.
      }
    }
    return { message: 'Đăng xuất thành công' };
  }

  private generateOtp() {
    return randomInt(100000, 1000000).toString();
  }

  /**
   * Xác thực invite token và trả về thông tin farm/role.
   * Frontend gọi trước khi hiển thị trang đăng ký.
   */
  async verifyInviteToken(token: string) {
    try {
      const payload = await this.jwtService.verifyAsync(token, {
        secret: this.configService.get<string>('JWT_SECRET'),
      });

      if (payload?.type !== 'farm_invite') {
        return { valid: false, reason: 'Token không phải invitation token' };
      }

      const farm = await this.prisma.farm.findUnique({
        where: { id: payload.farmId },
        select: { id: true, name: true, owner: { select: { fullName: true } } },
      });

      if (!farm) {
        return { valid: false, reason: 'Trang trại không tồn tại' };
      }

      return {
        valid: true,
        email: payload.email,
        farmId: payload.farmId,
        farmName: farm.name,
        managerName: farm.owner?.fullName ?? 'Quản lý trang trại',
        role: payload.role,
      };
    } catch {
      return { valid: false, reason: 'Token không hợp lệ hoặc đã hết hạn' };
    }
  }

  private async generateTokens(payload: {
    sub: string;
    email: string;
    role: string;
  }, replacedSessionId?: string) {
    const sessionId = randomUUID();
    const refreshExpiresAt = new Date(
      Date.now() + this.getRefreshExpirationMs(),
    );
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('JWT_SECRET'),
        expiresIn: (this.configService.get<string>('JWT_ACCESS_EXPIRATION') ??
          '15m') as any,
      }),
      this.jwtService.signAsync(
        { ...payload, jti: sessionId, type: 'refresh' },
        {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: (this.configService.get<string>('JWT_REFRESH_EXPIRATION') ??
          '7d') as any,
        },
      ),
    ]);

    if (replacedSessionId) {
      await this.prisma.$transaction(async (tx) => {
        const revoked = await tx.refreshSession.updateMany({
          where: { id: replacedSessionId, revokedAt: null },
          data: { revokedAt: new Date(), replacedBy: sessionId },
        });
        if (revoked.count !== 1) {
          throw new UnauthorizedException('Phiên đăng nhập đã được sử dụng');
        }
        await tx.refreshSession.create({
          data: {
            id: sessionId,
            userId: payload.sub,
            expiresAt: refreshExpiresAt,
          },
        });
      });
    } else {
      await this.prisma.refreshSession.create({
        data: {
          id: sessionId,
          userId: payload.sub,
          expiresAt: refreshExpiresAt,
        },
      });
    }

    return {
      accessToken,
      refreshToken,
    };
  }

  private getRefreshExpirationMs() {
    const value =
      this.configService.get<string>('JWT_REFRESH_EXPIRATION') ?? '7d';
    const match = /^(\d+)([smhd])$/.exec(value.trim());
    if (!match) return 7 * 24 * 60 * 60 * 1000;

    const amount = Number(match[1]);
    const multipliers = {
      s: 1000,
      m: 60 * 1000,
      h: 60 * 60 * 1000,
      d: 24 * 60 * 60 * 1000,
    };
    return amount * multipliers[match[2] as keyof typeof multipliers];
  }
}
