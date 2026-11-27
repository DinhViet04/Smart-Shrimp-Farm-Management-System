import { ChatDataScopeService, ChatScope } from './chat-data-scope.service';
import { ChatToolsService } from './chat-tools.service';

const scopeOf = (role: string, userId = 'u-1'): ChatScope => ({
  userId,
  role,
  farmIds: ['farm-1'],
});

describe('ChatDataScopeService – ma trận phân quyền tra cứu của AI', () => {
  const farmAccess = { getAccessibleFarmIds: jest.fn() };
  const service = new ChatDataScopeService(farmAccess as any);

  describe('resolveScope', () => {
    it('ADMIN không bị giới hạn trang trại', async () => {
      farmAccess.getAccessibleFarmIds.mockResolvedValueOnce(undefined);
      await expect(
        service.resolveScope({ userId: 'a', role: 'ADMIN' }),
      ).resolves.toEqual({
        userId: 'a',
        role: 'ADMIN',
        farmIds: undefined,
      });
    });

    it('nhân viên không có trang trại -> phạm vi rỗng (không phải toàn hệ thống)', async () => {
      farmAccess.getAccessibleFarmIds.mockResolvedValueOnce(undefined);
      const scope = await service.resolveScope({ userId: 'f', role: 'FARMER' });
      expect(scope.farmIds).toEqual([]);
    });
  });

  describe('FARM_MANAGER', () => {
    const scope = scopeOf('FARM_MANAGER');

    it('xem toàn bộ dữ liệu trang trại, không lọc theo người tạo', () => {
      expect(service.feedingWhere(scope)).toEqual({
        farmId: { in: ['farm-1'] },
      });
      expect(service.waterWhere(scope)).toEqual({
        pond: { farmId: { in: ['farm-1'] }, farm: { deletedAt: null } },
      });
      expect(service.healthWhere(scope)).toEqual({
        farmId: { in: ['farm-1'] },
      });
      expect(service.growthWhere(scope)).toEqual({
        pond: { farmId: { in: ['farm-1'] } },
      });
      expect(service.incidentWhere(scope)).toEqual({
        crop: { pond: { farmId: { in: ['farm-1'] } } },
      });
      expect(service.mortalityWhere(scope)).not.toBeNull();
      expect(service.inventoryWhere(scope)).not.toBeNull();
      expect(service.canAccess(scope, 'CROP_RESULTS')).toBe(true);
      expect(service.canAccess(scope, 'STAFF_FILTER')).toBe(true);
    });
  });

  describe('TECHNICIAN', () => {
    const scope = scopeOf('TECHNICIAN', 'tech-1');

    it('xem toàn bộ dữ liệu nước của trang trại được phân công (không lọc người đo)', () => {
      expect(service.waterWhere(scope)).toEqual({
        pond: { farmId: { in: ['farm-1'] }, farm: { deletedAt: null } },
      });
      expect(service.waterTreatmentWhere(scope)).not.toBeNull();
      expect(service.treatmentStockWhere(scope)).toMatchObject({
        farmId: { in: ['farm-1'] },
        category: { in: ['CHEMICAL', 'MEDICINE'] },
      });
    });

    it('đọc toàn bộ dữ liệu cấp trang trại (khớp quyền GET trên app), không lọc theo người tạo', () => {
      expect(service.feedingWhere(scope)).toEqual({ farmId: { in: ['farm-1'] } });
      expect(service.healthWhere(scope)).toEqual({ farmId: { in: ['farm-1'] } });
      expect(service.growthWhere(scope)).toEqual({ pond: { farmId: { in: ['farm-1'] } } });
      expect(service.incidentWhere(scope)).toEqual({
        crop: { pond: { farmId: { in: ['farm-1'] } } },
      });
      expect(service.mortalityWhere(scope)).not.toBeNull();
      expect(service.inventoryWhere(scope)).toEqual({ farmId: { in: ['farm-1'] }, deletedAt: null });
      expect(service.staffWhere(scope)).toMatchObject({ farmId: { in: ['farm-1'] } });
      expect(service.supplierWhere(scope)).toMatchObject({ farmId: { in: ['farm-1'] }, deletedAt: null });
      expect(service.canAccess(scope, 'CROP_RESULTS')).toBe(true);
      expect(service.canAccess(scope, 'STAFF_FILTER')).toBe(true);
    });

    it('không có trang trại nào được phân công -> phạm vi rỗng, không thấy dữ liệu trại khác', () => {
      const empty = { userId: 'tech-1', role: 'TECHNICIAN', farmIds: [] };
      expect(service.healthWhere(empty)).toEqual({ farmId: { in: [] } });
      expect(service.incidentWhere(empty)).toEqual({ crop: { pond: { farmId: { in: [] } } } });
    });
  });

  describe('FARMER', () => {
    const scope = scopeOf('FARMER', 'farmer-1');

    it('xem nhật ký cho ăn và sự cố của cả trang trại được phân công (không chỉ của mình)', () => {
      expect(service.feedingWhere(scope)).toEqual({ farmId: { in: ['farm-1'] } });
      expect(service.feedingWhere(scope)).not.toHaveProperty('createdBy');
      expect(service.incidentWhere(scope)).not.toHaveProperty('reporterId');
    });

    it('xem dữ liệu nước của trang trại được phân công (giống API lịch sử nước)', () => {
      expect(service.waterWhere(scope)).toEqual({
        pond: { farmId: { in: ['farm-1'] }, farm: { deletedAt: null } },
      });
    });

    it('hỏi / xem được mọi loại dữ liệu như Kỹ thuật viên (trong trang trại được phân công)', () => {
      expect(service.allowedDomains(scope)).toEqual(service.allowedDomains(scopeOf('TECHNICIAN')));
      expect(service.healthWhere(scope)).toEqual({ farmId: { in: ['farm-1'] } });
      expect(service.growthWhere(scope)).not.toBeNull();
      expect(service.mortalityWhere(scope)).not.toBeNull();
      expect(service.inventoryWhere(scope)).toEqual({ farmId: { in: ['farm-1'] }, deletedAt: null });
      expect(service.staffWhere(scope)).not.toBeNull();
      expect(service.supplierWhere(scope)).not.toBeNull();
      expect(service.canAccess(scope, 'CROP_RESULTS')).toBe(true);
    });
  });

  it('role không xác định không được xem gì', () => {
    expect(service.allowedDomains(scopeOf('UNKNOWN'))).toEqual([]);
  });
});

