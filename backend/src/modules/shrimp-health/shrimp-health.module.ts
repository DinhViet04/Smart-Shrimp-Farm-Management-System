import { Module } from '@nestjs/common';
import { ShrimpHealthController } from './shrimp-health.controller.js';
import { ShrimpHealthService } from './shrimp-health.service.js';
import { PrismaModule } from '../../prisma/prisma.module.js';
import { FarmAccessModule } from '../farm-access/farm-access.module.js';

/**
 * ShrimpHealthModule
 *
 * Encapsulates the shrimp health recording feature (FE-21).
 */
@Module({
  imports: [PrismaModule, FarmAccessModule],
  controllers: [ShrimpHealthController],
  providers: [ShrimpHealthService],
  exports: [ShrimpHealthService],
})
export class ShrimpHealthModule {}
