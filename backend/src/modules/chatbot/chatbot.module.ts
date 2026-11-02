import { Module } from '@nestjs/common';
import { ChatbotController } from './chatbot.controller';
import { ChatbotService } from './chatbot.service';
import { WeatherService } from './weather.service';
import { FarmAccessModule } from '../farm-access/farm-access.module';

@Module({
  imports: [FarmAccessModule],
  controllers: [ChatbotController],
  providers: [ChatbotService, WeatherService],
  exports: [WeatherService],
})
export class ChatbotModule {}