describe('ChatToolsService – áp bộ lọc phạm vi vào truy vấn', () => {
  const scopeService = new ChatDataScopeService({} as any);

  const makePrisma = () => ({
    feedingLog: {
      aggregate: jest.fn().mockResolvedValue({
        _sum: { feedAmount: 12.5 },
        _count: 1,
        _min: {},
        _max: {},
      }),
      groupBy: jest.fn().mockResolvedValue([]),
      findMany: jest.fn().mockResolvedValue([]),
    },
    waterQualityRecord: { aggregate: jest.fn(), findMany: jest.fn() },
    pond: { findMany: jest.fn().mockResolvedValue([]) },
    inventory: { findMany: jest.fn().mockResolvedValue([]) },
    inventoryUsageLog: {
      count: jest.fn().mockResolvedValue(0),
      findMany: jest.fn().mockResolvedValue([]),
    },
    crop: { findFirst: jest.fn() },
    user: { findMany: jest.fn().mockResolvedValue([{ id: 'staff-9' }]) },
  });

  it('chỉ đưa cho AI các tool đúng quyền của role', () => {
    const tools = new ChatToolsService({} as any, scopeService);
    const names = (role: string) =>
      tools.getToolDefinitions(scopeOf(role)).map((t) => t.function.name);

    const waterTools = [
      'query_water_quality',
      'get_water_status',
      'query_water_treatments',
      'get_treatment_stock',
      'get_farm_weather',
    ];
    const allTools = [
      'list_crops',
      'get_crop_summary',
      'get_feeding_status',
      'query_feeding_logs',
      ...waterTools,
      'query_shrimp_health',
      'query_growth_samples',
      'query_incidents',
      'query_mortality',
      'query_inventory',
      'get_farm_overview',
      'list_farm_staff',
      'query_suppliers',
    ];
    // Kỹ thuật viên đọc được mọi loại dữ liệu như trên app (trong trang trại được phân công)
    expect(names('TECHNICIAN')).toEqual(allTools);
    expect(names('FARM_MANAGER')).toEqual(allTools);
    // Nông dân: hỏi / xem được mọi thứ (quyền ghi được chặn ở AgentActionService)
    expect(names('FARMER')).toEqual(allTools);
    expect(names('UNKNOWN')).toEqual(['list_crops']);
  });

  it('Kỹ thuật viên tra cứu sức khỏe/sự cố: thấy bản ghi của cả trại, có thể lọc "giao cho tôi"', async () => {
    const prisma: any = {
      ...makePrisma(),
      shrimpHealthRecord: { aggregate: jest.fn(), findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0), groupBy: jest.fn().mockResolvedValue([]) },
      incident: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        groupBy: jest.fn().mockResolvedValue([]),
      },
    };
    const tools = new ChatToolsService(prisma, scopeService);
    await tools.execute('query_incidents', { mine: 'ASSIGNED' }, scopeOf('TECHNICIAN', 'tech-1'));
    const where = prisma.incident.findMany.mock.calls[0][0].where;
    expect(where.AND[0]).toEqual({ crop: { pond: { farmId: { in: ['farm-1'] } } } });
    expect(where.AND).toContainEqual({ assignedToId: 'tech-1' });

    await tools.execute('query_incidents', {}, scopeOf('TECHNICIAN', 'tech-1'));
    expect(JSON.stringify(prisma.incident.findMany.mock.calls[1][0].where)).not.toContain('tech-1');
  });

  it('list_farm_staff / query_suppliers chỉ trong trang trại được phân công', async () => {
    const prisma: any = {
      ...makePrisma(),
      farmStaff: { findMany: jest.fn().mockResolvedValue([]) },
      farm: { findMany: jest.fn().mockResolvedValue([]) },
      supplier: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const tools = new ChatToolsService(prisma, scopeService);
    await tools.execute('list_farm_staff', {}, scopeOf('TECHNICIAN', 'tech-1'));
    await tools.execute('query_suppliers', {}, scopeOf('TECHNICIAN', 'tech-1'));
    expect(prisma.farmStaff.findMany.mock.calls[0][0].where.AND[0]).toMatchObject({ farmId: { in: ['farm-1'] } });
    expect(prisma.supplier.findMany.mock.calls[0][0].where.AND[0]).toMatchObject({ farmId: { in: ['farm-1'] } });

    // Role không xác định không có quyền FARM_INFO
    const denied = await tools.execute('query_suppliers', {}, scopeOf('UNKNOWN'));
    expect(denied).toHaveProperty('error');
    expect(prisma.supplier.findMany).toHaveBeenCalledTimes(1);
  });

  it('Role không có quyền nước gọi tool nước -> bị từ chối, không chạm DB', async () => {
    const prisma = makePrisma();
    const tools = new ChatToolsService(prisma as any, scopeService);
    for (const name of [
      'query_water_quality',
      'get_water_status',
      'query_water_treatments',
      'get_treatment_stock',
      'get_farm_weather',
    ]) {
      const result = await tools.execute(name, {}, scopeOf('UNKNOWN'));
      expect(result).toHaveProperty('error');
    }
    expect(prisma.waterQualityRecord.findMany).not.toHaveBeenCalled();
    expect(prisma.pond.findMany).not.toHaveBeenCalled();
    expect(prisma.inventory.findMany).not.toHaveBeenCalled();
    expect(prisma.inventoryUsageLog.findMany).not.toHaveBeenCalled();
  });

  it('Farmer tra cứu nước: chỉ trong trang trại được phân công, kèm đánh giá & xu hướng theo ngày', async () => {
    const prisma = makePrisma();
    const record = {
      recordTime: new Date('2026-11-17T23:00:00Z'),
      temperature: 29,
      ph: 7.2,
      dissolvedOxygen: 2.5,
      salinity: 15,
      alkalinity: 120,
      nh3: 0.1,
      no2: 0,
      h2s: 0.01,
      transparency: 35,
      waterColor: null,
      note: null,
      pond: { name: 'A1' },
      creator: { fullName: 'KTV Nam' },
    };
    prisma.waterQualityRecord.aggregate.mockResolvedValue({
      _count: 1,
      _avg: {},
      _min: {},
      _max: {},
    });
    prisma.waterQualityRecord.findMany.mockResolvedValue([record]);
    const tools = new ChatToolsService(prisma as any, scopeService);
    const result: any = await tools.execute(
      'query_water_quality',
      {},
      scopeOf('FARMER', 'farmer-1'),
    );

    const where = prisma.waterQualityRecord.findMany.mock.calls[0][0].where;
    expect(where.AND[0]).toEqual({
      pond: { farmId: { in: ['farm-1'] }, farm: { deletedAt: null } },
    });
    expect(JSON.stringify(where)).not.toContain('farmer-1');
    expect(result.records[0].status).toBe('Nguy hiểm');
    expect(result.statusCounts.danger).toBe(1);
    expect(result.dailyAverages[0]).toMatchObject({ measurements: 1, ph: 7.2 });
  });

  it('get_water_status: đánh giá lần đo mới nhất và tính thể tích ao', async () => {
    const prisma = makePrisma();
    const now = new Date();
    // Lần gọi 1: quy đổi tên ao -> id; lần gọi 2: dữ liệu nước của ao
    prisma.pond.findMany.mockResolvedValueOnce([{ id: 'p1', name: 'A1' }]);
    prisma.pond.findMany.mockResolvedValueOnce([
      {
        name: 'A1',
        areaSize: 1500,
        depth: 1.2,
        farm: { name: 'Trại 1' },
        crops: [],
        waterQualityRecords: [
          {
            recordTime: now,
            temperature: 29,
            ph: 8.3,
            dissolvedOxygen: 3.5,
            salinity: 15,
            alkalinity: 120,
            nh3: 0.1,
            no2: 0,
            h2s: 0.01,
            transparency: 35,
            waterColor: null,
            note: null,
            creator: { fullName: 'KTV Nam' },
          },
        ],
      },
    ]);
    const tools = new ChatToolsService(prisma as any, scopeService);
    const result: any = await tools.execute(
      'get_water_status',
      { pondName: 'A1' },
      scopeOf('TECHNICIAN', 'tech-1'),
    );

    const where = prisma.pond.findMany.mock.calls[1][0].where;
    expect(where.AND[0]).toEqual({
      farmId: { in: ['farm-1'] },
      farm: { deletedAt: null },
    });
    expect(where.AND[1]).toMatchObject({ id: { in: ['p1'] } });
    expect(result.overview).toMatchObject({ ponds: 1, warning: 1 });
    expect(result.ponds[0].waterVolumeM3).toBe(1800);
    expect(result.ponds[0].latest.overallStatus).toBe('Cần chú ý');
    expect(result.ponds[0].latest.alerts[0]).toContain('Oxy hòa tan');
  });

  it('Farmer tra cứu cho ăn: thấy cả trang trại được phân công (không ép createdBy)', async () => {
    const prisma = makePrisma();
    prisma.pond.findMany.mockResolvedValueOnce([{ id: 'p1', name: 'Ao nuôi A1' }, { id: 'p10', name: 'Ao nuôi A10' }]);
    const tools = new ChatToolsService(prisma as any, scopeService);
    await tools.execute(
      'query_feeding_logs',
      { pondName: 'A1' },
      scopeOf('FARMER', 'farmer-1'),
    );

    const where = prisma.feedingLog.findMany.mock.calls[0][0].where;
    expect(where.AND[0]).toEqual({ farmId: { in: ['farm-1'] } });
    // "A1" khớp đúng "Ao nuôi A1" (không lẫn sang "Ao nuôi A10")
    expect(where.AND[1]).toMatchObject({ pond: { id: { in: ['p1'] } } });
  });

  it('tên ao viết khác ("Ao D3", "ao d 3") vẫn tìm đúng "Ao nuôi D3"', async () => {
    for (const asked of ['Ao D3', 'ao d 3', 'Ao nuôi D3']) {
      const prisma = makePrisma();
      prisma.pond.findMany
        .mockResolvedValueOnce([{ id: 'pd3', name: 'Ao nuôi D3' }, { id: 'pd1', name: 'Ao nuôi D1' }])
        .mockResolvedValueOnce([]);
      const tools = new ChatToolsService(prisma as any, scopeService);
      await tools.execute('get_water_status', { pondName: asked }, scopeOf('TECHNICIAN', 'tech-1'));
      expect(prisma.pond.findMany.mock.calls[1][0].where.AND[1]).toMatchObject({ id: { in: ['pd3'] } });
    }
  });

  it('Farmer lọc theo tên nhân viên được (trong trang trại được phân công)', async () => {
    const prisma = makePrisma();
    const tools = new ChatToolsService(prisma as any, scopeService);
    await tools.execute(
      'query_feeding_logs',
      { staffName: 'Nam' },
      scopeOf('FARMER', 'farmer-1'),
    );

    expect(
      prisma.feedingLog.findMany.mock.calls[0][0].where.AND[1],
    ).toMatchObject({ createdBy: { in: ['staff-9'] } });
  });

  it('Manager lọc theo tên nhân viên', async () => {
    const prisma = makePrisma();
    const tools = new ChatToolsService(prisma as any, scopeService);
    await tools.execute(
      'query_feeding_logs',
      { staffName: 'Nam' },
      scopeOf('FARM_MANAGER'),
    );

    expect(
      prisma.feedingLog.findMany.mock.calls[0][0].where.AND[1],
    ).toMatchObject({
      createdBy: { in: ['staff-9'] },
    });
  });

  it('Technician hỏi nước theo vụ ngoài phạm vi -> không tìm thấy vụ', async () => {
    const prisma = makePrisma();
    prisma.crop.findFirst.mockResolvedValue(null);
    const tools = new ChatToolsService(prisma as any, scopeService);
    const result = await tools.execute(
      'query_water_quality',
      { cropId: 'other' },
      scopeOf('TECHNICIAN'),
    );

    expect(result).toHaveProperty('error');
    expect(prisma.crop.findFirst.mock.calls[0][0].where.AND[0]).toEqual(
      scopeService.cropWhere(scopeOf('TECHNICIAN')),
    );
    expect(prisma.waterQualityRecord.findMany).not.toHaveBeenCalled();
  });
});

