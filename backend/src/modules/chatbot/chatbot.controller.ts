import {
  Controller,
  Get,
  Post,
  Delete,
  Put,
  Query,
  BadRequestException,
  Body,
  Param,
  UseGuards,
  Request,
  Res,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ChatbotService } from './chatbot.service';
import { AskChatbotDto } from './dto/ask-chatbot.dto';
import { CreateDocumentDto } from './dto/create-document.dto';
import { ExecuteActionDto } from './dto/execute-action.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Throttle } from '@nestjs/throttler';
import type { UploadedFileDto } from './file-parser.service';
import { ChatHistoryService } from './chat-history.service';
import { FeedingRecordAgentService } from './feeding-record-agent.service';
import type { ChatSessionPayload } from './chat-history.service';

@Controller('chatbot')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ChatbotController {
  constructor(
    private readonly chatbotService: ChatbotService,
    private readonly chatHistory: ChatHistoryService,
    private readonly feedingRecordAgent: FeedingRecordAgentService,
  ) {}

  /**
   * Hỏi đáp RAG với Trợ lý AI
   * Endpoint: POST /api/chatbot/ask
   */
  @Post('ask')
  @Roles('ADMIN', 'FARM_MANAGER', 'FARMER', 'TECHNICIAN')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async askChatbot(@Body() dto: AskChatbotDto, @Request() req: any) {
    return this.chatbotService.ask(dto, req.user);
  }

  /**
   * Gợi ý loại thức ăn & số ký theo giai đoạn tôm cho thẻ ghi nhật ký cho ăn (chỉ Nông dân)
   * Endpoint: GET /api/chatbot/feeding-suggestion?pondId=&date=YYYY-MM-DD
   */
  @Get('feeding-suggestion')
  @Roles('FARMER')
  async feedingSuggestion(@Query('pondId') pondId: string, @Query('date') date: string, @Request() req: any) {
    if (!pondId) throw new BadRequestException('Thiếu mã ao.');
    return this.feedingRecordAgent.getSuggestion(req.user, pondId, date);
  }

  // ── LỊCH SỬ HỘI THOẠI (lưu theo tài khoản, xem lại khi đăng nhập lại / đổi máy) ──

  @Get('sessions')
  @Roles('ADMIN', 'FARM_MANAGER', 'FARMER', 'TECHNICIAN')
  async listSessions(@Request() req: any) {
    return this.chatHistory.list(req.user);
  }

  @Put('sessions/:id')
  @Roles('ADMIN', 'FARM_MANAGER', 'FARMER', 'TECHNICIAN')
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  async saveSession(@Param('id') id: string, @Body() body: ChatSessionPayload, @Request() req: any) {
    return this.chatHistory.upsert(req.user, id, body);
  }

  @Delete('sessions/:id')
  @Roles('ADMIN', 'FARM_MANAGER', 'FARMER', 'TECHNICIAN')
  async deleteSession(@Param('id') id: string, @Request() req: any) {
    return this.chatHistory.remove(req.user, id);
  }

  @Delete('sessions')
  @Roles('ADMIN', 'FARM_MANAGER', 'FARMER', 'TECHNICIAN')
  async clearSessions(@Request() req: any) {
    return this.chatHistory.clear(req.user);
  }

  /**
   * Tải tệp (Excel, PDF, Word) lên để AI phân tích và chuẩn bị lệnh nhập kho vật tư
   * Endpoint: POST /api/chatbot/upload-and-parse
   */
  @Post('upload-and-parse')
  @Roles('ADMIN', 'FARM_MANAGER')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 15 * 1024 * 1024 }, // Tối đa 15MB
    }),
  )
  async uploadAndParse(
    @UploadedFile() file: UploadedFileDto,
    @Body('question') question: string,
    @Body('history') historyStr: string,
    @Request() req: any,
  ) {
    let history: any = undefined;
    if (historyStr) {
      try {
        history = JSON.parse(historyStr);
      } catch {}
    }
    return this.chatbotService.handleFileUploadAndAction(file, question, req.user, history);
  }

  /**
   * Xuất báo cáo tồn kho trang trại ra file Excel (.xlsx)
   * Endpoint: GET /api/chatbot/export/inventory/:farmId
   */
  @Get('export/inventory/:farmId')
  @Roles('ADMIN', 'FARM_MANAGER')
  async exportInventoryExcel(
    @Param('farmId') farmId: string,
    @Request() req: any,
    @Res() res: any,
  ) {
    const result = await this.chatbotService.exportInventoryExcel(farmId, req.user);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(result.filename)}"`,
    );
    res.setHeader('Content-Length', result.buffer.length);
    return res.end(result.buffer);
  }

  /**
   * Thực thi hành động do AI đề xuất sau khi người dùng xác nhận
   * Endpoint: POST /api/chatbot/execute-action
   */
  @Post('execute-action')
  // FARM_MANAGER: tạo trang trại / ao / vụ, nhập kho. TECHNICIAN: lưu số đo nước.
  // FARMER: ghi nhật ký cho ăn. Quyền chi tiết theo từng loại phiếu kiểm tra lại trong AgentActionService.
  @Roles('FARM_MANAGER', 'TECHNICIAN', 'FARMER')
  async executeAgentAction(@Body() dto: ExecuteActionDto, @Request() req: any) {
    return this.chatbotService.executeAction(dto, req.user);
  }

  /**
   * Lấy danh sách tài liệu trong kho tri thức
   * Endpoint: GET /api/chatbot/documents
   */
  @Get('documents')
  @Roles('ADMIN', 'FARM_MANAGER', 'TECHNICIAN')
  async getAllDocuments() {
    return this.chatbotService.getAllDocuments();
  }

  /**
   * Xem chi tiết tài liệu kèm các đoạn trích (chunks)
   * Endpoint: GET /api/chatbot/documents/:id
   */
  @Get('documents/:id')
  @Roles('ADMIN', 'FARM_MANAGER', 'TECHNICIAN')
  async getDocumentById(@Param('id') id: string) {
    return this.chatbotService.getDocumentById(id);
  }

  /**
   * Thêm tài liệu mới vào kho tri thức RAG
   * Endpoint: POST /api/chatbot/documents
   */
  @Post('documents')
  @Roles('ADMIN', 'FARM_MANAGER', 'TECHNICIAN')
  async createDocument(@Body() dto: CreateDocumentDto, @Request() req: any) {
    return this.chatbotService.createDocument(dto, req.user?.id);
  }

  /**
   * Xóa tài liệu khỏi kho tri thức
   * Endpoint: DELETE /api/chatbot/documents/:id
   */
  @Delete('documents/:id')
  @Roles('ADMIN', 'FARM_MANAGER')
  async deleteDocument(@Param('id') id: string, @Request() req: any) {
    return this.chatbotService.deleteDocument(id, req.user);
  }

  /**
   * Kiểm tra cấu hình và kết nối Google Drive Knowledge Store
   * Endpoint: GET /api/chatbot/documents/drive/status
   */
  @Get('documents/drive/status')
  @Roles('ADMIN', 'FARM_MANAGER')
  async getDriveStatus() {
    return this.chatbotService.getDriveStatus();
  }

  /**
   * Kích hoạt đồng bộ tài liệu từ Google Drive vào RAG Vector Store
   * Endpoint: POST /api/chatbot/documents/drive/sync
   */
  @Post('documents/drive/sync')
  @Roles('ADMIN', 'FARM_MANAGER')
  async syncDriveDocuments(@Body() body: any) {
    return this.chatbotService.syncDriveDocuments(body);
  }
}
