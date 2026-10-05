import { BadRequestException } from '@nestjs/common';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service.js';
import { UsersService } from '../users/users.service.js';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

jest.mock('nodemailer', () => ({
  createTransport: jest.fn(),
}));

describe('AuthService password reset', () => {
  let service: AuthService;
  let usersService: {
    findByEmail: jest.Mock;
    findById: jest.Mock;
    updatePasswordByEmail: jest.Mock;
  };
  let jwtService: { signAsync: jest.Mock; verifyAsync: jest.Mock };
  let configService: { get: jest.Mock };
  let sendMail: jest.Mock;
  let prisma: any;

  beforeEach(() => {
    usersService = {
      findByEmail: jest.fn(),
      findById: jest.fn(),
      updatePasswordByEmail: jest.fn(),
    };
    jwtService = {
      signAsync: jest.fn(),
      verifyAsync: jest.fn(),
    };
    configService = {
      get: jest.fn((key: string) => {
        const values: Record<string, string> = {
          JWT_SECRET: 'secret',
          JWT_REFRESH_SECRET: 'refresh-secret',
          JWT_ACCESS_EXPIRATION: '15m',
          JWT_REFRESH_EXPIRATION: '7d',
          SMTP_HOST: 'smtp.test.com',
          SMTP_PORT: '587',
          SMTP_SECURE: 'false',
          SMTP_USER: 'test@example.com',
          SMTP_PASS: 'secret',
          SMTP_FROM: 'test@example.com',
        };
        return values[key];
      }),
    };

    sendMail = jest.fn().mockResolvedValue({ accepted: ['test@example.com'] });
    (nodemailer.createTransport as jest.Mock).mockReturnValue({ sendMail });

    prisma = {
      farm: { findUnique: jest.fn() },
      farmStaff: { upsert: jest.fn() },
      passwordResetOtp: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
        update: jest.fn(),
      },
      refreshSession: {
        findUnique: jest.fn(),
        create: jest.fn(),
        updateMany: jest.fn(),
      },
      $transaction: jest.fn(async (callback) => callback(prisma)),
      user: { update: jest.fn() },
    };

    service = new AuthService(
      usersService as unknown as UsersService,
      jwtService as unknown as JwtService,
      configService as unknown as ConfigService,
      prisma,
      { createWelcomeNotification: jest.fn(), createFarmJoinNotification: jest.fn(), createStaffJoinedNotification: jest.fn() } as any,
    );
  });

  it('should send OTP for an existing email', async () => {
    usersService.findByEmail.mockResolvedValue({
      id: 'user-1',
      email: 'demo@example.com',
    });
    prisma.passwordResetOtp.findUnique.mockResolvedValue(null);

    const result = await service.forgotPassword({ email: 'demo@example.com' });

    expect(result.message).toContain('OTP');
    expect(sendMail).toHaveBeenCalled();
    expect(prisma.passwordResetOtp.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { email: 'demo@example.com' },
        create: expect.objectContaining({ email: 'demo@example.com' }),
      }),
    );
  });

  it('does not reveal whether a password-reset email exists', async () => {
    usersService.findByEmail.mockResolvedValue(null);

    const result = await service.forgotPassword({ email: 'missing@example.com' });

    expect(result.message).toContain('Nếu email tồn tại');
    expect(sendMail).not.toHaveBeenCalled();
  });

  it('rejects a farm invitation issued to another email during login', async () => {
    usersService.findByEmail.mockResolvedValue({
      id: 'user-1',
      email: 'member@example.com',
      fullName: 'Member',
      password: await bcrypt.hash('Password123!', 10),
      role: Role.TECHNICIAN,
      isActive: true,
    });
    jwtService.verifyAsync.mockResolvedValue({
      email: 'other@example.com',
      farmId: 'farm-1',
      role: Role.TECHNICIAN,
      type: 'farm_invite',
    });

    await expect(
      service.login({
        email: 'member@example.com',
        password: 'Password123!',
        inviteToken: 'invite-token',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rotates and revokes the previous refresh session', async () => {
    jwtService.verifyAsync.mockResolvedValue({
      sub: 'user-1',
      email: 'demo@example.com',
      role: Role.FARMER,
      jti: 'session-old',
      type: 'refresh',
    });
    jwtService.signAsync
      .mockResolvedValueOnce('new-access-token')
      .mockResolvedValueOnce('new-refresh-token');
    prisma.refreshSession.findUnique.mockResolvedValue({
      id: 'session-old',
      userId: 'user-1',
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
    });
    prisma.refreshSession.updateMany.mockResolvedValue({ count: 1 });
    prisma.refreshSession.create.mockResolvedValue({ id: 'session-new' });
    usersService.findById.mockResolvedValue({
      id: 'user-1',
      email: 'demo@example.com',
      role: Role.FARMER,
      isActive: true,
    });

    await expect(service.refreshToken('old-refresh-token')).resolves.toEqual({
      accessToken: 'new-access-token',
      refreshToken: 'new-refresh-token',
    });

    expect(prisma.refreshSession.updateMany).toHaveBeenCalledWith({
      where: { id: 'session-old', revokedAt: null },
      data: {
        revokedAt: expect.any(Date),
        replacedBy: expect.any(String),
      },
    });
    expect(prisma.refreshSession.create).toHaveBeenCalled();
  });

  it('should reset password with a valid OTP', async () => {
    prisma.passwordResetOtp.findUnique.mockResolvedValue({
      id: 'otp-1',
      email: 'demo@example.com',
      otpHash: await bcrypt.hash('123456', 10),
      expiresAt: new Date(Date.now() + 300000),
      usedAt: null,
      attempts: 0,
    });
    prisma.passwordResetOtp.updateMany = jest.fn().mockResolvedValue({ count: 1 });
    prisma.user.update.mockResolvedValue({ id: 'user-1' });
    prisma.refreshSession.updateMany.mockResolvedValue({ count: 2 });

    const result = await service.resetPassword({
      email: 'demo@example.com',
      otp: '123456',
      password: 'NewPass123!',
      confirmPassword: 'NewPass123!',
    });

    expect(result.message).toContain('thành công');
    expect(prisma.passwordResetOtp.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'otp-1' }),
      }),
    );
    expect(prisma.refreshSession.updateMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });
});
