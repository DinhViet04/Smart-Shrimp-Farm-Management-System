import { Module } from '@nestjs/common';
import { WaterQualityController } from './water-quality.controller.js';
import { WaterQualityService } from './water-quality.service.js';
import { PrismaModule } from '../../prisma/prisma.module.js';
import { FarmAccessModule } from '../farm-access/farm-access.module.js';

/**
 * WaterQualityModule
 *
 * Encapsulates the water quality recording feature (FE-23).
 * Exports WaterQualityService so it can be consumed by:
 *  - Water Quality History module
 *  - Trend Analysis module
 *  - Environmental Warning module
 *  - AI Analysis module
 */
@Module({
  imports: [PrismaModule, FarmAccessModule],
  controllers: [WaterQualityController],
  providers: [WaterQualityService],
  exports: [WaterQualityService],
})
export class WaterQualityModule {}
