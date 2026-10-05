import { ShrimpSizeService } from './shrimp-size.service.js';

describe('ShrimpSizeService access control', () => {
  it('checks farm access before returning pond samples', async () => {
    const prisma = {
      pond: {
        findUnique: jest.fn().mockResolvedValue({ farmId: 'farm-1' }),
      },
      shrimpSizeSample: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    const farmAccess = {
      assertCanAccessFarm: jest.fn().mockResolvedValue(undefined),
    };
    const service = new ShrimpSizeService(
      prisma as any,
      {} as any,
      farmAccess as any,
    );

    await service.getSamplesByPond('pond-1', {
      userId: 'technician-1',
      role: 'TECHNICIAN',
    });

    expect(farmAccess.assertCanAccessFarm).toHaveBeenCalledWith(
      { userId: 'technician-1', role: 'TECHNICIAN' },
      'farm-1',
    );
    expect(prisma.shrimpSizeSample.findMany).toHaveBeenCalled();
  });

  it('does not query samples when farm access is denied', async () => {
    const prisma = {
      pond: {
        findUnique: jest.fn().mockResolvedValue({ farmId: 'farm-1' }),
      },
      shrimpSizeSample: { findMany: jest.fn() },
    };
    const farmAccess = {
      assertCanAccessFarm: jest.fn().mockRejectedValue(new Error('forbidden')),
    };
    const service = new ShrimpSizeService(
      prisma as any,
      {} as any,
      farmAccess as any,
    );

    await expect(
      service.getSamplesByPond('pond-1', {
        userId: 'technician-1',
        role: 'TECHNICIAN',
      }),
    ).rejects.toThrow('forbidden');

    expect(prisma.shrimpSizeSample.findMany).not.toHaveBeenCalled();
  });
});
