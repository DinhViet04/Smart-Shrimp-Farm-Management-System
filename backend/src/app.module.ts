import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { UsersModule } from './modules/users/users.module.js';
import { FarmsModule } from './modules/farms/farms.module.js';
import { PondsModule } from './modules/ponds/ponds.module.js';
import { CropsModule } from './modules/crops/crops.module.js';
import { FiveTCareModule } from './modules/five-t-care/five-t-care.module.js';
import { EnvironmentModule } from './modules/environment/environment.module.js';
import { IncidentsModule } from './modules/incidents/incidents.module.js';
import { ReportsModule } from './modules/reports/reports.module.js';
import { ChatbotModule } from './modules/chatbot/chatbot.module.js';
import { AdminModule } from './modules/admin/admin.module.js';
import { WaterQualityModule } from './modules/water-quality/water-quality.module.js';

@Module({
  imports: [
    // Global config — loads .env automatically
    ConfigModule.forRoot({ isGlobal: true }),

    // Database
    PrismaModule,

    // Core modules
    AuthModule,
    UsersModule,

    // Domain modules
    FarmsModule,
    PondsModule,
    CropsModule,
    FiveTCareModule,
    EnvironmentModule,
    IncidentsModule,
    ReportsModule,
    ChatbotModule,
    AdminModule,
    WaterQualityModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
