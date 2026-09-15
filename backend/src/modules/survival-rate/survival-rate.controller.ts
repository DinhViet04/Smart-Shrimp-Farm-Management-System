import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Request,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { SurvivalRateService } from './survival-rate.service.js';
import { CreateMortalityLogDto } from './dto/create-mortality-log.dto.js';
import { UpdateHarvestCountDto } from './dto/update-harvest-count.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class SurvivalRateController {
  constructor(private readonly survivalRateService: SurvivalRateService) {}

  /**
   * GET /api/survival-rate/crop/:cropId
   */
  @Get('survival-rate/crop/:cropId')
  @Roles('FARM_MANAGER', 'TECHNICIAN', 'ADMIN', 'FARMER')
  getSurvivalRate(@Request() req: any, @Param('cropId') cropId: string) {
    return this.survivalRateService.calculateSurvivalRate(req.user, cropId);
  }

  /**
   * PATCH /api/survival-rate/crop/:cropId/harvest
   */
  @Patch('survival-rate/crop/:cropId/harvest')
  @Roles('FARM_MANAGER', 'ADMIN')
  updateHarvestCount(
    @Request() req: any,
    @Param('cropId') cropId: string,
    @Body() dto: UpdateHarvestCountDto,
  ) {
    return this.survivalRateService.updateHarvestCount(req.user, cropId, dto);
  }

  /**
   * GET /api/mortality-logs/crop/:cropId
   */
  @Get('mortality-logs/crop/:cropId')
  @Roles('FARM_MANAGER', 'TECHNICIAN', 'ADMIN', 'FARMER')
  getMortalityLogs(@Request() req: any, @Param('cropId') cropId: string) {
    return this.survivalRateService.getMortalityLogs(req.user, cropId);
  }

  /**
   * POST /api/mortality-logs
   */
  @Post('mortality-logs')
  @Roles('FARM_MANAGER', 'TECHNICIAN', 'ADMIN', 'FARMER')
  @HttpCode(HttpStatus.CREATED)
  createMortalityLog(@Request() req: any, @Body() dto: CreateMortalityLogDto) {
    return this.survivalRateService.createMortalityLog(req.user, dto);
  }
}
