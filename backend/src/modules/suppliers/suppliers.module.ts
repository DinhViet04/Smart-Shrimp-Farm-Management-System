import { Module } from '@nestjs/common';
import { SuppliersController } from './suppliers.controller.js';
import { SuppliersService } from './suppliers.service.js';
import { PrismaModule } from '../../prisma/prisma.module.js';
import { FarmAccessModule } from '../farm-access/farm-access.module.js';

@Module({
  imports: [PrismaModule, FarmAccessModule],
  controllers: [SuppliersController],
  providers: [SuppliersService],
  exports: [SuppliersService],
})
export class SuppliersModule {}
