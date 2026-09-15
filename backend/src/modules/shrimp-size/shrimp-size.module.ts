import { Module } from '@nestjs/common';
import { ShrimpSizeController } from './shrimp-size.controller.js';
import { ShrimpSizeService } from './shrimp-size.service.js';
import { PrismaModule } from '../../prisma/prisma.module.js';

@Module({
  imports: [PrismaModule],
  controllers: [ShrimpSizeController],
  providers: [ShrimpSizeService],
  exports: [ShrimpSizeService],
})
export class ShrimpSizeModule {}