describe('ChatToolsService – gợi ý nhận diện câu hỏi theo role', () => {
  const tools = new ChatToolsService({} as any, new ChatDataScopeService({} as any));
  const scopeOf = (role: string): ChatScope => ({ role, userId: 'u1', farmIds: ['f1'] }) as ChatScope;

  it.each(['ADMIN', 'FARM_MANAGER', 'TECHNICIAN', 'FARMER'])(
    'chỉ gợi ý các công cụ mà role %s được dùng và có hướng dẫn riêng cho role',
    (role) => {
      const scope = scopeOf(role);
      const available = new Set(tools.getToolDefinitions(scope).map((t) => t.function.name));
      const guide = tools.describeRouting(scope);

      for (const name of ['query_feeding_logs', 'query_growth_samples', 'query_shrimp_health', 'query_mortality', 'query_inventory', 'get_crop_summary', 'get_farm_overview']) {
        expect(guide.includes(`- ${name}:`)).toBe(available.has(name));
      }
      expect(guide).toContain('VAI TRÒ:');
      expect(guide).toContain('fromDate/toDate');
      // Không nêu ao -> tổng hợp tất cả ao, không kế thừa ao từ lượt trước
      expect(guide).toContain('KHÔNG truyền pondName/farmName');
    },
  );

  it('nông dân: có gợi ý cho mọi mảng dữ liệu và được nhắc là chỉ ghi nhật ký cho ăn', () => {
    const guide = tools.describeRouting(scopeOf('FARMER'));
    for (const name of ['query_feeding_logs', 'get_water_status', 'query_inventory', 'get_farm_overview', 'get_crop_summary', 'query_growth_samples', 'list_farm_staff']) {
      expect(guide).toContain(`- ${name}:`);
    }
    expect(guide).toContain('CHỈ được ghi NHẬT KÝ CHO ĂN');
    expect(guide).toContain('NÔNG DÂN');
  });

  it('chỉ nông dân có công cụ gợi ý cho ăn (cùng bộ tính với thẻ nhật ký)', async () => {
    const feedingAgent = {
      listPonds: jest.fn().mockResolvedValue([{ id: 'p1', name: 'Ao 1', farmId: 'farm-1', farmName: 'A', cropId: 'c1', doc: 30 }]),
      getSuggestion: jest.fn().mockResolvedValue({
        pondName: 'Ao 1', farmName: 'A', date: '2026-11-23', doc: 30, abwGram: 2.5, abwSource: 'DOC_CURVE', aliveCount: 90000,
        biomassKg: 225, feedRatePercent: 6.5, dailyKg: 14.6, fedTodayKg: 4, remainingKg: 10.6, recentDailyAvgKg: 13,
        recentSessionsPerDay: 4, recommendedFeedSize: 'số 2',
        feedOptions: [{ id: 'f2', name: 'Cám số 2', unit: 'kg', stock: 50, recommended: true, lastUsed: true }],
        todayLogs: [], notes: ['n'], warnings: [],
      }),
    };
    const withFeeding = new ChatToolsService({} as any, new ChatDataScopeService({} as any), undefined, feedingAgent as any);
    const names = (role: string) => withFeeding.getToolDefinitions(scopeOf(role)).map((t) => t.function.name);
    expect(names('FARMER')).toContain('get_feeding_suggestion');
    expect(names('FARM_MANAGER')).not.toContain('get_feeding_suggestion');
    expect(names('TECHNICIAN')).not.toContain('get_feeding_suggestion');

    const res: any = await withFeeding.execute('get_feeding_suggestion', {}, scopeOf('FARMER'));
    expect(res.ponds[0]).toMatchObject({ pondName: 'Ao 1', dailyKg: 14.6, remainingKg: 10.6, recommendedFeed: { name: 'Cám số 2' } });
    const denied: any = await withFeeding.execute('get_feeding_suggestion', {}, scopeOf('TECHNICIAN'));
    expect(denied.error).toBeDefined();
  });
});

