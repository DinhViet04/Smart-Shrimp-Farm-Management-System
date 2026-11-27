import { WaterQualityService } from './water-quality.service.js';

describe('WaterQualityService manager trends', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-10-07T08:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns seven daily buckets and the latest measurement for every accessible pond', async () => {
    const prisma = {
      waterQualityRecord: {
        findMany: jest
          .fn()
          .mockResolvedValueOnce([
            {
              recordTime: new Date('2026-10-01T01:00:00.000Z'),
              dissolvedOxygen: 4,
              ph: 8,
            },
            {
              recordTime: new Date('2026-10-01T05:00:00.000Z'),
              dissolvedOxygen: 6,
              ph: 8.4,
            },
            {
              recordTime: new Date('2026-10-07T01:00:00.000Z'),
              dissolvedOxygen: 3,
              ph: 7.2,
            },
          ])
          .mockResolvedValueOnce([
            {
              pondId: 'pond-id',
              recordTime: new Date('2026-10-07T01:00:00.000Z'),
              temperature: 28,
              dissolvedOxygen: 3,
              ph: 7.2,
              salinity: 15,
              alkalinity: 120,
              nh3: 0.1,
              h2s: 0.01,
              no2: 0.1,
              transparency: 35,
              waterColor: null,
            },
          ]),
        groupBy: jest.fn().mockResolvedValue([
          {
            pondId: 'pond-id',
            _max: { recordTime: new Date('2026-10-07T01:00:00.000Z') },
          },
        ]),
      },
    };
    const farmAccess = {
      assertCanAccessFarm: jest.fn(),
      getAccessibleFarmIds: jest.fn().mockResolvedValue(['farm-id']),
    };
    const service = new WaterQualityService(
      prisma as any,
      farmAccess as any,
      {} as any,
    );

    const result = await service.getManagerTrends(
      { userId: 'manager-id', role: 'FARM_MANAGER' },
      { days: 7 },
    );

    expect(result.series).toHaveLength(7);
    expect(result.series[0]).toEqual({
      date: '2026-10-01',
      averageDo: 5,
      averagePh: 8.2,
      sampleCount: 2,
    });
    expect(result.series[1]).toEqual({
      date: '2026-10-02',
      averageDo: null,
      averagePh: null,
      sampleCount: 0,
    });
    expect(result.latestByPond[0]).toMatchObject({
      pondId: 'pond-id',
      dissolvedOxygen: 3,
      ph: 7.2,
      overallStatus: 'Danger',
    });

    const trendQuery = prisma.waterQualityRecord.findMany.mock.calls[0][0];
    const latestGroupQuery = prisma.waterQualityRecord.groupBy.mock.calls[0][0];
    const latestQuery = prisma.waterQualityRecord.findMany.mock.calls[1][0];
    expect(trendQuery.where.pond).toEqual({ farmId: { in: ['farm-id'] } });
    expect(latestGroupQuery.by).toEqual(['pondId']);
    expect(latestGroupQuery._max).toEqual({ recordTime: true });
    expect(latestQuery.where.OR).toEqual([
      { pondId: 'pond-id', recordTime: new Date('2026-10-07T01:00:00.000Z') },
    ]);
  });

  it('checks access when filtering by one farm', async () => {
    const prisma = {
      waterQualityRecord: {
        findMany: jest.fn().mockResolvedValue([]),
        groupBy: jest.fn().mockResolvedValue([]),
      },
    };
    const farmAccess = {
      assertCanAccessFarm: jest.fn().mockResolvedValue(undefined),
      getAccessibleFarmIds: jest.fn().mockResolvedValue(['farm-id']),
    };
    const service = new WaterQualityService(
      prisma as any,
      farmAccess as any,
      {} as any,
    );

    await service.getManagerTrends(
      { userId: 'manager-id', role: 'FARM_MANAGER' },
      { farmId: 'farm-id', days: 7 },
    );

    expect(farmAccess.assertCanAccessFarm).toHaveBeenCalledWith(
      { userId: 'manager-id', role: 'FARM_MANAGER' },
      'farm-id',
    );
  });
});

describe('WaterQualityService – lưu việc xử lý cảnh báo nước trên server', () => {
  const user = { userId: 'tech-1', role: 'TECHNICIAN' } as any;
  const makeService = (overrides: Record<string, any> = {}) => {
    const prisma: any = {
      waterQualityRecord: {
        findUnique: jest.fn().mockResolvedValue({ id: 'wq-1', pondId: 'p1', pond: { id: 'p1', farmId: 'f1' } }),
      },
      waterTreatment: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 't1', ...data })),
        ...overrides,
      },
    };
    const farmAccess = { assertCanAccessFarm: jest.fn().mockResolvedValue(undefined) };
    const service = new WaterQualityService(prisma, farmAccess as any, {} as any);
    return { service, prisma, farmAccess };
  };

  it('ghi nhận đã xử lý: lưu người xử lý, ghi chú, hóa chất', async () => {
    const { service, prisma, farmAccess } = makeService();
    await service.saveTreatment(user, 'wq-1', {
      note: 'Tạt vôi CaCO3, chạy quạt 2 giờ',
      chemicals: [{ name: 'Vôi CaCO3', quantity: 20, unit: 'kg' }],
    });

    expect(farmAccess.assertCanAccessFarm).toHaveBeenCalledWith(user, 'f1');
    expect(prisma.waterTreatment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        waterQualityRecordId: 'wq-1',
        pondId: 'p1',
        treatedById: 'tech-1',
        note: 'Tạt vôi CaCO3, chạy quạt 2 giờ',
      }),
    });
  });

  it('cảnh báo đã xử lý rồi -> báo lỗi, không tạo trùng', async () => {
    const { service, prisma } = makeService({ findUnique: jest.fn().mockResolvedValue({ id: 'old' }) });
    await expect(service.saveTreatment(user, 'wq-1', {})).rejects.toThrow('đã được xử lý');
    expect(prisma.waterTreatment.create).not.toHaveBeenCalled();
  });

  it('chưa chạy prisma db push (thiếu bảng) -> thông báo rõ cách khắc phục', async () => {
    const { service } = makeService({ findUnique: jest.fn().mockRejectedValue({ code: 'P2021' }) });
    await expect(service.saveTreatment(user, 'wq-1', {})).rejects.toThrow('prisma db push');
  });
});
