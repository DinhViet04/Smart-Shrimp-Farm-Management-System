import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Request,
  Param,
  Put,
  Delete,
} from '@nestjs/common';
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
  @Roles('FARM_MANAGER', 'ADMIN')
  create(@Request() req: any, @Body() createPondDto: CreatePondDto) {
    return this.pondsService.create(req.user, createPondDto);
  }

  @Get()
  @Roles('FARM_MANAGER', 'FARMER', 'TECHNICIAN', 'ADMIN')
  findAll(@Request() req: any) {
    return this.pondsService.findAll(req.user);
  }

  @Get(':id')
  @Roles('FARM_MANAGER', 'FARMER', 'TECHNICIAN', 'ADMIN')
  findOne(@Request() req: any, @Param('id') id: string) {
    return this.pondsService.findOne(id, req.user);
  }

  @Put(':id')
  @Roles('FARM_MANAGER', 'ADMIN')
  update(
    @Request() req: any,
    @Param('id') id: string,
    @Body() updatePondDto: UpdatePondDto,
  ) {
    return this.pondsService.update(id, req.user, updatePondDto);
  }

  @Delete(':id')
  @Roles('FARM_MANAGER', 'ADMIN')
  remove(@Request() req: any, @Param('id') id: string) {
    return this.pondsService.remove(id, req.user);
  }
}
