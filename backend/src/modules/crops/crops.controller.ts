import { Controller, Get, Post, Put, Delete, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';

@Controller('crops')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CropsController {
  @Get()
  @Roles('FARM_MANAGER', 'FARMER')
  findAll() {
    return { message: 'This action returns all crops' };
  }

  @Post()
  @Roles('FARM_MANAGER', 'FARMER')
  create() {
    return { message: 'This action adds a new crops' };
  }

  @Put(':id')
  @Roles('FARM_MANAGER', 'FARMER')
  update() {
    return { message: 'This action updates a crops' };
  }

  @Delete(':id')
  @Roles('FARM_MANAGER') // Only manager can delete
  remove() {
    return { message: 'This action removes a crops' };
  }
}
