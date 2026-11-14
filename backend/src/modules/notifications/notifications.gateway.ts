import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { getAllowedOrigins } from '../../config/environment.js';

const allowedOrigins = getAllowedOrigins(process.env);

@WebSocketGateway({
  cors: {
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      const isAllowed =
        allowedOrigins.includes(origin) ||
        (process.env.NODE_ENV !== 'production' &&
          /^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+)(:\d+)?$/.test(
            origin,
          ));
      return callback(null, isAllowed);
    },
    credentials: true,
  },
  namespace: '/notifications',
})
export class NotificationsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  // Map of userId to their active socket IDs
  private userSockets: Map<string, Set<string>> = new Map();
  private chatMessageHandler?: (payload: {
    groupId: string;
    content: string;
    attachmentUrl?: string;
    attachmentName?: string;
    attachmentType?: string;
    attachmentSize?: number;
    replyToId?: string;
    user: { userId: string; role: any };
  }) => Promise<any>;

  private chatReceiptHandler?: (payload: {
    groupId: string;
    type: 'DELIVERED' | 'READ';
    user: { userId: string; role: any };
  }) => Promise<any>;

  registerChatMessageHandler(
    handler: (payload: {
      groupId: string;
      content: string;
      attachmentUrl?: string;
      attachmentName?: string;
      attachmentType?: string;
      attachmentSize?: number;
      replyToId?: string;
      user: { userId: string; role: any };
    }) => Promise<any>,
  ) {
    this.chatMessageHandler = handler;
  }

  registerChatReceiptHandler(
    handler: (payload: {
      groupId: string;
      type: 'DELIVERED' | 'READ';
      user: { userId: string; role: any };
    }) => Promise<any>,
  ) {
    this.chatReceiptHandler = handler;
  }

  @SubscribeMessage('sendChatMessage')
  async handleSendChatMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    payload: {
      groupId?: string;
      content?: string;
      attachmentUrl?: string;
      attachmentName?: string;
      attachmentType?: string;
      attachmentSize?: number;
      replyToId?: string;
    },
  ) {
    const user = client.data?.user;
    const userId = user?.sub || user?.userId || user?.id;
    if (!userId) {
      return { ok: false, error: 'Chưa xác thực kết nối' };
    }
    if (!this.chatMessageHandler) {
      return { ok: false, error: 'Dịch vụ chat chưa sẵn sàng' };
    }
    try {
      const message = await this.chatMessageHandler({
        groupId: payload?.groupId || '',
        content: payload?.content || '',
        attachmentUrl: payload?.attachmentUrl,
        attachmentName: payload?.attachmentName,
        attachmentType: payload?.attachmentType,
        attachmentSize: payload?.attachmentSize,
        replyToId: payload?.replyToId,
        user: { userId, role: user.role },
      });
      return { ok: true, message };
    } catch (err: any) {
      return {
        ok: false,
        error: err?.message || 'Không thể gửi tin nhắn',
      };
    }
  }

  @SubscribeMessage('markChatReceipt')
  async handleMarkChatReceipt(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    payload: {
      groupId?: string;
      type?: 'DELIVERED' | 'READ';
    },
  ) {
    const user = client.data?.user;
    const userId = user?.sub || user?.userId || user?.id;
    if (!userId || !this.chatReceiptHandler || !payload?.groupId) {
      return { ok: false };
    }
    try {
      await this.chatReceiptHandler({
        groupId: payload.groupId,
        type: payload.type === 'READ' ? 'READ' : 'DELIVERED',
        user: { userId, role: user.role },
      });
      return { ok: true };
    } catch {
      return { ok: false };
    }
  }

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const token =
        client.handshake.auth?.token ||
        client.handshake.headers?.authorization?.split(' ')[1];
      if (!token) {
        client.disconnect();
        return;
      }

      const payload = await this.jwtService.verifyAsync(token, {
        secret: this.configService.get<string>('JWT_SECRET'),
      });

      const userId = payload.sub || payload.userId || payload.id;
      client.data.user = payload; // store user info in socket

      // Join a room specific to this user to easily emit to all their devices
      await client.join(`user_${userId}`);
      if (payload.role === 'ADMIN') await client.join('role_ADMIN');

      // Also track in memory if needed
      if (!this.userSockets.has(userId)) {
        this.userSockets.set(userId, new Set());
      }
      this.userSockets.get(userId)!.add(client.id);
    } catch {
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    const userId =
      client.data.user?.sub || client.data.user?.userId || client.data.user?.id;
    if (userId && this.userSockets.has(userId)) {
      this.userSockets.get(userId)!.delete(client.id);
      if (this.userSockets.get(userId)!.size === 0) {
        this.userSockets.delete(userId);
      }
    }
  }

  /**
   * Emit a notification to a specific user
   */
  sendNotificationToUser(userId: string, notification: any) {
    this.server.to(`user_${userId}`).emit('newNotification', notification);
  }

  sendSupportTicketCreated(ticket: unknown) {
    this.server.to('role_ADMIN').emit('supportTicketCreated', ticket);
  }

  sendSupportTicketUpdated(requesterId: string, ticket: unknown) {
    this.server
      .to('role_ADMIN')
      .to(`user_${requesterId}`)
      .emit('supportTicketUpdated', ticket);
  }

  sendChatMessageToUsers(userIds: string[], message: unknown) {
    if (!this.server || !userIds?.length) return;
    const rooms = Array.from(new Set(userIds)).map((id) => `user_${id}`);
    this.server.to(rooms).emit('newChatMessage', message);
  }

  sendChatReceiptToUsers(userIds: string[], receipt: unknown) {
    if (!this.server || !userIds?.length) return;
    const rooms = Array.from(new Set(userIds)).map((id) => `user_${id}`);
    this.server.to(rooms).emit('chatReceiptUpdated', receipt);
  }

  sendChatGroupUpdatedToUsers(userIds: string[], group: unknown) {
    if (!this.server || !userIds?.length) return;
    const rooms = Array.from(new Set(userIds)).map((id) => `user_${id}`);
    this.server.to(rooms).emit('chatGroupUpdated', group);
  }

  getRealtimeStats() {
    let totalConnections = 0;
    this.userSockets.forEach((sockets) => {
      totalConnections += sockets.size;
    });
    return {
      isReady: Boolean(this.server),
      onlineUsers: this.userSockets.size,
      totalConnections,
    };
  }
}
