import { Module } from '@nestjs/common';
import { ChatbotController } from './chatbot.controller';
import { ChatbotService } from './chatbot.service';
import { WeatherService } from './weather.service';
import { AgentActionService } from './agent-action.service';
import { RoleContextService } from './role-context.service';
import { FarmAccessModule } from '../farm-access/farm-access.module';
import { FarmsModule } from '../farms/farms.module';
import { PondsModule } from '../ponds/ponds.module';
import { CropsModule } from '../crops/crops.module';

@Module({
  imports: [FarmAccessModule, FarmsModule, PondsModule, CropsModule],
  controllers: [ChatbotController],
  providers: [ChatbotService, WeatherService, AgentActionService, RoleContextService],
  exports: [WeatherService, AgentActionService, RoleContextService],
})
export class ChatbotModule {}
