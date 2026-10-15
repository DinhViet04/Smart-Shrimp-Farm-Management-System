import {
  ForbiddenException,
  HttpException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import OpenAI from 'openai';
import { AskChatbotDto } from './dto/ask-chatbot.dto';
import { CreateDocumentDto } from './dto/create-document.dto';
import { AuthUser, FarmAccessService } from '../farm-access/farm-access.service';
import { WeatherService, WeatherData } from './weather.service';

interface ChunkMatch {
  documentTitle: string;
  chunkIndex: number;
  content: string;
  score: number;
}

@Injectable()
export class ChatbotService implements OnModuleInit {
  private readonly logger = new Logger(ChatbotService.name);
  private openai: OpenAI | null = null;
  private apiKey: string | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly farmAccess: FarmAccessService,
    private readonly weatherService: WeatherService,
  ) {
    this.apiKey = process.env.OPENAI_API_KEY || null;
    if (this.apiKey) {
      this.openai = new OpenAI({ apiKey: this.apiKey });
      this.logger.log(
        'OpenAI ChatGPT API initialized successfully for RAG Chatbot.',
      );
    } else {
      this.logger.warn(
        'OPENAI_API_KEY not found in environment. Chatbot will use built-in local semantic matching fallback.',
      );
    }
  }

  async onModuleInit() {
    // Tự động kiểm tra và nạp sẵn tài liệu tri thức mẫu nếu database chưa có
    try {
      const docCount = await this.prisma.knowledgeDocument.count();
      if (docCount === 0) {
        this.logger.log(
          'Seeding initial smart shrimp farming knowledge documents...',
        );
        await this.seedDefaultKnowledge();
      }
    } catch (err) {
      this.logger.warn('Could not check knowledge documents on startup:', err);
    }
  }

  // ── 1. EMBEDDING HELPERS (OpenAI text-embedding-3-small) ─────────────────────
  private async getEmbedding(text: string): Promise<number[]> {
    if (this.openai && this.apiKey) {
      try {
        const response = await this.openai.embeddings.create({
          model: 'text-embedding-3-small',
          input: text,
        });
        return response.data[0].embedding;
      } catch (err) {
        this.logger.warn(
          'OpenAI embedding failed, falling back to local vectorizer:',
          err.message,
        );
      }
    }
    // Fallback: Tạo vector 64 chiều đơn giản nếu chưa có API Key
    return this.createLocalVector(text);
  }

  private createLocalVector(text: string, dimensions = 64): number[] {
    const vector = new Array(dimensions).fill(0);
    const words = text
      .toLowerCase()
      .replace(/[^\w\sà-ỹ]/g, '')
      .split(/\s+/)
      .filter(Boolean);
    if (words.length === 0) return vector;

    words.forEach((word) => {
      let hash = 0;
      for (let i = 0; i < word.length; i++) {
        hash = (hash << 5) - hash + word.charCodeAt(i);
        hash |= 0;
      }
      const index = Math.abs(hash) % dimensions;
      vector[index] += 1;
    });

    const norm = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    return norm > 0 ? vector.map((val) => val / norm) : vector;
  }

  private cosineSimilarity(vecA: number[], vecB: number[]): number {
    if (!vecA || !vecB || vecA.length === 0 || vecB.length === 0) return 0;
    const len = Math.min(vecA.length, vecB.length);
    let dot = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < len; i++) {
      dot += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }
    if (normA === 0 || normB === 0) return 0;
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  // ── 2. CHUNKING LOGIC ─────────────────────────────────────────────────────
  private splitTextIntoChunks(
    text: string,
    maxChunkLength = 600,
    overlap = 100,
  ): string[] {
    if (!text || text.length <= maxChunkLength) return [text.trim()];

    const chunks: string[] = [];
    let startIndex = 0;

    while (startIndex < text.length) {
      let endIndex = startIndex + maxChunkLength;

      if (endIndex < text.length) {
        const punctuationIndex = Math.max(
          text.lastIndexOf('\n', endIndex),
          text.lastIndexOf('. ', endIndex),
          text.lastIndexOf('? ', endIndex),
        );

        if (punctuationIndex > startIndex + 150) {
          endIndex = punctuationIndex + 1;
        }
      }

      const chunk = text.slice(startIndex, endIndex).trim();
      if (chunk.length > 20) {
        chunks.push(chunk);
      }

      startIndex = endIndex - overlap;
      if (startIndex >= text.length - overlap) break;
    }

    return chunks;
  }

  // ── 3. DOCUMENT MANAGEMENT ─────────────────────────────────────────────────
  async createDocument(dto: CreateDocumentDto, uploadedBy?: string) {
    const doc = await this.prisma.knowledgeDocument.create({
      data: {
        title: dto.title,
        category: dto.category || 'GENERAL',
        content: dto.content,
        fileName: dto.fileName || null,
        fileType: dto.fileType || 'manual',
        fileSize: dto.content.length,
        uploadedBy: uploadedBy || null,
      },
    });

    const chunkTexts = this.splitTextIntoChunks(dto.content);

    for (let i = 0; i < chunkTexts.length; i++) {
      const chunkContent = chunkTexts[i];
      const embedding = await this.getEmbedding(chunkContent);

      await this.prisma.knowledgeChunk.create({
        data: {
          documentId: doc.id,
          chunkIndex: i + 1,
          content: chunkContent,
          embedding: embedding as any,
          metadata: {
            title: dto.title,
            category: dto.category || 'GENERAL',
          },
        },
      });
    }

    return {
      message: 'Tạo tài liệu và trích xuất vector chunks thành công!',
      documentId: doc.id,
      chunksCount: chunkTexts.length,
    };
  }

  async getAllDocuments() {
    return this.prisma.knowledgeDocument.findMany({
      include: {
        _count: {
          select: { chunks: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getDocumentById(id: string) {
    return this.prisma.knowledgeDocument.findUnique({
      where: { id },
      include: {
        chunks: {
          orderBy: { chunkIndex: 'asc' },
        },
      },
    });
  }

  async deleteDocument(id: string) {
    await this.prisma.knowledgeDocument.delete({
      where: { id },
    });
    return { message: 'Đã xóa tài liệu và dữ liệu vector chunks liên quan.' };
  }

  // ── 3.5. SIMILARITY SEARCH ───────────────────────────────────────────────
  private async searchSimilarChunks(
    questionEmbedding: number[],
    topK = 3,
  ): Promise<ChunkMatch[]> {
    try {
      if (!this.prisma.knowledgeChunk) {
        return [];
      }
      const chunks = await this.prisma.knowledgeChunk.findMany({
        include: {
          document: {
            select: { title: true },
          },
        },
      });

      const scoredChunks: ChunkMatch[] = chunks.map((chunk) => {
        let chunkEmbedding: number[] = [];
        if (Array.isArray(chunk.embedding)) {
          chunkEmbedding = chunk.embedding as number[];
        } else if (typeof chunk.embedding === 'string') {
          try {
            chunkEmbedding = JSON.parse(chunk.embedding);
          } catch {
            chunkEmbedding = [];
          }
        }

        const score = this.cosineSimilarity(questionEmbedding, chunkEmbedding);
        return {
          documentTitle: chunk.document?.title || 'Tài liệu nuôi tôm',
          chunkIndex: chunk.chunkIndex,
          content: chunk.content,
          score: score,
        };
      });

      scoredChunks.sort((a, b) => b.score - a.score);
      return scoredChunks.slice(0, topK);
    } catch (err) {
      this.logger.error('Error searching similar chunks:', err);
      return [];
    }
  }

  private isCasualGreeting(question: string): boolean {
    if (!question) return false;
    const q = question.toLowerCase().trim();
    const patterns = [
      /^(chào|xin chào|hello|hi|helo|alo|hey|ê|hế lô)(\s+.*)?$/i,
      /^(tao|tôi|mình|anh|chị|em)\s+tên\s+(là\s+)?([a-zA-ZÀ-ỹ\s]+)$/i,
      /^(bạn|mày|em)\s+là\s+ai/i,
      /^(giới thiệu|gioi thieu)(\s+về\s+bạn)?/i,
      /^(cảm ơn|cam on|thanks|thank you|ok|oke|được rồi|tạm biệt|bye)$/i,
      /^test$/i,
    ];
    return patterns.some((p) => p.test(q));
  }

  // ── 4. RAG RETRIEVAL & CHATGPT GENERATION (Python AI Service + OpenAI) ──────
  async ask(dto: AskChatbotDto, currentUser: AuthUser) {
    const question = dto.question?.trim() || '';
    if (!question) {
      return { answer: 'Vui lòng nhập câu hỏi của bạn.' };
    }

    let targetPondName = '';
    let pondContextPayload: any = null;
    let pondRealtimeContext = '';

    try {
      // 1. Thu thập dữ liệu ngữ cảnh ao nuôi thực tế từ DB
      if (dto.pondId) {
        try {
          const pond = await this.prisma.pond.findUnique({
            where: { id: dto.pondId },
            include: {
              farm: true,
              crops: { where: { status: 'ACTIVE' }, take: 1 },
              waterQualityRecords: { orderBy: { recordTime: 'desc' }, take: 1 },
            },
          });

          if (pond) {
            await this.farmAccess.assertCanAccessFarm(currentUser, pond.farmId);
            targetPondName = pond.name;
            const latestWater = pond.waterQualityRecords[0];
            const activeCrop = pond.crops[0];

            let docDays = 0;
            if (activeCrop) {
              const start = new Date(activeCrop.startDate);
              const now = new Date();
              docDays = Math.max(1, Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
            }

            // Tính thể tích nước ao (m³) và mật độ tôm (con/m²) để AI tính liều lượng chính xác
            const areaSize = Number(pond.areaSize) || 0;
            const depth = Number(pond.depth) || 1.2;
            const waterVolume = Math.round(areaSize * depth * 100) / 100; // m³
            const shrimpCount = activeCrop?.initialShrimpCount ? Number(activeCrop.initialShrimpCount) : 0;
            const shrimpDensity = areaSize > 0 && shrimpCount > 0 ? Math.round((shrimpCount / areaSize) * 10) / 10 : null; // con/m²

            pondContextPayload = {
              pondId: pond.id,
              pondName: pond.name,
              farmName: pond.farm?.name || '',
              farmLocation: pond.farm?.location || pond.farm?.address || null,
              areaSize,
              depth,
              waterVolume,
              shrimpDensity,
              doc: activeCrop ? docDays : null,
              initialShrimpCount: shrimpCount || null,
              stage: activeCrop?.stage || null,
              latestWaterQuality: latestWater ? {
                ph: latestWater.ph,
                dissolvedOxygen: latestWater.dissolvedOxygen,
                salinity: latestWater.salinity,
                temperature: latestWater.temperature,
                nh3: latestWater.nh3,
                no2: latestWater.no2,
                alkalinity: (latestWater as any).alkalinity || null,
              } : null,
            };

            const shrimpCountFormatted = shrimpCount > 0 ? shrimpCount.toLocaleString('vi-VN') : 'Chưa rõ';
            pondRealtimeContext = `\n[DỮ LIỆU THỰC TẾ AO NUÔI ${pond.name.toUpperCase()} - DÙNG ĐỂ TÍNH LIỀU LƯỢNG THUỐC CHÍNH XÁC]:\n` +
              `- Diện tích ao: ${areaSize} m²\n` +
              `- Độ sâu trung bình: ${depth} m\n` +
              `- ⚠️ THỂ TÍCH NƯỚC AO (ĐÃ TÍNH): ${waterVolume} m³ (= ${areaSize} m² × ${depth} m) — AI BẮT BUỘC dùng số này để tính tổng lượng thuốc/hóa chất cần dùng cho ao\n` +
              `- Trang trại: ${pond.farm?.name || 'Không rõ'}\n` +
              (activeCrop
                ? `- Vụ nuôi đang chạy: Bắt đầu ${new Date(activeCrop.startDate).toLocaleDateString('vi-VN')} (Ngày nuôi - DOC: ${docDays} ngày)\n` +
                  `- Số lượng giống thả: ${shrimpCountFormatted} con\n` +
                  (shrimpDensity ? `- Mật độ nuôi: ${shrimpDensity} con/m²\n` : '') +
                  (activeCrop.stage ? `- Giai đoạn phát triển: ${activeCrop.stage}\n` : '')
                : '- Trạng thái: Chưa có vụ nuôi nào đang hoạt động\n') +
              (latestWater
                ? `- Chỉ số đo nước gần nhất: pH: ${latestWater.ph ?? 'Chưa đo'}, Oxy hòa tan (DO): ${latestWater.dissolvedOxygen ?? 'Chưa đo'} mg/L, Độ mặn: ${latestWater.salinity ?? 'Chưa đo'}‰, Nhiệt độ: ${latestWater.temperature ?? 'Chưa đo'}°C, Khí độc NH3: ${latestWater.nh3 ?? 'Chưa đo'} mg/L, NO2: ${latestWater.no2 ?? 'Chưa đo'} mg/L${ (latestWater as any).alkalinity ? `, Kiềm: ${(latestWater as any).alkalinity} mg/L` : ''}.\n`
                : '- Chưa có bản ghi đo chất lượng nước gần đây.\n');
          }
        } catch (e) {
          if (e instanceof ForbiddenException) {
            throw e;
          }
          this.logger.warn('Failed to fetch pond realtime context:', e);
        }
      }

      // 1.1 Thu thập tồn kho thuốc & hóa chất của trang trại để AI đối chiếu
      let targetFarmId: string | null = null;
      if (pondContextPayload?.pondId) {
        try {
          const pondObj = await this.prisma.pond.findUnique({
            where: { id: pondContextPayload.pondId },
            select: { farmId: true },
          });
          targetFarmId = pondObj?.farmId || null;
        } catch {
          /* ignore */
        }
      }

      if (!targetFarmId) {
        const uid = (currentUser as any)?.userId || (currentUser as any)?.id;
        if (uid) {
          try {
            const accessible = await this.farmAccess.getAccessibleFarmIds(currentUser);
            if (accessible && accessible.length > 0) {
              targetFarmId = accessible[0];
            } else {
              const userFarm = await this.prisma.farm.findFirst({
                where: {
                  OR: [
                    { ownerId: uid, deletedAt: null },
                    { staff: { some: { userId: uid, isActive: true } }, deletedAt: null },
                  ],
                },
                select: { id: true },
              });
              targetFarmId = userFarm?.id || null;
            }
          } catch (farmErr) {
            this.logger.debug?.(`Could not find farm for user: ${farmErr}`);
          }
        }
      }

      let farmInventory: any[] = [];
      if (targetFarmId) {
        try {
          farmInventory = await this.prisma.inventory.findMany({
            where: {
              farmId: targetFarmId,
              deletedAt: null,
              category: { in: ['MEDICINE', 'CHEMICAL'] },
            },
            select: {
              itemName: true,
              category: true,
              quantity: true,
              unit: true,
              description: true,
              minThreshold: true,
            },
            orderBy: [{ category: 'asc' }, { itemName: 'asc' }],
          });
        } catch (invErr) {
          this.logger.warn('Failed to fetch farm inventory for chatbot:', invErr);
        }
      }

      let inventoryRealtimeContext = '';
      if (farmInventory.length > 0) {
        inventoryRealtimeContext = `\n[DANH MỤC THUỐC & HÓA CHẤT HIỆN CÓ TRONG KHO VẬT TƯ CỦA TRANG TRẠI (TỔNG CỘNG: ${farmInventory.length} MẶT HÀNG)]:\n` +
          farmInventory
            .map((item, idx) => {
              const catLabel = item.category === 'MEDICINE' ? 'Thuốc / Men vi sinh' : 'Hóa chất / Khoáng';
              return `- [${idx + 1}] Tên: "${item.itemName}" | Loại: ${catLabel} | Tồn kho thực tế: ${item.quantity} ${item.unit}${
                item.description ? ` | Công dụng: ${item.description}` : ''
              }`;
            })
            .join('\n') + '\n';
      } else {
        inventoryRealtimeContext = '\n[KHO VẬT TƯ THUỐC & HÓA CHẤT CỦA TRANG TRẠI]: Kho hiện tại chưa có mặt hàng thuốc hoặc hóa chất nào được nhập sẵn.\n';
      }

      pondRealtimeContext += inventoryRealtimeContext;
      if (!pondContextPayload) pondContextPayload = {};
      pondContextPayload.inventory = farmInventory;

      // 1.1 Kiểm tra xem người dùng CÓ HỎI về thời tiết hay không
      let weatherData: WeatherData | null = null;
      const isAskingWeather = this.weatherService.isWeatherInquiry(question);
      if (isAskingWeather) {
        try {
          let farmLocationHint = '';
          if (pondContextPayload?.farmLocation) {
            farmLocationHint = pondContextPayload.farmLocation;
          } else {
            const uid = (currentUser as any)?.userId || (currentUser as any)?.id;
            if (uid) {
              try {
                const userFarm = await this.prisma.farm.findFirst({
                  where: { ownerId: uid, deletedAt: null },
                  select: { location: true, address: true, name: true },
                });
                if (userFarm) {
                  farmLocationHint = userFarm.location || userFarm.address || userFarm.name || '';
                }
              } catch (dbFarmErr) {
                this.logger.debug?.(`Could not query farm for user ${uid}: ${dbFarmErr}`);
              }
            }
          }

          weatherData = await this.weatherService.getWeather(question, farmLocationHint);
          if (weatherData) {
            if (!pondContextPayload) {
              pondContextPayload = {};
            }
            pondContextPayload.weather = weatherData;
            pondRealtimeContext += this.weatherService.buildWeatherContextString(weatherData);
          }
        } catch (weatherErr) {
          this.logger.warn('Could not fetch realtime weather data:', weatherErr);
        }
      }

      // 2. Gọi sang Python AI Microservice (FastAPI on :8000)
      const aiServiceUrl =
        process.env.AI_SERVICE_URL || 'http://localhost:8000';
      try {
        const response = await fetch(`${aiServiceUrl}/api/v1/chat/ask`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            question,
            pondId: pondContextPayload?.pondId,
            pondContext: pondContextPayload,
          }),
          signal: AbortSignal.timeout(12000), // Timeout sau 12 giây
        });

        if (response.ok) {
          const aiData = await response.json();
          return {
            answer: aiData.answer,
            sources: [],
            pondName: targetPondName || aiData.pondName || undefined,
            recommendations: aiData.recommendations || [],
            sourceType: undefined,
            hasLocalKnowledge: false,
            weather: isAskingWeather ? (aiData.weather || weatherData || undefined) : undefined,
            poweredBy: 'Python AI Service (FastAPI Hybrid RAG)',
          };
        }
      } catch (pythonErr: any) {
        this.logger.warn(
          'Python AI Service is unreachable, using built-in NestJS RAG fallback:',
          pythonErr?.message || pythonErr,
        );
      }

      // 3. Fallback: Embedding câu hỏi & Cosine search nội bộ nếu Python Service chưa chạy
      const isGreeting = this.isCasualGreeting(question);
      let topChunks: ChunkMatch[] = [];
      if (!isGreeting) {
        const questionEmbedding = await this.getEmbedding(question);
        const rawChunks = await this.searchSimilarChunks(questionEmbedding, 3);
        // Chỉ giữ lại các chunk có độ khớp thực sự cao (>= 0.40)
        topChunks = rawChunks.filter((c: ChunkMatch) => c.score >= 0.40);
      }
      const hasLocalMatch = topChunks.some((c: ChunkMatch) => c.score >= 0.55);
      let answerText = '';

      if (this.openai && this.apiKey) {
        try {
          const contextDocuments = topChunks.length > 0
            ? topChunks.map((c: ChunkMatch, i: number) => `[TÀI LIỆU CẨM NANG ${i + 1} - "${c.documentTitle}" (Độ khớp ${Math.round(c.score * 100)}%)]: ${c.content}`).join('\n\n')
            : 'Kho tài liệu cẩm nang nội bộ trang trại hiện chưa có đoạn trích nào khớp với câu hỏi này.';

          const systemPrompt = `Bạn là Trợ lý Kỹ thuật Nuôi Tôm Thông Minh AI của hệ thống Smart Shrimp Farm Management.
Nhiệm vụ của bạn là tư vấn, giải đáp chuyên môn kỹ thuật sâu sắc cho người nuôi tôm và kỹ thuật viên.

${pondRealtimeContext}

KHO TÀI LIỆU CẨM NANG NỘI BỘ TRANG TRẠI (RAG CONTEXT):
${contextDocuments}

NGUYÊN TẮC XỬ LÝ NGUỒN TRI THỨC (BẮT BUỘC TUÂN THỦ):
1. [ƯU TIÊN SỐ 1 - CẨM NANG NỘI BỘ & SỐ LIỆU AO]:
   - Nếu KHO TÀI LIỆU CẨM NANG NỘI BỘ ở trên có thông tin/quy trình liên quan, bạn BẮT BUỘC PHẢI ƯU TIÊN SỐ 1 dùng dữ liệu này làm căn cứ cốt lõi.
   - Nếu có dữ liệu ao thực tế, hãy đối chiếu sát sao với chỉ số cẩm nang để đưa ra phác đồ cấp bách theo thứ tự ưu tiên 1, 2, 3.

2. [ƯU TIÊN SỐ 2 - TRI THỨC MỞ RỘNG TỪ CHUYÊN GIA AI OPENAI]:
   - Nếu cẩm nang nội bộ KHÔNG CÓ hoặc KHÔNG ĐỦ CHI TIẾT để giải đáp trọn vẹn, bạn TUYỆT ĐỐI KHÔNG TỪ CHỐI BỎ CUỘC.
   - Hãy tự động khai thác KHO TRI THỨC CHUYÊN SÂU CỦA BẠN (về sinh học tôm, quản lý môi trường nước, bệnh học thủy sản, dinh dưỡng & FCR) để giải thích cặn kẽ, khoa học và đưa ra phác đồ thực hành rõ ràng.

3. [XỬ LÝ DỮ LIỆU THỜI TIẾT]:
   - CHỈ ĐỀ CẬP ĐẾN THỜI TIẾT KHI NGƯỜI DÙNG CÓ HỎI VỀ THỜI TIẾT.
   - Nếu câu hỏi KHÔNG hỏi về thời tiết, TUYỆT ĐỐI KHÔNG tự ý chèn thông tin thời tiết vào câu trả lời.

4. [QUY TẮC TRÌNH BÀY & NGUỒN THAM KHẢO]:
   - TUYỆT ĐỐI KHÔNG thêm bất kỳ dòng ghi chú nào về "Nguồn tham khảo", "Cẩm nang", "Tài liệu" hay "Tri thức OpenAI" ở cuối câu trả lời.
   - Trả lời trực tiếp vào trọng tâm câu hỏi, bằng tiếng Việt chuyên nghiệp, giọng điệu kỹ sư giàu kinh nghiệm, thân thiện, dễ hiểu.
   - Bố cục rõ ràng: Dùng gạch đầu dòng, in đậm các từ khóa, liều lượng quan trọng.

5. [TÍNH LIỀU LƯỢNG THUỐC/HÓA CHẤT CHÍNH XÁC THEO DỮ LIỆU AO THỰC TẾ - BẮT BUỘC TUYỆT ĐỐI]:
   Khi tư vấn về thuốc, hóa chất, khoáng chất, men vi sinh hoặc bất kỳ chế phẩm nào cần dùng cho ao:
   a. BẮT BUỘC SỬ DỤNG CÁC SỐ LIỆU AO SAU ĐÂY ĐỂ TÍNH LIỀU LƯỢNG THỰC TẾ:
      - Thể tích nước ao (m³) = [đọc từ DỮ LIỆU THỰC TẾ AO NUÔI ở trên, đã được tính sẵn]
      - Diện tích ao (m²) = [đọc từ DỮ LIỆU THỰC TẾ AO NUÔI ở trên]
      - Số lượng tôm (con) và mật độ (con/m²) = [đọc từ DỮ LIỆU THỰC TẾ AO NUÔI ở trên]
   b. Công thức tính liều lượng PHẢI HIỂN THỊ RÕ RÀNG:
      - Nếu liều chuẩn tính theo m³ nước: Tổng lượng cần dùng = [liều mg/L hoặc g/m³] × [thể tích ao m³]
      - Nếu liều chuẩn tính theo m² diện tích ao: Tổng lượng = [liều g/m² hoặc mL/m²] × [diện tích ao m²]
      - Nếu liều chuẩn tính theo kg tôm sinh khối: ước tính sinh khối = [số lượng tôm] × [khối lượng trung bình ước tính theo DOC] rồi tính tổng lượng
       - Vi du trinh bay: "Lieu chuan: 2 g/m3 -> Ao [the tich ao] m3 can dung: **[the tich] x 2 = [ket qua] g** tong cong"
   c. Luôn nêu rõ: Cách pha loãng (hòa trong bao nhiêu lít nước trước khi tạt), thời điểm tạt trong ngày, tần suất sử dụng.

6. [QUY TẮC ĐỐI CHIẾU KHO VẬT TƯ & TƯ VẤN THUỐC / HÓA CHẤT - BẮT BUỘC]:
   Khi câu hỏi hoặc vấn đề liên quan đến bệnh tôm, sự cố sức khỏe, điều trị, xử lý môi trường nước hoặc hỏi về việc dùng thuốc/hóa chất:
   a. Hãy phân tích cặn kẽ nguyên nhân và đưa ra các loại thuốc, hoạt chất hoặc hóa chất cần thiết để chữa trị theo chuẩn chuyên môn bệnh học thủy sản.
   b. BẮT BUỘC ĐỐI CHIẾU VỚI [DANH MỤC THUỐC & HÓA CHẤT HIỆN CÓ TRONG KHO VẬT TƯ CỦA TRANG TRẠI] ở trên:
      - Đối với thuốc/hóa chất ĐÃ CÓ TRONG KHO:
        * Đặt nhãn nổi bật: "✅ [CÓ SẴN TRONG KHO - Tồn: X <đơn vị>]"
        * Nêu rõ công dụng của thuốc đối với ca bệnh này, tính toán LIỀU LƯỢNG TUYỆT ĐỐI cần dùng cho ao (theo quy tắc số 5 ở trên) và hướng dẫn cách dùng chi tiết (thời điểm dùng trong ngày, cách hòa nước tạt ao hoặc cách trộn thức ăn).
      - Đối với thuốc/hóa chất CHƯA CÓ TRONG KHO:
        * BẮT BUỘC thông báo rõ ràng bằng nhãn cảnh báo: "⚠️ [KHO HIỆN CHƯA CÓ THUỐC NÀY - Cần mua bổ sung]"
        * ĐỒNG THỜI VẪN PHẢI NÊU ĐẦY ĐỦ: Tên thuốc/hoạt chất cần mua, CÔNG DỤNG của thuốc đối với bệnh này, LIỀU LƯỢNG tính sẵn theo số liệu ao thực tế (quy tắc số 5) và CÁCH DÙNG chi tiết.
        * Nếu trong kho có mặt hàng khác cùng nhóm công dụng có thể dùng tạm thời để sơ cứu, hãy gợi ý phương án thay thế tạm thời cho người nuôi.`;

          const completion = await this.openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: question },
            ],
            temperature: 0.3,
          });

          answerText = completion.choices[0]?.message?.content || '';
        } catch (openaiErr) {
          this.logger.error('OpenAI chat completion failed:', openaiErr);
          answerText = this.buildFallbackResponse(
            question,
            topChunks,
            pondRealtimeContext,
          );
        }
      } else {
        answerText = this.buildFallbackResponse(
          question,
          topChunks,
          pondRealtimeContext,
        );
      }

      return {
        answer: this.stripReferenceSources(answerText),
        sources: [],
        pondName: targetPondName || undefined,
        sourceType: undefined,
        hasLocalKnowledge: false,
        weather: undefined,
      };
    } catch (topErr) {
      if (topErr instanceof HttpException) {
        throw topErr;
      }
      this.logger.error('Error handling askChatbot:', topErr);
      return {
        answer: this.stripReferenceSources(this.buildFallbackResponse(question, [], pondRealtimeContext)),
        sources: [],
        pondName: targetPondName || undefined,
      };
    }
  }

  private buildFallbackResponse(
    question: string,
    topChunks: ChunkMatch[],
    pondRealtimeContext: string,
  ): string {
    let response = '';

    if (pondRealtimeContext) {
      response += `${pondRealtimeContext}\n`;
    }

    if (topChunks.length > 0) {
      topChunks.forEach((chunk) => {
        response += `${chunk.content}\n\n`;
      });
      response += `💡 *Lời khuyên kỹ thuật:* Bạn nên kiểm tra kỹ các thông số ao thực tế vào mỗi buổi sáng và chiều để có biện pháp điều chỉnh kịp thời.`;
    } else {
      response += `🤖 Cảm ơn bạn đã hỏi về: **"${question}"**.\n\n` +
        `Hiện tại trong kho tài liệu chưa có nội dung khớp trực tiếp với câu hỏi này. Bạn có thể hỏi về các chủ đề: **Chỉ số pH, Oxy hòa tan, FCR, Khí độc NH3/NO2, và Bệnh phân trắng**.`;
    }

    return response;
  }

  private stripReferenceSources(text: string): string {
    if (!text) return '';
    return text
      .replace(/(?:\r?\n)+\s*(?:📖\s*|📚\s*)?(?:Nguồn\s*(?:tham\s*khảo|trích\s*dẫn)?|Tài\s*liệu\s*tham\s*khảo|Cẩm\s*nang\s*tham\s*khảo)[\s\S]*$/i, '')
      .trim();
  }

  // ── 5. SEED INITIAL KNOWLEDGE DOCUMENTS ────────────────────────────────────
  private async seedDefaultKnowledge() {
    const initialDocs: CreateDocumentDto[] = [
      {
        title: 'Quy Chuẩn Chất Lượng Nước Nuôi Tôm Thẻ Chân Trắng',
        category: 'WATER_QUALITY',
        content: `Quy chuẩn kỹ thuật quốc gia về môi trường nước ao nuôi tôm thẻ chân trắng (Litopenaeus vannamei):
1. Độ pH: Dao động tối ưu từ 7.5 đến 8.3. Chênh lệch pH giữa sáng (6h) và chiều (14h) không được vượt quá 0.5 đơn vị. Nếu pH dưới 7.5, tôm khó lột xác, mềm vỏ; cần tạt vôi nông nghiệp CaCO3 hoặc vôi tôi Ca(OH)2 liều lượng 10-15 kg/1.000 m3. Nếu pH trên 8.5, khí độc NH3 trở nên cực kỳ độc; cần tạt mật đường hoặc mật rỉ kết hợp vi sinh để kìm hãm sự phát triển của tảo.
2. Hàm lượng Oxy hòa tan (DO): Phải duy trì tối thiểu >= 5.0 mg/L ở mọi tầng nước, đặc biệt là tầng đáy ao. Khi oxy hòa tan xuống dưới 4.0 mg/L, tôm giảm ăn rõ rệt; dưới 3.0 mg/L, tôm nổi đầu tấp mé và nguy cơ chết hàng loạt. Cần bố trí hệ thống quạt nước và sục khí đáy hoạt động liên tục từ 22h đêm đến 6h sáng.
3. Độ kiềm (Alkalinity): Mức an toàn là 120 - 160 mg/L tính theo CaCO3. Độ kiềm giữ ổn định pH. Khi độ kiềm thấp (< 100 mg/L), sử dụng Sodium Bicarbonate (NaHCO3 - soda lạnh) vào ban đêm liều 15-20 kg/1.000 m3.
4. Khí độc: Hàm lượng NH3/NH4+ tự do phải < 0.1 mg/L, Nitrit (NO2-) < 0.2 mg/L, Hydro sulfide (H2S) < 0.03 mg/L. Khi phát hiện khí độc vượt ngưỡng, lập tức giảm 30-50% lượng thức ăn, tăng cường quạt sục khí và tạt vi sinh Yucca hấp thụ khí độc.`,
      },
      {
        title: 'Quản Lý Thức Ăn Và Kéo Giảm Hệ Số Chuyển Đổi FCR',
        category: 'FEEDING',
        content: `Hướng dẫn kỹ thuật quản lý thức ăn và tối ưu hóa hệ số FCR trong nuôi tôm công nghệ cao:
1. Công thức tính FCR: Hệ số FCR = Tổng khối lượng thức ăn đã cho tôm ăn (kg) chia cho Tổng sản lượng tôm thu hoạch (kg). Chỉ số FCR lý tưởng cho tôm thẻ là từ 1.05 đến 1.25.
2. Quy tắc canh nhá (vó ăn):
- Sau khi thả tôm 20 ngày tuổi, bắt đầu đặt nhá để theo dõi sức ăn.
- Mỗi nhá đặt khoảng 0.8 - 1% lượng thức ăn của cữ ăn đó.
- Kiểm tra nhá sau 1.5 - 2 giờ: Nếu nhá hết sạch thức ăn và đường ruột tôm đầy đặn, tăng 5% lượng thức ăn ở cữ tiếp theo. Nếu nhá còn thừa thức ăn từ 5-10%, giữ nguyên cữ sau. Nếu còn thừa > 10%, giảm ngay 20-30% thức ăn hoặc cắt cữ tiếp theo để tránh làm ô nhiễm đáy ao.
3. Chia cữ ăn khoa học: Nên chia làm 4 - 5 cữ ăn mỗi ngày (6h00, 10h00, 14h00, 18h00, 21h00). Cữ ăn sáng và chiều tối nên cho lượng thức ăn nhiều hơn cữ trưa khi nhiệt độ nước quá cao.
4. Bổ sung dưỡng chất: Trộn men vi sinh đường ruột (Bacillus subtilis, Lactobacillus), Beta-glucan tăng miễn dịch và Acid hữu cơ để bảo vệ gan tụy và cải thiện khả năng tiêu hóa, giúp tôm hấp thụ triệt để thức ăn.`,
      },
      {
        title: 'Phòng Ngừa Và Điều Trị Bệnh Đục Cơ Và Phân Trắng',
        category: 'SHRIMP_DISEASE',
        content: `Phác đồ phòng trị các bệnh phổ biến trên tôm nuôi nước lợ:
1. Bệnh Đục Cơ và Cong Thân (Muscle Necrosis):
- Nguyên nhân: Do tôm bị sốc nhiệt khi kiểm tra nhá vào lúc trời nắng gắt, hoặc do thiếu hụt các khoáng chất vi lượng thiết yếu như Canxi, Magie, Kali (tỷ lệ Ca:Mg:K mất cân bằng).
- Biểu hiện: Cơ thịt phần đuôi hoặc toàn thân tôm bị mờ đục như nước gạo, cơ co quắp không duỗi thẳng được, tôm lột xác dính vỏ và rớt đáy.
- Phác đồ điều trị: Tuyệt đối không kéo nhá hoặc tác động mạnh vào ao lúc trời nắng gắt từ 11h - 14h. Tạt khoáng tạt chuyên dụng vào ban đêm (liều lượng 5 - 10 kg/1.000 m3) kết hợp bổ sung Kali (KCl) và Magie (MgCl2) liên tục trong 3 ngày.
2. Bệnh Phân Trắng (White Feces Disease):
- Nguyên nhân: Do nhiễm khuẩn Vibrio parahaemolyticus hoặc vi bào tử trùng Enterocytozoon hepatopenaei (EHP) kết hợp với thức ăn bị ẩm mốc độc tố mycotoxin.
- Biểu hiện: Xuất hiện các sợi phân màu trắng nổi trên mặt nước theo hướng gió, tôm bị ốp thân, ruột đứt khúc hoặc rỗng ruột, gan tụy teo nhợt nhạt.
- Phác đồ điều trị: Ngừng cho ăn hoàn toàn 1 ngày. Xi-phông sạch đáy ao và diệt khuẩn nước nguồn bằng Iodine hoặc BKC lúc 18h tối. Sau đó cho ăn lại với 50% khẩu phần, trộn tinh dầu tỏi lên men, thảo dược bảo vệ gan và men tiêu hóa sống liều cao liên tục 5 - 7 ngày.`,
      },
    ];

    for (const docDto of initialDocs) {
      await this.createDocument(docDto, 'SYSTEM_SEED');
    }
    this.logger.log(
      'Seed completed: 3 knowledge documents with OpenAI vector chunks successfully created.',
    );
  }
}
