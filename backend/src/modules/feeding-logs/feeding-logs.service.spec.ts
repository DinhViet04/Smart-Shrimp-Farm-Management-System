import { FeedingLogsService } from './feeding-logs.service.js';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateDailyFeedingLogDto } from './dto/create-feeding-log.dto.js';
import { FeedingMethod, FeedingSession, FeedingStatus } from '@prisma/client';

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
          .mockResolvedValueOnce([
            key,
            { ...key, feedingDate: new Date('2026-09-30') },
          ]),
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
    expect(
      prisma.feedingLog.findMany.mock.calls[0][0].where.AND[1].OR,
    ).toHaveLength(1);
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

  it('validates CreateDailyFeedingLogDto successfully with string feedProductId like inv-feed-005', async () => {
    const dto = plainToInstance(CreateDailyFeedingLogDto, {
      farmId: 'farm-001',
      pondId: 'pond-001',
      cropId: 'crop-001',
      feedingDate: '2026-10-15',
      sessions: [
        {
          feedingSession: FeedingSession.SESSION_1,
          feedingTime: '06:00',
          feedProductId: 'inv-feed-005',
          feedAmount: 10.5,
          feedingMethod: FeedingMethod.MANUAL,
          feedingStatus: FeedingStatus.COMPLETED,
        },
      ],
    });

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });
});

describe('FeedingLogsService inventory deduction', () => {
  const user = { userId: 'farmer-id', role: 'FARMER' };
  const feedingDate = '2026-11-19';
  const day = new Date(feedingDate);
  const baseLog = {
    farmId: 'farm-1',
    pondId: 'pond-1',
    cropId: 'crop-1',
    feedingDate: day,
    feedProductId: 'feed-1',
    feedingTime: '06:00',
    feedingMethod: 'MANUAL',
    feedingStatus: 'COMPLETED',
  };

  const buildPrisma = (opts: { deductCount?: number } = {}) => {
    const prisma: any = {
      pond: {
        findFirst: jest.fn().mockResolvedValue({ id: 'pond-1', name: 'Ao A1', farmId: 'farm-1' }),
      },
      crop: { findFirst: jest.fn().mockResolvedValue({ id: 'crop-1', status: 'ACTIVE' }) },
      feedingLog: {
        findMany: jest
          .fn()
          // 1) các cử đã có trước khi lưu: cử 1 đã cho ăn 5 kg
          .mockResolvedValueOnce([{ ...baseLog, feedingSession: 'SESSION_1', feedAmount: 5 }])
          // 2) đọc lại cả ngày sau khi upsert: cử 1 + cử 2
          .mockResolvedValueOnce([
            { ...baseLog, feedingSession: 'SESSION_1', feedAmount: 5 },
            { ...baseLog, feedingSession: 'SESSION_2', feedAmount: 4 },
          ]),
        upsert: jest.fn().mockResolvedValue({}),
      },
      inventory: {
        findFirst: jest.fn().mockResolvedValue({ id: 'feed-1', quantity: 100, unit: 'kg', itemName: 'Cám' }),
        updateMany: jest.fn().mockResolvedValue({ count: opts.deductCount ?? 1 }),
        findUnique: jest.fn().mockResolvedValue({ id: 'feed-1', quantity: 91, packageQty: 4, weightPerPkg: 25 }),
        update: jest.fn().mockResolvedValue({}),
      },
      inventoryUsageLog: {
        findMany: jest.fn().mockResolvedValue([{ id: 'usage-1', inventoryId: 'feed-1' }]),
        update: jest.fn().mockResolvedValue({}),
        create: jest.fn().mockResolvedValue({}),
        delete: jest.fn().mockResolvedValue({}),
        deleteMany: jest.fn().mockResolvedValue({}),
      },
    };
    prisma.$transaction = jest.fn((cb: (tx: any) => unknown) => cb(prisma));
    return prisma;
  };
  const farmAccess = { assertCanAccessFarm: jest.fn().mockResolvedValue(undefined) };

  const saveSession2 = (service: FeedingLogsService) =>
    service.createOrUpdateDailyLog(user as any, {
      farmId: 'farm-1',
      pondId: 'pond-1',
      cropId: 'crop-1',
      feedingDate,
      sessions: [
        {
          feedingSession: FeedingSession.SESSION_2,
          feedingTime: '08:00',
          feedProductId: 'feed-1',
          feedAmount: 4,
          feedingMethod: FeedingMethod.MANUAL,
          feedingStatus: FeedingStatus.COMPLETED,
        },
      ],
    } as any);

  it('lưu từng cử: chỉ trừ kho phần của cử mới, phiếu xuất kho là tổng cả ngày', async () => {
    const prisma = buildPrisma();
    const service = new FeedingLogsService(prisma, farmAccess as any);

    await saveSession2(service);

    // Chỉ trừ 4 kg của cử 2 (cử 1 đã trừ trước đó)
    expect(prisma.inventory.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'feed-1', quantity: { gte: 4 } }),
        data: { quantity: { decrement: 4 } },
      }),
    );
    // Số bao = ceil(91 / 25) = 4
    expect(prisma.inventory.update).toHaveBeenCalledWith({
      where: { id: 'feed-1' },
      data: { quantity: 91, packageQty: 4 },
    });
    // Phiếu xuất kho = 5 + 4 = 9 kg (không bị ghi đè thành 4 kg)
    expect(prisma.inventoryUsageLog.update).toHaveBeenCalledWith({
      where: { id: 'usage-1' },
      data: expect.objectContaining({ quantityUsed: 9, pondId: 'pond-1', cropId: 'crop-1' }),
    });
    // Tìm phiếu theo ghi chú chính xác của đúng ao & trang trại
    expect(prisma.inventoryUsageLog.findMany.mock.calls[0][0].where).toMatchObject({
      notes: 'Xuất kho từ Nhật ký cho ăn - Ao A1',
      inventory: { farmId: 'farm-1' },
    });
  });

  it('báo lỗi (không kẹp tồn kho về 0) khi kho không còn đủ lúc trừ', async () => {
    const prisma = buildPrisma({ deductCount: 0 });
    const service = new FeedingLogsService(prisma, farmAccess as any);

    await expect(saveSession2(service)).rejects.toThrow('không đủ');
    expect(prisma.inventoryUsageLog.update).not.toHaveBeenCalled();
  });

  it('xoá nhật ký ngày: xoá đúng phiếu xuất kho của ao tên bắt đầu bằng "Ao"', async () => {
    const prisma = buildPrisma();
    prisma.feedingLog.findMany = jest.fn().mockResolvedValue([
      { ...baseLog, feedingSession: 'SESSION_1', feedAmount: 5, pond: { name: 'Ao A1' } },
    ]);
    prisma.feedingLog.deleteMany = jest.fn().mockResolvedValue({});
    const service = new FeedingLogsService(prisma, farmAccess as any);

    await service.deleteDailyLog(user as any, 'farm-1', 'pond-1', 'crop-1', feedingDate);

    expect(prisma.inventoryUsageLog.deleteMany.mock.calls[0][0].where).toMatchObject({
      notes: 'Xuất kho từ Nhật ký cho ăn - Ao A1',
      inventory: { farmId: 'farm-1' },
    });
  });
});
