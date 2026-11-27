import { ForbiddenException } from '@nestjs/common';
import { ChatbotService } from './chatbot.service';

describe('ChatbotService access control', () => {
  it('does not use pond data when the user cannot access its farm', async () => {
    const prisma = {
      pond: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'pond-1',
          farmId: 'farm-1',
          farm: { name: 'Farm 1' },
          crops: [],
          waterQualityRecords: [],
        }),
      },
    };
    const farmAccess = {
      assertCanAccessFarm: jest
        .fn()
        .mockRejectedValue(new ForbiddenException('forbidden')),
    };
    const weatherService = {
      getWeather: jest.fn(),
      isWeatherInquiry: jest.fn().mockReturnValue(false),
      buildWeatherContextString: jest.fn(),
    };
    const agentActionService = { handleAgentConversation: jest.fn().mockResolvedValue(null) };
    const chatDataScope = {
      resolveScope: jest.fn().mockResolvedValue({ userId: 'user-1', role: 'TECHNICIAN', farmIds: [] }),
    };
    const chatTools = { describeScope: jest.fn().mockResolvedValue('') };
    const service = new ChatbotService(
      prisma as any,
      farmAccess as any,
      weatherService as any,
      agentActionService as any,
      {} as any,
      chatDataScope as any,
      chatTools as any,
    );

    await expect(
      service.ask(
        { question: 'Tình trạng ao?', pondId: 'pond-1' },
        { userId: 'user-1', role: 'TECHNICIAN' },
      ),
    ).rejects.toThrow(ForbiddenException);

    expect(farmAccess.assertCanAccessFarm).toHaveBeenCalledWith(
      { userId: 'user-1', role: 'TECHNICIAN' },
      'farm-1',
    );
  });
});

describe('ChatbotService – thẻ cho ăn của Nông dân', () => {
  const makeService = (create: jest.Mock, role: string) => {
    const prisma = { pond: { findUnique: jest.fn().mockResolvedValue(null) } };
    const agentActionService = {
      handleAgentConversation: jest.fn().mockResolvedValue(null),
      getActionToolDefinitions: jest.fn().mockReturnValue(
        role === 'FARMER'
          ? [{ type: 'function', function: { name: 'draft_record_feeding', parameters: { type: 'object', properties: {} } } }]
          : [],
      ),
      draftFromToolCall: jest.fn().mockResolvedValue({ isAgentAction: true, answer: 'chọn ao', actionDraft: { intent: 'RECORD_FEEDING' } }),
      stampDraft: jest.fn((d) => d),
    };
    const chatDataScope = { resolveScope: jest.fn().mockResolvedValue({ userId: 'u1', role, farmIds: ['f1'] }) };
    const chatTools = {
      describeScope: jest.fn().mockResolvedValue(''),
      describeRouting: jest.fn().mockReturnValue(''),
      getToolDefinitions: jest.fn().mockReturnValue([]),
      execute: jest.fn(),
    };
    const service = new ChatbotService(
      prisma as any, {} as any, {} as any, agentActionService as any, {} as any, chatDataScope as any, chatTools as any,
    );
    (service as any).openai = { chat: { completions: { create } } };
    return { service, agentActionService };
  };

  it('bắt buộc OpenAI gọi draft_record_feeding khi nông dân nói "tôi muốn cho ăn"', async () => {
    const create = jest.fn().mockResolvedValue({
      choices: [{ message: { tool_calls: [{ id: 't1', type: 'function', function: { name: 'draft_record_feeding', arguments: '{}' } }] } }],
    });
    const { service, agentActionService } = makeService(create, 'FARMER');
    const res: any = await service.ask({ question: 'tôi muốn cho ăn' } as any, { userId: 'u1', role: 'FARMER' });

    expect(create.mock.calls[0][0].tool_choice).toEqual({ type: 'function', function: { name: 'draft_record_feeding' } });
    expect(agentActionService.draftFromToolCall).toHaveBeenCalledWith('draft_record_feeding', {}, expect.anything(), 'tôi muốn cho ăn', expect.anything());
    expect(res.actionDraft.intent).toBe('RECORD_FEEDING');
  });

  it('không ép mở thẻ khi nông dân chỉ hỏi tư vấn', async () => {
    const create = jest.fn().mockResolvedValue({ choices: [{ message: { content: 'Nên cho khoảng 5 kg/cữ.' } }] });
    const { service } = makeService(create, 'FARMER');
    await service.ask({ question: 'hôm nay nên cho ăn bao nhiêu' } as any, { userId: 'u1', role: 'FARMER' });
    expect(create.mock.calls[0][0].tool_choice).toBe('auto');
  });
});

describe('ChatbotService – OpenAI phân loại muốn cho ăn / chỉ hỏi', () => {
  const build = (intent: 'RECORD' | 'QUESTION') => {
    const create = jest.fn().mockResolvedValue({ choices: [{ message: { content: 'Trả lời' } }] });
    const agentActionService = {
      handleAgentConversation: jest.fn().mockResolvedValue(null),
      getActionToolDefinitions: jest.fn().mockReturnValue([
        { type: 'function', function: { name: 'draft_record_feeding', parameters: { type: 'object', properties: {} } } },
      ]),
      draftFromToolCall: jest.fn(),
      stampDraft: jest.fn((d) => d),
    };
    const chatTools = {
      describeScope: jest.fn().mockResolvedValue(''),
      describeRouting: jest.fn().mockReturnValue(''),
      getToolDefinitions: jest.fn().mockReturnValue([
        { type: 'function', function: { name: 'get_feeding_status', parameters: { type: 'object', properties: {} } } },
      ]),
      execute: jest.fn(),
    };
    const feedingAgent = { classifyFeedingIntent: jest.fn().mockResolvedValue(intent) };
    const service = new ChatbotService(
      { pond: { findUnique: jest.fn() } } as any, {} as any, {} as any, agentActionService as any, {} as any,
      { resolveScope: jest.fn().mockResolvedValue({ userId: 'u1', role: 'FARMER', farmIds: ['f1'] }) } as any,
      chatTools as any, feedingAgent as any,
    );
    (service as any).openai = { chat: { completions: { create } } };
    return { service, create, feedingAgent };
  };

  it('QUESTION: không ép và bỏ công cụ ghi cho ăn khỏi lượt hỏi', async () => {
    const { service, create, feedingAgent } = build('QUESTION');
    await service.ask({ question: 'ao 1 hôm qua cho ăn ít quá' } as any, { userId: 'u1', role: 'FARMER' });
    expect(feedingAgent.classifyFeedingIntent).toHaveBeenCalled();
    const req = create.mock.calls[0][0];
    expect(req.tool_choice).toBe('auto');
    expect(req.tools.map((t: any) => t.function.name)).toEqual(['get_feeding_status']);
  });

  it('RECORD: bắt buộc gọi draft_record_feeding', async () => {
    const { service, create } = build('RECORD');
    await service.ask({ question: 'cho ăn ao C1' } as any, { userId: 'u1', role: 'FARMER' });
    expect(create.mock.calls[0][0].tool_choice).toEqual({ type: 'function', function: { name: 'draft_record_feeding' } });
  });
});
