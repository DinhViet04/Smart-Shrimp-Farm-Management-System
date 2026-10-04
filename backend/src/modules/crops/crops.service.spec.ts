import { CropsService } from './crops.service.js';

describe('CropsService list queries', () => {
  const user = { userId: 'manager-id', role: 'FARM_MANAGER' };

  function createService() {
    const prisma = {
      crop: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    const farmAccess = {
      getAccessibleFarmIds: jest.fn().mockResolvedValue(['farm-id']),
    };
    const notificationsService = {};

    return {
      service: new CropsService(
        prisma as any,
        farmAccess as any,
        notificationsService as any,
      ),
      prisma,
    };
  }

  it('uses a lightweight projection for pond overview requests', async () => {
    const { service, prisma } = createService();

    await service.findAll(user, { summary: true });

    const query = prisma.crop.findMany.mock.calls[0][0];
    expect(query.select).toBeDefined();
    expect(query.select.parentCrop).toBeUndefined();
    expect(query.select.childCrops).toBeUndefined();
    expect(query.where).toEqual({
      pond: { farmId: { in: ['farm-id'] } },
    });
  });

  it('keeps lineage relations in the full crop list', async () => {
    const { service, prisma } = createService();

    await service.findAll(user, {});

    const query = prisma.crop.findMany.mock.calls[0][0];
    expect(query.include.parentCrop).toBeDefined();
    expect(query.include.childCrops).toBeDefined();
  });
});
