import { WorkspacesService } from './workspaces.service.js';

describe('WorkspacesService', () => {
  it('limits non-admin users to active memberships', async () => {
    const prisma = {
      workspace: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const service = new WorkspacesService(prisma as any);

    await service.findAll('user-id', 'FARM_MANAGER');

    expect(prisma.workspace.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          members: { some: { userId: 'user-id', isActive: true } },
        },
      }),
    );
  });

  it('records workspace suspension in the admin audit log', async () => {
    const tx = {
      workspace: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: 'workspace-id', status: 'ACTIVE' }),
        update: jest
          .fn()
          .mockResolvedValue({ id: 'workspace-id', status: 'SUSPENDED' }),
      },
      adminAuditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    const prisma = {
      $transaction: jest.fn((callback) => callback(tx)),
    };
    const service = new WorkspacesService(prisma as any);

    await service.updateStatus('workspace-id', 'SUSPENDED', 'admin-id');

    expect(tx.adminAuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          actorId: 'admin-id',
          action: 'WORKSPACE_STATUS_CHANGED',
          details: { from: 'ACTIVE', to: 'SUSPENDED' },
        }),
      }),
    );
  });

  it('records member changes in the audit log', async () => {
    const tx = {
      workspaceMember: {
        upsert: jest.fn().mockResolvedValue({ id: 'member-id' }),
      },
      adminAuditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue({ isActive: true }) },
      $transaction: jest.fn((callback) => callback(tx)),
    };
    const service = new WorkspacesService(prisma as any);

    await service.addMember(
      'workspace-id',
      { userId: 'user-id', role: 'MEMBER' },
      'admin-id',
      'ADMIN',
    );

    expect(tx.adminAuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          actorId: 'admin-id',
          action: 'WORKSPACE_MEMBER_ADDED_OR_REACTIVATED',
          targetId: 'member-id',
        }),
      }),
    );
  });

  it('transfers workspace ownership atomically and records an audit log', async () => {
    const tx = {
      workspace: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'workspace-id',
          name: 'Workspace A',
          status: 'ACTIVE',
        }),
      },
      workspaceMember: {
        findFirst: jest
          .fn()
          .mockResolvedValueOnce({
            id: 'old-member-id',
            userId: 'old-owner-id',
            user: { fullName: 'Old Owner' },
          })
          .mockResolvedValueOnce({
            id: 'new-member-id',
            userId: 'new-owner-id',
            user: {
              id: 'new-owner-id',
              fullName: 'New Owner',
              role: 'FARM_MANAGER',
              isActive: true,
            },
          }),
        update: jest
          .fn()
          .mockResolvedValueOnce({ role: 'ADMIN' })
          .mockResolvedValueOnce({
            role: 'OWNER',
            user: { id: 'new-owner-id', fullName: 'New Owner' },
          }),
      },
      adminAuditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    const prisma = { $transaction: jest.fn((callback) => callback(tx)) };
    const service = new WorkspacesService(prisma as any);

    await service.transferOwnership(
      'workspace-id',
      'new-owner-id',
      'old-owner-id',
      'FARM_MANAGER',
    );

    expect(tx.workspaceMember.update).toHaveBeenNthCalledWith(1, {
      where: { id: 'old-member-id' },
      data: { role: 'ADMIN' },
    });
    expect(tx.workspaceMember.update).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: { id: 'new-member-id' },
        data: { role: 'OWNER' },
      }),
    );
    expect(tx.adminAuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'WORKSPACE_OWNERSHIP_TRANSFERRED',
          actorId: 'old-owner-id',
        }),
      }),
    );
  });
});
