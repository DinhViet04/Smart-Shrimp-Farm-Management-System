import { ExpoPushService } from './expo-push.service';

describe('ExpoPushService', () => {
  const prismaMock = {
    devicePushToken: {
      upsert: jest.fn(),
      deleteMany: jest.fn(),
      findMany: jest.fn(),
    },
  };

  let service: ExpoPushService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ExpoPushService(prismaMock as any);
  });

  it('rejects invalid Expo push tokens on register', async () => {
    const res = await service.registerToken('u1', 'invalid-token', 'android');
    expect(res).toEqual({ registered: false, reason: 'INVALID_TOKEN' });
    expect(prismaMock.devicePushToken.upsert).not.toHaveBeenCalled();
  });

  it('upserts valid Expo push tokens on register', async () => {
    prismaMock.devicePushToken.upsert.mockResolvedValue({});
    const res = await service.registerToken(
      'u1',
      'ExponentPushToken[abc123]',
      'android',
    );
    expect(res).toEqual({ registered: true });
    expect(prismaMock.devicePushToken.upsert).toHaveBeenCalledWith({
      where: { token: 'ExponentPushToken[abc123]' },
      update: { userId: 'u1', platform: 'android' },
      create: {
        userId: 'u1',
        token: 'ExponentPushToken[abc123]',
        platform: 'android',
      },
    });
  });

  it('sends push notification and cleans up DeviceNotRegistered tokens', async () => {
    prismaMock.devicePushToken.findMany.mockResolvedValue([
      { token: 'ExponentPushToken[valid1]' },
      { token: 'ExponentPushToken[stale2]' },
    ]);
    prismaMock.devicePushToken.deleteMany.mockResolvedValue({ count: 1 });

    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          { status: 'ok', id: 'ticket-1' },
          { status: 'error', details: { error: 'DeviceNotRegistered' } },
        ],
      }),
    } as any);

    await service.sendToUser('u1', {
      id: 'n1',
      title: 'Cảnh báo pH',
      message: 'Ao 1 vượt ngưỡng',
      level: 'DANGER',
      farmId: 'f1',
      pondId: 'p1',
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(String(init?.body));
    expect(body).toHaveLength(2);
    expect(body[0].priority).toBe('high');
    expect(body[0].channelId).toBe('alerts-danger');

    expect(prismaMock.devicePushToken.deleteMany).toHaveBeenCalledWith({
      where: { token: { in: ['ExponentPushToken[stale2]'] } },
    });

    fetchMock.mockRestore();
  });
});
