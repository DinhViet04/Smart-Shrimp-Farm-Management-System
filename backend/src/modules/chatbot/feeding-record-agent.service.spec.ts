import { BadRequestException, ForbiddenException } from '@nestjs/common';
import {
  FeedingRecordAgentService,
  feedSizeNumber,
  feedingSessionFromText,
  normalizeTime,
  sessionForTime,
  vnToday,
} from './feeding-record-agent.service';
import { AgentActionService } from './agent-action.service';

const farmer = { userId: 'f1', role: 'FARMER' };

describe('feeding helpers', () => {
  it.each([
    ['cữ 2', 'SESSION_2'],
    ['bữa thứ 3', 'SESSION_3'],
    ['sáng sớm nay', 'SESSION_1'],
    ['sáng nay', 'SESSION_2'],
    ['trưa', 'SESSION_3'],
    ['đầu chiều', 'SESSION_4'],
    ['chiều nay', 'SESSION_5'],
    ['chiều tối', 'SESSION_6'],
    ['tối qua', 'SESSION_7'],
  ])('maps "%s" to %s', (text, session) => {
    expect(feedingSessionFromText(text)).toBe(session);
  });

  it('maps a time to the nearest default session', () => {
    expect(sessionForTime('16:00')).toBe('SESSION_5');
    expect(sessionForTime('05:00')).toBe('SESSION_1');
  });

  it('normalizes times', () => {
    expect(normalizeTime('16h')).toBe('16:00');
    expect(normalizeTime('7:5')).toBe('07:05');
    expect(normalizeTime('25:00')).toBeUndefined();
  });

  it('reads feed size numbers from names', () => {
    expect(feedSizeNumber('Cám CP số 2')).toBe(2);
    expect(feedSizeNumber('Grobest No.3')).toBe(3);
    expect(feedSizeNumber('Thức ăn tôm size 4')).toBe(4);
    expect(feedSizeNumber('Men vi sinh')).toBeNull();
  });

  it('detects feeding reports but not questions (no-OpenAI fallback)', () => {
    expect(FeedingRecordAgentService.detectIntent('ao 1 vừa cho ăn cữ 2 12kg')).toBe(true);
    expect(FeedingRecordAgentService.detectIntent('ao 3 bỏ cữ trưa')).toBe(true);
    expect(FeedingRecordAgentService.detectIntent('hôm nay nên cho ăn bao nhiêu?')).toBe(false);
  });
});

