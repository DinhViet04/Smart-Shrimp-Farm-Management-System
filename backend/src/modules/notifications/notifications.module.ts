import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service.js';
import { NotificationsController } from './notifications.controller.js';
import { NotificationsGateway } from './notifications.gateway.js';
import { ExpoPushService } from './expo-push.service.js';
import { JwtModule } from '@nestjs/jwt';

@Module({
  imports: [JwtModule],
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationsGateway, ExpoPushService],
  exports: [NotificationsService, NotificationsGateway, ExpoPushService],
})
export class NotificationsModule {}
