import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { FarmStaffsService } from './farm-staffs.service.js';
import { CreateFarmStaffDto } from './dto/create-farm-staff.dto.js';
import { UpdateFarmStaffDto } from './dto/update-farm-staff.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';

@Controller('farm-staffs')
@UseGuards(JwtAuthGuard, RolesGuard)
export class FarmStaffsController {
  constructor(private readonly farmStaffsService: FarmStaffsService) {}

  @Get()
  @Roles('FARM_MANAGER', 'FARMER', 'TECHNICIAN', 'ADMIN')
  findAll(@CurrentUser() user: any, @Query('farmId') farmId?: string) {
    return this.farmStaffsService.findAll(user, farmId);
  }

  @Post()
  @Roles('FARM_MANAGER')
  create(@Body() dto: CreateFarmStaffDto, @CurrentUser() user: any) {
    return this.farmStaffsService.create(dto, user);
  }

  @Put(':id')
  @Roles('FARM_MANAGER')
  update(@Param('id') id: string, @Body() dto: UpdateFarmStaffDto, @CurrentUser() user: any) {
    return this.farmStaffsService.update(id, dto, user);
  }

  @Delete(':id')
  @Roles('FARM_MANAGER')
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.farmStaffsService.remove(id, user);
  }
}
