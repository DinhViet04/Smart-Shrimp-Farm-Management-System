import { Module } from '@nestjs/common';
import { SurvivalRateController } from './survival-rate.controller.js';
import { SurvivalRateService } from './survival-rate.service.js';
import { PrismaModule } from '../../prisma/prisma.module.js';
import { FarmAccessModule } from '../farm-access/farm-access.module.js';
import { ShrimpSizeModule } from '../shrimp-size/shrimp-size.module.js';

@Module({
  imports: [PrismaModule, FarmAccessModule, ShrimpSizeModule],
  controllers: [SurvivalRateController],
  providers: [SurvivalRateService],
  exports: [SurvivalRateService],
})
export class SurvivalRateModule {}