describe('FeedingRecordAgentService', () => {
  // Không gọi OpenAI thật trong test
  const ORIGINAL_KEY = process.env.OPENAI_API_KEY;
  beforeAll(() => {
    delete process.env.OPENAI_API_KEY;
  });
  afterAll(() => {
    if (ORIGINAL_KEY !== undefined) process.env.OPENAI_API_KEY = ORIGINAL_KEY;
  });

  const makePrisma = () => {
    const start = new Date(`${vnToday()}T00:00:00.000Z`);
    start.setUTCDate(start.getUTCDate() - 44); // DOC 45
    return {
      pond: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'p1',
            name: 'Ao 1',
            farmId: 'farm1',
            farm: { name: 'Trại A' },
            crops: [{ id: 'c1', startDate: start }],
          },
        ]),
        findUnique: jest.fn().mockResolvedValue({
          id: 'p1',
          name: 'Ao 1',
          farmId: 'farm1',
          farm: { name: 'Trại A', deletedAt: null },
          crops: [{ id: 'c1', startDate: start, initialShrimpCount: 100_000, stage: 'COMMERCIAL', growthMilestones: null }],
        }),
      },
      shrimpSizeSample: { findFirst: jest.fn().mockResolvedValue(null) },
      mortalityLog: { aggregate: jest.fn().mockResolvedValue({ _sum: { deadQuantityPcs: 10_000 } }) },
      feedingLog: { findMany: jest.fn().mockResolvedValue([]) },
      inventory: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'feed2', itemName: 'Cám CP số 2', unit: 'kg', quantity: 100, sizeSpec: null },
          { id: 'feed3', itemName: 'Cám CP số 3', unit: 'kg', quantity: 200, sizeSpec: null },
        ]),
        count: jest.fn().mockResolvedValue(1),
      },
      waterQualityRecord: { findFirst: jest.fn().mockResolvedValue(null) },
    };
  };
  const farmAccess = {
    getAccessibleFarmIds: jest.fn().mockResolvedValue(['farm1']),
    assertCanAccessFarm: jest.fn().mockResolvedValue(undefined),
  };

  it('suggests daily feed from biomass and the feed size that matches the shrimp', async () => {
    const prisma = makePrisma();
    const service = new FeedingRecordAgentService(prisma as any, farmAccess as any, {} as any);
    const s = await service.getSuggestion(farmer, 'p1');
    expect(s.doc).toBe(45);
    expect(s.aliveCount).toBe(90_000);
    expect(s.abwSource).toBe('DOC_CURVE');
    // DOC 45 ≈ 5.75 g/con -> 4.2%/ngày -> ~517 kg sinh khối × 4.2% ≈ 21.7 kg
    expect(s.dailyKg).toBeGreaterThan(18);
    expect(s.dailyKg).toBeLessThan(25);
    expect(s.recommendedFeedProductId).toBe('feed3');
    expect(s.remainingKg).toBe(s.dailyKg);
  });

  it('reduces the suggestion when dissolved oxygen is low', async () => {
    const prisma = makePrisma();
    const service = new FeedingRecordAgentService(prisma as any, farmAccess as any, {} as any);
    const normal = await service.getSuggestion(farmer, 'p1');
    prisma.waterQualityRecord.findFirst.mockResolvedValue({ dissolvedOxygen: 3.2, temperature: 29, nh3: 0, no2: 0 });
    const lowDo = await service.getSuggestion(farmer, 'p1');
    expect(lowDo.dailyKg).toBeLessThan(normal.dailyKg);
    expect(lowDo.warnings.join(' ')).toContain('DO thấp');
  });

  it('caps the suggestion at +15% of the recent daily average', async () => {
    const prisma = makePrisma();
    const yesterday = new Date(`${vnToday()}T00:00:00.000Z`);
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    prisma.feedingLog.findMany.mockResolvedValue([
      { feedingDate: yesterday, feedingSession: 'SESSION_2', feedingStatus: 'COMPLETED', feedAmount: 10, feedProductId: 'feed2', feedingTime: '08:00', feedProduct: { itemName: 'Cám CP số 2' } },
    ]);
    const service = new FeedingRecordAgentService(prisma as any, farmAccess as any, {} as any);
    const s = await service.getSuggestion(farmer, 'p1');
    expect(s.dailyKg).toBe(11.5);
  });

  it('only lets FARMER get suggestions, drafts and save', async () => {
    const prisma = makePrisma();
    const feedingLogs = { createOrUpdateDailyLog: jest.fn() };
    const service = new FeedingRecordAgentService(prisma as any, farmAccess as any, feedingLogs as any);
    const manager = { userId: 'm1', role: 'FARM_MANAGER' };

    await expect(service.getSuggestion(manager, 'p1')).rejects.toBeInstanceOf(ForbiddenException);
    const draft = await service.buildDraft(manager, {}, 'ao 1 cho ăn cữ 2');
    expect((draft as any).actionDraft).toBeUndefined();
    await expect(service.execute({ pondId: 'p1', date: vnToday(), sessions: [] }, manager)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(feedingLogs.createOrUpdateDailyLog).not.toHaveBeenCalled();
  });

  it('builds a draft with the pond and session from the message, leaving feed & kg to the farmer', async () => {
    const prisma = makePrisma();
    const service = new FeedingRecordAgentService(prisma as any, farmAccess as any, {} as any);
    const res: any = await service.buildDraft(farmer, { pondName: 'ao 1', sessions: [{ session: 2 }] }, 'ao 1 vừa cho ăn cữ 2');
    expect(res.actionDraft.intent).toBe('RECORD_FEEDING');
    expect(res.actionDraft.collectedData.pondId).toBe('p1');
    expect(res.actionDraft.collectedData.sessions[0]).toMatchObject({ session: 'SESSION_2' });
    expect(res.actionDraft.collectedData.sessions[0].amountKg).toBeUndefined();
    expect(res.actionDraft.feedingPondOptions).toHaveLength(1);
  });

  it('lists active ponds with today feeding status when the farmer does not name a pond', async () => {
    const prisma = makePrisma();
    const start = new Date(`${vnToday()}T00:00:00.000Z`);
    prisma.pond.findMany.mockResolvedValue([
      { id: 'p1', name: 'Ao 1', farmId: 'farm1', farm: { name: 'Trại A' }, crops: [{ id: 'c1', startDate: start }] },
      { id: 'p2', name: 'Ao 2', farmId: 'farm1', farm: { name: 'Trại A' }, crops: [{ id: 'c2', startDate: start }] },
    ]);
    prisma.feedingLog.findMany.mockResolvedValue([
      { pondId: 'p1', feedAmount: 6 },
      { pondId: 'p1', feedAmount: 5.5 },
    ]);
    const service = new FeedingRecordAgentService(prisma as any, farmAccess as any, {} as any);
    const res: any = await service.buildDraft(farmer, {}, 'tôi muốn cho ăn');

    expect(res.actionDraft.collectedData.pondId).toBe('');
    expect(res.actionDraft.feedingPondOptions).toEqual([
      expect.objectContaining({ id: 'p1', todaySessions: 2, todayKg: 11.5 }),
      expect.objectContaining({ id: 'p2', todaySessions: 0, todayKg: 0 }),
    ]);
    expect(res.answer).toContain('2 ao đang nuôi');
    expect(res.answer).toContain('**Ao 1**');
    expect(res.answer).toContain('đã cho 2 cữ, 11.5 kg');
    expect(res.answer).toContain('**Ao 2**');
    expect(res.answer).toContain('chưa cho ăn');
  });

  it('names the growth stage and the in-stock feed that fits it', async () => {
    const prisma = makePrisma();
    const service = new FeedingRecordAgentService(prisma as any, farmAccess as any, {} as any);
    const s = await service.getSuggestion(farmer, 'p1');
    expect(s.growthStage).toContain('3–8 g');
    expect(s.matchingFeeds.map((f) => f.name)).toEqual(['Cám CP số 3']);
    expect(s.nearFeeds.map((f) => f.name)).toEqual(['Cám CP số 2']);
    const line = service.feedAdviceLine(s);
    expect(line).toContain('nên dùng thức ăn **số 3**');
    expect(line).toContain('trong kho có **Cám CP số 3** (tồn 200 kg)');
  });

  it('suggests the nearest size in stock when the exact size is missing', async () => {
    const prisma = makePrisma();
    prisma.inventory.findMany.mockResolvedValue([
      { id: 'feed2', itemName: 'Cám CP số 2', unit: 'kg', quantity: 100, sizeSpec: null },
    ]);
    const service = new FeedingRecordAgentService(prisma as any, farmAccess as any, {} as any);
    const line = service.feedAdviceLine(await service.getSuggestion(farmer, 'p1'));
    expect(line).toContain('kho chưa có loại đúng cỡ');
    expect(line).toContain('**Cám CP số 2** (tồn 100 kg)');
  });

  it('keeps the pond list short — feed advice only appears on the card after a pond is picked', async () => {
    const prisma = makePrisma();
    const service = new FeedingRecordAgentService(prisma as any, farmAccess as any, {} as any);
    const ponds = await service.listPonds(farmer);
    const reply: string = (service as any).pondListReply([...ponds, { ...ponds[0], id: 'p1b', name: 'Ao 1B' }]);
    expect(reply).toContain('**Ao 1**');
    expect(reply).toContain('**Ao 1B**');
    expect(reply).not.toContain('nên dùng thức ăn');
    expect(reply).not.toContain('Cám CP');
    // Danh sách ao không tự tính gợi ý cho từng ao
    expect(prisma.pond.findUnique).not.toHaveBeenCalled();
  });

  it('detects "tôi muốn cho ăn" in the no-OpenAI fallback', () => {
    expect(FeedingRecordAgentService.detectIntent('tôi muốn cho ăn')).toBe(true);
  });

  it('replies with the real suggestion when OpenAI is unavailable', async () => {
    const prisma = makePrisma();
    const service = new FeedingRecordAgentService(prisma as any, farmAccess as any, {} as any);
    const res: any = await service.buildDraft(farmer, { pondName: 'ao 1' }, 'ao 1 vừa cho ăn');
    expect(res.answer).toContain('Ao 1');
    expect(res.answer).toMatch(/gợi ý cả ngày \*\*[\d.]+ kg\*\*/);
    expect(res.answer).toContain('Cám CP số 3');
  });

  it('asks OpenAI to reply using the pond data and what the farmer said', async () => {
    const prisma = makePrisma();
    prisma.inventory.findMany.mockImplementation((q: any) =>
      Promise.resolve(
        q?.select?.quantity
          ? [
              { id: 'feed2', itemName: 'Cám CP số 2', unit: 'kg', quantity: 100, sizeSpec: null },
              { id: 'feed3', itemName: 'Cám CP số 3', unit: 'kg', quantity: 200, sizeSpec: null },
            ]
          : [
              { id: 'feed2', itemName: 'Cám CP số 2' },
              { id: 'feed3', itemName: 'Cám CP số 3' },
            ],
      ),
    );
    const service = new FeedingRecordAgentService(prisma as any, farmAccess as any, {} as any);
    const create = jest.fn().mockResolvedValue({ choices: [{ message: { content: 'Ao 1 nên cho khoảng **5 kg/cữ**.' } }] });
    (service as any).openai = { chat: { completions: { create } } };

    const res: any = await service.buildDraft(
      farmer,
      { pondName: 'ao 1', sessions: [{ session: 2, amountKg: 30, feedName: 'Cám CP số 2' }] },
      'ao 1 cữ 2 cho ăn 30 ký cám số 2',
    );
    expect(res.answer).toBe('Ao 1 nên cho khoảng **5 kg/cữ**.');
    const userContent = create.mock.calls[0][0].messages[1].content as string;
    expect(userContent).toContain('"goiYCaNgayKg"');
    expect(userContent).toContain('"soKy":30');
    expect(userContent).toContain('Cám CP số 2');
    expect(userContent).toContain('Cám CP số 3');
  });

  it('falls back to the template reply when OpenAI fails', async () => {
    const prisma = makePrisma();
    const service = new FeedingRecordAgentService(prisma as any, farmAccess as any, {} as any);
    (service as any).openai = { chat: { completions: { create: jest.fn().mockRejectedValue(new Error('timeout')) } } };
    const res: any = await service.buildDraft(farmer, { pondName: 'ao 1' }, 'ao 1 vừa cho ăn');
    expect(res.answer).toContain('gợi ý cả ngày');
    expect(res.actionDraft.intent).toBe('RECORD_FEEDING');
  });

  it('saves the chosen sessions through FeedingLogsService', async () => {
    const prisma = makePrisma();
    const feedingLogs = { createOrUpdateDailyLog: jest.fn().mockResolvedValue([]) };
    const service = new FeedingRecordAgentService(prisma as any, farmAccess as any, feedingLogs as any);
    const res = await service.execute(
      {
        pondId: 'p1',
        date: vnToday(),
        sessions: [
          { session: 'SESSION_2', time: '08:00', feedProductId: 'feed3', amountKg: 12, status: 'COMPLETED' },
          { session: 'SESSION_5', time: '16h', feedProductId: 'feed3', amountKg: 0, status: 'SKIPPED' },
        ],
      },
      farmer,
    );
    expect(res.success).toBe(true);
    const dto = feedingLogs.createOrUpdateDailyLog.mock.calls[0][1];
    expect(dto).toMatchObject({ farmId: 'farm1', pondId: 'p1', cropId: 'c1', feedingDate: vnToday() });
    expect(dto.sessions).toHaveLength(2);
    expect(dto.sessions[1]).toMatchObject({ feedingSession: 'SESSION_5', feedingTime: '16:00', feedAmount: 0, feedingStatus: 'SKIPPED' });
  });

  it('rejects missing kg, duplicate sessions, future dates and feed from another farm', async () => {
    const prisma = makePrisma();
    const feedingLogs = { createOrUpdateDailyLog: jest.fn() };
    const service = new FeedingRecordAgentService(prisma as any, farmAccess as any, feedingLogs as any);
    const row = { session: 'SESSION_2', time: '08:00', feedProductId: 'feed3', amountKg: 12, status: 'COMPLETED' };

    await expect(
      service.execute({ pondId: 'p1', date: vnToday(), sessions: [{ ...row, amountKg: 0 }] }, farmer),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.execute({ pondId: 'p1', date: vnToday(), sessions: [row, row] }, farmer)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(service.execute({ pondId: 'p1', date: '2999-01-01', sessions: [row] }, farmer)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    prisma.inventory.count.mockResolvedValue(0);
    await expect(service.execute({ pondId: 'p1', date: vnToday(), sessions: [row] }, farmer)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(feedingLogs.createOrUpdateDailyLog).not.toHaveBeenCalled();
  });
});

describe('AgentActionService feeding tool permissions', () => {
  const feedingAgent = {} as any;
  const service = new AgentActionService({} as any, {} as any, {} as any, {} as any, {} as any, undefined, undefined, feedingAgent);
  const names = (role: string) =>
    service.getActionToolDefinitions(role).map((t) => (t.type === 'function' ? t.function.name : ''));

  it('gives draft_record_feeding to FARMER only', () => {
    expect(names('FARMER')).toEqual(['draft_record_feeding']);
    expect(names('FARM_MANAGER')).not.toContain('draft_record_feeding');
    expect(names('TECHNICIAN')).not.toContain('draft_record_feeding');
    expect(names('ADMIN')).toEqual([]);
  });

  it('refuses RECORD_FEEDING execution for non-farmers', async () => {
    await expect(
      service.executeAgentAction({ intent: 'RECORD_FEEDING', data: {} }, { userId: 't1', role: 'TECHNICIAN' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
