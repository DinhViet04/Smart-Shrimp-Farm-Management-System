import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { OAuth2Client } from 'google-auth-library';
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
    create: jest.Mock;
    updateGoogleId: jest.Mock;
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
      create: jest.fn(),
      updateGoogleId: jest.fn(),
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
          GOOGLE_CLIENT_ID: 'google-client-id.apps.googleusercontent.com',
        };
        return values[key];
      }),
    };

    sendMail = jest.fn().mockResolvedValue({ accepted: ['test@example.com'] });
    (nodemailer.createTransport as jest.Mock).mockReturnValue({ sendMail });

    prisma = {
      farm: { findUnique: jest.fn() },
      farmStaff: { findUnique: jest.fn(), upsert: jest.fn() },
      workspaceMember: { upsert: jest.fn() },
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
      user: { findFirst: jest.fn(), update: jest.fn() },
    };

    service = new AuthService(
      usersService as unknown as UsersService,
      jwtService as unknown as JwtService,
      configService as unknown as ConfigService,
      prisma,
      {
        createWelcomeNotification: jest.fn(),
        createFarmJoinNotification: jest.fn(),
        createStaffJoinedNotification: jest.fn(),
      } as any,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
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

    const result = await service.forgotPassword({
      email: 'missing@example.com',
    });

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

  it.each([Role.FARMER, Role.TECHNICIAN])(
    'rejects public registration for %s without a farm invitation',
    async (role) => {
      usersService.findByEmail.mockResolvedValue(null);

      await expect(
        service.register({
          email: 'employee@example.com',
          password: 'Password123!',
          fullName: 'Employee',
          role,
        }),
      ).rejects.toThrow(BadRequestException);

      expect(usersService.create).not.toHaveBeenCalled();
    },
  );

  it('verifies a Google ID token against the configured client ID', async () => {
    const verifyIdToken = jest
      .spyOn(OAuth2Client.prototype, 'verifyIdToken')
      .mockRejectedValue(
        new Error('Wrong recipient, payload audience != requiredAudience') as never,
      );

    await expect(
      service.loginWithGoogle('wrong-audience-token'),
    ).rejects.toThrow(UnauthorizedException);

    expect(verifyIdToken).toHaveBeenCalledWith({
      idToken: 'wrong-audience-token',
      audience: 'google-client-id.apps.googleusercontent.com',
    });
    expect(usersService.findByEmail).not.toHaveBeenCalled();
  });

  it('accepts a verified Google ID token for the configured client', async () => {
    jest.spyOn(OAuth2Client.prototype, 'verifyIdToken').mockResolvedValue({
      getPayload: () => ({
        sub: 'google-user-id',
        email: 'google@example.com',
        name: 'Google User',
        email_verified: true,
      }),
    } as never);
    usersService.findByEmail.mockResolvedValue(null);
    usersService.create.mockResolvedValue({
      id: 'user-google',
      email: 'google@example.com',
      fullName: 'Google User',
      role: Role.FARM_MANAGER,
      isActive: true,
      password: null,
      googleId: 'google-user-id',
    });
    jwtService.signAsync
      .mockResolvedValueOnce('access-token')
      .mockResolvedValueOnce('refresh-token');
    prisma.refreshSession.create.mockResolvedValue({ id: 'refresh-session' });

    await expect(service.loginWithGoogle('valid-token')).resolves.toMatchObject(
      {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        user: { email: 'google@example.com' },
      },
    );

    expect(usersService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'google@example.com',
        googleId: 'google-user-id',
      }),
    );
  });

  it('only lets the authenticated account with the invited email join the farm', async () => {
    jwtService.verifyAsync.mockResolvedValue({
      email: 'invited@example.com',
      farmId: 'farm-1',
      role: Role.FARMER,
      type: 'farm_invite',
    });
    usersService.findById.mockResolvedValue({
      id: 'user-1',
      email: 'other@example.com',
      role: Role.FARMER,
      isActive: true,
    });

    await expect(
      service.acceptInviteToken('invite-token', 'user-1'),
    ).rejects.toThrow(BadRequestException);

    expect(prisma.farmStaff.upsert).not.toHaveBeenCalled();
  });

  it('adds the authenticated account after it accepts its own invitation', async () => {
    jwtService.verifyAsync.mockResolvedValue({
      email: 'invited@example.com',
      farmId: 'farm-1',
      role: Role.TECHNICIAN,
      type: 'farm_invite',
    });
    const invitedUser = {
      id: 'user-1',
      email: 'invited@example.com',
      fullName: 'Invited User',
      role: Role.TECHNICIAN,
      isActive: true,
    };
    usersService.findById.mockResolvedValue(invitedUser);
    prisma.farm.findUnique.mockResolvedValue({
      id: 'farm-1',
      name: 'Farm A',
      ownerId: 'manager-1',
      workspaceId: 'workspace-1',
    });
    prisma.farmStaff.findUnique.mockResolvedValue(null);
    prisma.farmStaff.upsert.mockResolvedValue({ id: 'staff-1' });
    prisma.workspaceMember.upsert.mockResolvedValue({ id: 'membership-1' });

    await expect(
      service.acceptInviteToken('invite-token', 'user-1'),
    ).resolves.toMatchObject({ success: true, role: Role.TECHNICIAN });

    expect(prisma.farmStaff.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          farmId: 'farm-1',
          userId: 'user-1',
          role: Role.TECHNICIAN,
        }),
      }),
    );
    expect(prisma.workspaceMember.upsert).toHaveBeenCalled();
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
    prisma.passwordResetOtp.updateMany = jest
      .fn()
      .mockResolvedValue({ count: 1 });
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

