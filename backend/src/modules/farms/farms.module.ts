import { Module } from '@nestjs/common';
import { FarmsController } from './farms.controller';
import { FarmsService } from './farms.service';
import { PrismaModule } from '../../prisma/prisma.module.js';
import { FarmAccessModule } from '../farm-access/farm-access.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { ChatGroupsModule } from '../chat-groups/chat-groups.module.js';

@Module({
  imports: [
    PrismaModule,
    FarmAccessModule,
    AuthModule,
    NotificationsModule,
    ChatGroupsModule,
  ],
  controllers: [FarmsController],
  providers: [FarmsService],
  exports: [FarmsService],
})
export class FarmsModule {}
