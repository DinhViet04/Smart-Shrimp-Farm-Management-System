import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import * as nodemailer from 'nodemailer';
import { UsersService } from '../users/users.service.js';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { ForgotPasswordDto } from './dto/forgot-password.dto.js';
import { ResetPasswordDto } from './dto/reset-password.dto.js';

@Injectable()
export class AuthService {
  private passwordResetStore: Record<
    string,
    { otp: string; expiresAt: number; used: boolean }
  > = {};

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async register(dto: RegisterDto) {
    // Check if user already exists
    const existingUser = await this.usersService.findByEmail(dto.email);
    if (existingUser) {
      throw new ConflictException('Email đã được sử dụng');
    }

    // Determine role (allowed: FARM_MANAGER, FARMER, TECHNICIAN)
    const allowedRoles = ['FARM_MANAGER', 'FARMER', 'TECHNICIAN'];
    const role =
      dto.role && allowedRoles.includes(dto.role) ? dto.role : 'FARM_MANAGER';

    // Create new user (password is hashed inside UsersService.create)
    const user = await this.usersService.create({
      email: dto.email,
      password: dto.password,
      fullName: dto.fullName,
      phone: dto.phone,
      role: role,
    });

    // Generate tokens
    const tokens = await this.generateTokens({
      sub: user.id,
      email: user.email,
      role: user.role,
    });

    const { password: _, ...userWithoutPassword } = user;

    return {
      user: userWithoutPassword,
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
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) {
      throw new NotFoundException('Email không tồn tại trong hệ thống');
    }

    const otp = this.generateOtp();
    const expiresAt = Date.now() + 5 * 60 * 1000;
    this.passwordResetStore[dto.email.toLowerCase()] = {
      otp,
      expiresAt,
      used: false,
    };

    const transporter = nodemailer.createTransport({
      host: this.configService.get<string>('SMTP_HOST'),
      port: Number(this.configService.get<string>('SMTP_PORT') ?? 587),
      secure: this.configService.get<string>('SMTP_SECURE') === 'true',
      auth: {
        user: this.configService.get<string>('SMTP_USER'),
        pass: this.configService.get<string>('SMTP_PASS'),
      },
    });

    await transporter.sendMail({
      from: this.configService.get<string>('SMTP_FROM'),
      to: dto.email,
      subject: 'Mã OTP đặt lại mật khẩu SSFM',
      html: `<p>Xin chào ${user.fullName || 'bạn'},</p><p>Mã OTP của bạn là <strong>${otp}</strong>. Mã này có hiệu lực trong 5 phút.</p><p>Nếu bạn không yêu cầu, hãy bỏ qua email này.</p>`,
    });

    return {
      message:
        'Mã OTP đã được gửi đến email của bạn. Vui lòng kiểm tra hộp thư.',
    };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const normalizedEmail = dto.email.toLowerCase();
    const resetEntry = this.passwordResetStore[normalizedEmail];

    if (!resetEntry) {
      throw new BadRequestException('Không tìm thấy yêu cầu đặt lại mật khẩu');
    }

    if (resetEntry.used) {
      throw new BadRequestException('OTP đã được sử dụng');
    }

    if (Date.now() > resetEntry.expiresAt) {
      delete this.passwordResetStore[normalizedEmail];
      throw new BadRequestException('OTP đã hết hạn');
    }

    if (resetEntry.otp !== dto.otp) {
      throw new BadRequestException('OTP không đúng');
    }

    if (dto.password !== dto.confirmPassword) {
      throw new BadRequestException('Xác nhận mật khẩu không khớp');
    }

    const user = await this.usersService.findByEmail(normalizedEmail);
    if (!user) {
      throw new NotFoundException('Email không tồn tại trong hệ thống');
    }

    await this.usersService.updatePasswordByEmail(
      normalizedEmail,
      dto.password,
    );
    resetEntry.used = true;

    return {
      message: 'Đặt lại mật khẩu thành công. Vui lòng đăng nhập lại.',
    };
  }

  async refreshToken(refreshToken: string) {
    try {
      const payload = await this.jwtService.verifyAsync(refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      });

      // Verify user still exists
      const user = await this.usersService.findById(payload.sub);
      if (!user) {
        throw new UnauthorizedException('User không tồn tại');
      }
      if (!user.isActive) {
        throw new UnauthorizedException('Tài khoản của bạn đã bị khóa');
      }

      // Generate new token pair
      const tokens = await this.generateTokens({
        sub: user.id,
        email: user.email,
        role: user.role,
      });

      return tokens;
    } catch {
      throw new UnauthorizedException(
        'Refresh token không hợp lệ hoặc đã hết hạn',
      );
    }
  }

  private generateOtp() {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  private async generateTokens(payload: {
    sub: string;
    email: string;
    role: string;
  }) {
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('JWT_SECRET'),
        expiresIn: (this.configService.get<string>('JWT_ACCESS_EXPIRATION') ??
          '15m') as any,
      }),
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: (this.configService.get<string>('JWT_REFRESH_EXPIRATION') ??
          '7d') as any,
      }),
    ]);

    return {
      accessToken,
      refreshToken,
    };
  }
}
