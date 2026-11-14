import { Module } from '@nestjs/common';
import { FarmStaffsController } from './farm-staffs.controller.js';
import { FarmStaffsService } from './farm-staffs.service.js';
import { PrismaModule } from '../../prisma/prisma.module.js';
import { FarmAccessModule } from '../farm-access/farm-access.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { ChatGroupsModule } from '../chat-groups/chat-groups.module.js';

@Module({
  imports: [PrismaModule, FarmAccessModule, NotificationsModule, ChatGroupsModule],
  controllers: [FarmStaffsController],
  providers: [FarmStaffsService],
})
export class FarmStaffsModule {}
