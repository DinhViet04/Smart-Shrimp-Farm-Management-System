import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  Query,
} from '@nestjs/common';
import { WaterQualityService } from './water-quality.service.js';
import { CreateWaterQualityDto } from './dto/create-water-quality.dto.js';
import { GetWaterQualityHistoryDto } from './dto/get-water-quality-history.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';

/**
 * REST controller for water quality records.
 *
 * Base path: /api/water-quality
 * Security:  JWT + Role-based (FARMER only for write operations)
 */
@Controller('water-quality')
@UseGuards(JwtAuthGuard, RolesGuard)
export class WaterQualityController {
  constructor(private readonly waterQualityService: WaterQualityService) {}

  /**
   * POST /api/water-quality
   *
   * Records a new set of water quality parameters for a pond.
   * Only Farmers who own the target pond's farm may create records.
   *
   * @returns 201 Created — { id: string, message: string }
   */
  @Post()
  @Roles('FARMER', 'FARM_MANAGER')
  @HttpCode(HttpStatus.CREATED)
  create(@Request() req: any, @Body() dto: CreateWaterQualityDto) {
    return this.waterQualityService.create(req.user.userId, dto);
  }

  /**
   * GET /api/water-quality/history
   *
   * Returns paginated, filtered, and sorted water quality records history.
   *
   * @returns 200 OK — Paginated history
   */
  @Get('history')
  @Roles('FARMER', 'FARM_MANAGER')
  getHistory(@Request() req: any, @Query() query: GetWaterQualityHistoryDto) {
    return this.waterQualityService.findHistory(req.user.userId, query);
  }

  /**
   * GET /api/water-quality/pond/:pondId
   *
   * Returns all water quality records for a pond, ordered by recordTime desc.
   * Used by: Water Quality History, Trend Analysis, Environmental Warning,
   *          AI Analysis modules.
   *
   * @returns 200 OK — WaterQualityRecord[]
   */
  @Get('pond/:pondId')
  @Roles('FARMER', 'FARM_MANAGER', 'ADMIN')
  findAllByPond(@Request() req: any, @Param('pondId') pondId: string) {
    return this.waterQualityService.findAllByPond(pondId, req.user.userId);
  }
}
