import { of, lastValueFrom } from 'rxjs';
import { RealtimeInterceptor, describeRoute } from './realtime.interceptor';

describe('describeRoute', () => {
  it('maps farm-scoped controllers', () => {
    expect(describeRoute(['ponds', ':id'], {})).toEqual({
      resource: 'ponds',
      scope: 'farm',
    });
    expect(describeRoute(['mortality-logs'], {})?.resource).toBe(
      'survival-rate',
    );
  });

  it('maps size samples nested under ponds', () => {
    expect(
      describeRoute(['ponds', ':pondId', 'size-samples', ':sampleId'], {}),
    ).toEqual({
      resource: 'shrimp-size',
      scope: 'farm',
      entityParam: 'sampleId',
    });
  });

  it('maps chatbot actions by intent and ignores plain chat', () => {
    expect(
      describeRoute(['chatbot', 'execute-action'], { intent: 'CREATE_POND' })
        ?.resource,
    ).toBe('ponds');
    expect(describeRoute(['chatbot', 'ask'], {})).toBeNull();
  });

  it('skips routes with their own realtime channel or no data change', () => {
    for (const root of ['auth', 'chat-groups', 'support-tickets', 'weather']) {
      expect(describeRoute([root], {})).toBeNull();
    }
  });
});

describe('RealtimeInterceptor', () => {
  const makeContext = (req: any) =>
    ({
      getType: () => 'http',
      switchToHttp: () => ({ getRequest: () => req }),
    }) as any;

  it('publishes a farm-scoped event resolved before the handler runs', async () => {
    const realtime = {
      farmIdFromPond: jest.fn(),
      farmIdFromCrop: jest.fn(),
      farmIdFromEntity: jest.fn().mockResolvedValue('farm-1'),
      publish: jest.fn().mockResolvedValue(undefined),
    };
    const interceptor = new RealtimeInterceptor(realtime as any);
    const req = {
      method: 'DELETE',
      route: { path: '/api/ponds/:id' },
      params: { id: 'pond-123456' },
      body: {},
      query: {},
      user: { userId: 'user-1' },
    };

    await lastValueFrom(
      interceptor.intercept(makeContext(req), { handle: () => of({}) }),
    );
    await new Promise((r) => setImmediate(r));
    await new Promise((r) => setImmediate(r));

    expect(realtime.farmIdFromEntity).toHaveBeenCalledWith(
      'ponds',
      'pond-123456',
    );
    expect(realtime.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        resource: 'ponds',
        action: 'deleted',
        farmId: 'farm-1',
        audience: { kind: 'farm', farmId: 'farm-1' },
        actorId: 'user-1',
      }),
    );
  });

  it('does nothing for GET requests', async () => {
    const realtime = { publish: jest.fn() };
    const interceptor = new RealtimeInterceptor(realtime as any);
    await lastValueFrom(
      interceptor.intercept(
        makeContext({ method: 'GET', route: { path: '/api/ponds' } }),
        { handle: () => of([]) },
      ),
    );
    await new Promise((r) => setImmediate(r));
    expect(realtime.publish).not.toHaveBeenCalled();
  });
});
