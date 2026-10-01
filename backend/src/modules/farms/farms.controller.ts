import {
  Controller,
  Get,
  Post,
  Body,
  Put,
  Param,
  Delete,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FarmsService } from './farms.service.js';
import { CreateFarmDto } from './dto/create-farm.dto.js';
import { UpdateFarmDto } from './dto/update-farm.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';

@Controller('farms')
@UseGuards(JwtAuthGuard, RolesGuard)
export class FarmsController {
  constructor(private readonly farmsService: FarmsService) {}

  private getUserId(req: any): string {
    return req.user.userId || req.user.sub || req.user.id;
  }

  @Get()
  @Roles('FARM_MANAGER', 'FARMER', 'ADMIN', 'TECHNICIAN')
  findAll(
    @Query('search') search: string,
    @Query('status') status: string,
    @Request() req: any,
  ) {
    return this.farmsService.findAll(
      search,
      status,
      this.getUserId(req),
      req.user.role,
    );
  }

  @Get('my')
  @Roles('FARM_MANAGER')
  findMyFarms(@Request() req: any) {
    return this.farmsService.findAllByManager(this.getUserId(req));
  }

  @Get(':id')
  @Roles('FARM_MANAGER', 'FARMER', 'ADMIN', 'TECHNICIAN')
  findOne(@Param('id') id: string, @Request() req: any) {
    return this.farmsService.findOne(id, this.getUserId(req), req.user.role);
  }

  @Post()
  @Roles('FARM_MANAGER')
  create(@Body() createFarmDto: CreateFarmDto, @Request() req: any) {
    // Nếu createFarmDto chưa có ownerId thì tự gán bằng user đang đăng nhập
    if (!createFarmDto.ownerId) {
      createFarmDto.ownerId = this.getUserId(req);
    }
    return this.farmsService.create(createFarmDto);
  }

  @Put(':id')
  @Roles('FARM_MANAGER')
  update(
    @Param('id') id: string,
    @Body() updateFarmDto: UpdateFarmDto,
    @Request() req: any,
  ) {
    return this.farmsService.update(
      id,
      updateFarmDto,
      this.getUserId(req),
      req.user.role,
    );
  }

  @Delete(':id')
  @Roles('FARM_MANAGER')
  remove(@Param('id') id: string, @Request() req: any) {
    return this.farmsService.remove(id, this.getUserId(req), req.user.role);
  }

  @Get(':id/staff')
  @Roles('FARM_MANAGER', 'ADMIN')
  getStaff(@Param('id') id: string, @Request() req: any) {
    return this.farmsService.getStaff(id, this.getUserId(req), req.user.role);
  }

  @Post(':id/staff')
  @Roles('FARM_MANAGER', 'ADMIN')
  assignStaff(
    @Param('id') id: string,
    @Body('userId') userIdToAssign: string,
    @Request() req: any,
  ) {
    return this.farmsService.assignStaff(
      id,
      userIdToAssign,
      this.getUserId(req),
      req.user.role,
    );
  }

  @Delete(':id/staff/:userId')
  @Roles('FARM_MANAGER', 'ADMIN')
  unassignStaff(
    @Param('id') id: string,
    @Param('userId') userIdToUnassign: string,
    @Request() req: any,
  ) {
    return this.farmsService.unassignStaff(
      id,
      userIdToUnassign,
      this.getUserId(req),
      req.user.role,
    );
  }

  /**
   * POST /api/farms/:farmId/invite-by-email
   * Manager mời nhân sự bằng email (2 luồng: đã có TK / chưa có TK)
   */
  @Post(':farmId/invite-by-email')
  @Roles('FARM_MANAGER')
  @HttpCode(HttpStatus.OK)
  inviteByEmail(
    @Param('farmId') farmId: string,
    @Body('email') email: string,
    @Body('role') role: 'FARMER' | 'TECHNICIAN',
    @Request() req: any,
  ) {
    return this.farmsService.inviteStaffByEmail(
      farmId,
      email,
      role,
      this.getUserId(req),
      req.user.role,
    );
  }
}
