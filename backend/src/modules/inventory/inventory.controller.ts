import { Controller, Get, Post, Body, Put, Param, Delete, Query, UseGuards } from '@nestjs/common';
import { InventoryService } from './inventory.service.js';
import { CreateInventoryDto } from './dto/create-inventory.dto.js';
import { UpdateInventoryDto } from './dto/update-inventory.dto.js';
import { CreateInventoryUsageDto } from './dto/create-inventory-usage.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { InventoryCategory } from '@prisma/client';

@Controller('inventory')
@UseGuards(JwtAuthGuard, RolesGuard)
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get()
  @Roles('FARM_MANAGER', 'FARMER', 'TECHNICIAN', 'ADMIN')
  findAll(
    @CurrentUser() user: any,
    @Query('search') search?: string,
    @Query('category') category?: InventoryCategory,
    @Query('farmId') farmId?: string,
    @Query('skip') skip?: number,
    @Query('take') take?: number,
  ) {
    return this.inventoryService.findAll(user, search, category, farmId, skip, take);
  }

  @Get('consumption-summary')
  @Roles('FARM_MANAGER', 'FARMER', 'TECHNICIAN', 'ADMIN')
  getConsumptionSummary(
    @CurrentUser() user: any,
    @Query('farmId') farmId?: string,
    @Query('days') days?: number,
  ) {
    return this.inventoryService.getConsumptionSummary(user, farmId, days ? Number(days) : 30);
  }

  @Get('usage-logs')
  @Roles('FARM_MANAGER', 'FARMER', 'TECHNICIAN', 'ADMIN')
  findUsageLogs(
    @CurrentUser() user: any,
    @Query('farmId') farmId?: string,
    @Query('inventoryId') inventoryId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.inventoryService.findUsageLogs(user, farmId, inventoryId, from, to);
  }

  @Get('suppliers')
  @Roles('FARM_MANAGER', 'FARMER', 'TECHNICIAN', 'ADMIN')
  findSuppliers(
    @CurrentUser() user: any,
    @Query('farmId') farmId?: string,
    @Query('search') search?: string,
  ) {
    return this.inventoryService.findSuppliers(user, farmId, search);
  }

  @Get(':id')
  @Roles('FARM_MANAGER', 'FARMER', 'TECHNICIAN', 'ADMIN')
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.inventoryService.findOne(id, user);
  }

  @Post()
  @Roles('FARM_MANAGER')
  create(@Body() createInventoryDto: CreateInventoryDto, @CurrentUser() user: any) {
    return this.inventoryService.create(createInventoryDto, user);
  }

  @Put(':id')
  @Roles('FARM_MANAGER')
  update(@Param('id') id: string, @Body() updateInventoryDto: UpdateInventoryDto, @CurrentUser() user: any) {
    return this.inventoryService.update(id, updateInventoryDto, user);
  }

  @Post(':id/usage')
  @Roles('FARM_MANAGER', 'FARMER', 'TECHNICIAN', 'ADMIN')
  recordUsage(
    @Param('id') id: string,
    @Body() createUsageDto: CreateInventoryUsageDto,
    @CurrentUser() user: any,
  ) {
    return this.inventoryService.recordUsage(id, createUsageDto, user);
  }

  @Delete(':id')
  @Roles('FARM_MANAGER')
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.inventoryService.remove(id, user);
  }
}
