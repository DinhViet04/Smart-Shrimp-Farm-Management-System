import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import OpenAI from 'openai';
import { CropStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthUser, FarmAccessService } from '../farm-access/farm-access.service';
import { FarmsService } from '../farms/farms.service';
import { PondsService } from '../ponds/ponds.service';
import { CropsService } from '../crops/crops.service';
import { ExecuteActionDto } from './dto/execute-action.dto';

export type AgentActionIntent = 'CREATE_FARM' | 'CREATE_POND' | 'CREATE_CROP';

/**
 * Danh mục 63 Tỉnh/Thành phố Việt Nam khớp 100% với form tạo trang trại thủ công (FarmFormModal)
 */
export const VIETNAM_PROVINCES = [
  'An Giang', 'Bà Rịa - Vũng Tàu', 'Bắc Giang', 'Bắc Kạn', 'Bạc Liêu', 'Bắc Ninh',
  'Bến Tre', 'Bình Định', 'Bình Dương', 'Bình Phước', 'Bình Thuận', 'Cà Mau',
  'Cần Thơ', 'Cao Bằng', 'Đà Nẵng', 'Đắk Lắk', 'Đắk Nông', 'Điện Biên',
  'Đồng Nai', 'Đồng Tháp', 'Gia Lai', 'Hà Giang', 'Hà Nam', 'Hà Nội',
  'Hà Tĩnh', 'Hải Dương', 'Hải Phòng', 'Hậu Giang', 'Hòa Bình', 'Hưng Yên',
  'Khánh Hòa', 'Kiên Giang', 'Kon Tum', 'Lai Châu', 'Lâm Đồng', 'Lạng Sơn',
  'Lào Cai', 'Long An', 'Nam Định', 'Nghệ An', 'Ninh Bình', 'Ninh Thuận',
  'Phú Thọ', 'Phú Yên', 'Quảng Bình', 'Quảng Nam', 'Quảng Ngãi', 'Quảng Ninh',
  'Quảng Trị', 'Sóc Trăng', 'Sơn La', 'Tây Ninh', 'Thái Bình', 'Thái Nguyên',
  'Thanh Hóa', 'Thừa Thiên Huế', 'Tiền Giang', 'TP Hồ Chí Minh', 'Trà Vinh',
  'Tuyên Quang', 'Vĩnh Long', 'Vĩnh Phúc', 'Yên Bái'
];

export function normalizeVietnamese(str: string): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function matchVietnamProvince(raw: string): string | null {
  if (!raw) return null;
  const nRaw = normalizeVietnamese(raw);

  if (/^(hcm|sai gon|tphcm|ho chi minh|thanh pho ho chi minh)$/i.test(nRaw)) return 'TP Hồ Chí Minh';
  if (/^(vung tau|ba ria|ba ria vung tau)$/i.test(nRaw)) return 'Bà Rịa - Vũng Tàu';
  if (/^(hue|thua thien|thua thien hue)$/i.test(nRaw)) return 'Thừa Thiên Huế';

  for (const p of VIETNAM_PROVINCES) {
    if (normalizeVietnamese(p) === nRaw) return p;
  }
  for (const p of VIETNAM_PROVINCES) {
    const np = normalizeVietnamese(p);
    if (nRaw.includes(np)) return p;
  }
  for (const p of VIETNAM_PROVINCES) {
    const np = normalizeVietnamese(p);
    if (np.includes(nRaw) && nRaw.length >= 4) return p;
  }
  return null;
}

export function findProvinceInText(text: string): string | null {
  if (!text) return null;
  const nText = normalizeVietnamese(text);

  if (/\b(thua thien hue|thua thien|hue)\b/i.test(nText)) return 'Thừa Thiên Huế';
  if (/\b(hcm|sai gon|tphcm|ho chi minh)\b/i.test(nText)) return 'TP Hồ Chí Minh';
  if (/\b(ba ria vung tau|vung tau|ba ria)\b/i.test(nText)) return 'Bà Rịa - Vũng Tàu';

  const sorted = [...VIETNAM_PROVINCES].sort((a, b) => b.length - a.length);
  for (const p of sorted) {
    const np = normalizeVietnamese(p);
    if (new RegExp(`\\b${np}\\b`, 'i').test(nText)) {
      return p;
    }
  }
  return null;
}

export function findAreaInText(text: string): number | null {
  if (!text) return null;

  // 1. Khớp Hecta / ha: 10ha, 10 ha, 10 hecta, 2.5ha
  const haMatch = text.match(/(\d+(?:[.,]\d+)?)\s*(?:ha|hecta|héc ta)\b/i);
  if (haMatch) {
    const num = parseFloat(haMatch[1].replace(',', '.'));
    if (!isNaN(num) && num > 0) return Math.round(num * 10000);
  }

  // 2. Khớp Mét vuông: 100000m2, 100.000m2, 100,000 m2, 100000 m²
  const m2Match = text.match(/(\d{1,3}(?:[.,]\d{3})*|\d+)\s*(?:m2|m²|mét vuông|met vuong)\b/i);
  if (m2Match) {
    const cleanNum = m2Match[1].replace(/[.,]/g, '');
    const num = parseInt(cleanNum, 10);
    if (!isNaN(num) && num > 0) return num;
  }

  // 3. Khớp số sau từ "diện tích là" / "diện tích"
  const areaExplicit = text.match(/diện tích\s*(?:là|khoảng|đạt)?\s*(\d+)/i);
  if (areaExplicit) {
    const num = parseInt(areaExplicit[1], 10);
    if (!isNaN(num) && num > 0) {
      if (num <= 100) return num * 10000;
      return num;
    }
  }

  return null;
}

