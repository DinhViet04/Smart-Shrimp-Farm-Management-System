import { PondsService } from './ponds.service.js';

describe('PondsService overview', () => {
  it('loads only the latest crop per pond and returns the three overview lists', async () => {
    const farm = {
      id: 'farm-id',
      name: 'Farm A',
      location: null,
      address: 'Address',
      area: 1000,
      description: null,
      status: 'ACTIVE',
      ownerId: 'manager-id',
      farmingModel: 'HIGH_TECH',
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date('2026-01-01'),
      ponds: [
        {
          id: 'pond-id',
          name: 'Pond A',
          areaSize: 500,
          depth: 1.5,
          farmId: 'farm-id',
          createdAt: new Date('2026-01-01'),
          updatedAt: new Date('2026-01-01'),
          crops: [
            {
              id: 'crop-id',
              pondId: 'pond-id',
              startDate: new Date('2026-02-01'),
              initialShrimpCount: 10000,
              status: 'ACTIVE',
            },
          ],
        },
      ],
    };
    const prisma = {
      farm: {
        findMany: jest.fn().mockResolvedValue([
          (({ ponds: _ponds, ...farmData }) => farmData)(farm),
        ]),
      },
      pond: {
        findMany: jest.fn().mockResolvedValue([
          (({ crops: _crops, ...pondData }) => pondData)(farm.ponds[0]),
        ]),
      },
      crop: {
        findMany: jest.fn().mockResolvedValue([
          farm.ponds[0].crops[0],
        ]),
      },
    };
    const farmAccess = {
      getAccessibleFarmIds: jest.fn().mockResolvedValue(['farm-id']),
    };
    const service = new PondsService(
      prisma as any,
      farmAccess as any,
      {} as any,
    );

    const result = await service.findOverview({
      userId: 'manager-id',
      role: 'FARM_MANAGER',
    });

    const farmQuery = prisma.farm.findMany.mock.calls[0][0];
    const cropQuery = prisma.crop.findMany.mock.calls[0][0];
    expect(farmQuery.where).toEqual({
      deletedAt: null,
      ownerId: 'manager-id',
    });
    expect(cropQuery.distinct).toEqual(['pondId']);
    expect(cropQuery.orderBy).toEqual([
      { pondId: 'asc' },
      { startDate: 'desc' },
    ]);
    expect(result.farms).toHaveLength(1);
    expect(result.farms[0]).not.toHaveProperty('ponds');
    expect(result.ponds[0]).toMatchObject({
      id: 'pond-id',
      farm: { id: 'farm-id', name: 'Farm A' },
    });
    expect(result.ponds[0]).not.toHaveProperty('crops');
    expect(result.crops[0]).toMatchObject({
      id: 'crop-id',
      pond: {
        id: 'pond-id',
        farmId: 'farm-id',
        farm: { id: 'farm-id', name: 'Farm A' },
      },
    });
  });
});
