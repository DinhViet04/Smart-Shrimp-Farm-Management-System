import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { SuppliersService } from './suppliers.service.js';
import { CreateSupplierDto } from './dto/create-supplier.dto.js';
import { UpdateSupplierDto } from './dto/update-supplier.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';

@Controller('suppliers')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SuppliersController {
  constructor(private readonly suppliersService: SuppliersService) {}

  @Get()
  @Roles('FARM_MANAGER', 'FARMER', 'TECHNICIAN', 'ADMIN')
  findAll(
    @CurrentUser() user: any,
    @Query('farmId') farmId?: string,
    @Query('search') search?: string,
  ) {
    return this.suppliersService.findAll(user, farmId, search);
  }

  @Get(':id')
  @Roles('FARM_MANAGER', 'FARMER', 'TECHNICIAN', 'ADMIN')
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.suppliersService.findOne(id, user);
  }

  @Post()
  @Roles('FARM_MANAGER')
  create(
    @Body() createSupplierDto: CreateSupplierDto,
    @CurrentUser() user: any,
  ) {
    return this.suppliersService.create(createSupplierDto, user);
  }

  @Put(':id')
  @Roles('FARM_MANAGER')
  update(
    @Param('id') id: string,
    @Body() updateSupplierDto: UpdateSupplierDto,
    @CurrentUser() user: any,
  ) {
    return this.suppliersService.update(id, updateSupplierDto, user);
  }

  @Delete(':id')
  @Roles('FARM_MANAGER')
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.suppliersService.remove(id, user);
  }
}
