import { Controller, Get, Post, Put, Delete, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';

@Controller('farms')
@UseGuards(JwtAuthGuard, RolesGuard)
export class FarmsController {
  @Get()
  @Roles('FARM_MANAGER', 'FARMER')
  findAll() {
    return { message: 'This action returns all farms' };
  }

  @Post()
  @Roles('FARM_MANAGER', 'FARMER')
  create() {
    return { message: 'This action adds a new farms' };
  }

  @Put(':id')
  @Roles('FARM_MANAGER', 'FARMER')
  update() {
    return { message: 'This action updates a farms' };
  }

  @Delete(':id')
  @Roles('FARM_MANAGER') // Only manager can delete
  remove() {
    return { message: 'This action removes a farms' };
  }
}
