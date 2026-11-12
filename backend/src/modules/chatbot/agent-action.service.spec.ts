import { ForbiddenException } from '@nestjs/common';
import { AgentActionService } from './agent-action.service';

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

