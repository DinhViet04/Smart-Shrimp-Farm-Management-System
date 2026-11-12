import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { ChatGroupsService } from './chat-groups.service.js';
import { SendChatMessageDto } from './dto/send-chat-message.dto.js';

@Controller('chat-groups')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ChatGroupsController {
  constructor(private readonly chatGroupsService: ChatGroupsService) {}

  private getAuthUser(req: any) {
    return {
      userId: req.user.userId || req.user.sub || req.user.id,
      role: req.user.role,
    };
  }

  @Get()
  @Roles('FARM_MANAGER', 'FARMER', 'TECHNICIAN', 'ADMIN')
  findAll(@Query('workspaceId') workspaceId: string, @Request() req: any) {
    return this.chatGroupsService.findMyGroups(
      this.getAuthUser(req),
      workspaceId,
    );
  }

  @Get(':groupId/messages')
  @Roles('FARM_MANAGER', 'FARMER', 'TECHNICIAN', 'ADMIN')
  getMessages(@Param('groupId') groupId: string, @Request() req: any) {
    return this.chatGroupsService.getGroupMessages(
      groupId,
      this.getAuthUser(req),
    );
  }

  @Post(':groupId/messages')
  @Roles('FARM_MANAGER', 'FARMER', 'TECHNICIAN', 'ADMIN')
  sendMessage(
    @Param('groupId') groupId: string,
    @Body() dto: SendChatMessageDto,
    @Request() req: any,
  ) {
    return this.chatGroupsService.sendMessage(
      groupId,
      dto.content,
      this.getAuthUser(req),
    );
  }
}

