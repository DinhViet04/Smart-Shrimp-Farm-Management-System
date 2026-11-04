import { FarmsService } from './farms.service.js';

describe('FarmsService list query', () => {
  it('rejects farm creation outside a workspace the manager administers', async () => {
    const prisma = {
      workspaceMember: { findFirst: jest.fn().mockResolvedValue(null) },
      farm: { create: jest.fn() },
    };
    const service = new FarmsService(
      prisma as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    await expect(
      service.create({
        workspaceId: 'other-workspace-id',
        ownerId: 'manager-id',
        name: 'Farm A',
        address: 'Soc Trang',
        area: 1000,
      } as any),
    ).rejects.toThrow(
      'Bạn không có quyền tạo trang trại trong workspace đã chọn',
    );
    expect(prisma.farm.create).not.toHaveBeenCalled();
  });

  it('loads farms and ponds in parallel without returning full user records', async () => {
    const farm = {
      id: 'farm-id',
      name: 'Farm A',
      ownerId: 'manager-id',
      deletedAt: null,
    };
    const pond = { id: 'pond-id', name: 'Pond A', farmId: 'farm-id' };
    const prisma = {
      farm: { findMany: jest.fn().mockResolvedValue([farm]) },
      pond: { findMany: jest.fn().mockResolvedValue([pond]) },
      user: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const service = new FarmsService(
      prisma as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    const result = await service.findAll(
      undefined,
      undefined,
      'manager-id',
      'FARM_MANAGER',
    );

    expect(prisma.farm.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          deletedAt: null,
          ownerId: 'manager-id',
          workspace: {
            status: 'ACTIVE',
            members: { some: { userId: 'manager-id', isActive: true } },
          },
        },
      }),
    );
    expect(prisma.pond.findMany).toHaveBeenCalled();
    expect(prisma.user.findMany).not.toHaveBeenCalled();
    expect(result[0]).toMatchObject({
      id: 'farm-id',
      ponds: [{ id: 'pond-id' }],
    });
  });

  it('transfers ownership to an active farm manager and records an audit log', async () => {
    const tx = {
      farm: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'farm-id',
          name: 'Farm A',
          ownerId: 'old-manager-id',
          workspaceId: 'workspace-id',
          owner: { fullName: 'Old Manager' },
        }),
        update: jest.fn().mockResolvedValue({
          id: 'farm-id',
          ownerId: 'new-manager-id',
        }),
      },
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'new-manager-id',
          fullName: 'New Manager',
          role: 'FARM_MANAGER',
          isActive: true,
        }),
      },
      workspaceMember: {
        findFirst: jest.fn().mockResolvedValue({ id: 'membership-id' }),
      },
      adminAuditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    const prisma = {
      $transaction: jest.fn((callback) => callback(tx)),
    };
    const service = new FarmsService(
      prisma as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    const result = await service.transferOwnership(
      'farm-id',
      'new-manager-id',
      'admin-id',
    );

    expect(tx.farm.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'farm-id' },
        data: { ownerId: 'new-manager-id' },
      }),
    );
    expect(tx.adminAuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          actorId: 'admin-id',
          action: 'FARM_OWNERSHIP_TRANSFERRED',
        }),
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({ ownerId: 'new-manager-id' }),
    );
  });

  it('rejects ownership transfer to a manager outside the farm workspace', async () => {
    const tx = {
      farm: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'farm-id',
          name: 'Farm A',
          ownerId: 'old-manager-id',
          workspaceId: 'workspace-id',
          owner: { fullName: 'Old Manager' },
        }),
        update: jest.fn(),
      },
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'new-manager-id',
          fullName: 'New Manager',
          role: 'FARM_MANAGER',
          isActive: true,
        }),
      },
      workspaceMember: { findFirst: jest.fn().mockResolvedValue(null) },
      adminAuditLog: { create: jest.fn() },
    };
    const prisma = { $transaction: jest.fn((callback) => callback(tx)) };
    const service = new FarmsService(
      prisma as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    await expect(
      service.transferOwnership('farm-id', 'new-manager-id', 'admin-id'),
    ).rejects.toThrow(
      'Quản lý mới phải là thành viên đang hoạt động của cùng workspace',
    );
    expect(tx.farm.update).not.toHaveBeenCalled();
    expect(tx.adminAuditLog.create).not.toHaveBeenCalled();
  });
});
