import { Module } from '@nestjs/common';
import { IncidentsController } from './incidents.controller.js';
import { IncidentsService } from './incidents.service.js';
import { FarmAccessModule } from '../farm-access/farm-access.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';

@Module({
  imports: [FarmAccessModule, NotificationsModule],
  controllers: [IncidentsController],
  providers: [IncidentsService],
})
export class IncidentsModule {}

