import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { WaterQualityService } from './water-quality.service.js';
import { CreateWaterQualityDto } from './dto/create-water-quality.dto.js';
import { GetWaterQualityHistoryDto } from './dto/get-water-quality-history.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';

@Controller('water-quality')
@UseGuards(JwtAuthGuard, RolesGuard)
export class WaterQualityController {
  constructor(private readonly waterQualityService: WaterQualityService) {}

  @Post()
  @Roles('TECHNICIAN', 'ADMIN')
  @HttpCode(HttpStatus.CREATED)
  create(@Request() req: any, @Body() dto: CreateWaterQualityDto) {
    return this.waterQualityService.create(req.user, dto);
  }

  @Get('history')
  @Roles('FARMER', 'FARM_MANAGER', 'TECHNICIAN', 'ADMIN')
  getHistory(@Request() req: any, @Query() query: GetWaterQualityHistoryDto) {
    return this.waterQualityService.findHistory(req.user, query);
  }

  @Get('pond/:pondId')
  @Roles('FARMER', 'FARM_MANAGER', 'TECHNICIAN', 'ADMIN')
  findAllByPond(@Request() req: any, @Param('pondId') pondId: string) {
    return this.waterQualityService.findAllByPond(pondId, req.user);
  }

  @Get('trends')
  @Roles('FARMER', 'FARM_MANAGER', 'TECHNICIAN', 'ADMIN')
  getTrends(
    @Request() req: any,
    @Query('pondId') pondId: string,
    @Query('fromDate') fromDate: string,
    @Query('toDate') toDate: string,
  ) {
    return this.waterQualityService.findTrends(
      pondId,
      fromDate,
      toDate,
      req.user,
    );
  }
}
