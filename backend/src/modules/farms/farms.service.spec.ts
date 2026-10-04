import { FarmsService } from './farms.service.js';

describe('FarmsService list query', () => {
  it('loads farms and ponds in parallel without returning full user records', async () => {
    const farm = {
      id: 'farm-id',
      name: 'Farm A',
      ownerId: 'manager-id',
      deletedAt: null,
    };
    const pond = { id: 'pond-id', name: 'Pond A', farmId: 'farm-id' };
    const prisma = {
      farm: { findMany: jest.fn().mockResolvedValue([farm]) },
      pond: { findMany: jest.fn().mockResolvedValue([pond]) },
      user: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const service = new FarmsService(
      prisma as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    const result = await service.findAll(
      undefined,
      undefined,
      'manager-id',
      'FARM_MANAGER',
    );

    expect(prisma.farm.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { deletedAt: null, ownerId: 'manager-id' },
      }),
    );
    expect(prisma.pond.findMany).toHaveBeenCalled();
    expect(prisma.user.findMany).not.toHaveBeenCalled();
    expect(result[0]).toMatchObject({
      id: 'farm-id',
      ponds: [{ id: 'pond-id' }],
    });
  });
});
