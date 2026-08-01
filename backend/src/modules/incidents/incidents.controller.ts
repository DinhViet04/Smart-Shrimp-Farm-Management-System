import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { IncidentsService } from './incidents.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CreateIncidentDto } from './dto/create-incident.dto.js';
import { GetIncidentsDto } from './dto/get-incidents.dto.js';
import { AssignIncidentDto } from './dto/assign-incident.dto.js';
import { CreateTreatmentUpdateDto } from './dto/create-treatment-update.dto.js';
import { ResolveIncidentDto } from './dto/resolve-incident.dto.js';
import { ReopenIncidentDto } from './dto/reopen-incident.dto.js';

@Controller('incidents')
@UseGuards(JwtAuthGuard, RolesGuard)
export class IncidentsController {
  constructor(private readonly incidentsService: IncidentsService) {}

  @Get()
  @Roles('FARMER', 'TECHNICIAN', 'FARM_MANAGER', 'ADMIN')
  findAll(@Request() req: any, @Query() query: GetIncidentsDto) {
    return this.incidentsService.findAll(req.user, query);
  }

  @Get(':id')
  @Roles('FARMER', 'TECHNICIAN', 'FARM_MANAGER', 'ADMIN')
  findOne(@Request() req: any, @Param('id') id: string) {
    return this.incidentsService.findOne(req.user, id);
  }

  @Post()
  @Roles('FARMER', 'TECHNICIAN', 'FARM_MANAGER')
  @HttpCode(HttpStatus.CREATED)
  create(@Request() req: any, @Body() dto: CreateIncidentDto) {
    return this.incidentsService.create(req.user, dto);
  }

  @Patch(':id/assignment')
  @Roles('FARM_MANAGER')
  assign(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: AssignIncidentDto,
  ) {
    return this.incidentsService.assign(req.user, id, dto);
  }

  @Patch(':id/start-treatment')
  @Roles('TECHNICIAN')
  startTreatment(@Request() req: any, @Param('id') id: string) {
    return this.incidentsService.startTreatment(req.user, id);
  }

  @Post(':id/treatment-updates')
  @Roles('TECHNICIAN')
  @HttpCode(HttpStatus.CREATED)
  addTreatmentUpdate(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: CreateTreatmentUpdateDto,
  ) {
    return this.incidentsService.addTreatmentUpdate(req.user, id, dto);
  }

  @Patch(':id/resolve')
  @Roles('TECHNICIAN')
  resolve(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: ResolveIncidentDto,
  ) {
    return this.incidentsService.resolve(req.user, id, dto);
  }

  @Patch(':id/reopen')
  @Roles('TECHNICIAN', 'FARM_MANAGER')
  reopen(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: ReopenIncidentDto,
  ) {
    return this.incidentsService.reopen(req.user, id, dto);
  }
}
