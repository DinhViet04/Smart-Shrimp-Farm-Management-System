import { Module } from '@nestjs/common';
import { PondsController } from './ponds.controller';
import { PondsService } from './ponds.service';
import { PrismaModule } from '../../prisma/prisma.module.js';
import { FarmAccessModule } from '../farm-access/farm-access.module.js';

@Module({
  imports: [PrismaModule, FarmAccessModule],
  controllers: [PondsController],
  providers: [PondsService]
})
export class PondsModule {}
