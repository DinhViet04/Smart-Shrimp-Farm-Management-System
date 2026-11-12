import { Module } from '@nestjs/common';
import { FarmAccessModule } from '../farm-access/farm-access.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { ChatGroupsController } from './chat-groups.controller.js';
import { ChatGroupsService } from './chat-groups.service.js';

@Module({
  imports: [FarmAccessModule, NotificationsModule],
  controllers: [ChatGroupsController],
  providers: [ChatGroupsService],
  exports: [ChatGroupsService],
})
export class ChatGroupsModule {}

