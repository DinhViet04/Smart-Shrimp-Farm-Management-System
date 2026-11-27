import { BadRequestException } from '@nestjs/common';
import { ChatHistoryService } from './chat-history.service';

describe('ChatHistoryService', () => {
  const user = { userId: 'u1', role: 'FARMER' };
  const makePrisma = () => ({
    aiChatSession: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue(null),
      upsert: jest.fn().mockResolvedValue({}),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  });

  it('only lists sessions of the current user', async () => {
    const prisma = makePrisma();
    await new ChatHistoryService(prisma as any).list(user);
    expect(prisma.aiChatSession.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'u1' } }),
    );
  });

  it('saves a session for the current user', async () => {
    const prisma = makePrisma();
    const res = await new ChatHistoryService(prisma as any).upsert(user, 'session-1-abc', {
      title: 'Ao 1',
      messages: [{ id: 'm1', sender: 'user', text: 'hi' }],
    });
    expect(res).toEqual({ saved: true });
    expect(prisma.aiChatSession.upsert.mock.calls[0][0].create.userId).toBe('u1');
  });

  it('refuses to overwrite a session owned by another account', async () => {
    const prisma = makePrisma();
    prisma.aiChatSession.findUnique.mockResolvedValue({ userId: 'someone-else' });
    await expect(
      new ChatHistoryService(prisma as any).upsert(user, 'session-1-abc', { messages: [] }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.aiChatSession.upsert).not.toHaveBeenCalled();
  });

  it('only deletes the current user sessions', async () => {
    const prisma = makePrisma();
    await new ChatHistoryService(prisma as any).remove(user, 'session-1-abc');
    expect(prisma.aiChatSession.deleteMany).toHaveBeenCalledWith({ where: { id: 'session-1-abc', userId: 'u1' } });
  });

  it('reports history as unavailable when the table does not exist yet', async () => {
    const prisma = makePrisma();
    prisma.aiChatSession.findMany.mockRejectedValue({ code: 'P2021' });
    await expect(new ChatHistoryService(prisma as any).list(user)).resolves.toEqual({
      available: false,
      sessions: [],
    });
  });
});
