import { ForbiddenException } from '@nestjs/common';
import { AgentActionService, findPondNamesInText, parsePerPondEdits } from './agent-action.service';

describe('AgentActionService role permissions', () => {
  const prisma = {
    farm: { findMany: jest.fn().mockResolvedValue([]) },
    workspaceMember: { findFirst: jest.fn(), upsert: jest.fn() },
    workspace: { findFirst: jest.fn() },
  };
  const farmAccess = {
    getAccessibleFarmIds: jest.fn().mockResolvedValue([]),
  };
  const farmsService = {
    create: jest.fn(),
  };
  const pondsService = {
    create: jest.fn(),
  };
  const cropsService = {
    create: jest.fn(),
  };

  const service = new AgentActionService(
    prisma as any,
    farmAccess as any,
    farmsService as any,
    pondsService as any,
    cropsService as any,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('blocks ADMIN from starting an entity creation draft in conversation', async () => {
    const result = await service.handleAgentConversation(
      'Tạo trang trại mới ở Cà Mau',
      { userId: 'admin-id', role: 'ADMIN' },
    );

    expect(result).toEqual({
      isAgentAction: true,
      answer: expect.stringContaining('Quản trị viên hệ thống (ADMIN) chỉ thực hiện giám sát'),
      actionDraft: undefined,
    });
    expect(farmsService.create).not.toHaveBeenCalled();
  });

  it.each([
    ['FARMER', 'tạo trang trại mới ở Cà Mau'],
    ['FARMER', 'tạo 3 ao cho trang trại'],
    ['FARMER', 'tạo vụ nuôi mới cho ao 1'],
    ['TECHNICIAN', 'thêm 2 ao mới'],
  ])('blocks %s from getting a create draft for "%s"', async (role, message) => {
    const result = await service.handleAgentConversation(message, { userId: 'u1', role });
    expect(result).toEqual({
      isAgentAction: true,
      answer: expect.stringContaining('chỉ dành cho **Quản lý trang trại**'),
      actionDraft: undefined,
    });
    expect(prisma.farm.findMany).not.toHaveBeenCalled();
  });

  it('blocks FARMER from continuing a pending create draft sent by the client', async () => {
    const result = await service.handleAgentConversation(
      'đổi tên thành Ao 9',
      { userId: 'u1', role: 'FARMER' },
      [],
      { intent: 'CREATE_POND', collectedData: { name: 'Ao 1' } },
    );
    expect(result?.actionDraft).toBeUndefined();
    expect(result?.answer).toContain('Quản lý trang trại');
  });

  it('lets FARMER ask how to create a pond without being blocked', async () => {
    const result = await service.handleAgentConversation('làm sao để tạo ao mới?', { userId: 'u1', role: 'FARMER' });
    expect(result).toBeNull();
  });

  it('rejects ADMIN executing CREATE_FARM, CREATE_POND, or CREATE_CROP', async () => {
    await expect(
      service.executeAgentAction(
        { intent: 'CREATE_FARM', data: { name: 'Farm A', address: 'Cà Mau', area: 5 } },
        { userId: 'admin-id', role: 'ADMIN' },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    await expect(
      service.executeAgentAction(
        { intent: 'CREATE_POND', data: { farmId: 'f1', name: 'Ao 1', areaSize: 1000 } },
        { userId: 'admin-id', role: 'ADMIN' },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    await expect(
      service.executeAgentAction(
        { intent: 'CREATE_CROP', data: { pondId: 'p1', initialShrimpCount: 100000 } },
        { userId: 'admin-id', role: 'ADMIN' },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects FARMER executing CREATE_FARM or CREATE_POND', async () => {
    await expect(
      service.executeAgentAction(
        { intent: 'CREATE_FARM', data: { name: 'Farm A', address: 'Cà Mau', area: 5 } },
        { userId: 'farmer-id', role: 'FARMER' },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    await expect(
      service.executeAgentAction(
        { intent: 'CREATE_POND', data: { farmId: 'f1', name: 'Ao 1', areaSize: 1000 } },
        { userId: 'farmer-id', role: 'FARMER' },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});

// ─── Dữ liệu dùng chung cho các test tạo / sửa phiếu ───
const farmA = { id: 'f1', name: 'SSFM Farm', address: 'Cà Mau', area: 50000, farmingModel: 'HIGH_TECH' };
const farmB = { id: 'f2', name: 'Trang Trại Bến Tre', address: 'Bến Tre', area: 30000, farmingModel: 'HIGH_TECH' };
const manager = { userId: 'm1', role: 'FARM_MANAGER' } as any;

function makeService(opts: { farms?: any[]; ponds?: any[] } = {}) {
  const farms = opts.farms || [farmA];
  const ponds = opts.ponds || [{ id: 'p1', name: 'Ao 1', farmId: 'f1', farm: farmA, areaSize: 2000, depth: 1.5, crops: [] }];
  const prisma = {
    farm: { findMany: jest.fn().mockResolvedValue(farms) },
    pond: { findMany: jest.fn().mockResolvedValue(ponds) },
  };
  const farmAccess = { getAccessibleFarmIds: jest.fn().mockResolvedValue(farms.map((f) => f.id)) };
  const pondsService = { create: jest.fn().mockImplementation((_u, dto) => ({ id: `new-${dto.name}`, ...dto })) };
  const service = new AgentActionService(prisma as any, farmAccess as any, {} as any, pondsService as any, {} as any);
  return { service, pondsService };
}

/** Giả lập OpenAI trả về collectedData cho luồng sửa phiếu */
function mockAI(service: AgentActionService, intent: string, collectedData: any) {
  (service as any).openai = {
    chat: {
      completions: {
        create: jest.fn().mockResolvedValue({
          choices: [{ message: { content: JSON.stringify({ isActionIntent: true, intent, status: 'CONFIRM_ACTION', collectedData }) } }],
        }),
      },
    },
  };
}

describe('AgentActionService draft_create_* tool calls', () => {
  it('only offers tools allowed for the role', () => {
    const { service } = makeService();
    const names = (role: string) => service.getActionToolDefinitions(role).map((t: any) => t.function.name);
    // Quản lý: duy nhất được tạo & nhập / xuất kho
    expect(names('FARM_MANAGER')).toEqual([
      'draft_create_farm',
      'draft_create_pond',
      'draft_create_crop',
      'draft_import_inventory',
      'export_inventory_file',
    ]);
    // Nông dân, Admin: chỉ hỏi / xem
    expect(names('FARMER')).toEqual([]);
    expect(names('ADMIN')).toEqual([]);
    // Kỹ thuật viên không có bộ nhập số đo nước được cấu hình -> không có công cụ ghi
    expect(names('TECHNICIAN')).toEqual([]);
  });

  it('Kỹ thuật viên chỉ có công cụ nhập số đo nước; Nông dân gọi công cụ ghi bị từ chối', async () => {
    const prisma = { farm: { findMany: jest.fn().mockResolvedValue([]) }, pond: { findMany: jest.fn().mockResolvedValue([]) } };
    const waterAgent = { handleConversation: jest.fn().mockResolvedValue({ isAgentAction: true, answer: 'phiếu nước' }) };
    const service = new AgentActionService(
      prisma as any,
      { getAccessibleFarmIds: jest.fn().mockResolvedValue([]) } as any,
      {} as any,
      {} as any,
      {} as any,
      waterAgent as any,
    );
    const names = (role: string) => service.getActionToolDefinitions(role).map((t: any) => t.function.name);
    expect(names('TECHNICIAN')).toEqual(['draft_record_water_quality']);

    const tech = { userId: 't', role: 'TECHNICIAN' } as any;
    const res = await service.draftFromToolCall('draft_record_water_quality', {}, tech, 'ao 1 pH 8.2 DO 5', { focusPondId: 'p1' });
    expect(res.answer).toBe('phiếu nước');
    expect(waterAgent.handleConversation).toHaveBeenCalledWith('ao 1 pH 8.2 DO 5', tech, undefined, 'p1', undefined);

    for (const tool of ['draft_record_water_quality', 'draft_import_inventory', 'draft_create_pond']) {
      const denied = await service.draftFromToolCall(tool, {}, { userId: 'f', role: 'FARMER' } as any, 'x');
      expect(denied.actionDraft).toBeUndefined();
      expect(denied.answer).toContain('không có quyền');
    }
    expect(waterAgent.handleConversation).toHaveBeenCalledTimes(1);
  });

  it('drafts several ponds with auto names that skip existing ones', async () => {
    const { service } = makeService();
    const res = await service.draftFromToolCall(
      'draft_create_pond',
      { quantity: 3, areaSize: 2000, depth: 1.5 },
      manager,
      'làm cho tôi mấy cái ao, 3 cái, 2000m2 mỗi ao',
    );
    expect(res.actionDraft?.type).toBe('CONFIRM_ACTION');
    expect(res.actionDraft?.collectedData).toMatchObject({
      farmId: 'f1',
      quantity: 3,
      ponds: [
        { name: 'Ao 2', areaSize: 2000, depth: 1.5 },
        { name: 'Ao 3', areaSize: 2000, depth: 1.5 },
        { name: 'Ao 4', areaSize: 2000, depth: 1.5 },
      ],
    });
  });

  it('accepts different specs per pond from the tool', async () => {
    const { service } = makeService();
    const res = await service.draftFromToolCall(
      'draft_create_pond',
      { ponds: [{ name: 'A', areaSize: 1500 }, { name: 'B', areaSize: 2000, depth: 1.8 }] },
      manager,
      'tạo ao A 1500m2 và ao B 2000m2 sâu 1.8m',
    );
    expect(res.actionDraft?.collectedData.ponds).toEqual([
      { name: 'A', areaSize: 1500, depth: 1.5 },
      { name: 'B', areaSize: 2000, depth: 1.8 },
    ]);
    expect(res.actionDraft?.summary).toMatchObject({ A: '1.500 m² · sâu 1,5 m', B: '2.000 m² · sâu 1,8 m' });
  });

  it('asks for missing area instead of inventing it', async () => {
    const { service } = makeService();
    const res = await service.draftFromToolCall('draft_create_pond', { quantity: 2 }, manager, 'thêm 2 ao');
    expect(res.actionDraft).toMatchObject({ type: 'SLOT_FILLING', intent: 'CREATE_POND', missingFields: ['areaSize'] });
  });

  it('refuses a tool the role is not allowed to use', async () => {
    const { service } = makeService();
    const res = await service.draftFromToolCall('draft_create_pond', { quantity: 1 }, { userId: 'f', role: 'FARMER' } as any, 'tạo ao');
    expect(res.actionDraft).toBeUndefined();
    expect(res.answer).toContain('không có quyền');
  });

  it('creates every pond with its own specs', async () => {
    const { service, pondsService } = makeService();
    const res = await service.executeAgentAction(
      {
        intent: 'CREATE_POND',
        data: { farmId: 'f1', ponds: [{ name: 'Ao 2', areaSize: 2000, depth: 1.5 }, { name: 'Ao 3', areaSize: 1500, depth: 1.8 }] },
      } as any,
      manager,
    );
    expect(pondsService.create).toHaveBeenCalledTimes(2);
    expect(pondsService.create).toHaveBeenLastCalledWith(manager, { farmId: 'f1', name: 'Ao 3', areaSize: 1500, depth: 1.8 });
    expect(res.message).toContain('2 ao nuôi');
  });

  it('still accepts the legacy names + shared area format', async () => {
    const { service, pondsService } = makeService();
    await service.executeAgentAction(
      { intent: 'CREATE_POND', data: { farmId: 'f1', names: ['Ao 2', 'Ao 3'], areaSize: 2000, depth: 1.5 } } as any,
      manager,
    );
    expect(pondsService.create).toHaveBeenCalledTimes(2);
  });
});

describe('findPondNamesInText', () => {
  it.each([
    ['tôi muốn sửa lại tên thành ao 4,5,6', ['Ao 4', 'Ao 5', 'Ao 6']],
    ['đổi tên thành Ao 4, Ao 5 và Ao 6 nhé', ['Ao 4', 'Ao 5', 'Ao 6']],
    ['đặt tên là A1, A2, A3', ['A1', 'A2', 'A3']],
    ['đổi tên thành ao tròn 1, 2 và diện tích 1500m2', ['Ao Tròn 1', 'Ao Tròn 2']],
    ['sửa tên ao: Ao Ươm', ['Ao Ươm']],
  ])('%s', (text, expected) => {
    expect(findPondNamesInText(text)).toEqual(expected);
  });

  it('ignores messages without names', () => {
    expect(findPondNamesInText('đổi diện tích thành 1500m2')).toBeNull();
  });
});

describe('parsePerPondEdits', () => {
  it('reads per-pond depth and area by pond name', () => {
    expect(parsePerPondEdits('Ao 2 sâu 1.8m, Ao 3 diện tích 1.500m2', ['Ao 1', 'Ao 2', 'Ao 3'])).toEqual([
      {},
      { depth: 1.8 },
      { areaSize: 1500 },
    ]);
  });

  it('does not confuse Ao 1 with Ao 12', () => {
    expect(parsePerPondEdits('ao 12 sâu 2m', ['Ao 1', 'Ao 12'])).toEqual([{}, { depth: 2 }]);
  });
});

describe('AgentActionService editing a pending pond draft', () => {
  const ponds3 = [
    { name: 'Ao 2', areaSize: 2000, depth: 1.5 },
    { name: 'Ao 3', areaSize: 2000, depth: 1.5 },
    { name: 'Ao 4', areaSize: 2000, depth: 1.5 },
  ];
  const pending = {
    intent: 'CREATE_POND' as const,
    collectedData: { farmId: 'f1', farmName: 'SSFM Farm', quantity: 3, ponds: ponds3 },
  };

  it('renames ponds to the names the user typed (even if AI echoes old data)', async () => {
    const { service } = makeService();
    mockAI(service, 'CREATE_POND', pending.collectedData);
    const res = await service.handleAgentConversation('tôi muốn sửa lại tên thành ao 5,6,7', manager, [], pending);
    expect(res?.actionDraft?.collectedData.ponds.map((p: any) => p.name)).toEqual(['Ao 5', 'Ao 6', 'Ao 7']);
    expect(res?.answer).toContain('đã cập nhật');
  });

  it('rejects a name that already exists in the farm', async () => {
    const { service } = makeService();
    mockAI(service, 'CREATE_POND', pending.collectedData);
    const res = await service.handleAgentConversation('đổi tên thành ao 1, 5, 6', manager, [], pending);
    expect(res?.actionDraft?.type).toBe('SLOT_FILLING');
    expect(res?.answer).toContain('Ao 1');
  });

  it('edits a single pond without touching the others (AI wrongly puts depth at top level)', async () => {
    const { service } = makeService();
    mockAI(service, 'CREATE_POND', { ...pending.collectedData, depth: 1.8 });
    const res = await service.handleAgentConversation('Ao 3 sâu 1.8m', manager, [], pending);
    expect(res?.actionDraft?.collectedData.ponds.map((p: any) => p.depth)).toEqual([1.5, 1.8, 1.5]);
    expect(res?.actionDraft?.summary?.['Ao 3']).toBe('2.000 m² · sâu 1,8 m');
  });

  it('merges when AI returns only the edited pond', async () => {
    const { service } = makeService();
    mockAI(service, 'CREATE_POND', { ponds: [{ name: 'Ao 4', areaSize: 2500, depth: 1.5 }] });
    const res = await service.handleAgentConversation('cho ao 4 rộng hơn, 2500 mét vuông', manager, [], pending);
    expect(res?.actionDraft?.collectedData.ponds.map((p: any) => p.areaSize)).toEqual([2000, 2000, 2500]);
  });

  it('applies "tất cả" changes to every pond', async () => {
    const { service } = makeService();
    mockAI(service, 'CREATE_POND', { ...pending.collectedData, areaSize: 1500 });
    const res = await service.handleAgentConversation('tất cả 1500m2', manager, [], pending);
    expect(res?.actionDraft?.collectedData.ponds.map((p: any) => p.areaSize)).toEqual([1500, 1500, 1500]);
  });

  it('adds and removes ponds relative to the draft', async () => {
    const { service } = makeService();
    mockAI(service, 'CREATE_POND', pending.collectedData);
    const added = await service.handleAgentConversation('thêm 2 ao', manager, [], pending);
    expect(added?.actionDraft?.collectedData.ponds.map((p: any) => p.name)).toEqual(['Ao 2', 'Ao 3', 'Ao 4', 'Ao 5', 'Ao 6']);
    expect(added?.actionDraft?.collectedData.ponds[4].areaSize).toBe(2000);

    mockAI(service, 'CREATE_POND', pending.collectedData);
    const removed = await service.handleAgentConversation('bớt 1 ao', manager, [], pending);
    expect(removed?.actionDraft?.collectedData.quantity).toBe(2);
  });

  it('moves the draft to another farm', async () => {
    const { service } = makeService({ farms: [farmA, farmB] });
    mockAI(service, 'CREATE_POND', { ...pending.collectedData, farmName: 'Trang trại Bến Tre' });
    const res = await service.handleAgentConversation('chuyển sang trang trại Bến Tre', manager, [], pending);
    expect(res?.actionDraft?.collectedData).toMatchObject({ farmId: 'f2', farmName: 'Trang Trại Bến Tre' });
    expect(res?.actionDraft?.summary?.['Trực thuộc trang trại']).toBe('Trang Trại Bến Tre');
  });
});

describe('AgentActionService editing a pending crop draft', () => {
  const ponds = [
    { id: 'p1', name: 'Ao 1', farmId: 'f1', farm: farmA, areaSize: 2000, depth: 1.5, crops: [] },
    { id: 'p2', name: 'Ao 2', farmId: 'f1', farm: farmA, areaSize: 1000, depth: 1.5, crops: [] },
    { id: 'p3', name: 'Ao 3', farmId: 'f1', farm: farmA, areaSize: 1000, depth: 1.5, crops: [{ id: 'c1' }] },
  ];
  const pending = {
    intent: 'CREATE_CROP' as const,
    collectedData: { pondId: 'p1', pondName: 'Ao 1', initialShrimpCount: 200000, startDate: '2026-11-18' },
  };

  it('switches to another empty pond by name', async () => {
    const { service } = makeService({ ponds });
    mockAI(service, 'CREATE_CROP', { ...pending.collectedData, pondName: 'Ao 2' });
    const res = await service.handleAgentConversation('đổi sang ao 2', manager, [], pending);
    expect(res?.actionDraft?.collectedData).toMatchObject({ pondId: 'p2', pondName: 'Ao 2' });
    expect(res?.actionDraft?.summary?.['Mật độ thả dự tính']).toContain('200 con/m²');
  });

  it('refuses a pond that already has an active crop', async () => {
    const { service } = makeService({ ponds });
    mockAI(service, 'CREATE_CROP', { ...pending.collectedData, pondId: 'p3' });
    const res = await service.handleAgentConversation('thả vào ao 3', manager, [], pending);
    expect(res?.actionDraft?.type).toBe('SLOT_FILLING');
    expect(res?.answer).toContain('Ao 3');
  });
});

describe('AgentActionService crop creation card (manager only)', () => {
  const ponds = [
    { id: 'p1', name: 'Ao 1', farmId: 'f1', farm: farmA, areaSize: 2000, depth: 1.5, crops: [] },
    { id: 'p2', name: 'Ao 2', farmId: 'f1', farm: farmA, areaSize: 1000, depth: 1.2, crops: [{ id: 'c1' }] },
  ];

  it('attaches the empty ponds and AI-prefilled values to the card', async () => {
    const { service } = makeService({ ponds });
    const res = await service.draftFromToolCall(
      'draft_create_crop',
      { pondName: 'Ao 1', initialShrimpCount: 200000, seedType: 'Post 12', targetSurvivalRate: 'abc' },
      manager,
      'thả 200 nghìn con post 12 vào ao 1',
    );
    expect(res.actionDraft?.cropPondOptions).toEqual([
      { id: 'p1', name: 'Ao 1', farmId: 'f1', farmName: 'SSFM Farm', farmingModel: 'HIGH_TECH', areaSize: 2000, depth: 1.5 },
    ]);
    expect(res.actionDraft?.collectedData).toMatchObject({ pondId: 'p1', initialShrimpCount: 200000, seedType: 'Post 12' });
    expect(res.actionDraft?.collectedData.targetSurvivalRate).toBeUndefined();
  });

  it('asks to fill the card when nothing is known yet', async () => {
    const { service } = makeService({
      ponds: [...ponds, { id: 'p3', name: 'Ao 3', farmId: 'f1', farm: farmA, areaSize: 1500, depth: 1.5, crops: [] }],
    });
    const res = await service.draftFromToolCall('draft_create_crop', {}, manager, 'tạo vụ mới');
    expect(res.actionDraft?.type).toBe('SLOT_FILLING');
    expect(res.actionDraft?.cropPondOptions?.map((p) => p.id)).toEqual(['p1', 'p3']);
    expect(res.answer).toContain('thẻ tạo vụ nuôi');
  });

  it('forbids FARMER from executing CREATE_CROP through the assistant', async () => {
    const { service } = makeService({ ponds });
    await expect(
      service.executeAgentAction(
        { intent: 'CREATE_CROP', data: { pondId: 'p1', initialShrimpCount: 100000 } } as any,
        { userId: 'farmer', role: 'FARMER' } as any,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('saves a high-tech crop as NURSERY with all card fields, ignoring any client-sent seed price', async () => {
    const cropsService = { create: jest.fn().mockResolvedValue({ id: 'c9' }) };
    const prisma = { pond: { findUnique: jest.fn().mockResolvedValue({ farm: { farmingModel: 'HIGH_TECH' } }) } };
    const service = new AgentActionService(prisma as any, {} as any, {} as any, {} as any, cropsService as any);
    await service.executeAgentAction(
      {
        intent: 'CREATE_CROP',
        data: {
          pondId: 'p1', initialShrimpCount: 200000, startDate: '2026-11-18', stage: 'COMMERCIAL',
          seedUnitPrice: 80, targetSurvivalRate: 85, targetHarvestSize: 30, expectedTransferDate: '2026-12-10',
        },
      } as any,
      manager,
    );
    expect(cropsService.create).toHaveBeenCalledWith(
      manager,
      expect.objectContaining({
        pondId: 'p1',
        initialShrimpCount: 200000,
        stage: 'NURSERY',
        expectedTransferDate: new Date('2026-12-10').toISOString(),
        seedUnitPrice: 70, // không có giá Tép Bạc -> giá mặc định, KHÔNG dùng 80 client gửi
        seedCost: 14000000,
        targetSurvivalRate: 85,
        targetHarvestSize: 30,
      }),
    );
  });
});

describe('AgentActionService executes each draft only once (draftId)', () => {
  /** Bảng agent_action_executions giả lập: create trùng khóa -> lỗi P2002 như Postgres */
  function makeExecTable() {
    const rows = new Map<string, any>();
    return {
      rows,
      create: jest.fn(async ({ data }) => {
        if (rows.has(data.draftId)) throw Object.assign(new Error('Unique constraint'), { code: 'P2002' });
        const row = { status: 'PROCESSING', result: null, updatedAt: new Date(), ...data };
        rows.set(data.draftId, row);
        return row;
      }),
      findUnique: jest.fn(async ({ where }) => rows.get(where.draftId) || null),
      update: jest.fn(async ({ where, data }) => Object.assign(rows.get(where.draftId), data, { updatedAt: new Date() })),
      delete: jest.fn(async ({ where }) => rows.delete(where.draftId)),
    };
  }

  function setup() {
    const exec = makeExecTable();
    const prisma = { agentActionExecution: exec };
    let resolveCreate: (() => void) | null = null;
    const pondsService = {
      create: jest.fn().mockImplementation(async (_u: any, dto: any) => {
        // Chậm lại để mô phỏng 2 request chạy song song
        await new Promise<void>((r) => (resolveCreate = r));
        return { id: `new-${dto.name}`, ...dto };
      }),
    };
    const service = new AgentActionService(prisma as any, {} as any, {} as any, pondsService as any, {} as any);
    const release = () => resolveCreate?.();
    return { service, exec, pondsService, release };
  }

  const draftId = '0b7c2a4e-1f3d-4c5a-9e8b-123456789abc';
  const dto = {
    intent: 'CREATE_POND',
    draftId,
    data: { farmId: 'f1', ponds: [{ name: 'Ao 9', areaSize: 2000, depth: 1.5 }] },
  } as any;
  const flush = () => new Promise((r) => setImmediate(r));

  it('creates once, and a second click while processing is rejected', async () => {
    const { service, pondsService, release, exec } = setup();
    const first = service.executeAgentAction(dto, manager);
    await flush();
    await expect(service.executeAgentAction(dto, manager)).rejects.toThrow('đang được xử lý');
    release();
    const res = await first;
    expect(res.message).toContain('Ao 9');
    expect(pondsService.create).toHaveBeenCalledTimes(1);
    expect(exec.rows.get(draftId)).toMatchObject({ status: 'DONE', userId: 'm1' });
  });

  it('returns the previous result instead of creating again once done', async () => {
    const { service, pondsService, release } = setup();
    const first = service.executeAgentAction(dto, manager);
    await flush();
    release();
    await first;
    const again = await service.executeAgentAction(dto, manager);
    expect(again).toMatchObject({ success: true, alreadyExecuted: true });
    expect(again.message).toContain('đã được thực hiện trước đó');
    expect(pondsService.create).toHaveBeenCalledTimes(1);
  });

  it('releases the draft when execution fails so the user can retry', async () => {
    const { service, exec } = setup();
    const bad = { ...dto, data: { farmId: 'f1', ponds: [{ name: '', areaSize: 0 }] } };
    await expect(service.executeAgentAction(bad, manager)).rejects.toThrow('chưa hợp lệ');
    expect(exec.rows.has(draftId)).toBe(false);
  });

  it("refuses another user's draft", async () => {
    const { service, exec } = setup();
    exec.rows.set(draftId, { draftId, userId: 'someone-else', status: 'DONE', result: {}, updatedAt: new Date() });
    await expect(service.executeAgentAction(dto, manager)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('stamps a fresh draftId on every draft', () => {
    const { service } = setup();
    const a = service.stampDraft({ type: 'CONFIRM_ACTION', intent: 'CREATE_POND', collectedData: {}, missingFields: [] });
    const b = service.stampDraft({ type: 'CONFIRM_ACTION', intent: 'CREATE_POND', collectedData: {}, missingFields: [] });
    expect(a?.draftId).toMatch(/^[0-9a-f-]{36}$/);
    expect(a?.draftId).not.toBe(b?.draftId);
  });
});

describe('AgentActionService seed market price (Tép Bạc) on the crop card', () => {
  const ponds = [{ id: 'p1', name: 'Ao 1', farmId: 'f1', farm: farmA, areaSize: 2000, depth: 1.5, crops: [] }];
  const seed = {
    code: 'THEP10', name: 'Giống tôm thẻ chân trắng Post 10', species: 'Tôm thẻ', sizeStage: 'P10',
    price: 82, unit: 'đ/CON', source: 'tepbac.com', sourceUrl: 'https://tepbac.com/gia-thuy-san/giong-tom-the-chan-trang-p10',
    updatedAt: new Date('2026-11-18T01:00:00Z'), isLive: true,
  };

  function build(getSeedPrice: jest.Mock) {
    const prisma = {
      farm: { findMany: jest.fn().mockResolvedValue([farmA]) },
      pond: {
        findMany: jest.fn().mockResolvedValue(ponds),
        findUnique: jest.fn().mockResolvedValue({ farm: { farmingModel: 'HIGH_TECH' } }),
      },
    };
    const farmAccess = { getAccessibleFarmIds: jest.fn().mockResolvedValue(['f1']) };
    const cropsService = { create: jest.fn().mockResolvedValue({ id: 'c1' }) };
    const service = new AgentActionService(
      prisma as any, farmAccess as any, {} as any, {} as any, cropsService as any, undefined, { getSeedPrice } as any,
    );
    return { service, cropsService };
  }

  it('attaches the live Tép Bạc price and source link to the card', async () => {
    const { service } = build(jest.fn().mockResolvedValue(seed));
    const res = await service.draftFromToolCall('draft_create_crop', { pondName: 'Ao 1', seedUnitPrice: 5 }, manager, 'tạo vụ ao 1 giá 5 đồng');
    expect(res.actionDraft?.collectedData.seedUnitPrice).toBeUndefined();
    expect(res.actionDraft?.seedMarketPrice).toMatchObject({
      price: 82,
      sourceUrl: 'https://tepbac.com/gia-thuy-san/giong-tom-the-chan-trang-p10',
      isLive: true,
    });
  });

  it('still returns the card quickly when tepbac.com hangs', async () => {
    jest.useFakeTimers();
    const { service } = build(jest.fn(() => new Promise(() => undefined)));
    const pending = service.draftFromToolCall('draft_create_crop', { pondName: 'Ao 1' }, manager, 'tạo vụ ao 1');
    await jest.advanceTimersByTimeAsync(3100);
    const res = await pending;
    jest.useRealTimers();
    expect(res.actionDraft?.cropPondOptions?.length).toBe(1);
    expect(res.actionDraft?.seedMarketPrice).toBeUndefined();
  });

  it('always saves with the Tép Bạc price, even if a price is sent', async () => {
    const { service, cropsService } = build(jest.fn().mockResolvedValue(seed));
    await service.executeAgentAction(
      { intent: 'CREATE_CROP', data: { pondId: 'p1', initialShrimpCount: 100000, startDate: '2026-11-18', seedUnitPrice: 1 } } as any,
      manager,
    );
    expect(cropsService.create).toHaveBeenCalledWith(
      manager,
      expect.objectContaining({ seedUnitPrice: 82, seedCost: 8200000, seedSource: 'tepbac.com' }),
    );
  });
});

describe('AgentActionService when agent_action_executions table is missing', () => {
  it('still executes the draft (no duplicate guard) instead of failing', async () => {
    const missingTable = () => Promise.reject(Object.assign(new Error('table does not exist'), { code: 'P2021' }));
    const prisma = { agentActionExecution: { create: jest.fn(missingTable), findUnique: jest.fn(missingTable) } };
    const pondsService = { create: jest.fn().mockImplementation(async (_u: any, dto: any) => ({ id: 'x', ...dto })) };
    const service = new AgentActionService(prisma as any, {} as any, {} as any, pondsService as any, {} as any);
    const res = await service.executeAgentAction(
      {
        intent: 'CREATE_POND',
        draftId: '0b7c2a4e-1f3d-4c5a-9e8b-123456789abc',
        data: { farmId: 'f1', ponds: [{ name: 'Ao 9', areaSize: 2000, depth: 1.5 }] },
      } as any,
      manager,
    );
    expect(res.message).toContain('Ao 9');
    expect(pondsService.create).toHaveBeenCalledTimes(1);
  });
});

describe('AgentActionService.looksLikeQuestion – không bắt nhầm câu hỏi thành lệnh nhập kho', () => {
  it.each([
    'tôm yếu có nên thêm thức ăn không?',
    'có cần thêm thuốc cho ao a1 không',
    'cách nhập kho thế nào',
    'thêm thuốc diệt khuẩn liều bao nhiêu',
  ])('"%s" là câu hỏi', (q) => {
    expect(AgentActionService.looksLikeQuestion(q)).toBe(true);
  });

  it.each(['nhập kho 10 bao cám cp', 'thêm thức ăn vào kho 5 bao', 'nhập hàng thuốc bkc 3 chai'])(
    '"%s" là câu lệnh',
    (q) => {
      expect(AgentActionService.looksLikeQuestion(q)).toBe(false);
    },
  );
});

describe('AgentActionService – có OpenAI thì mọi ý định do OpenAI nhận diện', () => {
  const ORIGINAL_KEY = process.env.OPENAI_API_KEY;
  afterEach(() => {
    if (ORIGINAL_KEY === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = ORIGINAL_KEY;
  });

  it.each([
    ['FARM_MANAGER', 'nhập kho 10 bao cám CP'],
    ['FARM_MANAGER', 'xuất file tồn kho'],
    ['TECHNICIAN', 'ao 1 nhiệt độ 29, pH 8.2, DO 5.1, mặn 15'],
    ['FARMER', 'nhập kho 5 bao cám'],
  ])('%s: "%s" không bị regex chặn trước, để OpenAI quyết định', async (role, message) => {
    process.env.OPENAI_API_KEY = 'test-key';
    const waterAgent = { handleConversation: jest.fn() };
    const service = new AgentActionService({} as any, {} as any, {} as any, {} as any, {} as any, waterAgent as any);

    const res = await service.handleAgentConversation(message, { userId: 'u', role } as any);

    expect(res).toBeNull();
    expect(waterAgent.handleConversation).not.toHaveBeenCalled();
  });
});

describe('AgentActionService – nhập kho: mỗi trang trại là một kho riêng', () => {
  const items = [{ itemName: 'Cám CP 01', category: 'FEED', quantity: 250, unit: 'kg', packageQty: 10, weightPerPkg: 25, packageType: 'Bao' }];
  const pending = { intent: 'IMPORT_INVENTORY' as any, collectedData: { items, fileName: 'tin nhắn', fileText: 'nhập 10 bao cám CP 01' } };

  it('nhiều trang trại mà chưa nói rõ kho nào -> hỏi lại, kèm nút chọn trang trại', async () => {
    const { service } = makeService({ farms: [farmA, farmB] });
    const res = await service.handleAgentConversation('xác nhận giúp tôi', manager, [], pending);

    expect(res?.actionDraft?.type).toBe('SLOT_FILLING');
    expect(res?.actionDraft?.missingFields).toEqual(['farmId']);
    expect(res?.actionDraft?.quickSuggestions).toEqual(['SSFM Farm', 'Trang Trại Bến Tre']);
    // Giữ lại danh sách mặt hàng đã bóc tách
    expect(res?.actionDraft?.collectedData.items).toEqual(items);
  });

  it('nêu tên trang trại (không dấu cũng được) -> phiếu nhập đúng kho trang trại đó', async () => {
    const { service } = makeService({ farms: [farmA, farmB] });
    const res = await service.handleAgentConversation('nhập vào trang trai ben tre', manager, [], pending);

    expect(res?.actionDraft?.type).toBe('CONFIRM_ACTION');
    expect(res?.actionDraft?.collectedData).toMatchObject({ farmId: 'f2', farmName: 'Trang Trại Bến Tre' });
    expect(res?.actionDraft?.collectedData).not.toHaveProperty('farmIds');
    expect(res?.actionDraft?.farmOptions).toEqual([
      { id: 'f1', name: 'SSFM Farm' },
      { id: 'f2', name: 'Trang Trại Bến Tre' },
    ]);
  });

  it('chỉ có 1 trang trại -> tự chọn kho đó', async () => {
    const { service } = makeService({ farms: [farmA] });
    const res = await service.handleAgentConversation('ok', manager, [], pending);
    expect(res?.actionDraft?.collectedData).toMatchObject({ farmId: 'f1' });
  });

  it('thực thi phiếu không chỉ định trang trại -> từ chối, không cộng vào mọi kho', async () => {
    const { service } = makeService({ farms: [farmA, farmB] });
    await expect(
      service.executeAgentAction({ intent: 'IMPORT_INVENTORY', data: { items, farmIds: ['f1', 'f2'] } } as any, manager),
    ).rejects.toThrow('Vui lòng chọn kho của trang trại');
  });
});

describe('AgentActionService – nhập kho từ file: không tự đặt số lượng', () => {
  const makeImportService = () => {
    const prisma: any = {
      farm: { findMany: jest.fn().mockResolvedValue([{ id: 'f1', name: 'SSFM Farm' }]) },
      inventory: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: `inv-${data.itemName}`, ...data })),
      },
      inventoryUsageLog: { create: jest.fn().mockResolvedValue({}) },
    };
    const farmAccess = { getAccessibleFarmIds: jest.fn().mockResolvedValue(['f1']) };
    const service = new AgentActionService(prisma, farmAccess as any, {} as any, {} as any, {} as any);
    return { service, prisma };
  };

  it('dòng không có số lượng -> tồn kho 0, chỉ thêm vào danh mục; dòng có số lượng -> nhập đúng số đó', async () => {
    const { service, prisma } = makeImportService();
    const res: any = await service.executeAgentAction(
      {
        intent: 'IMPORT_INVENTORY',
        data: {
          farmId: 'f1',
          items: [
            { itemName: 'Grow Max (No.2)', category: 'FEED', unit: 'kg', packageType: 'Bao', weightPerPkg: 25, packageQty: 0, quantity: 0 },
            { itemName: 'BKC 80%', category: 'CHEMICAL', unit: 'lít', packageType: 'Chai', weightPerPkg: 1, packageQty: 15, quantity: 15 },
          ],
        },
      } as any,
      manager,
    );

    const created = prisma.inventory.create.mock.calls.map((c: any) => c[0].data);
    expect(created[0]).toMatchObject({ itemName: 'Grow Max (No.2)', quantity: 0, packageQty: 0 });
    expect(created[1]).toMatchObject({ itemName: 'BKC 80%', quantity: 15, packageQty: 15 });
    // Chỉ dòng có số lượng mới ghi phiếu nhập kho
    expect(prisma.inventoryUsageLog.create).toHaveBeenCalledTimes(1);
    expect(res.message).toContain('chưa có số lượng');
  });
});
