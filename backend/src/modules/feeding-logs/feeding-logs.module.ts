import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { FarmAccessModule } from '../farm-access/farm-access.module';
import { FeedingLogsController } from './feeding-logs.controller';
import { FeedingLogsService } from './feeding-logs.service';

@Module({
  imports: [PrismaModule, FarmAccessModule],
  controllers: [FeedingLogsController],
  providers: [FeedingLogsService],
  exports: [FeedingLogsService],
})
export class FeedingLogsModule {}
