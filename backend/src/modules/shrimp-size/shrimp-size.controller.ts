import { Controller, Post, Get, Delete, Param, Body, UseGuards, InternalServerErrorException } from '@nestjs/common';
import { ShrimpSizeService } from './shrimp-size.service.js';
import { CreateShrimpSizeSampleDto } from './dto/create-shrimp-size-sample.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';

@Controller('ponds/:pondId/size-samples')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ShrimpSizeController {
  constructor(private readonly shrimpSizeService: ShrimpSizeService) {}

  @Post()
  @Roles('FARM_MANAGER', 'ADMIN', 'TECHNICIAN')
  async createSample(
    @Param('pondId') pondId: string,
    @Body() dto: CreateShrimpSizeSampleDto,
  ) {
    try {
      return await this.shrimpSizeService.createSample(pondId, dto);
    } catch (error: any) {
      console.error('CREATE_SAMPLE_ERROR:', error);
      throw new InternalServerErrorException(error.message || 'Unknown error');
    }
  }

  @Get()
  @Roles('FARM_MANAGER', 'ADMIN', 'TECHNICIAN', 'FARMER')
  async getSamplesByPond(@Param('pondId') pondId: string) {
    return this.shrimpSizeService.getSamplesByPond(pondId);
  }

  @Get('latest')
  @Roles('FARM_MANAGER', 'ADMIN', 'TECHNICIAN', 'FARMER')
  async getLatestSample(@Param('pondId') pondId: string) {
    return this.shrimpSizeService.getLatestSample(pondId);
  }

  @Delete(':sampleId')
  @Roles('FARM_MANAGER', 'ADMIN', 'TECHNICIAN')
  async deleteSample(
    @Param('pondId') pondId: string,
    @Param('sampleId') sampleId: string,
  ) {
    return this.shrimpSizeService.deleteSample(pondId, sampleId);
  }
}
