import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { CreateSupportTicketDto } from './dto/create-support-ticket.dto.js';
import { UpdateSupportTicketDto } from './dto/update-support-ticket.dto.js';
import { GetSupportTicketsQueryDto } from './dto/get-support-tickets-query.dto.js';
import { SupportService } from './support.service.js';

@Controller('support-tickets')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SupportController {
  constructor(private readonly supportService: SupportService) {}

  @Get()
  @Roles('ADMIN', 'FARM_MANAGER', 'TECHNICIAN', 'FARMER')
  findAll(
    @CurrentUser('userId') userId: string,
    @CurrentUser('role') role: string,
    @Query() query: GetSupportTicketsQueryDto,
  ) {
    return this.supportService.findAll(userId, role, query);
  }

  @Post()
  @Roles('FARM_MANAGER', 'TECHNICIAN', 'FARMER')
  create(
    @CurrentUser('userId') userId: string,
    @Body() dto: CreateSupportTicketDto,
  ) {
    return this.supportService.create(dto, userId);
  }

  @Patch(':id')
  @Roles('ADMIN')
  update(
    @Param('id') id: string,
    @CurrentUser('userId') adminId: string,
    @Body() dto: UpdateSupportTicketDto,
  ) {
    return this.supportService.update(id, dto, adminId);
  }
}
