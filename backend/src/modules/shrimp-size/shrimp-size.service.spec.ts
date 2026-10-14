import { ShrimpSizeService } from './shrimp-size.service.js';

describe('ShrimpSizeService access control', () => {
  it('checks farm access before returning pond samples for active crop', async () => {
    const prisma = {
      pond: {
        findUnique: jest.fn().mockResolvedValue({ farmId: 'farm-1' }),
      },
      crop: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'crop-1',
          startDate: new Date('2026-07-17'),
          status: 'ACTIVE',
        }),
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
    expect(prisma.crop.findFirst).toHaveBeenCalledWith({
      where: { pondId: 'pond-1', status: 'ACTIVE' },
    });
    expect(prisma.shrimpSizeSample.findMany).toHaveBeenCalledWith({
      where: {
        pondId: 'pond-1',
        samplingDate: { gte: expect.any(Date) },
      },
      orderBy: { samplingDate: 'asc' },
    });
  });

  it('returns empty array without querying samples when pond has no active crop', async () => {
    const prisma = {
      pond: {
        findUnique: jest.fn().mockResolvedValue({ farmId: 'farm-1' }),
      },
      crop: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      shrimpSizeSample: {
        findMany: jest.fn(),
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

    const result = await service.getSamplesByPond('pond-1', {
      userId: 'technician-1',
      role: 'TECHNICIAN',
    });

    expect(result).toEqual([]);
    expect(prisma.shrimpSizeSample.findMany).not.toHaveBeenCalled();
  });

  it('does not query samples when farm access is denied', async () => {
    const prisma = {
      pond: {
        findUnique: jest.fn().mockResolvedValue({ farmId: 'farm-1' }),
      },
      crop: { findFirst: jest.fn() },
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
