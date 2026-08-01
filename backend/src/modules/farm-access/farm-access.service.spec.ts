import { FarmAccessService } from './farm-access.service.js';

describe('FarmAccessService', () => {
  it('uses the active assignment even when its cached role is stale', async () => {
    const prisma = {
      farm: { findMany: jest.fn() },
      farmStaff: {
        findMany: jest.fn().mockResolvedValue([{ farmId: 'farm-id' }]),
      },
    };
    const service = new FarmAccessService(prisma as any);

    await expect(
      service.getAccessibleFarmIds({ userId: 'technician-id', role: 'TECHNICIAN' }),
    ).resolves.toEqual(['farm-id']);

    expect(prisma.farmStaff.findMany).toHaveBeenCalledWith({
      where: {
        userId: 'technician-id',
        isActive: true,
        farm: { deletedAt: null },
      },
      select: { farmId: true },
    });
  });
});
