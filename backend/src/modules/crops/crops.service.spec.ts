import { CropsService } from './crops.service.js';
import { BadRequestException } from '@nestjs/common';

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

describe('CropsService harvest summary', () => {
  const user = { userId: 'manager-id', role: 'FARM_MANAGER' };

  function createHarvestService() {
    const crop = {
      id: 'crop-id',
      pondId: 'pond-id',
      startDate: new Date('2026-01-01T00:00:00.000Z'),
      initialShrimpCount: 100_000,
      status: 'ACTIVE',
      actualHarvestDate: null,
      pond: { id: 'pond-id', farmId: 'farm-id' },
    };
    const prisma = {
      crop: {
        findUnique: jest.fn().mockResolvedValue(crop),
        findFirst: jest.fn().mockResolvedValue(null),
        update: jest
          .fn()
          .mockImplementation(({ data }) =>
            Promise.resolve({ ...crop, ...data }),
          ),
      },
    };
    const farmAccess = {
      assertCanAccessFarm: jest.fn().mockResolvedValue(undefined),
      getAccessibleFarmIds: jest.fn().mockResolvedValue(['farm-id']),
    };
    return {
      service: new CropsService(prisma as any, farmAccess as any, {} as any),
      prisma,
    };
  }

  it('recalculates revenue, total cost, profit, FCR and survival rate on the server', async () => {
    const { service, prisma } = createHarvestService();

    await service.harvest(user, 'crop-id', {
      actualHarvestKg: 2_000,
      actualHarvestSize: 40,
      actualHarvestPricePerKg: 120_000,
      harvestFeedKg: 2_600,
      harvestFeedCost: 90_000_000,
      harvestMedicineCost: 5_000_000,
      harvestChemicalCost: 3_000_000,
      harvestSeedCost: 12_000_000,
      harvestElectricityCost: 8_000_000,
      harvestLaborCost: 6_000_000,
      harvestOtherCost: 1_000_000,
      actualHarvestDate: '2026-06-01T00:00:00.000Z',
    });

    expect(prisma.crop.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          actualHarvestCount: 80_000,
          actualHarvestRevenue: 240_000_000,
          actualHarvestCost: 125_000_000,
          actualHarvestProfit: 115_000_000,
          actualHarvestFcr: 1.3,
          actualHarvestSurvivalRate: 80,
          harvestEvaluation: expect.stringContaining('2.000 kg'),
          harvestLessonsLearned: expect.stringContaining(
            'Chưa có vụ thu hoạch trước',
          ),
          harvestNextRecommendation: expect.stringContaining('mốc tham chiếu'),
        }),
      }),
    );
  });

  it('rejects harvest values that imply a survival rate above 100 percent', async () => {
    const { service } = createHarvestService();

    await expect(
      service.harvest(user, 'crop-id', {
        actualHarvestKg: 3_000,
        actualHarvestSize: 40,
        actualHarvestPricePerKg: 120_000,
        actualHarvestDate: '2026-06-01T00:00:00.000Z',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('aggregates manager revenue, cost, profit and recent harvests by year', async () => {
    const harvested = [
      {
        id: 'crop-2026',
        pondId: 'pond-id',
        initialShrimpCount: 100_000,
        actualHarvestDate: new Date('2026-06-01T00:00:00.000Z'),
        actualHarvestKg: 2_000,
        actualHarvestRevenue: 240_000_000,
        actualHarvestCost: 125_000_000,
        actualHarvestProfit: 115_000_000,
        actualHarvestFcr: 1.3,
        actualHarvestSurvivalRate: 80,
        targetSurvivalRate: 75,
        targetHarvestSize: 40,
        pond: {
          id: 'pond-id',
          name: 'Ao 1',
          farmId: 'farm-id',
          farm: { id: 'farm-id', name: 'Trại A' },
        },
      },
      {
        id: 'crop-2025',
        pondId: 'pond-id',
        initialShrimpCount: 100_000,
        actualHarvestDate: new Date('2025-06-01T00:00:00.000Z'),
        actualHarvestKg: 1_000,
        actualHarvestRevenue: 100_000_000,
        actualHarvestCost: 70_000_000,
        actualHarvestProfit: 30_000_000,
        actualHarvestFcr: 1.5,
        actualHarvestSurvivalRate: 70,
        targetSurvivalRate: 75,
        targetHarvestSize: 40,
        pond: {
          id: 'pond-id',
          name: 'Ao 1',
          farmId: 'farm-id',
          farm: { id: 'farm-id', name: 'Trại A' },
        },
      },
    ];
    const prisma = {
      crop: { findMany: jest.fn().mockResolvedValue(harvested) },
    };
    const farmAccess = {
      assertCanAccessFarm: jest.fn().mockResolvedValue(undefined),
      getAccessibleFarmIds: jest.fn().mockResolvedValue(['farm-id']),
    };
    const service = new CropsService(
      prisma as any,
      farmAccess as any,
      {} as any,
    );

    const result = await service.getManagerSummary(user, { year: 2026 });

    expect(result.totals).toEqual(
      expect.objectContaining({
        harvestedCrops: 1,
        revenue: 240_000_000,
        cost: 125_000_000,
        profit: 115_000_000,
        harvestKg: 2_000,
        targetMet: 1,
      }),
    );
    expect(result.comparison.revenuePercent).toBe(140);
    expect(result.recentHarvests).toHaveLength(1);
    expect(result.farmSummaries).toEqual([
      expect.objectContaining({
        farmId: 'farm-id',
        farmName: 'Trại A',
        totals: expect.objectContaining({
          harvestedCrops: 1,
          profit: 115_000_000,
        }),
        ponds: [
          expect.objectContaining({
            pondId: 'pond-id',
            pondName: 'Ao 1',
            totals: expect.objectContaining({
              averageFcr: 1.3,
              averageSurvivalRate: 80,
            }),
          }),
        ],
      }),
    ]);
  });

  it('limits manager totals to the selected quarter and compares the same quarter last year', async () => {
    const harvested = [
      {
        id: 'q2-current',
        pondId: 'pond-id',
        initialShrimpCount: 100_000,
        actualHarvestDate: new Date('2026-05-10T00:00:00.000Z'),
        actualHarvestKg: 2_000,
        actualHarvestRevenue: 200_000_000,
        actualHarvestCost: 120_000_000,
        actualHarvestProfit: 80_000_000,
        actualHarvestFcr: 1.3,
        actualHarvestSurvivalRate: 80,
        targetSurvivalRate: 75,
        targetHarvestSize: 40,
        pond: {
          id: 'pond-id',
          name: 'Ao 1',
          farmId: 'farm-id',
          farm: { id: 'farm-id', name: 'Trại A' },
        },
      },
      {
        id: 'q2-previous',
        pondId: 'pond-id',
        initialShrimpCount: 100_000,
        actualHarvestDate: new Date('2025-04-20T00:00:00.000Z'),
        actualHarvestKg: 1_000,
        actualHarvestRevenue: 100_000_000,
        actualHarvestCost: 70_000_000,
        actualHarvestProfit: 30_000_000,
        actualHarvestFcr: 1.5,
        actualHarvestSurvivalRate: 70,
        targetSurvivalRate: 75,
        targetHarvestSize: 40,
        pond: {
          id: 'pond-id',
          name: 'Ao 1',
          farmId: 'farm-id',
          farm: { id: 'farm-id', name: 'Trại A' },
        },
      },
    ];
    const prisma = {
      crop: { findMany: jest.fn().mockResolvedValue(harvested) },
    };
    const farmAccess = {
      getAccessibleFarmIds: jest.fn().mockResolvedValue(['farm-id']),
    };
    const service = new CropsService(
      prisma as any,
      farmAccess as any,
      {} as any,
    );

    const result = await service.getManagerSummary(user, {
      year: 2026,
      quarter: 2,
    });

    expect(prisma.crop.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [
            {
              actualHarvestDate: {
                gte: new Date('2025-04-01T00:00:00.000Z'),
                lt: new Date('2025-07-01T00:00:00.000Z'),
              },
            },
            {
              actualHarvestDate: {
                gte: new Date('2026-04-01T00:00:00.000Z'),
                lt: new Date('2026-07-01T00:00:00.000Z'),
              },
            },
          ],
        }),
      }),
    );
    expect(result.quarter).toBe(2);
    expect(result.totals.revenue).toBe(200_000_000);
    expect(result.comparison.revenuePercent).toBe(100);
  });
});

