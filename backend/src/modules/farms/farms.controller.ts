import { Controller, Get, Post, Body, Put, Param, Delete, Query, UseGuards, Request } from '@nestjs/common';
import { FarmsService } from './farms.service.js';
import { CreateFarmDto } from './dto/create-farm.dto.js';
import { UpdateFarmDto } from './dto/update-farm.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';

@Controller('farms')
@UseGuards(JwtAuthGuard, RolesGuard)
export class FarmsController {
  constructor(private readonly farmsService: FarmsService) {}

  @Get()
  @Roles('FARM_MANAGER', 'FARMER', 'ADMIN')
  findAll(@Query('search') search: string, @Query('status') status: string) {
    return this.farmsService.findAll(search, status);
  }

  @Get('my')
  @Roles('FARM_MANAGER', 'ADMIN')
  findMyFarms(@Request() req: any) {
    return this.farmsService.findAllByManager(req.user.userId);
  }

  @Get(':id')
  @Roles('FARM_MANAGER', 'FARMER', 'ADMIN')
  findOne(@Param('id') id: string) {
    return this.farmsService.findOne(id);
  }

  @Post()
  @Roles('FARM_MANAGER', 'ADMIN') 
  create(@Body() createFarmDto: CreateFarmDto) {
    return this.farmsService.create(createFarmDto);
  }

  @Put(':id')
  @Roles('FARM_MANAGER', 'ADMIN')
  update(@Param('id') id: string, @Body() updateFarmDto: UpdateFarmDto) {
    return this.farmsService.update(id, updateFarmDto);
  }

  @Delete(':id')
  @Roles('FARM_MANAGER', 'ADMIN')
  remove(@Param('id') id: string) {
    return this.farmsService.remove(id);
  }
}
