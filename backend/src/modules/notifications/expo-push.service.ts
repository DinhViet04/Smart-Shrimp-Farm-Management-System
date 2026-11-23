import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';

export interface PushNotificationPayload {
  id?: string;
  title?: string;
  message?: string;
  level?: string;
  farmId?: string | null;
  pondId?: string | null;
  incidentId?: string | null;
  category?: string;
}

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const EXPO_TOKEN_REGEX = /^(ExponentPushToken|ExpoPushToken)\[[^\]]+\]$/;

@Injectable()
export class ExpoPushService {
  private readonly logger = new Logger(ExpoPushService.name);

  constructor(private readonly prisma: PrismaService) {}

  isValidExpoPushToken(token: string): boolean {
    return typeof token === 'string' && EXPO_TOKEN_REGEX.test(token.trim());
  }

  async registerToken(userId: string, token: string, platform?: string) {
    const trimmed = token?.trim();
    if (!this.isValidExpoPushToken(trimmed)) {
      return { registered: false, reason: 'INVALID_TOKEN' as const };
    }

    await this.prisma.devicePushToken.upsert({
      where: { token: trimmed },
      update: {
        userId,
        platform: platform || null,
      },
      create: {
        userId,
        token: trimmed,
        platform: platform || null,
      },
    });

    return { registered: true };
  }

  async unregisterToken(userId: string, token: string) {
    const trimmed = token?.trim();
    if (!trimmed) return { removed: false };

    await this.prisma.devicePushToken.deleteMany({
      where: {
        userId,
        token: trimmed,
      },
    });

    return { removed: true };
  }

  async sendToUser(userId: string, notification: PushNotificationPayload) {
    if (!userId || !this.prisma?.devicePushToken) return;

    try {
      const devices = await this.prisma.devicePushToken.findMany({
        where: { userId },
        select: { token: true },
      });

      const tokens = devices
        .map((d) => d.token)
        .filter((t) => this.isValidExpoPushToken(t));

      if (tokens.length === 0) return;

      const isDanger = notification.level === 'DANGER';
      const messages = tokens.map((to) => ({
        to,
        sound: 'default',
        title: notification.title || 'SSFM Thông báo',
        body: notification.message || '',
        priority: isDanger ? 'high' : 'default',
        channelId: isDanger ? 'alerts-danger' : 'alerts-default',
        data: {
          notificationId: notification.id ?? null,
          level: notification.level ?? 'INFO',
          farmId: notification.farmId ?? null,
          pondId: notification.pondId ?? null,
          incidentId: notification.incidentId ?? null,
          category: notification.category ?? 'ALERT',
        },
      }));

      const headers: Record<string, string> = {
        Accept: 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      };
      if (process.env.EXPO_ACCESS_TOKEN) {
        headers.Authorization = `Bearer ${process.env.EXPO_ACCESS_TOKEN}`;
      }

      const response = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify(messages),
      });

      if (!response.ok) {
        this.logger.warn(
          `Expo Push API returned HTTP ${response.status} for user ${userId}`,
        );
        return;
      }

      const result = (await response.json()) as {
        data?: Array<{
          status?: string;
          details?: { error?: string };
        }>;
      };

      const tickets = Array.isArray(result?.data) ? result.data : [];
      const invalidTokens: string[] = [];
      tickets.forEach((ticket, idx) => {
        if (
          ticket?.status === 'error' &&
          ticket?.details?.error === 'DeviceNotRegistered' &&
          tokens[idx]
        ) {
          invalidTokens.push(tokens[idx]);
        }
      });

      if (invalidTokens.length > 0) {
        await this.prisma.devicePushToken.deleteMany({
          where: { token: { in: invalidTokens } },
        });
      }
    } catch (error) {
      this.logger.warn(
        `Failed to send Expo push notification to user ${userId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}
