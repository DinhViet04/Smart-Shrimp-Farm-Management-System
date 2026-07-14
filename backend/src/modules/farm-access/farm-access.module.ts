import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module.js';
import { FarmAccessService } from './farm-access.service.js';

@Module({
  imports: [PrismaModule],
  providers: [FarmAccessService],
  exports: [FarmAccessService],
})
export class FarmAccessModule {}
