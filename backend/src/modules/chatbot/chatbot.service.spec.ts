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
    const service = new ChatbotService(prisma as any, farmAccess as any);

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
