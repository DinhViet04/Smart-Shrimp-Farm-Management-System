import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  Req,
  Res,
  ForbiddenException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service.js';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { ForgotPasswordDto } from './dto/forgot-password.dto.js';
import { ResetPasswordDto } from './dto/reset-password.dto.js';
import { GoogleLoginDto } from './dto/google-login.dto.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import { CurrentUser } from './decorators/current-user.decorator.js';
import { UsersService } from '../users/users.service.js';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
    private readonly configService: ConfigService,
  ) {}

  @Post('register')
  @Throttle({ default: { limit: 5, ttl: 15 * 60_000 } })
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.attachRefreshCookie(await this.authService.register(dto), response);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.attachRefreshCookie(await this.authService.login(dto), response);
  }

  @Post('google')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async googleLogin(
    @Body() dto: GoogleLoginDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.attachRefreshCookie(
      await this.authService.loginWithGoogle(dto.credential),
      response,
    );
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 3, ttl: 15 * 60_000 } })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 15 * 60_000 } })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    this.assertCsrfHeader(request);
    const token = this.getRefreshCookie(request);
    const result = await this.authService.refreshToken(token ?? '');
    return this.attachRefreshCookie(result, response);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getMe(@CurrentUser('userId') userId: string) {
    return this.usersService.findById(userId);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    this.assertCsrfHeader(request);
    const result = await this.authService.logout(this.getRefreshCookie(request));
    response.clearCookie('ssfm_refresh_token', this.getCookieOptions(false));
    return result;
  }

  /**
   * GET /api/auth/verify-invite?token=xxx
   * Frontend gọi endpoint này để kiểm tra token mời truớc khi hiển thị form đăng ký.
   */
  @Get('verify-invite')
  async verifyInvite(@Query('token') token: string) {
    if (!token) {
      return { valid: false, reason: 'Thiếu token' };
    }
    return this.authService.verifyInviteToken(token);
  }

  private attachRefreshCookie<T extends { refreshToken: string }>(
    result: T,
    response: Response,
  ): Omit<T, 'refreshToken'> {
    response.cookie(
      'ssfm_refresh_token',
      result.refreshToken,
      this.getCookieOptions(),
    );
    response.setHeader('Cache-Control', 'no-store');
    const { refreshToken: _, ...body } = result;
    return body;
  }

  private getRefreshCookie(request: Request) {
    const rawCookie = request.headers.cookie;
    if (!rawCookie) return undefined;

    for (const part of rawCookie.split(';')) {
      const [name, ...valueParts] = part.trim().split('=');
      if (name === 'ssfm_refresh_token') {
        return decodeURIComponent(valueParts.join('='));
      }
    }
    return undefined;
  }

  private getCookieOptions(includeMaxAge = true) {
    const isProduction =
      this.configService.get<string>('NODE_ENV') === 'production';
    return {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? ('none' as const) : ('lax' as const),
      path: '/api/auth',
      ...(includeMaxAge
        ? { maxAge: this.getRefreshExpirationMs() }
        : {}),
    };
  }

  private getRefreshExpirationMs() {
    const value =
      this.configService.get<string>('JWT_REFRESH_EXPIRATION') ?? '7d';
    const match = /^(\d+)([smhd])$/.exec(value.trim());
    if (!match) return 7 * 24 * 60 * 60 * 1000;

    const multipliers = {
      s: 1000,
      m: 60 * 1000,
      h: 60 * 60 * 1000,
      d: 24 * 60 * 60 * 1000,
    };
    return Number(match[1]) * multipliers[match[2] as keyof typeof multipliers];
  }

  private assertCsrfHeader(request: Request) {
    if (request.headers['x-ssfm-csrf'] !== '1') {
      throw new ForbiddenException('Yêu cầu xác thực không hợp lệ');
    }
  }
}
