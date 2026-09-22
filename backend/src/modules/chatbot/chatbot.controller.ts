import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ChatbotService } from './chatbot.service';
import { AskChatbotDto } from './dto/ask-chatbot.dto';
import { CreateDocumentDto } from './dto/create-document.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('chatbot')
export class ChatbotController {
  constructor(private readonly chatbotService: ChatbotService) {}

  /**
   * Hỏi đáp RAG với Trợ lý AI
   * Endpoint: POST /api/chatbot/ask
   */
  @Post('ask')
  async askChatbot(@Body() dto: AskChatbotDto, @Request() req: any) {
    const user = req?.user || null;
    return this.chatbotService.ask(dto, user);
  }

  /**
   * Lấy danh sách tài liệu trong kho tri thức
   * Endpoint: GET /api/chatbot/documents
   */
  @Get('documents')
  async getAllDocuments() {
    return this.chatbotService.getAllDocuments();
  }

  /**
   * Xem chi tiết tài liệu kèm các đoạn trích (chunks)
   * Endpoint: GET /api/chatbot/documents/:id
   */
  @Get('documents/:id')
  async getDocumentById(@Param('id') id: string) {
    return this.chatbotService.getDocumentById(id);
  }

  /**
   * Thêm tài liệu mới vào kho tri thức RAG
   * Endpoint: POST /api/chatbot/documents
   */
  @Post('documents')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'FARM_MANAGER', 'TECHNICIAN')
  async createDocument(@Body() dto: CreateDocumentDto, @Request() req: any) {
    return this.chatbotService.createDocument(dto, req.user?.id);
  }

  /**
   * Xóa tài liệu khỏi kho tri thức
   * Endpoint: DELETE /api/chatbot/documents/:id
   */
  @Delete('documents/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'FARM_MANAGER')
  async deleteDocument(@Param('id') id: string) {
    return this.chatbotService.deleteDocument(id);
  }
}
