import { Controller, Get, Patch, Param, Body, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { UpdateRoleDto } from './dto/update-role.dto.js';
import { UpdateStatusDto } from './dto/update-status.dto.js';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('profile')
  async getProfile(@CurrentUser('userId') userId: string) {
    return this.usersService.findById(userId);
  }

  @Get()
  @Roles('ADMIN')
  async getAllUsers() {
    return this.usersService.findAll();
  }

  @Patch(':id/role')
  @Roles('ADMIN')
  async updateUserRole(@Param('id') id: string, @Body() updateRoleDto: UpdateRoleDto) {
    return this.usersService.updateRole(id, updateRoleDto.role);
  }

  @Patch(':id/status')
  @Roles('ADMIN')
  async updateUserStatus(@Param('id') id: string, @Body() updateStatusDto: UpdateStatusDto) {
    return this.usersService.updateStatus(id, updateStatusDto.isActive);
  }
}
