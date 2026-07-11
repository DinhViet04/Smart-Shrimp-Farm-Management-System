import { Controller, Get, Post, Body, Put, Param, Delete, Query, UseGuards } from '@nestjs/common';
import { InventoryService } from './inventory.service.js';
import { CreateInventoryDto } from './dto/create-inventory.dto.js';
import { UpdateInventoryDto } from './dto/update-inventory.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { InventoryCategory } from '@prisma/client';

@Controller('inventory')
@UseGuards(JwtAuthGuard, RolesGuard)
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get()
  @Roles('FARM_MANAGER', 'FARMER', 'TECHNICIAN', 'ADMIN')
  findAll(
    @Query('search') search?: string,
    @Query('category') category?: InventoryCategory,
    @Query('farmId') farmId?: string,
    @Query('skip') skip?: number,
    @Query('take') take?: number,
  ) {
    return this.inventoryService.findAll(search, category, farmId, skip, take);
  }

  @Get(':id')
  @Roles('FARM_MANAGER', 'FARMER', 'TECHNICIAN', 'ADMIN')
  findOne(@Param('id') id: string) {
    return this.inventoryService.findOne(id);
  }

  @Post()
  @Roles('FARM_MANAGER')
  create(@Body() createInventoryDto: CreateInventoryDto) {
    return this.inventoryService.create(createInventoryDto);
  }

  @Put(':id')
  @Roles('FARM_MANAGER')
  update(@Param('id') id: string, @Body() updateInventoryDto: UpdateInventoryDto) {
    return this.inventoryService.update(id, updateInventoryDto);
  }

  @Delete(':id')
  @Roles('FARM_MANAGER')
  remove(@Param('id') id: string) {
    return this.inventoryService.remove(id);
  }
}
