import { Module } from '@nestjs/common';
import { ShrimpSizeController } from './shrimp-size.controller.js';
import { ShrimpSizeService } from './shrimp-size.service.js';
import { PrismaModule } from '../../prisma/prisma.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';

@Module({
  imports: [PrismaModule, NotificationsModule],
  controllers: [ShrimpSizeController],
  providers: [ShrimpSizeService],
  exports: [ShrimpSizeService],
})
export class ShrimpSizeModule {}
