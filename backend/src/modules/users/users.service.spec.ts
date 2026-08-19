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
    const service = new UsersService(prisma as any);

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
    const service = new UsersService(prisma as any);

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

    const service = new UsersService(prisma as any);

    await expect(
      service.changePassword(
        'user-1',
        'WrongPass123!',
        'NewPass123!',
        'NewPass123!',
      ),
    ).rejects.toThrow(UnauthorizedException);
  });
});