describe('ChatToolsService – get_feeding_status (tình hình cho ăn trong ngày)', () => {
  it('liệt kê mọi ao đang nuôi: cử đã cho ăn của từng ao và ao chưa cho ăn', async () => {
    const prisma: any = {
      pond: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'p1', name: 'A1', farm: { name: 'Trại 1' }, crops: [{ startDate: new Date('2026-11-01T00:00:00Z') }] },
          { id: 'p2', name: 'A2', farm: { name: 'Trại 1' }, crops: [{ startDate: new Date('2026-11-10T00:00:00Z') }] },
        ]),
      },
      feedingLog: {
        findMany: jest.fn().mockResolvedValue([
          { pondId: 'p1', feedingSession: 'SESSION_1', feedingTime: '05:30', feedAmount: 57.15, feedingStatus: 'COMPLETED', note: null, feedProduct: { itemName: 'Grow Max' }, pond: { name: 'A1', farm: { name: 'Trại 1' } }, creator: { fullName: 'Nông dân A' } },
          { pondId: 'p1', feedingSession: 'SESSION_2', feedingTime: '08:00', feedAmount: 40, feedingStatus: 'COMPLETED', note: null, feedProduct: { itemName: 'Grow Max' }, pond: { name: 'A1', farm: { name: 'Trại 1' } }, creator: { fullName: 'Nông dân A' } },
          { pondId: 'p1', feedingSession: 'SESSION_3', feedingTime: '10:30', feedAmount: 0, feedingStatus: 'SKIPPED', note: null, feedProduct: null, pond: { name: 'A1', farm: { name: 'Trại 1' } }, creator: { fullName: 'Nông dân A' } },
        ]),
      },
    };
    const tools = new ChatToolsService(prisma, new ChatDataScopeService({} as any));
    const res: any = await tools.execute('get_feeding_status', { date: '2026-11-19' }, scopeOf('FARMER', 'farmer-1'));

    expect(res.summary.pondsFed).toEqual(['A1']);
    expect(res.summary.pondsNotFedYet).toEqual(['A2']);
    expect(res.summary.totalFeedKg).toBe(97.15);
    const a1 = res.ponds.find((p: any) => p.pond === 'A1');
    expect(a1.fedSessions.map((s: any) => s.session)).toEqual(['Cử 1', 'Cử 2']);
    expect(a1.skippedSessions).toEqual(['Cử 3']);
    // Chỉ ao trong phạm vi trang trại được phân công
    expect(prisma.pond.findMany.mock.calls[0][0].where.AND[0]).toMatchObject({ farmId: { in: ['farm-1'] } });
  });
});
