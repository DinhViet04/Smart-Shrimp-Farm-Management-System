import { Role } from '@prisma/client';
import { ChatGroupsService } from './chat-groups.service.js';

describe('ChatGroupsService', () => {
  it('automatically creates a farm chat group with owner and active staff members', async () => {
    const prisma = {
      farm: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'farm-1',
          name: 'Trại Tôm Cà Mau',
          ownerId: 'owner-1',
          staff: [
            { userId: 'farmer-1', role: Role.FARMER, user: { isActive: true } },
            {
              userId: 'tech-1',
              role: Role.TECHNICIAN,
              user: { isActive: true },
            },
          ],
        }),
      },
      chatGroup: {
        findUnique: jest.fn().mockResolvedValue(null),
        upsert: jest.fn().mockResolvedValue({
          id: 'group-1',
          farmId: 'farm-1',
          name: 'Trại Tôm Cà Mau',
        }),
      },
      chatGroupMember: {
        upsert: jest.fn().mockResolvedValue({}),
      },
      chatMessage: {
        create: jest.fn().mockResolvedValue({ id: 'msg-welcome' }),
      },
    };
    const gateway = {
      sendChatGroupUpdatedToUsers: jest.fn(),
      sendChatMessageToUsers: jest.fn(),
    };

    const service = new ChatGroupsService(
      prisma as any,
      {} as any,
      gateway as any,
    );

    const group = await service.ensureFarmChatGroup('farm-1');
    expect(group).toMatchObject({ id: 'group-1', farmId: 'farm-1' });
    expect(prisma.chatGroupMember.upsert).toHaveBeenCalledTimes(3);
    expect(prisma.chatMessage.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          groupId: 'group-1',
          senderId: 'owner-1',
          isSystem: true,
        }),
      }),
    );
  });

  it('adds a new member to the farm chat group and creates a system welcome message', async () => {
    const prisma = {
      farm: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'farm-1',
          name: 'Trại Tôm Cà Mau',
          ownerId: 'owner-1',
          staff: [],
        }),
      },
      chatGroup: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'group-1',
          farmId: 'farm-1',
          name: 'Trại Tôm Cà Mau',
        }),
        upsert: jest.fn().mockResolvedValue({
          id: 'group-1',
          farmId: 'farm-1',
          name: 'Trại Tôm Cà Mau',
        }),
      },
      chatGroupMember: {
        findUnique: jest.fn().mockResolvedValue(null),
        upsert: jest.fn().mockResolvedValue({
          id: 'member-1',
          groupId: 'group-1',
          userId: 'farmer-2',
          role: Role.FARMER,
        }),
        findMany: jest
          .fn()
          .mockResolvedValue([{ userId: 'owner-1' }, { userId: 'farmer-2' }]),
      },
      chatMessage: {
        create: jest.fn().mockResolvedValue({
          id: 'msg-join',
          groupId: 'group-1',
          content:
            'Nguyễn Văn A (Nông dân) đã được tự động thêm vào nhóm chat trang trại.',
          isSystem: true,
        }),
      },
    };
    const gateway = {
      sendChatGroupUpdatedToUsers: jest.fn(),
      sendChatMessageToUsers: jest.fn(),
    };

    const service = new ChatGroupsService(
      prisma as any,
      {} as any,
      gateway as any,
    );

    await service.addMemberToFarmChatGroup(
      'farm-1',
      'farmer-2',
      Role.FARMER,
      'Nguyễn Văn A',
    );

    expect(prisma.chatGroupMember.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          groupId_userId: { groupId: 'group-1', userId: 'farmer-2' },
        },
        create: expect.objectContaining({
          groupId: 'group-1',
          userId: 'farmer-2',
          role: Role.FARMER,
        }),
      }),
    );
    expect(gateway.sendChatGroupUpdatedToUsers).toHaveBeenCalledWith(
      ['owner-1', 'farmer-2'],
      expect.objectContaining({ groupId: 'group-1', farmId: 'farm-1' }),
    );
  });

  it('validates non-empty content when sending a message', async () => {
    const service = new ChatGroupsService({} as any, {} as any, {} as any);
    await expect(
      service.sendMessage('group-1', '   ', {
        userId: 'owner-1',
        role: 'FARM_MANAGER',
      }),
    ).rejects.toThrow('Nội dung tin nhắn không được để trống');
  });

  it('creates a 1-on-1 direct chat group between users sharing a farm', async () => {
    const prisma = {
      user: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce({
            id: 'owner-1',
            role: Role.FARM_MANAGER,
            isActive: true,
          })
          .mockResolvedValueOnce({
            id: 'tech-1',
            fullName: 'Kỹ thuật viên A',
            role: Role.TECHNICIAN,
            isActive: true,
          }),
      },
      farm: {
        findFirst: jest.fn().mockResolvedValue({ id: 'farm-1' }),
      },
      chatGroup: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({
          id: 'dm-1',
          type: 'DIRECT',
          farmId: null,
          directKey: 'owner-1:tech-1',
          name: 'Kỹ thuật viên A',
          createdAt: new Date(),
          updatedAt: new Date(),
          farm: null,
          members: [
            { id: 'm1', userId: 'owner-1', role: Role.FARM_MANAGER, joinedAt: new Date(), user: { id: 'owner-1' } },
            { id: 'm2', userId: 'tech-1', role: Role.TECHNICIAN, joinedAt: new Date(), user: { id: 'tech-1' } },
          ],
          messages: [],
        }),
      },
    };
    const gateway = {
      sendChatGroupUpdatedToUsers: jest.fn(),
    };
    const service = new ChatGroupsService(
      prisma as any,
      {} as any,
      gateway as any,
    );

    const dm = await service.createOrGetDirectGroup('tech-1', {
      userId: 'owner-1',
      role: Role.FARM_MANAGER,
    });

    expect(dm).toMatchObject({
      id: 'dm-1',
      type: 'DIRECT',
      directKey: 'owner-1:tech-1',
    });
    expect(gateway.sendChatGroupUpdatedToUsers).toHaveBeenCalledWith(
      ['owner-1', 'tech-1'],
      { groupId: 'dm-1', farmId: null },
    );
  });

  it('rejects self-DM or DM with users not sharing any farm', async () => {
    const prisma = {
      user: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce({
            id: 'owner-1',
            role: Role.FARM_MANAGER,
            isActive: true,
          })
          .mockResolvedValueOnce({
            id: 'stranger-1',
            fullName: 'Người ngoài',
            role: Role.FARMER,
            isActive: true,
          }),
      },
      farm: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
    };
    const service = new ChatGroupsService(prisma as any, {} as any, {} as any);

    await expect(
      service.createOrGetDirectGroup('owner-1', {
        userId: 'owner-1',
        role: Role.FARM_MANAGER,
      }),
    ).rejects.toThrow('Không thể tự nhắn tin riêng cho chính mình');

    await expect(
      service.createOrGetDirectGroup('stranger-1', {
        userId: 'owner-1',
        role: Role.FARM_MANAGER,
      }),
    ).rejects.toThrow('Chỉ có thể nhắn riêng với thành viên cùng trang trại');
  });
});
