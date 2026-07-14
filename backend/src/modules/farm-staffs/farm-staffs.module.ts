import { Module } from '@nestjs/common';
import { FarmStaffsController } from './farm-staffs.controller.js';
import { FarmStaffsService } from './farm-staffs.service.js';
import { PrismaModule } from '../../prisma/prisma.module.js';
import { FarmAccessModule } from '../farm-access/farm-access.module.js';

@Module({
  imports: [PrismaModule, FarmAccessModule],
  controllers: [FarmStaffsController],
  providers: [FarmStaffsService],
})
export class FarmStaffsModule {}