describe('CropsService detailed report', () => {
  const user = { userId: 'manager-id', role: 'FARM_MANAGER' };

  it('aggregates all operational data across feeding, water quality, growth, health and treatments', async () => {
    const crop = {
      id: 'crop-1',
      pondId: 'pond-1',
      startDate: new Date('2026-07-17T00:00:00.000Z'),
      initialShrimpCount: 100_000,
      status: 'ACTIVE',
      stage: 'COMMERCIAL',
      parentCropId: 'nursery-1',
      transferDate: new Date('2026-08-05T00:00:00.000Z'),
      transferSize: 500,
      splitNote: 'Tách từ ao ươm A1',
      pond: {
        id: 'pond-1',
        name: 'Ao nuôi A1',
        farmId: 'farm-1',
        farm: { id: 'farm-1', name: 'Trang trại Long' },
      },
      parentCrop: {
        id: 'nursery-1',
        pond: { id: 'pond-nursery', name: 'Ao ươm A1' },
      },
      childCrops: [],
    };

    const prisma = {
      crop: { findUnique: jest.fn().mockResolvedValue(crop) },
      feedingLog: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'feed-1',
            feedAmount: 50,
            feedingStatus: 'COMPLETED',
            feedProduct: {
              id: 'p-1',
              itemName: 'Cám tôm Grobest',
              pricePerPackage: 500_000,
              weightPerPkg: 25,
            },
          },
        ]),
      },
      waterQualityRecord: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'wq-1',
            ph: 7.8,
            dissolvedOxygen: 5.5,
            temperature: 29,
            salinity: 15,
            nh3: 0.01,
            no2: 0.05,
          },
        ]),
      },
      shrimpSizeSample: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'sample-1',
            samplingDate: new Date('2026-08-10'),
            abwGram: 15.5,
            sizePerKg: 64.5,
            adgGramPerDay: 0.35,
          },
        ]),
      },
      shrimpHealthRecord: {
        findMany: jest
          .fn()
          .mockResolvedValue([
            { id: 'health-1', healthStatus: 'NORMAL', severity: 'NORMAL' },
          ]),
      },
      incident: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      inventoryUsageLog: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'usage-1',
            quantityUsed: 2,
            inventory: {
              id: 'inv-1',
              itemName: 'Men vi sinh Probiotic',
              category: 'CHEMICAL',
              pricePerPackage: 200_000,
              weightPerPkg: 1,
            },
          },
        ]),
      },
      mortalityLog: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    const farmAccess = {
      assertCanAccessFarm: jest.fn().mockResolvedValue(undefined),
    };

    const service = new CropsService(
      prisma as any,
      farmAccess as any,
      {} as any,
    );
    const report = await service.getDetailedReport(user, 'crop-1');

    expect(farmAccess.assertCanAccessFarm).toHaveBeenCalledWith(user, 'farm-1');
    expect(report.crop.id).toBe('crop-1');
    expect(report.transferInfo.splitFromParent).toEqual({
      parentCropId: 'nursery-1',
      pondId: 'pond-nursery',
      pondName: 'Ao ươm A1',
      transferDate: new Date('2026-08-05T00:00:00.000Z'),
      transferSize: 500,
      initialCountReceived: 100_000,
      splitNote: 'Tách từ ao ươm A1',
    });
    expect(report.feeding.totalFeedKg).toBe(50);
    expect(report.waterQuality.averages?.ph).toBe(7.8);
    expect(report.growth.samples.length).toBe(1);
    expect(report.health.summary.normal).toBe(1);
    expect(report.treatmentsAndSupplies.totalChemicalCost).toBe(400_000);
  });
});
