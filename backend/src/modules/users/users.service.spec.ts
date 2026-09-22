import { UnauthorizedException } from '@nestjs/common';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { UsersService } from './users.service';

describe('UsersService account settings', () => {
  it('synchronizes farm assignments when an account becomes a technician', async () => {
    const transactionClient = {
      user: {
        update: jest.fn().mockResolvedValue({ id: 'user-1', role: Role.TECHNICIAN }),
      },
      farmStaff: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const prisma = {
      $transaction: jest.fn((callback) => callback(transactionClient)),
    };
    const mockConfigService = {
      get: jest.fn().mockReturnValue(null),
    };
    const service = new UsersService(prisma as any, mockConfigService as any);

    await service.updateRole('user-1', Role.TECHNICIAN);

    expect(transactionClient.farmStaff.updateMany).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      data: { role: Role.TECHNICIAN },
    });
  });

  it('deactivates farm assignments when an account changes to a non-staff role', async () => {
    const transactionClient = {
      user: {
        update: jest.fn().mockResolvedValue({ id: 'user-1', role: Role.ADMIN }),
      },
      farmStaff: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const prisma = {
      $transaction: jest.fn((callback) => callback(transactionClient)),
    };
    const mockConfigService = {
      get: jest.fn().mockReturnValue(null),
    };
    const service = new UsersService(prisma as any, mockConfigService as any);

    await service.updateRole('user-1', Role.ADMIN);

    expect(transactionClient.farmStaff.updateMany).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      data: { isActive: false },
    });
  });

  it('rejects an incorrect current password during password change', async () => {
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'user-1',
          password: await bcrypt.hash('OldPass123!', 10),
        }),
        update: jest.fn(),
      },
    };

    const mockConfigService = {
      get: jest.fn().mockReturnValue(null),
    };
    const service = new UsersService(prisma as any, mockConfigService as any);

    await expect(
      service.changePassword(
        'user-1',
        'WrongPass123!',
        'NewPass123!',
        'NewPass123!',
      ),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('allows creating a password without currentPassword when account has no existing password', async () => {
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'user-google-1',
          email: 'googleuser@gmail.com',
          fullName: 'Google User',
          password: null,
          googleId: '123456789',
        }),
        update: jest.fn().mockResolvedValue({ id: 'user-google-1' }),
      },
    };
    const mockConfigService = {
      get: jest.fn().mockReturnValue(null),
    };

    const service = new UsersService(prisma as any, mockConfigService as any);

    const result = await service.changePassword(
      'user-google-1',
      undefined,
      'NewPass123!@#',
      'NewPass123!@#',
    );

    expect(result.message).toContain('Tạo mật khẩu mới thành công');
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'user-google-1' },
      }),
    );
  });

  it('returns hasPassword=false and isGoogleAccount=true in findById for Google users', async () => {
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'user-google-1',
          email: 'googleuser@gmail.com',
          fullName: 'Google User',
          password: null,
          googleId: '123456789',
          role: Role.FARMER,
          isActive: true,
        }),
      },
    };
    const mockConfigService = {
      get: jest.fn().mockReturnValue(null),
    };

    const service = new UsersService(prisma as any, mockConfigService as any);
    const profile = await service.findById('user-google-1');

    expect(profile?.hasPassword).toBe(false);
    expect(profile?.isGoogleAccount).toBe(true);
  });
});
