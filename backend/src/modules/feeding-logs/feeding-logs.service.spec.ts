import { FeedingLogsService } from './feeding-logs.service.js';

describe('FeedingLogsService grouped list', () => {
  it('paginates feeding-day groups before loading session rows', async () => {
    const feedingDate = new Date('2026-10-01');
    const key = {
      feedingDate,
      farmId: 'farm-id',
      pondId: 'pond-id',
      cropId: 'crop-id',
    };
    const prisma = {
      feedingLog: {
        groupBy: jest
          .fn()
          .mockResolvedValueOnce([key])
          .mockResolvedValueOnce([key, { ...key, feedingDate: new Date('2026-09-30') }]),
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'log-id',
            ...key,
            feedProductId: 'feed-id',
            feedingSession: 'SESSION_1',
            feedingTime: '06:00',
            feedAmount: 2,
            feedingMethod: 'MANUAL',
            feedingStatus: 'COMPLETED',
            note: null,
            createdAt: feedingDate,
            farm: { id: 'farm-id', name: 'Farm A' },
            pond: { id: 'pond-id', name: 'Pond A' },
            crop: { id: 'crop-id', startDate: feedingDate, status: 'ACTIVE' },
            creator: { id: 'user-id', fullName: 'User A' },
            feedProduct: { id: 'feed-id', itemName: 'Feed A', unit: 'kg' },
          },
        ]),
      },
    };
    const farmAccess = {
      getAccessibleFarmIds: jest.fn().mockResolvedValue(undefined),
      assertCanAccessFarm: jest.fn(),
    };
    const service = new FeedingLogsService(prisma as any, farmAccess as any);

    const result = await service.findAllGrouped(
      { userId: 'admin-id', role: 'ADMIN' },
      { page: 1, size: 1 },
    );

    expect(prisma.feedingLog.groupBy.mock.calls[0][0]).toMatchObject({
      skip: 1,
      take: 1,
      by: ['feedingDate', 'farmId', 'pondId', 'cropId'],
    });
    expect(prisma.feedingLog.findMany.mock.calls[0][0].where.AND[1].OR).toHaveLength(1);
    expect(result).toMatchObject({ total: 2, page: 1, size: 1 });
    expect(result.data).toHaveLength(1);
    expect(result.data[0]).toMatchObject({
      pondId: 'pond-id',
      totalFeedKg: 2,
      completedSessions: 1,
    });
  });

  it('validates an explicit farm filter before querying logs', async () => {
    const prisma = {
      feedingLog: {
        groupBy: jest.fn(),
        findMany: jest.fn(),
      },
    };
    const farmAccess = {
      getAccessibleFarmIds: jest.fn().mockResolvedValue(['farm-1']),
      assertCanAccessFarm: jest.fn().mockRejectedValue(new Error('forbidden')),
    };
    const service = new FeedingLogsService(prisma as any, farmAccess as any);

    await expect(
      service.findAllGrouped(
        { userId: 'farmer-1', role: 'FARMER' },
        { farmId: 'farm-2', page: 0, size: 10 },
      ),
    ).rejects.toThrow('forbidden');

    expect(prisma.feedingLog.groupBy).not.toHaveBeenCalled();
  });
});
