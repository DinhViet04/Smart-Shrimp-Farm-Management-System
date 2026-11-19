import { Module } from '@nestjs/common';
import { ChatbotController } from './chatbot.controller';
import { ChatbotService } from './chatbot.service';
import { WeatherService } from './weather.service';
import { AgentActionService } from './agent-action.service';
import { RoleContextService } from './role-context.service';
import { FileParserService } from './file-parser.service';
import { ChatDataScopeService } from './data-scope/chat-data-scope.service';
import { ChatToolsService } from './data-scope/chat-tools.service';
import { FarmAccessModule } from '../farm-access/farm-access.module';
import { FarmsModule } from '../farms/farms.module';
import { PondsModule } from '../ponds/ponds.module';
import { CropsModule } from '../crops/crops.module';
import { InventoryModule } from '../inventory/inventory.module';
import { WaterQualityModule } from '../water-quality/water-quality.module';
import { MarketPricesModule } from '../market-prices/market-prices.module';
import { WaterRecordAgentService } from './water-record-agent.service';

@Module({
  imports: [FarmAccessModule, FarmsModule, PondsModule, CropsModule, InventoryModule, WaterQualityModule, MarketPricesModule],
  controllers: [ChatbotController],
  providers: [ChatbotService, WeatherService, AgentActionService, RoleContextService, FileParserService, ChatDataScopeService, ChatToolsService, WaterRecordAgentService],
  exports: [WeatherService, AgentActionService, RoleContextService, FileParserService],
})
export class ChatbotModule {}
