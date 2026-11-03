import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module.js';
import { MarketPricesController } from './market-prices.controller.js';
import { MarketPricesService } from './market-prices.service.js';

@Module({
  imports: [PrismaModule],
  controllers: [MarketPricesController],
  providers: [MarketPricesService],
  exports: [MarketPricesService],
})
export class MarketPricesModule {}

