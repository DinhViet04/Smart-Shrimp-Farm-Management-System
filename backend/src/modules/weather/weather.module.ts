import { Module } from '@nestjs/common';
import { WeatherController } from './weather.controller.js';
import { WeatherService } from './weather.service.js';
import { PrismaModule } from '../../prisma/prisma.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';

@Module({
  imports: [PrismaModule, NotificationsModule],
  controllers: [WeatherController],
  providers: [WeatherService],
  exports: [WeatherService],
})
export class WeatherModule {}
