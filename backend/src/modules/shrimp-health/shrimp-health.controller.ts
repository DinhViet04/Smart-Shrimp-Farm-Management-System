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
import { ShrimpHealthService } from './shrimp-health.service.js';
import { CreateShrimpHealthDto } from './dto/create-shrimp-health.dto.js';
import { GetShrimpHealthHistoryDto } from './dto/get-shrimp-health-history.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';

@Controller('shrimp-health')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ShrimpHealthController {
  constructor(private readonly shrimpHealthService: ShrimpHealthService) {}

  @Post()
  @Roles('FARMER', 'TECHNICIAN')
  @HttpCode(HttpStatus.CREATED)
  create(@Request() req: any, @Body() dto: CreateShrimpHealthDto) {
    return this.shrimpHealthService.create(req.user, dto);
  }

  @Get('history')
  @Roles('FARMER', 'TECHNICIAN', 'FARM_MANAGER', 'ADMIN')
  getHistory(@Request() req: any, @Query() query: GetShrimpHealthHistoryDto) {
    return this.shrimpHealthService.findHistory(req.user, query);
  }

  @Get(':id')
  @Roles('FARMER', 'TECHNICIAN', 'FARM_MANAGER', 'ADMIN')
  getById(@Request() req: any, @Param('id') id: string) {
    return this.shrimpHealthService.findById(req.user, id);
  }
}
