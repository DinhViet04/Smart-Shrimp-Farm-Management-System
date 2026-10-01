import { Controller, Get, Put, Delete, Param, UseGuards, Request } from '@nestjs/common';
import { NotificationsService } from './notifications.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  async getUserNotifications(@Request() req: any) {
    const userId = req.user.userId || req.user.sub || req.user.id;
    return this.notificationsService.getUserNotifications(userId);
  }

  @Get('unread-count')
  async getUnreadCount(@Request() req: any) {
    const userId = req.user.userId || req.user.sub || req.user.id;
    const count = await this.notificationsService.getUnreadCount(userId);
    return { count };
  }

  @Put(':id/read')
  async markAsRead(@Request() req: any, @Param('id') id: string) {
    const userId = req.user.userId || req.user.sub || req.user.id;
    await this.notificationsService.markAsRead(userId, id);
    return { success: true };
  }

  @Put('read-all')
  async markAllAsRead(@Request() req: any) {
    const userId = req.user.userId || req.user.sub || req.user.id;
    await this.notificationsService.markAllAsRead(userId);
    return { success: true };
  }

  @Delete(':id')
  async deleteNotification(@Request() req: any, @Param('id') id: string) {
    const userId = req.user.userId || req.user.sub || req.user.id;
    await this.notificationsService.deleteNotification(userId, id);
    return { success: true };
  }

  @Delete()
  async clearAllNotifications(@Request() req: any) {
    const userId = req.user.userId || req.user.sub || req.user.id;
    await this.notificationsService.clearAllNotifications(userId);
    return { success: true };
  }
}
