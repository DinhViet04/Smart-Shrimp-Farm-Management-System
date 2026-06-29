import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { UsersService } from './users.service';

describe('UsersService account settings', () => {
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

    await expect(service.changePassword('user-1', 'WrongPass123!', 'NewPass123!', 'NewPass123!')).rejects.toThrow(UnauthorizedException);
  });
});
