import { Controller, Get, Post, Body, Put, Param, Delete, Query, UseGuards } from '@nestjs/common';
import { FarmsService } from './farms.service';
import { CreateFarmDto } from './dto/create-farm.dto';
import { UpdateFarmDto } from './dto/update-farm.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('farms') // Let's keep it 'farms' since the global prefix might be 'api' or standard
@UseGuards(JwtAuthGuard, RolesGuard)
export class FarmsController {
  constructor(private readonly farmsService: FarmsService) {}

  @Get()
  findAll(@Query('search') search: string, @Query('status') status: string) {
    return this.farmsService.findAll(search, status);
  }

  @Get(':id')
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
