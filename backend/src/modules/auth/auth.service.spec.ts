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
    updatePasswordByEmail: jest.Mock;
  };
  let jwtService: { signAsync: jest.Mock; verifyAsync: jest.Mock };
  let configService: { get: jest.Mock };
  let sendMail: jest.Mock;

  beforeEach(() => {
    usersService = {
      findByEmail: jest.fn(),
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

    service = new AuthService(
      usersService as unknown as UsersService,
      jwtService as unknown as JwtService,
      configService as unknown as ConfigService,
    );
  });

  it('should send OTP for an existing email', async () => {
    usersService.findByEmail.mockResolvedValue({ id: 'user-1', email: 'demo@example.com' });

    const result = await service.forgotPassword({ email: 'demo@example.com' });

    expect(result.message).toContain('OTP');
    expect(sendMail).toHaveBeenCalled();
    expect(service['passwordResetStore']['demo@example.com']).toBeDefined();
  });

  it('should reset password with a valid OTP', async () => {
    usersService.findByEmail.mockResolvedValue({ id: 'user-1', email: 'demo@example.com' });
    usersService.updatePasswordByEmail.mockResolvedValue({ id: 'user-1' });

    service['passwordResetStore']['demo@example.com'] = {
      otp: '123456',
      expiresAt: Date.now() + 300000,
      used: false,
    };

    const result = await service.resetPassword({
      email: 'demo@example.com',
      otp: '123456',
      password: 'NewPass123!',
      confirmPassword: 'NewPass123!',
    });

    expect(result.message).toContain('thành công');
    expect(usersService.updatePasswordByEmail).toHaveBeenCalledWith('demo@example.com', 'NewPass123!');
    expect(service['passwordResetStore']['demo@example.com'].used).toBe(true);
  });
});