export function toTitleCase(str: string): string {
  if (!str) return '';
  return str
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export function findFarmNameInText(text: string): string | null {
  if (!text) return null;
  let cleanText = text.replace(/^(?:tôi muốn|hãy|bạn hãy|vui lòng|làm ơn)?\s*(?:tạo|thêm|khởi tạo|lập)\s+/i, '');

  const parts = cleanText.split(/\s+(?:địa chỉ\s*(?:là|ở|tại)?|ở|tại|diện tích\s*(?:là|khoảng)?|quy mô)\s+/i);
  const candidate = parts[0]?.trim();

  if (candidate) {
    const m = candidate.match(/(?:tên\s+là\s+|tên\s*:\s*)?(trang trại\s+[A-ZÀ-Ỹa-zà-ỹ0-9\s]+|[A-ZÀ-Ỹa-zà-ỹ0-9\s]+)/i);
    if (m && m[1]) {
      let name = m[1].replace(/[,.;:]+$/, '').trim();
      name = name.replace(/\s+\d+\s*(?:ha|m2|m²|hecta)\b/i, '').trim();
      if (name.length >= 2 && !/^(trang trại|mới|này|của tôi|được không|nhé)$/i.test(name)) {
        if (!/^trang trại/i.test(name)) {
          name = 'Trang trại ' + name;
        }
        return toTitleCase(name);
      }
    }
  }
  return null;
}

export interface AgentActionDraft {
  type: 'SLOT_FILLING' | 'CONFIRM_ACTION';
  intent: AgentActionIntent;
  collectedData: Record<string, any>;
  missingFields: string[];
  quickSuggestions?: string[];
  summary?: Record<string, string>;
}

export interface AgentActionResult {
  isAgentAction: boolean;
  answer?: string;
  actionDraft?: AgentActionDraft;
}

@Injectable()
export class AgentActionService {
  private readonly logger = new Logger(AgentActionService.name);
  private openai: OpenAI | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly farmAccess: FarmAccessService,
    private readonly farmsService: FarmsService,
    private readonly pondsService: PondsService,
    private readonly cropsService: CropsService,
  ) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (apiKey) {
      this.openai = new OpenAI({ apiKey });
      this.logger.log('OpenAI AgentActionService initialized successfully.');
    } else {
      this.logger.warn('OPENAI_API_KEY not configured for AgentActionService.');
    }
  }

  /**
   * Xử lý hội thoại AI chuyên sâu với OpenAI gpt-4o-mini
   */
  async handleAgentConversation(
    question: string,
    currentUser: AuthUser,
    history?: Array<{ sender: 'user' | 'ai'; text: string }>,
    pendingAction?: { intent: AgentActionIntent; collectedData: Record<string, any> },
  ): Promise<AgentActionResult | null> {
    const q = question.trim();
    if (!q) return null;

    const lower = q.toLowerCase();

    // 1. Kiểm tra yêu cầu hủy bỏ (Cancel flow)
    const isCancelRequest = /^(hủy|thôi|dừng|bỏ qua|không tạo nữa|hủy bỏ|cancel|thôi nhé)/i.test(lower);
    if (isCancelRequest && pendingAction?.intent) {
      return {
        isAgentAction: true,
        answer: 'Dạ, tôi đã hủy tiến trình khởi tạo theo yêu cầu của bạn. Bất cứ khi nào bạn cần hỗ trợ thêm thông tin kỹ thuật hay quản lý ao, tôi luôn sẵn sàng!',
        actionDraft: undefined,
      };
    }

    // 2. Kiểm tra ý định tạo mới thực thể (Create Intent)
    const isExplicitCreate =
      /(tạo|thêm|khởi tạo|lập|mở|setup|thả giống|bắt đầu vụ|thả tôm)\s+(trang trại|ao|vụ|farm|pond|crop)/i.test(lower) ||
      /^(tạo|khởi tạo|thêm)\s+/i.test(lower) ||
      /^(tạo trang trại|tạo ao|tạo vụ|thả giống)$/i.test(lower) ||
      /(tạo|thêm|khởi tạo)\s+(mới|thêm)\b/i.test(lower);

    const isContinuingPending = Boolean(pendingAction?.intent);

    if (!isExplicitCreate && !isContinuingPending) {
      return null;
    }

    if (currentUser.role === 'ADMIN') {
      return {
        isAgentAction: true,
        answer:
          'Tài khoản Quản trị viên hệ thống (ADMIN) chỉ thực hiện giám sát vận hành và quản trị nền tảng, không trực tiếp tạo trang trại, ao nuôi hoặc vụ nuôi.',
        actionDraft: undefined,
      };
    }

    // 3. Thu thập ngữ cảnh cơ sở dữ liệu thực tế của người dùng
    const accessibleFarmIds = await this.farmAccess.getAccessibleFarmIds(currentUser);
    const farms = await this.prisma.farm.findMany({
      where: { id: { in: accessibleFarmIds }, deletedAt: null },
      select: { id: true, name: true, address: true, area: true, farmingModel: true },
      orderBy: { createdAt: 'desc' },
    });

    const ponds = await this.prisma.pond.findMany({
      where: { farmId: { in: accessibleFarmIds } },
      include: {
        farm: { select: { id: true, name: true, area: true } },
        crops: {
          where: { status: CropStatus.ACTIVE },
          select: { id: true, startDate: true, initialShrimpCount: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const pondsWithStatus = ponds.map((p) => ({
      id: p.id,
      name: p.name,
      farmId: p.farmId,
      farmName: p.farm?.name || '',
      farmTotalArea: p.farm?.area || 0,
      areaSize: p.areaSize,
      depth: p.depth,
      hasActiveCrop: p.crops.length > 0,
      activeCropInfo: p.crops[0] || null,
    }));

    const emptyPonds = pondsWithStatus.filter((p) => !p.hasActiveCrop);

    // 4. Trích xuất thực thể theo Heuristics từ tin nhắn hiện tại của người dùng
    const heuristicFarmName = findFarmNameInText(q);
    const heuristicProvince = findProvinceInText(q);
    const heuristicArea = findAreaInText(q);

    // 5. Sử dụng OpenAI gpt-4o-mini
    if (this.openai) {
      try {
        const result = await this.processWithOpenAI(
          question,
          history || [],
          pendingAction,
          { farms, ponds: pondsWithStatus, emptyPonds },
          { name: heuristicFarmName, address: heuristicProvince, area: heuristicArea },
        );
        if (result) return result;
      } catch (err: any) {
        this.logger.error(`OpenAI Agent Action error: ${err?.message || err}`, err.stack);
      }
    }

    // Fallback cơ bản nếu OpenAI gặp sự cố hoặc timeout
    return this.fallbackHandler(
      q,
      pendingAction,
      farms,
      pondsWithStatus,
      emptyPonds,
      { name: heuristicFarmName, address: heuristicProvince, area: heuristicArea },
    );
  }

  /**
   * Xử lý bằng OpenAI ChatGPT gpt-4o-mini với Structured Output JSON
   */
  private async processWithOpenAI(
    userMessage: string,
    history: Array<{ sender: 'user' | 'ai'; text: string }>,
    pendingAction: { intent?: AgentActionIntent; collectedData?: Record<string, any> } | undefined,
    db: {
      farms: Array<{ id: string; name: string; address?: string | null; area?: number | null }>;
      ponds: Array<{ id: string; name: string; farmId: string; farmName: string; farmTotalArea: number; areaSize: number; depth: number; hasActiveCrop: boolean; activeCropInfo: any }>;
      emptyPonds: Array<{ id: string; name: string; farmId: string; farmName: string; areaSize: number; depth: number }>;
    },
    heuristics: { name: string | null; address: string | null; area: number | null },
  ): Promise<AgentActionResult | null> {
    const systemPrompt = `Bạn là Kỹ sư Trưởng kiêm Chuyên gia Quản lý Trang trại Tôm Thông minh SSFM.
Bạn giao tiếp bằng tiếng Việt tự nhiên, lịch thiệp, sắc sảo, phong cách chuyên gia nuôi tôm giàu kinh nghiệm (xưng "tôi" hoặc "em", gọi người dùng là "bạn" hoặc "anh/chị").
TUYỆT ĐỐI TRÁNH ngôn từ máy móc kiểu robot (như: "Hệ thống ghi nhận...", "Agent action đã đối chiếu...", "Chức năng thực thi...").

QUY CHUẨN THỨ BẬC VÒNG ĐỜI NUÔI TÔM BẮT BUỘC (LIFECYCLE HIERARCHY):
1. BƯỚC 1: KHỞI TẠO TRANG TRẠI (intent: "CREATE_FARM")
   - Các thông tin bắt buộc:
     + name: Tên trang trại (Viết hoa trang trọng, vd: "Trang trại Tôm Huế", "Trang trại Ba Tri").
     + address: Tỉnh/Thành phố thuộc danh mục 63 tỉnh thành Việt Nam (đối chiếu chuẩn xác).
     + area: Tổng diện tích trang trại tính theo mét vuông (m2). 1 ha = 10.000 m2 (vd 10ha hay 100000m2 -> 100000).
     + farmingModel: "HIGH_TECH" (Mặc định: Công nghệ cao lót bạt / tuần hoàn) hoặc "TRADITIONAL" (Quảng canh).
   - Nếu người dùng chỉ nói chung chung "tạo trang trại", hãy phản hồi lịch sự hỏi 3 thông tin trên kèm ví dụ mẫu dễ hiểu.

2. BƯỚC 2: KHỞI TẠO AO NUÔI (intent: "CREATE_POND")
   - ĐIỀU KIỆN BẮT BUỘC: Người dùng phải có ít nhất 1 Trang trại trước (${db.farms.length} trang trại hiện có).
     + Nếu CHƯA có trang trại nào (${db.farms.length} === 0): BẮT BUỘC giải thích quy trình kỹ thuật cần tạo Trang trại trước và tự động chuyển sang hướng dẫn tạo Trang trại.
     + Nếu có đúng 1 trang trại duy nhất: Tự động gán ao thuộc trang trại đó.
     + Nếu có nhiều hơn 1 trang trại: Hỏi người dùng muốn tạo ao cho trang trại nào.
   - Các thông tin bắt buộc:
     + farmId: ID trang trại sở hữu.
     + name: Tên ao (vd: "Ao 1", "Ao Tròn 02").
     + areaSize: Diện tích mặt nước (m2) (tiêu chuẩn 1.000 - 3.000 m2).
     + depth: Độ sâu mực nước (m) (mặc định 1.5m).

3. BƯỚC 3: KHỞI TẠO VỤ NUÔI / THẢ GIỐNG (intent: "CREATE_CROP")
   - ĐIỀU KIỆN BẮT BUỘC: Phải có Trang trại VÀ có ít nhất 1 Ao nuôi ĐANG TRỐNG (${db.emptyPonds.length} ao trống hiện có).
     + Nếu chưa có ao hoặc tất cả ao đều đang có vụ (hasActiveCrop = true): Giải thích rõ ao đang bận, cần thu hoạch trước hoặc tạo ao mới.
   - Các thông tin bắt buộc:
     + pondId: ID ao nuôi đang trống được chọn.
     + initialShrimpCount: Số lượng tôm giống thả (con).
     + startDate: Ngày thả giống (YYYY-MM-DD, mặc định hôm nay).
   - Đánh giá mật độ thả nuôi (con/m²):
     + 80 - 150 con/m2: Chuẩn tối ưu công nghệ cao.
     + > 180 con/m2: Mật độ cao, cảnh báo oxy đáy.
     + < 60 con/m2: Nuôi thưa / sinh thái.

DANH MỤC 63 TỈNH/THÀNH PHỐ VIỆT NAM (CHUẨN FORM TẠO THỦ CÔNG):
${VIETNAM_PROVINCES.join(', ')}

DỮ LIỆU HIỆN TẠI CỦA TÀI KHOẢN NÀY:
- Trang trại (${db.farms.length}): ${JSON.stringify(db.farms.map((f) => ({ id: f.id, name: f.name, address: f.address, area: f.area })))}
- Ao nuôi (${db.ponds.length}): ${JSON.stringify(db.ponds.map((p) => ({ id: p.id, name: p.name, farmId: p.farmId, farmName: p.farmName, areaSize: p.areaSize, hasActiveCrop: p.hasActiveCrop })))}
- Ao đang trống (${db.emptyPonds.length}): ${JSON.stringify(db.emptyPonds.map((p) => ({ id: p.id, name: p.name, farmName: p.farmName, areaSize: p.areaSize })))}
${pendingAction?.intent ? `- Pending Action: intent="${pendingAction.intent}", data=${JSON.stringify(pendingAction.collectedData || {})}` : ''}

QUY TẮC BẮT BUỘC KHI TRÍCH XUẤT:
1. TUYỆT ĐỐI KHÔNG TỰ BỊA ĐẶT DỮ LIỆU (như "Trang trại Tôm Xanh", "3ha"). Chỉ lấy đúng thông tin người dùng cung cấp trong câu hỏi!
2. Phân định status:
   - "SLOT_FILLING": Thiếu 1 hoặc nhiều trường bắt buộc. Hỏi nhã nhặn đúng thông tin còn thiếu.
   - "CONFIRM_ACTION": Đã có ĐỦ thông tin bắt buộc. Tạo lời đáp chuyên nghiệp và bảng summary.

TRẢ VỀ ĐỊNH DẠNG JSON SCHEMA:
{
  "isActionIntent": true,
  "intent": "CREATE_FARM" | "CREATE_POND" | "CREATE_CROP" | null,
  "status": "SLOT_FILLING" | "CONFIRM_ACTION" | "NOT_ACTION",
  "collectedData": { "name"?: string, "address"?: string, "area"?: number, ... },
  "missingFields": [ "name", "address", "area" ],
  "replyText": "Câu trả lời lịch sự, thân thiện của chuyên gia...",
  "quickSuggestions": [ "gợi ý 1", "gợi ý 2" ]
}`;

    const completion = await this.openai!.chat.completions.create({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        ...history.slice(-6).map((h) => ({
          role: (h.sender === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
          content: h.text,
        })),
        { role: 'user', content: userMessage },
      ],
      temperature: 0.1,
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) return null;

    let parsed: any;
    try {
      parsed = JSON.parse(content);
    } catch {
      return null;
    }

    if (!parsed.isActionIntent || parsed.status === 'NOT_ACTION' || !parsed.intent) {
      return null;
    }

    // Hợp nhất dữ liệu: Ưu tiên Heuristic trực tiếp từ tin nhắn của user > OpenAI parsed > Pending action cũ
    const collected: Record<string, any> = {
      ...(pendingAction?.collectedData || {}),
      ...(parsed.collectedData || {}),
    };

    // Override bằng Heuristics trực tiếp nếu người dùng vừa nhập trong tin nhắn này
    if (heuristics.name) collected.name = heuristics.name;
    if (heuristics.address) collected.address = heuristics.address;
    if (heuristics.area) collected.area = heuristics.area;

    // ─────────────────────────────────────────────────────────────────────────
    // 1. XỬ LÝ CHUYÊN SÂU: CREATE_FARM
    // ─────────────────────────────────────────────────────────────────────────
    if (parsed.intent === 'CREATE_FARM') {
      if (!collected.farmingModel) collected.farmingModel = 'HIGH_TECH';
      if (collected.area) collected.area = Number(collected.area);

      // Chuẩn hóa tên trang trại
      if (collected.name) {
        collected.name = toTitleCase(String(collected.name));
      }

      // Đối chiếu địa chỉ với 63 tỉnh thành Việt Nam
      if (collected.address) {
        const matched = matchVietnamProvince(String(collected.address));
        if (matched) {
          collected.address = matched;
        } else {
          return {
            isAgentAction: true,
            answer: `Dạ, địa chỉ **"${collected.address}"** chưa khớp với danh mục 63 Tỉnh/Thành phố của hệ thống (giống biểu mẫu tạo trang trại thủ công).\n\nTrang trại của bạn thuộc **Tỉnh/Thành phố** nào ở Việt Nam? Bạn có thể chọn nhanh bên dưới hoặc nhắn tên tỉnh nhé:`,
            actionDraft: {
              type: 'SLOT_FILLING',
              intent: 'CREATE_FARM',
              collectedData: collected,
              missingFields: ['address'],
              quickSuggestions: ['Thừa Thiên Huế', 'Bến Tre', 'Cà Mau', 'Bạc Liêu', 'Sóc Trăng'],
            },
          };
        }
      }

      // Kiểm tra trùng lặp tên trang trại của người dùng
      if (collected.name) {
        const isDuplicate = db.farms.some(
          (f) => f.name.trim().toLowerCase() === String(collected.name || '').trim().toLowerCase(),
        );
        if (isDuplicate) {
          return {
            isAgentAction: true,
            answer: `Hệ thống ghi nhận bạn đã có một trang trại mang tên **"${collected.name}"**. Để tránh nhầm lẫn trong giám sát ao nuôi và báo cáo, bạn vui lòng chọn tên khác cho trang trại mới nhé!`,
            actionDraft: {
              type: 'SLOT_FILLING',
              intent: 'CREATE_FARM',
              collectedData: { ...collected, name: undefined },
              missingFields: ['name'],
              quickSuggestions: [`${collected.name} 2`, `${collected.name} Mới`],
            },
          };
        }
      }

      const hasAll = Boolean(collected.name && collected.address && collected.area && !isNaN(collected.area));
      if (hasAll) {
        const ha = (Number(collected.area) / 10000).toFixed(1);
        const summary: Record<string, string> = {
          'Tên trang trại': String(collected.name),
          'Địa chỉ / Vị trí': String(collected.address),
          'Tổng diện tích': `${Number(collected.area).toLocaleString('vi-VN')} m² (${ha} ha)`,
          'Mô hình canh tác':
            collected.farmingModel === 'TRADITIONAL'
              ? 'Quảng canh / Truyền thống'
              : 'Công nghệ cao (High-Tech lót bạt / tuần hoàn)',
        };

        const reply = `Dạ, tôi đã tiếp nhận và chuẩn hóa đầy đủ thông tin để khởi tạo **${collected.name}** tại **${collected.address}** với diện tích **${Number(collected.area).toLocaleString('vi-VN')} m² (${ha} ha)**.\n\nBảng thông số kỹ thuật bên dưới đã sẵn sàng, bạn hãy kiểm tra lại và bấm **"Xác nhận tạo ngay"** để tôi lưu vào hệ thống nhé!`;

        return {
          isAgentAction: true,
          answer: reply,
          actionDraft: {
            type: 'CONFIRM_ACTION',
            intent: 'CREATE_FARM',
            collectedData: collected,
            missingFields: [],
            summary,
          },
        };
      } else {
        // Còn thiếu thông tin
        const missing: string[] = [];
        if (!collected.name) missing.push('name');
        if (!collected.address) missing.push('address');
        if (!collected.area) missing.push('area');

        let reply = parsed.replyText;
        if (!reply || missing.length === 3) {
          reply = `Dạ, tôi rất sẵn lòng hỗ trợ bạn khởi tạo **Trang trại nuôi tôm mới** vào hệ thống SSFM!\n\nĐể hồ sơ trang trại được thiết lập chuẩn xác (khớp theo biểu mẫu tạo thủ công), bạn vui lòng cung cấp giúp tôi 3 thông tin cơ bản sau:\n1. 🏷️ **Tên trang trại** *(Ví dụ: Trang trại Tôm Huế, Trang trại Tôm Ba Tri)*\n2. 📍 **Địa chỉ (Tỉnh/Thành phố)** *(Khớp với danh mục 63 tỉnh thành: Thừa Thiên Huế, Bến Tre, Bạc Liêu, Cà Mau...)*\n3. 📐 **Tổng diện tích** *(Ví dụ: 100.000 m² hoặc 10 hecta)*\n\n👉 *Bạn có thể nhắn nhanh cả 3 thông tin trong 1 câu (Ví dụ: "Trang trại Tôm Huế ở Thừa Thiên Huế diện tích 10ha"), tôi sẽ chuẩn hóa và tạo phiếu xác nhận ngay cho bạn nhé!*`;
        }

        return {
          isAgentAction: true,
          answer: reply,
          actionDraft: {
            type: 'SLOT_FILLING',
            intent: 'CREATE_FARM',
            collectedData: collected,
            missingFields: missing,
            quickSuggestions: [
              'Trang trại Tôm Huế 10ha ở Thừa Thiên Huế',
              'Trang trại Tôm Bến Tre 5ha ở Bến Tre',
              'Trang trại Tôm Bạc Liêu 3ha ở Bạc Liêu',
            ],
          },
        };
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 2. XỬ LÝ CHUYÊN SÂU: CREATE_POND
    // ─────────────────────────────────────────────────────────────────────────
    if (parsed.intent === 'CREATE_POND') {
      // KIỂM TRA ĐIỀU KIỆN TIÊN QUYẾT: PHẢI CÓ TRANG TRẠI TRƯỚC
      if (db.farms.length === 0) {
        return {
          isAgentAction: true,
          answer: `Dạ, theo quy chuẩn quản lý trang trại của hệ thống SSFM, mỗi **Ao nuôi** bắt buộc phải trực thuộc một **Trang trại** cụ thể.\n\nHiện tại hệ thống chưa ghi nhận trang trại nào của bạn. Tôi sẵn sàng hỗ trợ bạn khởi tạo **Trang trại** trước nhé! Tên trang trại bạn dự định đặt là gì?`,
          actionDraft: {
            type: 'SLOT_FILLING',
            intent: 'CREATE_FARM',
            collectedData: { _waitingFor: 'name', farmingModel: 'HIGH_TECH' },
            missingFields: ['name', 'address', 'area'],
            quickSuggestions: [
              'Trang trại Tôm Huế 10ha ở Thừa Thiên Huế',
              'Trang trại Tôm Bến Tre 5ha ở Bến Tre',
            ],
          },
        };
      }

      if (!collected.depth) collected.depth = 1.5;
      if (collected.areaSize) collected.areaSize = Number(collected.areaSize);
      if (collected.name) collected.name = toTitleCase(String(collected.name));

      // Tự động gán nếu chỉ có 1 trang trại duy nhất
      if (!collected.farmId && db.farms.length === 1) {
        collected.farmId = db.farms[0].id;
        collected.farmName = db.farms[0].name;
      }

      // Nếu có nhiều trang trại mà chưa chọn
      if (!collected.farmId && db.farms.length > 1) {
        return {
          isAgentAction: true,
          answer: `Dạ, bạn hiện đang quản lý **${db.farms.length} trang trại**. Bạn muốn tạo ao nuôi mới trực thuộc trang trại nào? Vui lòng chọn bên dưới:\n${db.farms.map((f, i) => `${i + 1}. **${f.name}** (${f.address || ''})`).join('\n')}`,
          actionDraft: {
            type: 'SLOT_FILLING',
            intent: 'CREATE_POND',
            collectedData: collected,
            missingFields: ['farmId'],
            quickSuggestions: db.farms.map((f) => f.name),
          },
        };
      }

      const targetFarm = db.farms.find((f) => f.id === collected.farmId) || db.farms[0];

      // Kiểm tra trùng tên ao trong trang trại
      if (collected.name) {
        const isDuplicatePond = db.ponds.some(
          (p) =>
            p.farmId === targetFarm.id &&
            p.name.trim().toLowerCase() === String(collected.name || '').trim().toLowerCase(),
        );
        if (isDuplicatePond) {
          return {
            isAgentAction: true,
            answer: `Trang trại **${targetFarm.name}** đã có ao mang tên **"${collected.name}"**. Bạn vui lòng đặt tên khác (ví dụ: Ao 2, Ao 3...) để tránh trùng lặp:`,
            actionDraft: {
              type: 'SLOT_FILLING',
              intent: 'CREATE_POND',
              collectedData: { ...collected, name: undefined },
              missingFields: ['name'],
              quickSuggestions: ['Ao 2', 'Ao 3', 'Ao Ươm Lót Bạt'],
            },
          };
        }
      }

      const hasAllPond = Boolean(collected.name && collected.areaSize && collected.farmId);
      if (hasAllPond) {
        const farmName = targetFarm.name;
        const summary: Record<string, string> = {
          'Trực thuộc trang trại': farmName,
          'Tên ao nuôi': String(collected.name),
          'Diện tích mặt nước': `${Number(collected.areaSize).toLocaleString('vi-VN')} m²`,
          'Độ sâu mực nước': `${collected.depth || 1.5} m (Chuẩn kỹ thuật)`,
          'Loại ao': 'Ao nuôi thương phẩm công nghệ cao',
        };

        const reply = `Dạ, thông số kỹ thuật cho **${collected.name}** thuộc **${farmName}** đã hoàn thiện. Bạn hãy kiểm tra bảng xác nhận bên dưới và nhấn **"Xác nhận tạo ngay"** nhé!`;

        return {
          isAgentAction: true,
          answer: reply,
          actionDraft: {
            type: 'CONFIRM_ACTION',
            intent: 'CREATE_POND',
            collectedData: collected,
            missingFields: [],
            summary,
          },
        };
      } else {
        const missing: string[] = [];
        if (!collected.name) missing.push('name');
        if (!collected.areaSize) missing.push('areaSize');

        return {
          isAgentAction: true,
          answer: `Dạ, tôi sẽ hỗ trợ bạn tạo Ao nuôi mới trực thuộc **${targetFarm.name}**.\n\nBạn vui lòng cung cấp thông số kỹ thuật của ao:\n1. 🏷️ **Tên ao** *(Ví dụ: Ao 1, Ao Tròn 02)*\n2. 📐 **Diện tích mặt nước (m²)** *(Thường từ 1.000 - 3.000 m²)*\n3. 📏 **Độ sâu mực nước (m)** *(Mặc định tiêu chuẩn 1.5m)*`,
          actionDraft: {
            type: 'SLOT_FILLING',
            intent: 'CREATE_POND',
            collectedData: collected,
            missingFields: missing,
            quickSuggestions: ['Ao 1 diện tích 1500m2 sâu 1.5m', 'Ao 2 diện tích 2000m2'],
          },
        };
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 3. XỬ LÝ CHUYÊN SÂU: CREATE_CROP
    // ─────────────────────────────────────────────────────────────────────────
    if (parsed.intent === 'CREATE_CROP') {
      // 1. Kiểm tra trang trại
      if (db.farms.length === 0) {
        return {
          isAgentAction: true,
          answer: `Dạ, quy trình nuôi tôm yêu cầu theo thứ tự 3 bước: **Trang trại ➔ Ao nuôi ➔ Khởi tạo vụ nuôi (thả giống)**.\n\nHiện tại bạn cần khởi tạo **Trang trại** trước nhé! Tôi sẵn sàng hỗ trợ bạn ngay. Tên trang trại bạn muốn đặt là gì?`,
          actionDraft: {
            type: 'SLOT_FILLING',
            intent: 'CREATE_FARM',
            collectedData: { _waitingFor: 'name', farmingModel: 'HIGH_TECH' },
            missingFields: ['name', 'address', 'area'],
            quickSuggestions: ['Trang trại Tôm Huế 10ha ở Thừa Thiên Huế'],
          },
        };
      }

      // 2. Kiểm tra ao nuôi
      if (db.ponds.length === 0) {
        return {
          isAgentAction: true,
          answer: `Dạ, bạn đã có trang trại nhưng chưa có **Ao nuôi** nào để thả giống. Vui lòng khởi tạo Ao nuôi trước nhé!`,
          actionDraft: {
            type: 'SLOT_FILLING',
            intent: 'CREATE_POND',
            collectedData: { farmId: db.farms[0].id, farmName: db.farms[0].name },
            missingFields: ['name', 'areaSize'],
            quickSuggestions: ['Ao 1 diện tích 1500m2', 'Ao 2 diện tích 2000m2'],
          },
        };
      }

      // 3. Kiểm tra ao đang trống
      if (db.emptyPonds.length === 0) {
        return {
          isAgentAction: true,
          answer: `Dạ, hiện tại tất cả **${db.ponds.length} ao nuôi** của bạn đều đang có vụ nuôi hoạt động (chưa thu hoạch):\n${db.ponds.map((p) => `• **${p.name}** (${p.farmName}): đang nuôi`).join('\n')}\n\nĐể bắt đầu vụ nuôi mới, bạn có thể tạo thêm **Ao nuôi mới** hoặc tiến hành **Thu hoạch vụ cũ** trước nhé!`,
          actionDraft: {
            type: 'SLOT_FILLING',
            intent: 'CREATE_POND',
            collectedData: { farmId: db.farms[0].id },
            missingFields: ['name', 'areaSize'],
            quickSuggestions: ['Tạo Ao nuôi mới', 'Ao 3 diện tích 1500m2'],
          },
        };
      }

      if (collected.initialShrimpCount) {
        collected.initialShrimpCount = Number(collected.initialShrimpCount);
      }
      if (!collected.startDate) {
        collected.startDate = new Date().toISOString().slice(0, 10);
      }

      // Tự động gán ao nếu chỉ có đúng 1 ao trống
      if (!collected.pondId && db.emptyPonds.length === 1) {
        collected.pondId = db.emptyPonds[0].id;
        collected.pondName = db.emptyPonds[0].name;
      }

      const hasAllCrop = Boolean(collected.pondId && collected.initialShrimpCount);
      if (hasAllCrop) {
        const pond = db.ponds.find((p) => p.id === collected.pondId) || db.emptyPonds[0];
        const pondName = pond?.name || collected.pondName || 'Ao nuôi';
        const pondArea = pond?.areaSize || 1000;
        const count = Number(collected.initialShrimpCount);
        const density = Math.round(count / pondArea);

        let densityAssessment = `${density} con/m² (Mật độ chuẩn tối ưu High-Tech)`;
        if (density > 180) {
          densityAssessment = `${density} con/m² (Mật độ cao - Cần kiểm soát oxy đáy chặt chẽ)`;
        } else if (density < 60) {
          densityAssessment = `${density} con/m² (Mật độ thưa - Rủi ro môi trường thấp)`;
        }

        const summary: Record<string, string> = {
          'Ao thả giống': `${pondName} (${pond?.farmName || ''})`,
          'Số lượng tôm giống': `${count.toLocaleString('vi-VN')} con (Postlarvae)`,
          'Mật độ thả dự tính': densityAssessment,
          'Ngày bắt đầu thả': String(collected.startDate),
          'Trạng thái chu kỳ': 'Đang nuôi (ACTIVE)',
        };

        const reply = `Dạ, thông tin vụ nuôi thả **${count.toLocaleString('vi-VN')} con giống** vào **${pondName}** (mật độ đạt **${density} con/m²**) đã được thiết lập hoàn chỉnh. Bạn hãy kiểm tra phiếu xác nhận bên dưới và nhấn **"Xác nhận tạo ngay"** nhé!`;

        return {
          isAgentAction: true,
          answer: reply,
          actionDraft: {
            type: 'CONFIRM_ACTION',
            intent: 'CREATE_CROP',
            collectedData: collected,
            missingFields: [],
            summary,
          },
        };
      } else {
        return {
          isAgentAction: true,
          answer: `Dạ, hệ thống ghi nhận bạn có **${db.emptyPonds.length} ao nuôi đang trống** sẵn sàng thả giống:\n${db.emptyPonds.map((p) => `• **${p.name}** (${p.farmName} - ${p.areaSize} m²)`).join('\n')}\n\nĐể khởi tạo vụ nuôi (thả giống), bạn vui lòng cho biết:\n1. 🌊 **Ao thả giống** (Chọn ao trống bên dưới)\n2. 🦐 **Số lượng giống thả** (con) *(Mật độ chuẩn 80 - 150 con/m²)*\n3. 📅 **Ngày thả giống** *(Mặc định hôm nay)*`,
          actionDraft: {
            type: 'SLOT_FILLING',
            intent: 'CREATE_CROP',
            collectedData: collected,
            missingFields: ['pondId', 'initialShrimpCount'],
            quickSuggestions: db.emptyPonds.map((p) => `${p.name} (${p.farmName})`),
          },
        };
      }
    }

    return null;
  }

  /**
   * Fallback khi không có OpenAI hoặc OpenAI timeout
   */
  private fallbackHandler(
    q: string,
    pendingAction: any,
    farms: any[],
    ponds: any[],
    emptyPonds: any[],
    heuristics: { name: string | null; address: string | null; area: number | null },
  ): AgentActionResult {
    const isPond = /(ao nuôi|ao |pond)/i.test(q);
    const isCrop = /(vụ nuôi|thả giống|thả tôm|crop)/i.test(q);

    if (isPond && farms.length === 0) {
      return {
        isAgentAction: true,
        answer: 'Dạ, quy trình nuôi tôm yêu cầu phải có **Trang trại** trước khi tạo ao nuôi. Hiện tại hệ thống chưa ghi nhận trang trại nào của bạn.\n\nTôi sẵn sàng hỗ trợ bạn tạo **Trang trại** trước nhé! Tên trang trại bạn dự định đặt là gì?',
        actionDraft: {
          type: 'SLOT_FILLING',
          intent: 'CREATE_FARM',
          collectedData: { _waitingFor: 'name', farmingModel: 'HIGH_TECH' },
          missingFields: ['name', 'address', 'area'],
          quickSuggestions: ['Trang trại Tôm Huế 10ha ở Thừa Thiên Huế', 'Trang trại Tôm Bến Tre 5ha ở Bến Tre'],
        },
      };
    }

    if (isCrop && (farms.length === 0 || ponds.length === 0)) {
      return {
        isAgentAction: true,
        answer: 'Dạ, quy trình chuẩn gồm 3 bước: **Tạo Trang trại ➔ Tạo Ao nuôi ➔ Khởi tạo Vụ nuôi (thả giống)**. Hiện tại bạn cần tạo Trang trại và Ao nuôi trước.\n\nTôi sẽ hỗ trợ bạn khởi tạo **Trang trại** trước nhé! Tên trang trại bạn muốn đặt là gì?',
        actionDraft: {
          type: 'SLOT_FILLING',
          intent: 'CREATE_FARM',
          collectedData: { _waitingFor: 'name', farmingModel: 'HIGH_TECH' },
          missingFields: ['name', 'address', 'area'],
          quickSuggestions: ['Trang trại Tôm Huế 10ha ở Thừa Thiên Huế'],
        },
      };
    }

    // Kiểm tra nếu đã có đủ thông tin từ heuristics
    const name = heuristics.name || pendingAction?.collectedData?.name;
    const address = heuristics.address || pendingAction?.collectedData?.address;
    const area = heuristics.area || pendingAction?.collectedData?.area;

    if (name && address && area) {
      const ha = (Number(area) / 10000).toFixed(1);
      return {
        isAgentAction: true,
        answer: `Dạ, tôi đã tiếp nhận và chuẩn hóa đầy đủ thông tin để khởi tạo **${name}** tại **${address}** với diện tích **${Number(area).toLocaleString('vi-VN')} m² (${ha} ha)**.\n\nBảng thông số kỹ thuật bên dưới đã sẵn sàng, bạn hãy kiểm tra lại và bấm **"Xác nhận tạo ngay"** để tôi lưu vào hệ thống nhé!`,
        actionDraft: {
          type: 'CONFIRM_ACTION',
          intent: 'CREATE_FARM',
          collectedData: { name, address, area, farmingModel: 'HIGH_TECH' },
          missingFields: [],
          summary: {
            'Tên trang trại': String(name),
            'Địa chỉ / Vị trí': String(address),
            'Tổng diện tích': `${Number(area).toLocaleString('vi-VN')} m² (${ha} ha)`,
            'Mô hình canh tác': 'Công nghệ cao (High-Tech lót bạt / tuần hoàn)',
          },
        },
      };
    }

    return {
      isAgentAction: true,
      answer: 'Dạ, tôi rất sẵn lòng hỗ trợ bạn khởi tạo **Trang trại nuôi tôm mới** vào hệ thống SSFM!\n\nĐể hồ sơ trang trại được thiết lập chuẩn xác (khớp theo biểu mẫu tạo thủ công), bạn vui lòng cung cấp giúp tôi 3 thông tin cơ bản sau:\n1. 🏷️ **Tên trang trại** *(Ví dụ: Trang trại Tôm Huế, Trang trại Tôm Ba Tri)*\n2. 📍 **Địa chỉ (Tỉnh/Thành phố)** *(Khớp với danh mục 63 tỉnh thành: Thừa Thiên Huế, Bến Tre, Bạc Liêu, Cà Mau...)*\n3. 📐 **Tổng diện tích** *(Ví dụ: 100.000 m² hoặc 10 hecta)*\n\n👉 *Bạn có thể nhắn nhanh cả 3 thông tin trong 1 câu (Ví dụ: "Trang trại Tôm Huế ở Thừa Thiên Huế, diện tích 10ha"), tôi sẽ chuẩn hóa và tạo phiếu xác nhận ngay cho bạn nhé!*',
      actionDraft: {
        type: 'SLOT_FILLING',
        intent: 'CREATE_FARM',
        collectedData: {
          farmingModel: 'HIGH_TECH',
          ...(name ? { name } : {}),
          ...(address ? { address } : {}),
          ...(area ? { area } : {}),
        },
        missingFields: [
          ...(!name ? ['name'] : []),
          ...(!address ? ['address'] : []),
          ...(!area ? ['area'] : []),
        ],
        quickSuggestions: [
          'Trang trại Tôm Huế 10ha ở Thừa Thiên Huế',
          'Trang trại Tôm Bến Tre 5ha ở Bến Tre',
          'Trang trại Tôm Bạc Liêu 3ha ở Bạc Liêu',
        ],
      },
    };
  }

  /**
   * Thực thi lưu thực thể vào DB sau khi người dùng bấm nút [Xác nhận tạo ngay]
   */
  async executeAgentAction(dto: ExecuteActionDto, currentUser: AuthUser) {
    const { intent, data } = dto;
    const uid = currentUser.userId || (currentUser as any).id;

    if (currentUser.role === 'ADMIN') {
      throw new ForbiddenException(
        'Tài khoản Quản trị viên hệ thống chỉ dùng để giám sát, không thể tạo trang trại, ao nuôi hoặc vụ nuôi',
      );
    }

    if ((intent === 'CREATE_FARM' || intent === 'CREATE_POND') && currentUser.role !== 'FARM_MANAGER') {
      throw new ForbiddenException(
        'Chỉ Quản lý trang trại (FARM_MANAGER) mới có quyền khởi tạo trang trại và ao nuôi',
      );
    }

    if (intent === 'CREATE_CROP' && currentUser.role !== 'FARM_MANAGER' && currentUser.role !== 'FARMER') {
      throw new ForbiddenException(
        'Chỉ Quản lý trang trại hoặc Nhân viên chăm sóc mới có quyền khởi tạo vụ nuôi',
      );
    }

    if (intent === 'CREATE_FARM') {
      const userMember = await this.prisma.workspaceMember.findFirst({
        where: {
          userId: uid,
          isActive: true,
          workspace: { status: 'ACTIVE' },
        },
        include: { workspace: true },
      });

      let targetWorkspaceId = userMember?.workspaceId;
      let farmOwnerId = uid;

      if (!targetWorkspaceId) {
        const memberWs = await this.prisma.workspaceMember.findFirst({
          where: { userId: uid, isActive: true },
        });
        targetWorkspaceId = memberWs?.workspaceId;
      }

      if (!targetWorkspaceId) {
        const firstWs = await this.prisma.workspace.findFirst({
          where: { status: 'ACTIVE' },
        });
        targetWorkspaceId = firstWs?.id;
        if (targetWorkspaceId) {
          await this.prisma.workspaceMember.upsert({
            where: {
              workspaceId_userId: {
                workspaceId: targetWorkspaceId,
                userId: uid,
              },
            },
            update: { isActive: true },
            create: {
              workspaceId: targetWorkspaceId,
              userId: uid,
              role: currentUser.role === 'ADMIN' ? 'ADMIN' : 'MEMBER',
              isActive: true,
            },
          });
        }
      }

      if (!targetWorkspaceId) {
        throw new BadRequestException('Hệ thống chưa tìm thấy không gian làm việc (Workspace) nào đang hoạt động');
      }

      // Đảm bảo farmOwnerId là thành viên trong targetWorkspaceId
      const ownerInWs = await this.prisma.workspaceMember.findFirst({
        where: { workspaceId: targetWorkspaceId, userId: farmOwnerId, isActive: true },
      });
      if (!ownerInWs) {
        await this.prisma.workspaceMember.upsert({
          where: {
            workspaceId_userId: {
              workspaceId: targetWorkspaceId,
              userId: farmOwnerId,
            },
          },
          update: { isActive: true },
          create: {
            workspaceId: targetWorkspaceId,
            userId: farmOwnerId,
            role: currentUser.role === 'ADMIN' ? 'ADMIN' : 'MEMBER',
            isActive: true,
          },
        });
      }

      const province = matchVietnamProvince(data.address) || data.address;

      const created = await this.farmsService.create({
        name: data.name,
        address: province,
        area: Number(data.area),
        farmingModel: data.farmingModel || 'HIGH_TECH',
        workspaceId: targetWorkspaceId,
        ownerId: farmOwnerId,
      });

      return {
        success: true,
        message: `🎉 Đã khởi tạo thành công **Trang trại "${created.name}"** tại **${created.address}**!\n\n👉 Bước tiếp theo trong quy trình là tạo các **Ao nuôi** cho trang trại này. Bạn có muốn tôi tạo luôn Ao 1 cho ${created.name} không?`,
        entity: created,
        type: 'FARM',
        redirectTab: 'Quản lý Trang Trại',
      };
    }

    if (intent === 'CREATE_POND') {
      const created = await this.pondsService.create(currentUser, {
        farmId: data.farmId,
        name: data.name,
        areaSize: Number(data.areaSize),
        depth: Number(data.depth || 1.5),
      });

      return {
        success: true,
        message: `🎉 Đã khởi tạo thành công **Ao nuôi "${created.name}"**!\n\n👉 Bước tiếp theo là bắt đầu một **Vụ nuôi mới (thả giống)** cho ao này. Bạn có muốn khởi tạo vụ nuôi ngay không?`,
        entity: created,
        type: 'POND',
        redirectTab: 'Quản lý Ao/Vụ',
      };
    }

    if (intent === 'CREATE_CROP') {
      const startDate = data.startDate
        ? new Date(data.startDate).toISOString()
        : new Date().toISOString();

      const created = await this.cropsService.create(currentUser, {
        pondId: data.pondId,
        startDate,
        initialShrimpCount: Number(data.initialShrimpCount),
      });

      return {
        success: true,
        message: `🎉 Đã khởi tạo thành công vụ nuôi mới với **${Number(data.initialShrimpCount).toLocaleString('vi-VN')} con tôm giống**!\n\n👉 Hệ thống giám sát môi trường và cảnh báo tự động đã sẵn sàng cho vụ nuôi này.`,
        entity: created,
        type: 'CROP',
        redirectTab: 'Quản lý Ao/Vụ',
      };
    }

    throw new BadRequestException(`Ý định ${intent} không được hỗ trợ`);
  }
}
