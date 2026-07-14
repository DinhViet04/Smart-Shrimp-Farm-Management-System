import { Controller, Get, Post, Body, UseGuards, Request, Param, Put, Delete } from '@nestjs/common';
import { PondsService } from './ponds.service.js';
import { CreatePondDto } from './dto/create-pond.dto.js';
import { UpdatePondDto } from './dto/update-pond.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';

@Controller('ponds')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PondsController {
  constructor(private readonly pondsService: PondsService) {}

  @Post()
  @Roles('FARM_MANAGER', 'FARMER', 'ADMIN')
  create(@Request() req: any, @Body() createPondDto: CreatePondDto) {
    return this.pondsService.create(req.user.userId, createPondDto);
  }

  @Get()
  @Roles('FARM_MANAGER', 'FARMER', 'ADMIN', 'TECHNICIAN')
  findAll(@Request() req: any) {
    return this.pondsService.findAll(req.user.userId, req.user.role);
  }

  @Get(':id')
  @Roles('FARM_MANAGER', 'FARMER', 'ADMIN', 'TECHNICIAN')
  findOne(@Request() req: any, @Param('id') id: string) {
    return this.pondsService.findOne(id, req.user.userId, req.user.role);
  }

  @Put(':id')
  @Roles('FARM_MANAGER', 'FARMER', 'ADMIN')
  update(@Request() req: any, @Param('id') id: string, @Body() updatePondDto: UpdatePondDto) {
    return this.pondsService.update(id, req.user.userId, req.user.role, updatePondDto);
  }

  @Delete(':id')
  @Roles('FARM_MANAGER', 'ADMIN')
  remove(@Request() req: any, @Param('id') id: string) {
    return this.pondsService.remove(id, req.user.userId, req.user.role);
  }
}
