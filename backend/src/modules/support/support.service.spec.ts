import { SupportService } from './support.service.js';

describe('SupportService', () => {
  it('limits regular users to their own support tickets', async () => {
    const prisma = {
      supportTicket: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
    };
    const service = new SupportService(prisma as any, {} as any);

    await service.findAll('user-id', 'FARM_MANAGER', {
      page: 1,
      pageSize: 20,
    });

    expect(prisma.supportTicket.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          requesterId: 'user-id',
          OR: expect.arrayContaining([
            { scope: 'SYSTEM' },
            {
              workspace: {
                members: { some: { userId: 'user-id', isActive: true } },
              },
            },
          ]),
        }),
      }),
    );
  });

  it('rejects ticket creation outside an active workspace membership', async () => {
    const prisma = {
      workspaceMember: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const service = new SupportService(prisma as any, {} as any);

    await expect(
      service.create(
        {
          workspaceId: 'workspace-id',
          subject: 'Need help',
          description: 'Cannot access farm data',
          priority: 'HIGH',
        },
        'user-id',
      ),
    ).rejects.toThrow('Bạn không thuộc workspace');
  });

  it('rejects ticket content containing only whitespace', async () => {
    const service = new SupportService({} as any, {} as any);

    await expect(
      service.create(
        {
          workspaceId: 'workspace-id',
          subject: '   ',
          description: 'Cannot access farm data',
          priority: 'HIGH',
        },
        'user-id',
      ),
    ).rejects.toThrow('Tiêu đề và nội dung yêu cầu không được để trống');
  });

  it('requires a resolution before resolving a support ticket', async () => {
    const prisma = {
      supportTicket: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'ticket-id',
          status: 'IN_PROGRESS',
          assignedToId: 'admin-id',
        }),
      },
    };
    const service = new SupportService(prisma as any, {} as any);

    await expect(
      service.update('ticket-id', { status: 'RESOLVED' }, 'admin-id'),
    ).rejects.toThrow('Phải nhập kết quả xử lý');
  });

  it('creates a ticket and notifies active admins', async () => {
    const prisma = {
      workspaceMember: { findFirst: jest.fn().mockResolvedValue({ id: 'm' }) },
      supportTicket: {
        create: jest.fn().mockResolvedValue({
          id: 'ticket-id',
          subject: 'Need help',
          workspace: { name: 'Workspace A' },
        }),
      },
      user: { findMany: jest.fn().mockResolvedValue([{ id: 'admin-id' }]) },
    };
    const notifications = {
      createSupportNotification: jest.fn().mockResolvedValue({}),
      emitSupportTicketCreated: jest.fn(),
    };
    const service = new SupportService(prisma as any, notifications as any);

    await service.create(
      {
        workspaceId: 'workspace-id',
        subject: 'Need help',
        description: 'Cannot access farm data',
        priority: 'HIGH',
      },
      'user-id',
    );

    expect(notifications.createSupportNotification).toHaveBeenCalledWith(
      'admin-id',
      'Yêu cầu hỗ trợ mới',
      'Workspace A: Need help',
      'WARNING',
    );
    expect(notifications.emitSupportTicketCreated).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'ticket-id' }),
    );
  });

  it('creates a system ticket without requiring a workspace', async () => {
    const prisma = {
      supportTicket: {
        create: jest.fn().mockResolvedValue({
          id: 'ticket-id',
          subject: 'Application error',
          workspace: null,
        }),
      },
      user: { findMany: jest.fn().mockResolvedValue([{ id: 'admin-id' }]) },
    };
    const notifications = {
      createSupportNotification: jest.fn().mockResolvedValue({}),
      emitSupportTicketCreated: jest.fn(),
    };
    const service = new SupportService(prisma as any, notifications as any);

    await service.create(
      {
        scope: 'SYSTEM',
        subject: 'Application error',
        description: 'The dashboard cannot be opened',
        priority: 'HIGH',
      },
      'user-id',
    );

    expect(prisma.supportTicket.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          scope: 'SYSTEM',
          workspaceId: null,
        }),
      }),
    );
    expect(notifications.createSupportNotification).toHaveBeenCalledWith(
      'admin-id',
      'Yêu cầu hỗ trợ mới',
      'Hệ thống SSFM: Application error',
      'WARNING',
    );
  });

  it('rejects skipping directly from OPEN to RESOLVED', async () => {
    const prisma = {
      supportTicket: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'ticket-id',
          status: 'OPEN',
          assignedToId: 'admin-id',
        }),
      },
    };
    const service = new SupportService(prisma as any, {} as any);

    await expect(
      service.update(
        'ticket-id',
        { status: 'RESOLVED', resolution: 'Fixed' },
        'admin-id',
      ),
    ).rejects.toThrow('Không thể chuyển ticket từ OPEN sang RESOLVED');
  });

  it('requires an active admin assignee when accepting a ticket', async () => {
    const prisma = {
      supportTicket: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'ticket-id',
          status: 'OPEN',
          assignedToId: null,
        }),
      },
    };
    const service = new SupportService(prisma as any, {} as any);

    await expect(
      service.update('ticket-id', { status: 'IN_PROGRESS' }, 'admin-id'),
    ).rejects.toThrow('Phải chỉ định Admin phụ trách');
  });
});
