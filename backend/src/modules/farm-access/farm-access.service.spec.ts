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

  it('allows a technician with an active assignment to record usage', async () => {
    const prisma = {
      farmStaff: {
        findFirst: jest.fn().mockResolvedValue({ id: 'assignment-id' }),
      },
    };
    const service = new FarmAccessService(prisma as any);

    await expect(
      service.assertCanRecordUsage(
        { userId: 'technician-id', role: 'TECHNICIAN' },
        'farm-id',
      ),
    ).resolves.toBeUndefined();
  });

  it('allows the farm owner to record usage', async () => {
    const prisma = {
      farm: {
        findFirst: jest.fn().mockResolvedValue({ id: 'farm-id' }),
      },
    };
    const service = new FarmAccessService(prisma as any);

    await expect(
      service.assertCanRecordUsage(
        { userId: 'manager-id', role: 'FARM_MANAGER' },
        'farm-id',
      ),
    ).resolves.toBeUndefined();
  });

  it('rejects staff without an active farm assignment', async () => {
    const prisma = {
      farmStaff: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const service = new FarmAccessService(prisma as any);

    await expect(
      service.assertCanRecordUsage(
        { userId: 'farmer-id', role: 'FARMER' },
        'farm-id',
      ),
    ).rejects.toThrow('Bạn chưa được phân công vào trang trại này');
  });
});
