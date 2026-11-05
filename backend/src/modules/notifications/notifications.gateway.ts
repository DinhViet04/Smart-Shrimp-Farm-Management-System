import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { getAllowedOrigins } from '../../config/environment.js';

const allowedOrigins = getAllowedOrigins(process.env);

@WebSocketGateway({
  cors: {
    origin: allowedOrigins,
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
}
