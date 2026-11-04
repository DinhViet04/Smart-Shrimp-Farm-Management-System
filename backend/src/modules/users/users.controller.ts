import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UsersService } from './users.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { UpdateRoleDto } from './dto/update-role.dto.js';
import { UpdateStatusDto } from './dto/update-status.dto.js';
import { UpdateProfileDto } from './dto/update-profile.dto.js';
import { ChangePasswordDto } from './dto/change-password.dto.js';
import { GetUsersQueryDto } from './dto/get-users-query.dto.js';
import { CreateUserByAdminDto } from './dto/create-user-by-admin.dto.js';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('profile')
  async getProfile(@CurrentUser('userId') userId: string) {
    return this.usersService.findById(userId);
  }

  @Patch('profile')
  async updateProfile(
    @CurrentUser('userId') userId: string,
    @Body() updateProfileDto: UpdateProfileDto,
  ) {
    return this.usersService.updateProfile(userId, updateProfileDto);
  }

  @Patch('password')
  async changePassword(
    @CurrentUser('userId') userId: string,
    @Body() changePasswordDto: ChangePasswordDto,
  ) {
    return this.usersService.changePassword(
      userId,
      changePasswordDto.currentPassword,
      changePasswordDto.newPassword,
      changePasswordDto.confirmPassword,
    );
  }

  @Get('lookup')
  @Roles('FARM_MANAGER', 'ADMIN')
  async lookupStaff(
    @Query('email') email: string,
    @Query('expectedRole') expectedRole?: string,
  ) {
    return this.usersService.lookupStaff(email, expectedRole);
  }

  @Get('candidates')
  @Roles('FARM_MANAGER', 'ADMIN')
  async getCandidates(@Query('includeManagers') includeManagers?: string) {
    return this.usersService.findCandidates(includeManagers === 'true');
  }

  @Get()
  @Roles('ADMIN')
  async getAllUsers(@Query() query: GetUsersQueryDto) {
    return this.usersService.findAll(query);
  }

  @Post()
  @Roles('ADMIN')
  async createUser(
    @CurrentUser('userId') currentUserId: string,
    @Body() dto: CreateUserByAdminDto,
  ) {
    return this.usersService.createByAdmin(dto, currentUserId);
  }

  @Patch(':id/role')
  @Roles('ADMIN')
  async updateUserRole(
    @CurrentUser('userId') currentUserId: string,
    @Param('id') id: string,
    @Body() updateRoleDto: UpdateRoleDto,
  ) {
    return this.usersService.updateRole(id, updateRoleDto.role, currentUserId);
  }

  @Patch(':id/status')
  @Roles('ADMIN')
  async updateUserStatus(
    @CurrentUser('userId') currentUserId: string,
    @Param('id') id: string,
    @Body() updateStatusDto: UpdateStatusDto,
  ) {
    return this.usersService.updateStatus(
      id,
      updateStatusDto.isActive,
      currentUserId,
    );
  }
}
