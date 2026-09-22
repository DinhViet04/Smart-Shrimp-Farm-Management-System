import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import OpenAI from 'openai';
import { AskChatbotDto } from './dto/ask-chatbot.dto';
import { CreateDocumentDto } from './dto/create-document.dto';

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

  constructor(private readonly prisma: PrismaService) {
    this.apiKey = process.env.OPENAI_API_KEY || null;
    if (this.apiKey) {
      this.openai = new OpenAI({ apiKey: this.apiKey });
      this.logger.log('OpenAI ChatGPT API initialized successfully for RAG Chatbot.');
    } else {
      this.logger.warn('OPENAI_API_KEY not found in environment. Chatbot will use built-in local semantic matching fallback.');
    }
  }

  async onModuleInit() {
    // Tự động kiểm tra và nạp sẵn tài liệu tri thức mẫu nếu database chưa có
    try {
      const docCount = await this.prisma.knowledgeDocument.count();
      if (docCount === 0) {
        this.logger.log('Seeding initial smart shrimp farming knowledge documents...');
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
        this.logger.warn('OpenAI embedding failed, falling back to local vectorizer:', err.message);
      }
    }
    // Fallback: Tạo vector 64 chiều đơn giản nếu chưa có API Key
    return this.createLocalVector(text);
  }

  private createLocalVector(text: string, dimensions = 64): number[] {
    const vector = new Array(dimensions).fill(0);
    const words = text.toLowerCase().replace(/[^\w\sà-ỹ]/g, '').split(/\s+/).filter(Boolean);
    if (words.length === 0) return vector;

    words.forEach(word => {
      let hash = 0;
      for (let i = 0; i < word.length; i++) {
        hash = (hash << 5) - hash + word.charCodeAt(i);
        hash |= 0;
      }
      const index = Math.abs(hash) % dimensions;
      vector[index] += 1;
    });

    const norm = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    return norm > 0 ? vector.map(val => val / norm) : vector;
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
  private splitTextIntoChunks(text: string, maxChunkLength = 600, overlap = 100): string[] {
    if (!text || text.length <= maxChunkLength) return [text.trim()];

    const chunks: string[] = [];
    let startIndex = 0;

    while (startIndex < text.length) {
      let endIndex = startIndex + maxChunkLength;

      if (endIndex < text.length) {
        const punctuationIndex = Math.max(
          text.lastIndexOf('\n', endIndex),
          text.lastIndexOf('. ', endIndex),
          text.lastIndexOf('? ', endIndex)
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

  // ── 4. RAG RETRIEVAL & CHATGPT GENERATION (OpenAI gpt-4o-mini) ──────────────
  async ask(dto: AskChatbotDto, currentUser?: any) {
    const question = dto.question.trim();
    if (!question) {
      return { answer: 'Vui lòng nhập câu hỏi của bạn.' };
    }

    // 1. Embedding câu hỏi
    const questionEmbedding = await this.getEmbedding(question);

    // 2. Tìm kiếm Top-K chunks tương đồng nhất
    const allChunks = await this.prisma.knowledgeChunk.findMany({
      include: { document: true },
    });

    const matches: ChunkMatch[] = [];

    for (const chunk of allChunks) {
      if (!chunk.embedding) continue;
      const chunkVector = Array.isArray(chunk.embedding) ? (chunk.embedding as number[]) : [];
      if (chunkVector.length === 0) continue;

      const score = this.cosineSimilarity(questionEmbedding, chunkVector);
      if (score > 0.15) {
        matches.push({
          documentTitle: chunk.document.title,
          chunkIndex: chunk.chunkIndex,
          content: chunk.content,
          score: Math.round(score * 100) / 100,
        });
      }
    }

    matches.sort((a, b) => b.score - a.score);
    const topChunks = matches.slice(0, 3);

    // 3. Nếu người dùng hỏi về ao cụ thể, lấy dữ liệu ao thực tế
    let pondRealtimeContext = '';
    let targetPondName = '';

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
          targetPondName = pond.name;
          const latestWater = pond.waterQualityRecords[0];
          const activeCrop = pond.crops[0];

          pondRealtimeContext = `\n[DỮ LIỆU THỰC TẾ AO NUÔI ${pond.name.toUpperCase()}]:\n` +
            `- Diện tích: ${pond.areaSize} m², Độ sâu: ${pond.depth} m (Trang trại: ${pond.farm?.name || 'Không rõ'})\n` +
            (activeCrop ? `- Vụ nuôi: Bắt đầu ${new Date(activeCrop.startDate).toLocaleDateString('vi-VN')}, Số lượng giống: ${activeCrop.initialShrimpCount.toLocaleString()} con\n` : '- Trạng thái: Chưa có vụ nuôi nào đang hoạt động\n') +
            (latestWater ? `- Chỉ số đo nước gần nhất: pH: ${latestWater.ph ?? 'Chưa đo'}, Oxy hòa tan: ${latestWater.dissolvedOxygen ?? 'Chưa đo'} mg/L, Độ mặn: ${latestWater.salinity ?? 'Chưa đo'}‰, Nhiệt độ: ${latestWater.temperature ?? 'Chưa đo'}°C, Khí độc NH3: ${latestWater.nh3 ?? 'Chưa đo'} mg/L, NO2: ${latestWater.no2 ?? 'Chưa đo'} mg/L.\n` : '- Chưa có bản ghi đo chất lượng nước gần đây.\n');
        }
      } catch (e) {
        this.logger.warn('Failed to fetch pond realtime context:', e);
      }
    }

    // 4. Sinh câu trả lời với OpenAI ChatGPT (gpt-4o-mini)
    let answerText = '';

    if (this.openai && this.apiKey) {
      try {
        const contextDocuments = topChunks.length > 0
          ? topChunks.map((c, i) => `[TÀI LIỆU THAM KHẢO ${i + 1} - "${c.documentTitle}"]: ${c.content}`).join('\n\n')
          : 'Không tìm thấy tài liệu phù hợp trong kho tri thức.';

        const systemPrompt = `Bạn là Trợ lý Kỹ thuật Nuôi Tôm Thông Minh AI của hệ thống Smart Shrimp Farm Management.
Nhiệm vụ của bạn là giải đáp câu hỏi của người nuôi tôm dựa trên TÀI LIỆU KHO TRI THỨC và DỮ LIỆU THỰC TẾ được cung cấp dưới đây.

${pondRealtimeContext}

KHO TÀI LIỆU TRÍCH XUẤT (RAG CONTEXT):
${contextDocuments}

YÊU CẦU TRẢ LỜI:
1. Trả lời bằng tiếng Việt thân thiện, văn phong kỹ sư chuyên môn nuôi tôm, gạch đầu dòng rõ ràng, súc tích.
2. Ưu tiên dựa trên dữ liệu tài liệu đã cung cấp. Nếu câu hỏi có nhắc tới chỉ số ao thật, hãy phân tích dựa trên dữ liệu đo của ao.
3. Cuối câu trả lời, hãy nêu rõ nguồn tài liệu tham khảo đã dùng để người nuôi yên tâm.`;

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
        answerText = this.buildFallbackResponse(question, topChunks, pondRealtimeContext);
      }
    } else {
      answerText = this.buildFallbackResponse(question, topChunks, pondRealtimeContext);
    }

    return {
      answer: answerText,
      sources: topChunks.map(c => ({
        title: c.documentTitle,
        chunkIndex: c.chunkIndex,
        snippet: c.content.slice(0, 160) + '...',
        relevanceScore: c.score,
      })),
      pondName: targetPondName || undefined,
    };
  }

  private buildFallbackResponse(question: string, topChunks: ChunkMatch[], pondRealtimeContext: string): string {
    let response = '';

    if (pondRealtimeContext) {
      response += `${pondRealtimeContext}\n`;
    }

    if (topChunks.length > 0) {
      response += `📚 **Dựa trên tài liệu kỹ thuật nuôi tôm:**\n\n`;
      topChunks.forEach((chunk, idx) => {
        response += `• **Từ "${chunk.documentTitle}" (Độ liên quan ${Math.round(chunk.score * 100)}%):**\n${chunk.content}\n\n`;
      });
      response += `💡 *Lời khuyên kỹ thuật:* Bạn nên kiểm tra kỹ các thông số ao thực tế vào mỗi buổi sáng và chiều để có biện pháp điều chỉnh kịp thời.`;
    } else {
      response += `🤖 Cảm ơn bạn đã hỏi về: **"${question}"**.\n\n` +
        `Hiện tại trong kho tài liệu chưa có đoạn trích nào khớp chính xác với câu hỏi này. Bạn có thể tải thêm tài liệu quy chuẩn vào hệ thống hoặc hỏi về các chủ đề: **Chỉ số pH, Oxy hòa tan, FCR, Khí độc NH3/NO2, và Bệnh phân trắng**.`;
    }

    return response;
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
    this.logger.log('Seed completed: 3 knowledge documents with OpenAI vector chunks successfully created.');
  }
}
