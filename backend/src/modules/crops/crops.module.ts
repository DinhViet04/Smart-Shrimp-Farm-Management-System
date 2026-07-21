import { Module } from '@nestjs/common';
import { CropsController } from './crops.controller.js';
import { CropsService } from './crops.service.js';
import { PrismaModule } from '../../prisma/prisma.module.js';
import { FarmAccessModule } from '../farm-access/farm-access.module.js';

@Module({
  imports: [PrismaModule, FarmAccessModule],
  controllers: [CropsController],
  providers: [CropsService],
  exports: [CropsService],
})
export class CropsModule {}
