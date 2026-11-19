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

    it('chỉ thấy nhật ký cho ăn và sự cố do chính mình tạo', () => {
      expect(service.feedingWhere(scope)).toMatchObject({
        createdBy: 'farmer-1',
      });
      expect(service.incidentWhere(scope)).toMatchObject({
        reporterId: 'farmer-1',
      });
      expect(service.incidentWhere(scope)).not.toHaveProperty('OR');
    });

    it('xem dữ liệu nước của trang trại được phân công (giống API lịch sử nước)', () => {
      expect(service.waterWhere(scope)).toEqual({
        pond: { farmId: { in: ['farm-1'] }, farm: { deletedAt: null } },
      });
    });

    it('không được xem sức khỏe, tăng trưởng, tôm hao, kho, kết quả thu hoạch', () => {
      expect(service.healthWhere(scope)).toBeNull();
      expect(service.growthWhere(scope)).toBeNull();
      expect(service.mortalityWhere(scope)).toBeNull();
      expect(service.inventoryWhere(scope)).toBeNull();
      expect(service.canAccess(scope, 'CROP_RESULTS')).toBe(false);
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
    expect(names('FARMER')).toEqual([
      'list_crops',
      'query_feeding_logs',
      ...waterTools,
      'query_incidents',
    ]);
    const allTools = [
      'list_crops',
      'get_crop_summary',
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

    // Nông dân không có quyền FARM_INFO
    const denied = await tools.execute('query_suppliers', {}, scopeOf('FARMER', 'farmer-1'));
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
    prisma.pond.findMany.mockResolvedValue([
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

    const where = prisma.pond.findMany.mock.calls[0][0].where;
    expect(where.AND[0]).toEqual({
      farmId: { in: ['farm-1'] },
      farm: { deletedAt: null },
    });
    expect(result.overview).toMatchObject({ ponds: 1, warning: 1 });
    expect(result.ponds[0].waterVolumeM3).toBe(1800);
    expect(result.ponds[0].latest.overallStatus).toBe('Cần chú ý');
    expect(result.ponds[0].latest.alerts[0]).toContain('Oxy hòa tan');
  });

  it('Farmer tra cứu cho ăn: luôn bị ép createdBy = chính mình', async () => {
    const prisma = makePrisma();
    const tools = new ChatToolsService(prisma as any, scopeService);
    await tools.execute(
      'query_feeding_logs',
      { pondName: 'A1' },
      scopeOf('FARMER', 'farmer-1'),
    );

    const where = prisma.feedingLog.findMany.mock.calls[0][0].where;
    expect(where.AND[0]).toEqual({
      farmId: { in: ['farm-1'] },
      createdBy: 'farmer-1',
    });
    expect(where.AND[1]).toMatchObject({ pond: { name: { contains: 'A1' } } });
  });

  it('Farmer truyền staffName -> bị bỏ qua, không mở rộng sang dữ liệu người khác', async () => {
    const prisma = makePrisma();
    const tools = new ChatToolsService(prisma as any, scopeService);
    await tools.execute(
      'query_feeding_logs',
      { staffName: 'Nam' },
      scopeOf('FARMER', 'farmer-1'),
    );

    expect(prisma.user.findMany).not.toHaveBeenCalled();
    expect(
      prisma.feedingLog.findMany.mock.calls[0][0].where.AND[1],
    ).not.toHaveProperty('createdBy');
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
