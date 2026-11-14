import { FarmsService } from './farms.service.js';

describe('FarmsService list query', () => {
  it('rejects direct staff assignment and requires an email invitation', async () => {
    const farmAccess = {
      assertCanManageFarm: jest.fn().mockResolvedValue(undefined),
    };
    const service = new FarmsService(
      {} as any,
      farmAccess as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    await expect(
      service.assignStaff(
        'farm-id',
        'employee-id',
        'manager-id',
        'FARM_MANAGER',
      ),
    ).rejects.toThrow(
      'Không thể gán nhân viên trực tiếp; vui lòng mời nhân viên qua email',
    );
  });

  it.each(['FARMER', 'TECHNICIAN'] as const)(
    'validates and automatically assigns an existing %s to the farm and its chat group',
    async (role) => {
      const prisma = {
        farm: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'farm-id',
            name: 'Farm A',
            ownerId: 'manager-id',
            workspaceId: 'workspace-id',
            owner: {
              id: 'manager-id',
              fullName: 'Manager',
              email: 'manager@example.com',
            },
          }),
        },
        user: {
          findFirst: jest.fn().mockResolvedValue({
            id: 'employee-id',
            email: 'employee@example.com',
            fullName: 'Employee',
            role,
            isActive: true,
          }),
          update: jest.fn(),
        },
        farmStaff: {
          findUnique: jest.fn().mockResolvedValue(null),
          upsert: jest.fn().mockResolvedValue({}),
        },
        workspaceMember: { upsert: jest.fn().mockResolvedValue({}) },
      };
      const farmAccess = {
        assertCanManageFarm: jest.fn().mockResolvedValue(undefined),
      };
      const jwtService = {
        signAsync: jest.fn().mockResolvedValue('invite-token'),
      };
      const configService = {
        get: jest.fn((key: string) =>
          key === 'FRONTEND_URL' ? 'http://localhost:5173' : 'secret',
        ),
      };
      const emailService = {
        sendFarmInvitationExistingUser: jest.fn().mockResolvedValue(undefined),
      };
      const notificationsService = {
        createFarmJoinNotification: jest.fn().mockResolvedValue(undefined),
        createStaffJoinedNotification: jest.fn(),
      };
      const chatGroupsService = {
        addMemberToFarmChatGroup: jest.fn().mockResolvedValue(undefined),
      };
      const service = new FarmsService(
        prisma as any,
        farmAccess as any,
        jwtService as any,
        configService as any,
        emailService as any,
        notificationsService as any,
        chatGroupsService as any,
      );

      await expect(
        service.inviteStaffByEmail(
          'farm-id',
          'employee@example.com',
          role,
          'manager-id',
          'FARM_MANAGER',
        ),
      ).resolves.toMatchObject({
        status: 'assigned',
        addedToChatGroup: true,
        email: 'employee@example.com',
      });

      expect(prisma.farmStaff.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            farmId_userId: { farmId: 'farm-id', userId: 'employee-id' },
          },
        }),
      );
      expect(prisma.workspaceMember.upsert).toHaveBeenCalled();
      expect(chatGroupsService.addMemberToFarmChatGroup).toHaveBeenCalledWith(
        'farm-id',
        'employee-id',
        role,
        'Employee',
      );
      expect(emailService.sendFarmInvitationExistingUser).toHaveBeenCalledWith(
        expect.objectContaining({
          toEmail: 'employee@example.com',
          role,
          inviteLink: 'http://localhost:5173/login?inviteToken=invite-token',
        }),
      );
    },
  );

  it('validates farm creation inputs and automatically initializes the farm chat group', async () => {
    const prisma = {
      workspaceMember: {
        findFirst: jest.fn().mockResolvedValue({ id: 'membership-1' }),
      },
      farm: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({
          id: 'new-farm-id',
          name: 'Trại Tôm Bạc Liêu',
          ownerId: 'manager-id',
          workspaceId: 'workspace-id',
        }),
      },
    };
    const chatGroupsService = {
      ensureFarmChatGroup: jest
        .fn()
        .mockResolvedValue({ id: 'group-id', farmId: 'new-farm-id' }),
    };
    const service = new FarmsService(
      prisma as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      chatGroupsService as any,
    );

    await expect(
      service.create({
        workspaceId: 'workspace-id',
        ownerId: 'manager-id',
        name: 'A',
        address: 'Bạc Liêu',
        area: 1000,
      } as any),
    ).rejects.toThrow('Tên trang trại phải có ít nhất 2 ký tự');

    await expect(
      service.create({
        workspaceId: 'workspace-id',
        ownerId: 'manager-id',
        name: 'Trại Tôm Bạc Liêu',
        address: 'Bạc Liêu',
        area: 0,
      } as any),
    ).rejects.toThrow('Diện tích trang trại phải lớn hơn 0 m²');

    const created = await service.create({
      workspaceId: 'workspace-id',
      ownerId: 'manager-id',
      name: '  Trại Tôm Bạc Liêu  ',
      address: '  Bạc Liêu  ',
      area: 1500,
    } as any);

    expect(created.id).toBe('new-farm-id');
    expect(chatGroupsService.ensureFarmChatGroup).toHaveBeenCalledWith(
      'new-farm-id',
    );
  });

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
