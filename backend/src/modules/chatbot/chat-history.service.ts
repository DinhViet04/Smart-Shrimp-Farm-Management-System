import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthUser } from '../farm-access/farm-access.service';

/** Giới hạn để một tài khoản không làm phình bảng lịch sử */
const MAX_SESSIONS_RETURNED = 100;
const MAX_MESSAGES_PER_SESSION = 300;
const MAX_SESSION_BYTES = 1_500_000;
const SESSION_ID_PATTERN = /^[A-Za-z0-9_-]{1,80}$/;

export interface ChatSessionPayload {
  title?: string;
  messages?: unknown[];
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Lưu lịch sử hội thoại với Trợ lý AI theo tài khoản (giống ChatGPT / Gemini):
 * đăng nhập lại hoặc đổi máy vẫn thấy các cuộc trò chuyện cũ trong tab Lịch sử.
 * Mỗi tài khoản chỉ đọc / ghi / xoá được phiên của chính mình.
 */
@Injectable()
export class ChatHistoryService {
  private readonly logger = new Logger(ChatHistoryService.name);

  constructor(private readonly prisma: PrismaService) {}

  private uid(user: AuthUser) {
    return user.userId || (user as any).id;
  }

  /** Bảng chưa được tạo trên DB (P2021) -> coi như chưa có lịch sử, không làm hỏng khung chat */
  private isMissingTable(err: any) {
    if (err?.code === 'P2021') {
      this.logger.warn('Bảng ai_chat_sessions chưa tồn tại — lịch sử chat AI tạm thời chỉ lưu trên trình duyệt.');
      return true;
    }
    return false;
  }

  async list(user: AuthUser) {
    try {
      const rows = await this.prisma.aiChatSession.findMany({
        where: { userId: this.uid(user) },
        orderBy: { updatedAt: 'desc' },
        take: MAX_SESSIONS_RETURNED,
      });
      return {
        available: true,
        sessions: rows.map((r) => ({
          id: r.id,
          title: r.title,
          messages: r.messages,
          createdAt: r.createdAt.toISOString(),
          updatedAt: r.updatedAt.toISOString(),
        })),
      };
    } catch (err) {
      if (this.isMissingTable(err)) return { available: false, sessions: [] };
      throw err;
    }
  }

  async upsert(user: AuthUser, id: string, body: ChatSessionPayload) {
    if (!SESSION_ID_PATTERN.test(id || '')) {
      throw new BadRequestException('Mã cuộc trò chuyện không hợp lệ.');
    }
    if (!Array.isArray(body?.messages)) {
      throw new BadRequestException('Thiếu danh sách tin nhắn.');
    }
    const messages = body.messages.slice(-MAX_MESSAGES_PER_SESSION);
    if (JSON.stringify(messages).length > MAX_SESSION_BYTES) {
      throw new BadRequestException('Cuộc trò chuyện quá dài để lưu.');
    }
    const title = String(body.title || 'Cuộc trò chuyện mới').slice(0, 200);
    const updatedAt = this.parseDate(body.updatedAt) ?? new Date();
    const uid = this.uid(user);

    try {
      const existing = await this.prisma.aiChatSession.findUnique({
        where: { id },
        select: { userId: true },
      });
      // Không cho ghi đè phiên của tài khoản khác (id do client sinh)
      if (existing && existing.userId !== uid) {
        throw new BadRequestException('Mã cuộc trò chuyện không hợp lệ.');
      }
      await this.prisma.aiChatSession.upsert({
        where: { id },
        create: {
          id,
          userId: uid,
          title,
          messages: messages as Prisma.InputJsonValue,
          createdAt: this.parseDate(body.createdAt) ?? new Date(),
          updatedAt,
        },
        update: { title, messages: messages as Prisma.InputJsonValue, updatedAt },
      });
      return { saved: true };
    } catch (err) {
      if (this.isMissingTable(err)) return { saved: false };
      throw err;
    }
  }

  async remove(user: AuthUser, id: string) {
    try {
      await this.prisma.aiChatSession.deleteMany({ where: { id, userId: this.uid(user) } });
      return { deleted: true };
    } catch (err) {
      if (this.isMissingTable(err)) return { deleted: false };
      throw err;
    }
  }

  async clear(user: AuthUser) {
    try {
      await this.prisma.aiChatSession.deleteMany({ where: { userId: this.uid(user) } });
      return { deleted: true };
    } catch (err) {
      if (this.isMissingTable(err)) return { deleted: false };
      throw err;
    }
  }

  private parseDate(value?: string) {
    if (!value) return null;
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
}
