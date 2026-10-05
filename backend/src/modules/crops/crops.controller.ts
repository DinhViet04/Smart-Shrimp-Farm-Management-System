import {
  Controller,
  Get,
  Post,
  Patch,
  Put,
  Delete,
  Param,
  Body,
  Query,
  Request,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { CropsService } from './crops.service.js';
import { CreateCropDto } from './dto/create-crop.dto.js';
import { UpdateCropDto } from './dto/update-crop.dto.js';
import { SplitCropDto } from './dto/split-crop.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';

@Controller('crops')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CropsController {
  constructor(private readonly cropsService: CropsService) {}

  @Get()
  @Roles('FARM_MANAGER', 'FARMER', 'TECHNICIAN', 'ADMIN')
  findAll(
    @Request() req: any,
    @Query('pondId') pondId?: string,
    @Query('status') status?: string,
    @Query('summary') summary?: string,
  ) {
    return this.cropsService.findAll(req.user, {
      pondId,
      status,
      summary: summary === 'true',
    });
  }

  @Get('analytics/growth-trajectory')
  @Roles('FARM_MANAGER', 'FARMER', 'TECHNICIAN', 'ADMIN')
  getGrowthTrajectory(
    @Request() req: any,
    @Query('farmId') farmId?: string,
    @Query('pondId') pondId?: string,
    @Query('cropId') cropId?: string,
    @Query('timeRange') timeRange?: string,
    @Query('year') year?: string,
  ) {
    return this.cropsService.getGrowthTrajectory90d(req.user, {
      farmId,
      pondId,
      cropId,
      timeRange,
      year,
    });
  }

  @Get(':id')
  @Roles('FARM_MANAGER', 'FARMER', 'TECHNICIAN', 'ADMIN')
  findOne(@Request() req: any, @Param('id') id: string) {
    return this.cropsService.findOne(req.user, id);
  }

  @Post()
  @Roles('FARM_MANAGER', 'FARMER')
  @HttpCode(HttpStatus.CREATED)
  create(@Request() req: any, @Body() dto: CreateCropDto) {
    return this.cropsService.create(req.user, dto);
  }

  @Put(':id')
  @Roles('FARM_MANAGER', 'FARMER')
  update(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateCropDto,
  ) {
    return this.cropsService.update(req.user, id, dto);
  }

  @Post(':id/split')
  @Roles('FARM_MANAGER', 'FARMER')
  @HttpCode(HttpStatus.OK)
  split(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: SplitCropDto,
  ) {
    return this.cropsService.splitCrop(req.user, id, dto);
  }

  @Patch(':id/harvest')
  @Roles('FARM_MANAGER', 'ADMIN')
  harvest(@Request() req: any, @Param('id') id: string) {
    return this.cropsService.harvest(req.user, id);
  }

  @Delete(':id')
  @Roles('FARM_MANAGER', 'FARMER')
  remove(@Request() req: any, @Param('id') id: string) {
    return this.cropsService.remove(req.user, id);
  }
}
