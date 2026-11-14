import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Request,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { ChatGroupsService } from './chat-groups.service.js';
import { CreateDirectChatDto } from './dto/create-direct-chat.dto.js';
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

  @Post('direct')
  @Roles('FARM_MANAGER', 'FARMER', 'TECHNICIAN', 'ADMIN')
  createOrGetDirect(
    @Body() dto: CreateDirectChatDto,
    @Request() req: any,
  ) {
    return this.chatGroupsService.createOrGetDirectGroup(
      dto.targetUserId,
      this.getAuthUser(req),
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
      dto.content || '',
      this.getAuthUser(req),
      {
        attachmentUrl: dto.attachmentUrl,
        attachmentName: dto.attachmentName,
        attachmentType: dto.attachmentType,
        attachmentSize: dto.attachmentSize,
        replyToId: dto.replyToId,
      },
    );
  }

  @Post(':groupId/receipt')
  @Roles('FARM_MANAGER', 'FARMER', 'TECHNICIAN', 'ADMIN')
  markReceipt(
    @Param('groupId') groupId: string,
    @Body() body: { type?: 'DELIVERED' | 'READ' },
    @Request() req: any,
  ) {
    return this.chatGroupsService.markChatReceipt(
      groupId,
      this.getAuthUser(req),
      body?.type === 'READ' ? 'READ' : 'DELIVERED',
    );
  }

  @Post(':groupId/attachments')
  @Roles('FARM_MANAGER', 'FARMER', 'TECHNICIAN', 'ADMIN')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  uploadAttachment(
    @Param('groupId') groupId: string,
    @UploadedFile()
    file: {
      originalname: string;
      mimetype: string;
      size: number;
      buffer: Buffer;
    },
    @Request() req: any,
  ) {
    return this.chatGroupsService.uploadAttachment(
      groupId,
      file,
      this.getAuthUser(req),
    );
  }
}

