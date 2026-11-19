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
