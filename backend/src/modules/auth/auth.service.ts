import {
  Injectable,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { UsersService } from '../users/users.service.js';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';

@Injectable()
export class AuthService {
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

    // Create new user (password is hashed inside UsersService.create)
    const user = await this.usersService.create({
      email: dto.email,
      password: dto.password,
      fullName: dto.fullName,
      phone: dto.phone,
    });

    // Generate tokens
    const tokens = await this.generateTokens({
      sub: user.id,
      email: user.email,
      role: user.role,
    });

    return {
      user,
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
        throw new UnauthorizedException('Token Google không hợp lệ hoặc đã hết hạn');
      }
      payload = await response.json();
    } catch (error) {
      throw new UnauthorizedException('Không thể xác thực token Google. Vui lòng thử lại.');
    }

    const { sub: googleId, email, name, email_verified } = payload;

    if (!email) {
      throw new UnauthorizedException('Không thể lấy thông tin email từ Google.');
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
      throw new UnauthorizedException('Refresh token không hợp lệ hoặc đã hết hạn');
    }
  }

  private async generateTokens(payload: {
    sub: string;
    email: string;
    role: string;
  }) {
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('JWT_SECRET'),
        expiresIn: (this.configService.get<string>('JWT_ACCESS_EXPIRATION') ?? '15m') as any,
      }),
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: (this.configService.get<string>('JWT_REFRESH_EXPIRATION') ?? '7d') as any,
      }),
    ]);

    return {
      accessToken,
      refreshToken,
    };
  }
}
