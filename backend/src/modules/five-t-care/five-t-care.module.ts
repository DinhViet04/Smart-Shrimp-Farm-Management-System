import { Module } from '@nestjs/common';
import { FiveTCareController } from './five-t-care.controller';
import { FiveTCareService } from './five-t-care.service';

@Module({
  controllers: [FiveTCareController],
  providers: [FiveTCareService],
})
export class FiveTCareModule {}
