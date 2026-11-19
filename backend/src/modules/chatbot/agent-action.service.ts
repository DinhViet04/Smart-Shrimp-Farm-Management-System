import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  Optional,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import OpenAI from 'openai';
import { CropStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthUser, FarmAccessService } from '../farm-access/farm-access.service';
import { FarmsService } from '../farms/farms.service';
import { PondsService } from '../ponds/ponds.service';
import { CropsService } from '../crops/crops.service';
import { ExecuteActionDto } from './dto/execute-action.dto';
import { WaterRecordAgentService } from './water-record-agent.service';
import { MarketPricesService } from '../market-prices/market-prices.service';

export type AgentActionIntent =
  | 'CREATE_FARM'
  | 'CREATE_POND'
  | 'CREATE_CROP'
  | 'IMPORT_INVENTORY'
  | 'EXPORT_INVENTORY'
  | 'RECORD_WATER_QUALITY';

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

const VI_NUMBER_WORDS: Record<string, number> = {
  một: 1, hai: 2, ba: 3, bốn: 4, tư: 4, năm: 5, sáu: 6, bảy: 7, tám: 8, chín: 9, mười: 10,
};
export const MAX_PONDS_PER_ACTION = 20;

/** Nhận diện số lượng ao muốn tạo: "tạo 3 ao", "thêm ba ao nuôi" -> 3 */
export function findPondQuantityInText(text: string): number | null {
  if (!text) return null;
  const m = text.match(/(?:^|\s)(\d{1,2}|một|hai|ba|bốn|tư|năm|sáu|bảy|tám|chín|mười)\s+(?:cái\s+)?ao\b/i);
  if (!m) return null;
  const raw = m[1].toLowerCase();
  const n = /^\d+$/.test(raw) ? parseInt(raw, 10) : VI_NUMBER_WORDS[raw];
  return n && n > 0 ? n : null;
}

/**
 * Nhận diện danh sách tên ao người dùng đặt / sửa trong câu:
 * "sửa tên thành ao 4,5,6" -> ["Ao 4","Ao 5","Ao 6"]; "đặt tên là A1, A2 và A3" -> ["A1","A2","A3"]
 */
export function findPondNamesInText(text: string): string[] | null {
  if (!text) return null;
  const m = text.match(/\btên\b(?:\s+\S+){0,3}?\s*(?:thành|là|:)\s*(.+)$/i);
  if (!m) return null;
  // Cắt phần thông số phía sau: "... và diện tích 1500m2", "..., độ sâu 1.8m"
  const listPart = m[1]
    .split(/[\s,;]+(?:với|và|còn)?\s*(?:diện tích|độ sâu|sâu\s+\d|mỗi ao|rộng)/i)[0]
    .replace(/\s*(?:nhé|nha|nhá|giúp tôi|giùm|đi|ạ)?[.!?\s]*$/i, '');
  const raw = listPart
    .split(/\s*[,;/&]\s*|\s+và\s+/i)
    .map((s) => s.trim().replace(/^["'“]|["'”]$/g, ''))
    .filter(Boolean);
  if (raw.length === 0 || raw.some((s) => s.length > 40)) return null;

  // "ao 4, 5, 6": các mục chỉ là số/mã ngắn thì mượn tiền tố "Ao" của mục đầu
  const prefixMatch = raw[0].match(/^(ao(?:\s+\S+)*?)\s+\S+$/i);
  const prefix = prefixMatch ? prefixMatch[1] : null;
  const names = raw.map((s, i) => {
    const full = i > 0 && prefix && /^[\p{L}]?\d+[\p{L}]?$/u.test(s) ? `${prefix} ${s}` : s;
    return toTitleCase(full);
  });
  return names;
}

/**
 * Đọc thông số sửa riêng cho từng ao theo tên: "Ao 2 sâu 1.8m, Ao 3 diện tích 1500m2"
 * -> [{}, {depth: 1.8}, {areaSize: 1500}] (theo thứ tự danh sách tên truyền vào)
 */
export function parsePerPondEdits(text: string, names: string[]): Array<{ areaSize?: number; depth?: number }> {
  const toNum = (s: string) => parseFloat(s.replace(',', '.'));
  return names.map((name) => {
    if (!name || !text) return {};
    const escaped = name.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
    // Đoạn câu nói về ao này: từ tên ao đến trước dấu phẩy / chấm phẩy / chữ "ao" kế tiếp
    const seg = text.match(new RegExp(`(?:^|[^\\p{L}\\d])${escaped}(?![\\p{L}\\d])([^,;]*?)(?=[,;]|\\s+ao\\s|$)`, 'iu'));
    if (!seg) return {};
    const part = seg[1];
    const result: { areaSize?: number; depth?: number } = {};
    const area = part.match(/(\d{1,3}(?:[.,]\d{3})+|\d+)\s*(?:m2|m²|mét vuông)/i);
    if (area) result.areaSize = parseInt(area[1].replace(/[.,]/g, ''), 10);
    const depth = part.match(/sâu\s*(?:là|thành)?\s*(\d+(?:[.,]\d+)?)\s*m?(?![\d²2])/i);
    if (depth) result.depth = toNum(depth[1]);
    return result;
  });
}

/** Sinh tên ao tự động "Ao N" không trùng với các ao hiện có của trang trại */
function generatePondNames(count: number, existingNames: string[], prefix = 'Ao'): string[] {
  const taken = new Set(existingNames.map((n) => n.trim().toLowerCase()));
  const names: string[] = [];
  let i = 1;
  while (names.length < count) {
    const candidate = `${prefix} ${i}`;
    if (!taken.has(candidate.toLowerCase())) names.push(candidate);
    i++;
  }
  return names;
}

export interface InventoryParsedItem {
  itemName: string;
  category: 'FEED' | 'MEDICINE' | 'CHEMICAL';
  quantity: number;
  unit: string;
  packageType?: string;
  packageQty?: number;
  weightPerPkg?: number;
  minThreshold?: number;
  pricePerPackage?: number;
  supplierName?: string;
  description?: string;
  shape?: string;
  sizeSpec?: string;
  imageUrl?: string;
}

export interface AgentActionDraft {
  /** Mã phiếu duy nhất: mỗi phiếu chỉ được thực thi 1 lần (xem AgentActionExecution) */
  draftId?: string;
  type: 'SLOT_FILLING' | 'CONFIRM_ACTION';
  intent: AgentActionIntent;
  collectedData: Record<string, any>;
  missingFields: string[];
  quickSuggestions?: string[];
  summary?: Record<string, string>;
  inventoryItems?: InventoryParsedItem[];
  exportUrl?: string;
  fileName?: string;
  farmName?: string;
  /** Danh sách ao cho thẻ nhập thông số nước trong khung chat */
  pondOptions?: Array<{ id: string; name: string; farmName: string }>;
  /** Ao đang trống cho thẻ tạo vụ nuôi trong khung chat (chỉ Quản lý trang trại) */
  cropPondOptions?: CropPondOption[];
  /** Giá tôm giống thị trường (Tép Bạc) cho mục đơn giá giống trên thẻ tạo vụ */
  seedMarketPrice?: SeedPriceInfo;
}

/** Giá tôm giống thị trường gửi kèm thẻ tạo vụ (giống khối "Giá giống thị trường" ở form thủ công) */
export interface SeedPriceInfo {
  name: string;
  price: number;
  unit: string;
  source: string;
  sourceUrl: string;
  updatedAt: string;
  /** false = không lấy được giá trực tuyến, đang dùng giá mặc định */
  isLive: boolean;
}

/** Giá giống mặc định khi không lấy được giá Tép Bạc (khớp MarketPricesService) */
const DEFAULT_SEED_PRICE = 70;
const DEFAULT_SEED_SOURCE = 'tepbac.com';
const SEED_PRICE_TIMEOUT_MS = 3000;

export interface CropPondOption {
  id: string;
  name: string;
  farmId: string;
  farmName: string;
  /** HIGH_TECH -> vụ mới bắt buộc Ương dưỡng; TRADITIONAL -> chỉ Thương phẩm */
  farmingModel: string | null;
  areaSize: number;
  depth: number;
}

/** Các trường tùy chọn của vụ nuôi AI được phép điền sẵn vào thẻ */
const CROP_OPTIONAL_FIELDS = {
  // Không có seedUnitPrice: đơn giá giống luôn lấy tự động theo giá Tép Bạc khi lưu
  numbers: ['targetHarvestSize', 'targetSurvivalRate', 'targetTotalFeedKg'],
  dates: ['expectedHarvestDate', 'expectedTransferDate'],
  strings: ['seedType'],
} as const;

export interface AgentActionResult {
  isAgentAction: boolean;
  answer?: string;
  actionDraft?: AgentActionDraft;
}

/** Dữ liệu trang trại / ao của người dùng dùng để dựng và kiểm tra phiếu */
interface DraftContext {
  farms: Array<{ id: string; name: string; address?: string | null; area?: number | null; farmingModel?: string | null }>;
  ponds: Array<{ id: string; name: string; farmId: string; farmName: string; farmTotalArea: number; areaSize: number; depth: number; hasActiveCrop: boolean; activeCropInfo: any }>;
  emptyPonds: Array<{ id: string; name: string; farmId: string; farmName: string; areaSize: number; depth: number }>;
}

/** Tool tạo phiếu mà chatbot chính (OpenAI tool calling) được phép gọi */
const ACTION_TOOL_INTENTS: Record<string, AgentActionIntent> = {
  draft_create_farm: 'CREATE_FARM',
  draft_create_pond: 'CREATE_POND',
  draft_create_crop: 'CREATE_CROP',
};

const ACTION_TOOL_NOTE =
  'Chỉ truyền thông tin người dùng THỰC SỰ đã nói (kể cả trong các tin nhắn trước), KHÔNG bịa. ' +
  'Trường nào chưa có thì bỏ trống — hệ thống sẽ tự hỏi lại người dùng và hiển thị phiếu xác nhận. ' +
  'Công cụ này chỉ TẠO PHIẾU, chưa lưu gì vào hệ thống.';

const ACTION_TOOLS: Record<string, OpenAI.Chat.Completions.ChatCompletionTool> = {
  draft_create_farm: {
    type: 'function',
    function: {
      name: 'draft_create_farm',
      description:
        'Người dùng muốn tạo / mở / lập TRANG TRẠI nuôi tôm mới (bất kể cách diễn đạt). ' + ACTION_TOOL_NOTE,
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Tên trang trại, vd "Trang trại Tôm Huế"' },
          address: { type: 'string', description: 'Tỉnh/Thành phố Việt Nam' },
          area: { type: 'number', description: 'Tổng diện tích theo m² (1 ha = 10.000 m²)' },
          farmingModel: { type: 'string', enum: ['HIGH_TECH', 'TRADITIONAL'] },
        },
      },
    },
  },
  draft_create_pond: {
    type: 'function',
    function: {
      name: 'draft_create_pond',
      description:
        'Người dùng muốn tạo / thêm / đào / làm một hoặc NHIỀU AO NUÔI mới (vd "tạo 3 ao", "farm này cần thêm 2 ao 2000m2"). ' +
        ACTION_TOOL_NOTE,
      parameters: {
        type: 'object',
        properties: {
          farmName: {
            type: 'string',
            description: 'Tên trang trại chứa ao, nếu người dùng nêu. "Trang trại này" -> bỏ trống nếu không rõ là trang trại nào.',
          },
          quantity: { type: 'integer', minimum: 1, description: 'Số lượng ao cần tạo (mặc định 1)' },
          name: { type: 'string', description: 'Tên ao (chỉ khi tạo 1 ao và người dùng có đặt tên)' },
          names: {
            type: 'array',
            items: { type: 'string' },
            description: 'Tên các ao khi người dùng tự đặt tên cho nhiều ao, vd ["Ao A1","Ao A2"]. Bỏ trống để hệ thống tự đặt.',
          },
          ponds: {
            type: 'array',
            description:
              'CHỈ dùng khi các ao có thông số KHÁC NHAU, vd "ao A 1500m2, ao B 2000m2 sâu 1.8m". Thông số giống nhau thì dùng areaSize/depth chung.',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                areaSize: { type: 'number' },
                depth: { type: 'number' },
              },
            },
          },
          areaSize: { type: 'number', description: 'Diện tích mặt nước MỖI ao (m²)' },
          depth: { type: 'number', description: 'Độ sâu mực nước (m)' },
        },
      },
    },
  },
  draft_create_crop: {
    type: 'function',
    function: {
      name: 'draft_create_crop',
      description:
        'Người dùng muốn bắt đầu VỤ NUÔI mới / thả giống tôm vào ao. Hệ thống sẽ hiện THẺ NHẬP LIỆU để người dùng điền / sửa. ' +
        ACTION_TOOL_NOTE,
      parameters: {
        type: 'object',
        properties: {
          pondName: { type: 'string', description: 'Tên ao thả giống' },
          initialShrimpCount: { type: 'integer', description: 'Số lượng tôm giống thả (con), "200 nghìn" -> 200000' },
          startDate: { type: 'string', description: 'Ngày thả giống YYYY-MM-DD' },
          stage: { type: 'string', enum: ['NURSERY', 'COMMERCIAL'], description: 'Ương dưỡng / Thương phẩm' },
          seedType: { type: 'string', description: 'Loại giống, vd "Tôm thẻ chân trắng Post 12"' },
          targetHarvestSize: { type: 'number', description: 'Size thu hoạch mục tiêu (con/kg)' },
          targetSurvivalRate: { type: 'number', description: 'Tỷ lệ sống mục tiêu (%)' },
          targetTotalFeedKg: { type: 'number', description: 'Tổng thức ăn dự kiến (kg)' },
          expectedHarvestDate: { type: 'string', description: 'Ngày thu hoạch dự kiến YYYY-MM-DD' },
          expectedTransferDate: { type: 'string', description: 'Ngày dự tính tách ao (ương dưỡng) YYYY-MM-DD' },
        },
      },
    },
  },
};

/** Lọc các trường tùy chọn hợp lệ của vụ nuôi (số dương, ngày YYYY-MM-DD, chuỗi ngắn) */
function pickCropOptionalFields(src: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {};
  for (const k of CROP_OPTIONAL_FIELDS.numbers) {
    const v = Number(src?.[k]);
    if (src?.[k] !== undefined && src?.[k] !== null && src?.[k] !== '' && Number.isFinite(v) && v >= 0) out[k] = v;
  }
  for (const k of CROP_OPTIONAL_FIELDS.dates) {
    if (src?.[k] && /^\d{4}-\d{2}-\d{2}/.test(String(src[k]))) out[k] = String(src[k]).slice(0, 10);
  }
  for (const k of CROP_OPTIONAL_FIELDS.strings) {
    if (src?.[k]) out[k] = String(src[k]).trim().slice(0, 100);
  }
  return out;
}

/** Tìm phần tử có tên khớp (không dấu, không phân biệt hoa thường) */
function matchByName<T extends { name: string }>(items: T[], raw: unknown): T | undefined {
  const target = normalizeVietnamese(String(raw || ''));
  if (!target) return undefined;
  return (
    items.find((i) => normalizeVietnamese(i.name) === target) ||
    items.find((i) => {
      const n = normalizeVietnamese(i.name);
      return n.includes(target) || target.includes(n);
    })
  );
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
    @Optional() private readonly waterRecordAgent?: WaterRecordAgentService,
    @Optional() private readonly marketPrices?: MarketPricesService,
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
    fileContext?: { fileName: string; fileType: string; extractedText: string },
    focusPondId?: string,
  ): Promise<AgentActionResult | null> {
    const q = question.trim();
    if (!q && !fileContext) return null;

    const lower = q.toLowerCase();

    // 1. Kiểm tra yêu cầu hủy bỏ (Cancel flow)
    const isCancelRequest = /^(hủy|thôi|dừng|bỏ qua|không tạo nữa|không nhập nữa|hủy bỏ|cancel|thôi nhé)/i.test(lower);
    if (isCancelRequest && pendingAction?.intent) {
      return {
        isAgentAction: true,
        answer: 'Dạ, tôi đã hủy tiến trình theo yêu cầu của bạn. Bất cứ khi nào bạn cần hỗ trợ thêm thông tin kỹ thuật hay quản lý ao/kho, tôi luôn sẵn sàng!',
        actionDraft: undefined,
      };
    }

    // 2. Nhận diện các ý định nghiệp vụ (Intent Recognition)
    const isInventoryFile = Boolean(fileContext);
    const isInventoryImportIntent =
      isInventoryFile ||
      /(nhập.*kho|nhập.*vào kho|đưa.*vào kho|lưu.*vào kho|thêm vật tư|nhập hàng|thêm thuốc|thêm thức ăn|nhập hóa chất|nhập kho tệp|nhập file|import.*kho)/i.test(lower);

    const isInventoryExportIntent =
      /(xuất file kho|xuất báo cáo kho|xuất tồn kho|tải file tồn kho|báo cáo tồn kho|xuất excel tồn kho|tải danh sách vật tư|xuất kho ra file)/i.test(lower);

    const isExplicitCreate =
      // Cho phép số lượng / từ đệm xen giữa: "tạo 3 ao", "thêm ba cái ao", "tạo một trang trại", "tạo các ao"
      /(tạo|thêm|khởi tạo|lập|mở|setup|thả giống|bắt đầu vụ|thả tôm)\s+(?:(?:\d{1,3}|một|hai|ba|bốn|tư|năm|sáu|bảy|tám|chín|mười|các|những|cái|mới)\s+){0,2}(trang trại|ao|vụ|farm|pond|crop)/i.test(lower) ||
      /^(tạo|khởi tạo|thêm)\s+/i.test(lower) ||
      /^(tạo trang trại|tạo ao|tạo vụ|thả giống)$/i.test(lower) ||
      /(tạo|thêm|khởi tạo)\s+(mới|thêm)\b/i.test(lower);

    const isContinuingPending = Boolean(
      pendingAction?.intent && pendingAction.intent !== 'RECORD_WATER_QUALITY',
    );

    // ─────────────────────────────────────────────────────────────────────────
    // NHẬP SỐ ĐO MÔI TRƯỜNG NƯỚC BẰNG AI (RECORD_WATER_QUALITY) - chỉ Kỹ thuật viên
    // ─────────────────────────────────────────────────────────────────────────
    if (this.waterRecordAgent && !isInventoryFile && !isInventoryImportIntent && !isInventoryExportIntent) {
      const isWaterPending = pendingAction?.intent === 'RECORD_WATER_QUALITY';
      const waterIntent = WaterRecordAgentService.detectIntent(q);
      const isSideQuestion =
        isWaterPending && !waterIntent.explicit && WaterRecordAgentService.isSideQuestion(q);
      if (!isSideQuestion && (isWaterPending || waterIntent.explicit || waterIntent.implicit)) {
        if (currentUser.role === 'TECHNICIAN') {
          return this.waterRecordAgent.handleConversation(
            q,
            currentUser,
            isWaterPending ? pendingAction?.collectedData : undefined,
            focusPondId,
            history,
          );
        }
        if (waterIntent.explicit || isWaterPending) {
          return {
            isAgentAction: true,
            answer:
              'Dạ, việc **ghi nhận số đo môi trường nước** chỉ dành cho **Kỹ thuật viên** phụ trách ao. Tài khoản của bạn vẫn có thể hỏi tôi về **lịch sử chỉ số nước, xu hướng, đánh giá và hướng xử lý** của các ao trong phạm vi của bạn nhé!',
          };
        }
        // Người dùng khác gửi một dãy chỉ số -> để luồng tư vấn/đánh giá xử lý
      }
    }

    // Có OpenAI: yêu cầu tạo MỚI do chatbot chính tự hiểu qua tool calling
    // (draft_create_*), không phụ thuộc mẫu câu. Ở đây chỉ xử lý tiếp phiếu đang chờ.
    // Không có OpenAI: dùng regex làm đường dự phòng.
    const handleCreateHere = this.openai ? isContinuingPending : isExplicitCreate || isContinuingPending;
    if (!handleCreateHere && !isInventoryImportIntent && !isInventoryExportIntent) {
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

    // 3. Phân quyền bảo mật: Thao tác Kho qua trợ lý AI chỉ dành cho FARM_MANAGER (ADMIN đã bị chặn ở trên)
    if (isInventoryImportIntent || isInventoryExportIntent) {
      if (currentUser.role !== 'FARM_MANAGER') {
        return {
          isAgentAction: true,
          answer: 'Dạ, tính năng Nhập/Xuất vật tư kho (Thuốc, Thức ăn, Hóa chất) chỉ dành riêng cho Quản lý Trang trại (Farm Manager). Tài khoản của bạn hiện không có quyền thực hiện thao tác này.',
        };
      }
    }

    // 4. Thu thập ngữ cảnh cơ sở dữ liệu thực tế của người dùng
    const { farms, ponds: pondsWithStatus, emptyPonds } = await this.loadDraftContext(currentUser);

    // ─────────────────────────────────────────────────────────────────────────
    // XỬ LÝ ĐẶC THÙ: XUẤT FILE BÁO CÁO KHO (EXPORT_INVENTORY)
    // ─────────────────────────────────────────────────────────────────────────
    if (isInventoryExportIntent) {
      return this.handleInventoryExport(q, farms);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // XỬ LÝ ĐẶC THÙ: NHẬP VẬT TƯ KHO TỪ TỆP HOẶC TIN NHẮN (IMPORT_INVENTORY)
    // ─────────────────────────────────────────────────────────────────────────
    if (isInventoryImportIntent || pendingAction?.intent === 'IMPORT_INVENTORY') {
      return await this.handleInventoryImport(
        q,
        farms,
        pendingAction,
        fileContext,
      );
    }

    // 5. Trích xuất thực thể theo Heuristics cho luồng Tạo Farm/Ao/Vụ
    const heuristicFarmName = findFarmNameInText(q);
    const heuristicProvince = findProvinceInText(q);
    const heuristicArea = findAreaInText(q);

    // 6. Sử dụng OpenAI gpt-4o-mini cho Farm / Pond / Crop
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
        // AI xác định đây không phải lệnh sửa phiếu (vd hỏi chen ngang khi đang có phiếu
        // chờ xác nhận) -> để chatbot chính trả lời; phiếu vẫn được giữ ở client.
        return null;
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

  /** Trang trại, ao (kèm trạng thái có vụ) và ao trống trong phạm vi người dùng */
  private async loadDraftContext(currentUser: AuthUser): Promise<DraftContext> {
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

    return { farms, ponds: pondsWithStatus, emptyPonds: pondsWithStatus.filter((p) => !p.hasActiveCrop) };
  }

  /** Các tool tạo phiếu mà role này được phép dùng (đúng với phân quyền khi thực thi) */
  getActionToolDefinitions(role: string): OpenAI.Chat.Completions.ChatCompletionTool[] {
    if (role === 'FARM_MANAGER') {
      return [ACTION_TOOLS.draft_create_farm, ACTION_TOOLS.draft_create_pond, ACTION_TOOLS.draft_create_crop];
    }
    // Tạo vụ nuôi qua trợ lý AI (thẻ nhập liệu trong chat) chỉ dành cho Quản lý trang trại
    return [];
  }

  static isActionTool(name: string): boolean {
    return name in ACTION_TOOL_INTENTS;
  }

  /**
   * Chatbot chính (OpenAI tool calling) quyết định người dùng muốn tạo trang trại/ao/vụ
   * và gọi draft_create_*. Hàm này đổi tham số AI thành phiếu, qua cùng các bước kiểm tra
   * nghiệp vụ như luồng sửa phiếu.
   */
  async draftFromToolCall(
    toolName: string,
    args: Record<string, any>,
    currentUser: AuthUser,
    userMessage: string,
  ): Promise<AgentActionResult> {
    const intent = ACTION_TOOL_INTENTS[toolName];
    const allowed = this.getActionToolDefinitions(currentUser.role).includes(ACTION_TOOLS[toolName]);
    if (!intent || !allowed) {
      return {
        isAgentAction: true,
        answer: 'Dạ, tài khoản của bạn không có quyền khởi tạo dữ liệu này. Vui lòng liên hệ Quản lý trang trại nhé!',
      };
    }

    const db = await this.loadDraftContext(currentUser);
    const collected: Record<string, any> = {};

    if (intent === 'CREATE_FARM') {
      if (args.name) collected.name = String(args.name);
      if (args.address) collected.address = String(args.address);
      const area = Number(args.area) || findAreaInText(userMessage);
      if (area) collected.area = area;
      if (args.farmingModel === 'TRADITIONAL' || args.farmingModel === 'HIGH_TECH') {
        collected.farmingModel = args.farmingModel;
      }
    } else if (intent === 'CREATE_POND') {
      const farm = matchByName(db.farms, args.farmName);
      if (farm) {
        collected.farmId = farm.id;
        collected.farmName = farm.name;
      }
      if (args.name) collected.name = String(args.name);
      if (Array.isArray(args.names) && args.names.length) collected._userNames = args.names;
      if (Array.isArray(args.ponds) && args.ponds.length) {
        collected.ponds = args.ponds.slice(0, MAX_PONDS_PER_ACTION + 1);
      }
      if (Number(args.quantity) > 0) collected.quantity = Math.floor(Number(args.quantity));
      if (Number(args.areaSize) > 0) collected.areaSize = Number(args.areaSize);
      if (Number(args.depth) > 0) collected.depth = Number(args.depth);
    } else if (intent === 'CREATE_CROP') {
      // Chỉ nhận ao đang trống; ao đang có vụ sẽ để buildDraft liệt kê ao trống cho người dùng chọn
      const pond = matchByName(db.emptyPonds, args.pondName);
      if (pond) {
        collected.pondId = pond.id;
        collected.pondName = pond.name;
      }
      if (Number(args.initialShrimpCount) > 0) collected.initialShrimpCount = Math.floor(Number(args.initialShrimpCount));
      if (args.startDate && /^\d{4}-\d{2}-\d{2}$/.test(String(args.startDate))) {
        collected.startDate = String(args.startDate);
      }
      if (args.stage === 'NURSERY' || args.stage === 'COMMERCIAL') collected.stage = args.stage;
      Object.assign(collected, pickCropOptionalFields(args));
    }

    return (
      (await this.buildDraft(intent, collected, db, userMessage, undefined)) || {
        isAgentAction: true,
        answer: 'Dạ, tôi chưa dựng được phiếu cho yêu cầu này. Bạn mô tả lại giúp tôi nhé!',
      }
    );
  }

  /**
   * Xử lý trích xuất danh mục vật tư nhập kho từ tệp hoặc lệnh văn bản
   */
  private async handleInventoryImport(
    question: string,
    farms: Array<{ id: string; name: string; address?: string | null }>,
    pendingAction?: { intent: AgentActionIntent; collectedData: Record<string, any> },
    fileContext?: { fileName: string; fileType: string; extractedText: string },
  ): Promise<AgentActionResult> {
    if (farms.length === 0) {
      return {
        isAgentAction: true,
        answer: 'Dạ, hiện tại hệ thống chưa ghi nhận trang trại nào thuộc quyền quản lý của bạn để nhập kho. Bạn vui lòng tạo Trang trại trước nhé!',
      };
    }

    // 1. Xác định phạm vi nhập kho:
    // BẢO MẬT & PHÂN QUYỀN: 'farms' đã được farmAccess.getAccessibleFarmIds lọc nghiêm ngặt theo đúng Manager hiện tại.
    // Nếu người dùng nhắc đến tên 1 trang trại cụ thể trong tin nhắn -> Nhập riêng cho trang trại đó.
    // Nếu không nhắc riêng trang trại nào (hoặc tải file lên) -> Mặc định là KHO TỔNG DÙNG CHUNG cho TẤT CẢ các trang trại thuộc quyền quản lý của Manager đó!
    const userSpecifiedFarm = farms.find((f) =>
      question.toLowerCase().includes(f.name.toLowerCase()),
    );

    let targetFarmIds: string[] = [];
    let farmDisplayName = '';
    let isMultiFarm = false;

    if (userSpecifiedFarm) {
      targetFarmIds = [userSpecifiedFarm.id];
      farmDisplayName = userSpecifiedFarm.name;
    } else if (
      pendingAction?.collectedData?.farmIds &&
      Array.isArray(pendingAction.collectedData.farmIds) &&
      pendingAction.collectedData.farmIds.length > 0
    ) {
      targetFarmIds = pendingAction.collectedData.farmIds;
      isMultiFarm = targetFarmIds.length > 1;
      farmDisplayName = pendingAction.collectedData.farmName || (isMultiFarm
        ? `Kho Tổng Dùng Chung (${targetFarmIds.length} trang trại của bạn)`
        : farms.find(f => f.id === targetFarmIds[0])?.name || 'Kho trang trại');
    } else if (pendingAction?.collectedData?.farmId) {
      const found = farms.find((f) => f.id === pendingAction.collectedData.farmId);
      if (found) {
        targetFarmIds = [found.id];
        farmDisplayName = found.name;
      }
    }

    if (targetFarmIds.length === 0) {
      targetFarmIds = farms.map((f) => f.id);
      isMultiFarm = targetFarmIds.length > 1;
      farmDisplayName = isMultiFarm
        ? `Kho Tổng Hệ Thống (Dùng chung cho toàn bộ ${farms.length} trang trại của bạn)`
        : farms[0].name;
    }

    const contentToParse = fileContext?.extractedText || pendingAction?.collectedData?.fileText || question;
    const fileName = fileContext?.fileName || pendingAction?.collectedData?.fileName || 'Danh_sach_vat_tu';

    // 2. Dùng OpenAI trích xuất các mặt hàng có cấu trúc (hoặc tái sử dụng nếu đã bóc tách)
    let items: InventoryParsedItem[] = [];
    if (
      pendingAction?.collectedData?.items &&
      Array.isArray(pendingAction.collectedData.items) &&
      pendingAction.collectedData.items.length > 0
    ) {
      items = pendingAction.collectedData.items;
    }

    if (this.openai && contentToParse) {
      try {
        const systemPrompt = `Bạn là Chuyên gia Quản lý Kho Vật tư Nuôi tôm Thông minh SSFM (Smart Shrimp Farm Management).
Nhiệm vụ: Phân tích toàn bộ dữ liệu bảng tính Excel/CSV, hóa đơn hoặc danh mục kỹ thuật và trích xuất ĐẦY ĐỦ TẤT CẢ các mặt hàng (không được bỏ sót bất kỳ dòng sản phẩm nào).

QUY TẮC PHÂN LOẠI CATEGORY BẮT BUỘC:
1. "FEED" (Thức ăn cho tôm):
   - Cám viên, thức ăn ươm dưỡng (Vi Hạt Grow Master, SuperBest...), thức ăn thành phẩm (Grow Max, Super Fast...).
   - ĐẶC BIỆT: Nếu một sản phẩm thức ăn có nhiều dòng mã số hoặc kích cỡ hạt (No.0, No.1, No.2, No.3, No.4...) thì mỗi dòng mã số là 1 mặt hàng riêng biệt với tên: "Tên Sản Phẩm (Mã số)" (Ví dụ: "Vi Hạt Grow Master (No.0)", "Vi Hạt Grow Master (No.1S)", "Grow Max (No.1)", "Grow Max (No.2)").
   - "packageType": "Bao" (mặc định cho thức ăn), "weightPerPkg": 20 hoặc 25 kg/bao (hoặc theo quy cách nếu có), "unit": "kg".
   - "shape": "Mảnh" (cho thức ăn ươm gièo/vi hạt) hoặc "Trụ tròn" (pellet thành phẩm).
   - "sizeSpec": kích thước hạt hoặc trọng lượng tôm (ví dụ: "0.15 - 0.20 mm", "0.5 - 1.0 g/con").
2. "MEDICINE" (Thuốc phòng trị bệnh, bổ gan, men đường ruột, khoáng, vitamin):
   - Liver Max, Garlic Max, Grow Lactozyme, Grow Calciken, Canxi Max, Pro Max, Nutri Max, Hufa Max, Grow Glucan, Grow Gar, Grow First, Grow BioNutri, Glucan Max, BioLacto Max, Bio Max, Grow Garlic, Grow Liver, Grow Health, Grow Bio, Grow Organic, Grow Vitacomplex, Growmax Biolacto, Grow C100...
3. "CHEMICAL" (Hóa chất xử lý nước ao & đáy):
   - Grow TCCA, Grow Blance, Growmax PSB, Growmax VS, vôi, Chlorine, BKC, EDTA, Yucca...

QUY TẮC BÓC TÁCH QUY CÁCH, ĐƠN GIÁ & HÌNH ẢNH:
- "packageType": "Chai" | "Can" | "Bao" | "Gói" | "Thùng" | "Lon" | "Xô" | "Hộp" | "Túi" | "Khác".
- "weightPerPkg": Trọng lượng hoặc thể tích của 1 đơn vị đóng gói (số thực, theo đơn vị "unit").
  + "Chai 1 Lít" -> packageType: "Chai", weightPerPkg: 1, unit: "lít"
  + "Gói 1 kg" -> packageType: "Gói", weightPerPkg: 1, unit: "kg"
  + "Thùng 50 kg" -> packageType: "Thùng", weightPerPkg: 50, unit: "kg"
  + "Can 5 lít" -> packageType: "Can", weightPerPkg: 5, unit: "lít"
  + "Lon 500g" -> packageType: "Lon", weightPerPkg: 0.5, unit: "kg" (hoặc weightPerPkg: 500, unit: "g")
  + "Xô 5kg" -> packageType: "Xô", weightPerPkg: 5, unit: "kg"
  + "Bao 25kg" -> packageType: "Bao", weightPerPkg: 25, unit: "kg"
- "unit": Đơn vị đo lường cơ bản chuẩn hóa ("kg", "g", "lít", "ml").
- "packageQty": Số lượng gói/chai/bao nhập vào. Mặc định 10 (hoặc 1 nếu là thùng lớn 50kg, can 5 lít, xô 5kg).
- "quantity": Tổng khối lượng tồn kho = packageQty * weightPerPkg.
- "pricePerPackage": Đơn giá VNĐ trên 1 đơn vị đóng gói (từ cột Giá hoặc Đơn giá). Ví dụ: 260000, 4500000. Nếu không có giá thì 0.
- "minThreshold": Ngưỡng cảnh báo tồn kho tối thiểu (mặc định 10-15% tổng quantity).
- "supplierName": Tên thương hiệu, nhà sản xuất hoặc công ty cung cấp nếu nhận diện được (ví dụ: "GrowMax", "Cargill", "Bayer", "Uni-President", "CP"...).
- "description": Tóm tắt ngắn gọn thành phần chính, công dụng, liều dùng và bảo quản.
- "imageUrl": Bóc tách liên kết URL hình ảnh từ các cột "Hình ảnh", "Ảnh", "Image", "URL" (chuỗi URL hợp lệ bắt đầu bằng http:// hoặc https://).

YÊU CẦU TRẢ VỀ JSON THEO SCHEMA:
{
  "items": [
    {
      "itemName": "Tên cụ thể mặt hàng (Viết hoa đẹp mắt)",
      "category": "FEED" | "MEDICINE" | "CHEMICAL",
      "packageType": "Chai" | "Can" | "Bao" | "Gói" | "Thùng" | "Lon" | "Xô" | "Khác",
      "packageQty": 10,
      "weightPerPkg": 1,
      "quantity": 10,
      "unit": "kg" | "g" | "lít" | "ml",
      "pricePerPackage": 260000,
      "minThreshold": 2,
      "supplierName": "GrowMax",
      "description": "Bổ gan, giải độc, phục hồi gan tụy...",
      "imageUrl": "https://...",
      "shape": "Trụ tròn",
      "sizeSpec": "0.5mm"
    }
  ]
}`;

        const completion = await this.openai.chat.completions.create({
          model: 'gpt-4o-mini',
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: systemPrompt },
            {
              role: 'user',
              content: `Trích xuất TOÀN BỘ các mặt hàng và thuộc tính kho từ dữ liệu sau (không bỏ sót mặt hàng nào):\n\n${contentToParse.slice(0, 80000)}`,
            },
          ],
          temperature: 0.1,
          max_tokens: 8192,
        });

        const parsedContent = JSON.parse(completion.choices[0]?.message?.content || '{}');
        if (Array.isArray(parsedContent.items) && parsedContent.items.length > 0) {
          items = parsedContent.items.map((it: any) => {
            const cleanName = toTitleCase(String(it.itemName || ''));
            const category = ['FEED', 'MEDICINE', 'CHEMICAL'].includes(it.category) ? it.category : 'CHEMICAL';
            let unit = String(it.unit || 'kg').trim().toLowerCase();
            if (!['kg', 'g', 'lít', 'ml'].includes(unit)) {
              if (unit === 'lit' || unit === 'l' || unit === 'chai' || unit === 'can') unit = 'lít';
              else unit = 'kg';
            }
            const packageType = it.packageType ? String(it.packageType).trim() : (unit === 'lít' ? 'Chai' : 'Bao');
            const weightPerPkg = Math.max(0.01, Number(it.weightPerPkg) || 1);
            const packageQty = Math.max(1, Number(it.packageQty) || 1);
            const quantity = it.quantity ? Math.max(0.1, Number(it.quantity)) : packageQty * weightPerPkg;
            const pricePerPackage = Math.max(0, Number(it.pricePerPackage) || 0);
            const minThreshold = Number(it.minThreshold) || Math.max(1, Math.round(quantity * 0.15));

            return {
              itemName: cleanName,
              category,
              packageType,
              packageQty,
              weightPerPkg,
              quantity,
              unit,
              minThreshold,
              pricePerPackage,
              supplierName: it.supplierName ? String(it.supplierName).trim() : undefined,
              description: it.description ? String(it.description).trim() : undefined,
              imageUrl: it.imageUrl && /^https?:\/\/.+/i.test(String(it.imageUrl).trim())
                ? String(it.imageUrl).trim()
                : undefined,
              shape: category === 'FEED' ? (it.shape || 'Trụ tròn') : undefined,
              sizeSpec: category === 'FEED' ? it.sizeSpec : undefined,
            };
          });
        }
      } catch (err: any) {
        this.logger.error(`Error parsing inventory with OpenAI: ${err?.message || err}`);
      }
    }

    // Fallback nếu OpenAI không trích xuất được hoặc không có kết quả
    if (items.length === 0) {
      items = this.fallbackExtractInventoryItems(contentToParse);
    }

    if (items.length === 0) {
      return {
        isAgentAction: true,
        answer: `Dạ, tôi đã đọc tệp **"${fileName}"** nhưng chưa tìm thấy các dòng danh mục vật tư (Thức ăn, Thuốc hoặc Hóa chất) có cấu trúc số lượng và đơn vị tính rõ ràng.\n\nBạn vui lòng kiểm tra lại định dạng tệp hoặc nhắn trực tiếp danh sách mặt hàng nhé (Ví dụ: *"Nhập 50 bao thức ăn Cargill 02, 20 gói men vi sinh BZT"*).`,
      };
    }

    const summary: Record<string, string> = {
      'Phạm vi nhập kho': farmDisplayName,
      'Tổng số mặt hàng': `${items.length} mặt hàng`,
      'Tệp chứng từ': fileName,
      'Thời gian trích xuất': new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
    };

    const reply = isMultiFarm
      ? `Dạ vâng! Tôi đã đọc tệp **"${fileName}"** và trích xuất thành công **${items.length} mặt hàng vật tư** chuẩn bị nhập vào **Kho Tổng Hệ Thống (Dùng chung cho toàn bộ ${targetFarmIds.length} trang trại của bạn)**.\n\nBạn vui lòng kiểm tra bảng danh mục chi tiết bên dưới và nhấn **"Xác nhận nhập kho ngay"** để hoàn tất nhé!`
      : `Dạ vâng! Tôi đã đọc tệp **"${fileName}"** và trích xuất thành công **${items.length} mặt hàng vật tư** chuẩn bị nhập vào kho cho **"${farmDisplayName}"**.\n\nBạn vui lòng kiểm tra bảng danh mục chi tiết bên dưới và nhấn **"Xác nhận nhập kho ngay"** để hoàn tất nhé!`;

    return {
      isAgentAction: true,
      answer: reply,
      actionDraft: {
        type: 'CONFIRM_ACTION',
        intent: 'IMPORT_INVENTORY',
        collectedData: {
          farmIds: targetFarmIds,
          farmId: targetFarmIds[0],
          farmName: farmDisplayName,
          items,
          fileName,
          fileText: contentToParse,
        },
        missingFields: [],
        summary,
        inventoryItems: items,
        fileName,
        farmName: farmDisplayName,
      },
    };
  }

  /**
   * Xử lý nghiệp vụ Xuất file báo cáo tồn kho (Excel)
   */
  private async handleInventoryExport(
    question: string,
    farms: Array<{ id: string; name: string; address?: string | null }>,
  ): Promise<AgentActionResult> {
    if (farms.length === 0) {
      return {
        isAgentAction: true,
        answer: 'Dạ, hiện tại bạn chưa có trang trại nào để xuất dữ liệu kho. Vui lòng tạo trang trại trước nhé!',
      };
    }

    const targetFarm = farms[0];

    // Đếm số lượng vật tư trong kho
    const itemCount = await this.prisma.inventory.count({
      where: { farmId: targetFarm.id, deletedAt: null },
    });

    const exportUrl = `/api/chatbot/export/inventory/${targetFarm.id}`;
    const summary: Record<string, string> = {
      'Kho lưu trữ': 'Kho Dùng Chung Toàn Hệ Thống',
      'Định dạng xuất': 'Microsoft Excel (.xlsx)',
      'Tổng số mặt hàng tồn': `${itemCount} mặt hàng đang quản lý`,
      'Thời gian xuất file': new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
    };

    const reply = `Dạ, tôi đã tạo xong tệp báo cáo tồn kho vật tư **Kho Dùng Chung Toàn Hệ Thống** (gồm ${itemCount} mặt hàng). Bạn có thể bấm vào thẻ tải file bên dưới để tải về máy nhé!`;

    return {
      isAgentAction: true,
      answer: reply,
      actionDraft: {
        type: 'CONFIRM_ACTION',
        intent: 'EXPORT_INVENTORY',
        collectedData: { farmId: targetFarm.id, farmName: 'Kho Dùng Chung Hệ Thống' },
        missingFields: [],
        summary,
        exportUrl,
        farmName: 'Kho Dùng Chung Hệ Thống',
      },
    };
  }

  /**
   * Bộ trích xuất vật tư dự phòng (Regex heuristic)
   */
  private fallbackExtractInventoryItems(text: string): InventoryParsedItem[] {
    const lines = text.split(/[\r\n]+/);
    const items: InventoryParsedItem[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('---') || trimmed.length < 5) continue;

      // Tìm số lượng và đơn vị tính: vd "50 bao", "20 gói", "100 kg", "15 chai"
      const match = trimmed.match(/(\d+(?:[.,]\d+)?)\s*(kg|bao|gói|chai|can|lít|thùng|hộp|viên)/i);
      if (match) {
        const qty = parseFloat(match[1].replace(',', '.'));
        const unit = match[2].toLowerCase();
        let name = trimmed.split(match[0])[0].replace(/^[0-9.\-*\s|]+/, '').replace(/\|/g, '').trim();
        if (!name) {
          name = trimmed.replace(match[0], '').replace(/^[0-9.\-*\s|]+/, '').replace(/\|/g, '').trim();
        }

        if (name && name.length >= 2 && !/^(stt|tên|vật tư|mặt hàng|số lượng)$/i.test(name)) {
          let category: 'FEED' | 'MEDICINE' | 'CHEMICAL' = 'CHEMICAL';
          const nLower = name.toLowerCase();
          if (/thức ăn|cargill|cám|đạm|grobest|cp|tôm giống/i.test(nLower)) {
            category = 'FEED';
          } else if (/kháng sinh|vitamin|thuốc|phòng bệnh|trị bệnh|gan|ruột|antistress/i.test(nLower)) {
            category = 'MEDICINE';
          }

          items.push({
            itemName: toTitleCase(name),
            category,
            quantity: qty,
            unit,
            minThreshold: Math.round(qty * 0.15) || 5,
          });
        }
      }
    }
    return items.slice(0, 50);
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
     + quantity: Số lượng ao muốn tạo (mặc định 1). Vd "tạo 3 ao" -> quantity = 3, KHÔNG đưa câu lệnh vào "name".
       Khi quantity > 1 mà người dùng không đặt tên, để trống "name" (hệ thống tự đặt Ao 1, Ao 2...).
     + names: Danh sách tên ao (mảng) KHI người dùng đặt / đổi tên cho nhiều ao trong tin nhắn MỚI NHẤT.
       Vd "đổi tên thành ao 4,5,6" -> names = ["Ao 4","Ao 5","Ao 6"]. Không trả "names" nếu người dùng không nhắc đến tên.

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
1b. SỬA PHIẾU ĐANG CHỜ: Nếu có "Pending Action" và người dùng ra lệnh thay đổi (vd "đổi diện tích thành 1500m2", "sửa tên thành Ao Tròn 1", "độ sâu 1.8m", "đổi sang trang trại X", "tạo 4 ao thay vì 3"):
   - GIỮ NGUYÊN intent của Pending Action, trả về collectedData = dữ liệu cũ + trường vừa sửa, status = "CONFIRM_ACTION" nếu đã đủ.
   - Chỉ sửa đúng trường người dùng nhắc đến, không thay đổi các trường khác.
   - Nếu người dùng hỏi câu không liên quan đến phiếu (hỏi kiến thức, hỏi số liệu...), trả status = "NOT_ACTION".
   - Cấu trúc collectedData được phép sửa theo từng loại phiếu (hôm nay là ${new Date().toISOString().slice(0, 10)}):
     + CREATE_FARM: name, address (tỉnh/thành), area (m², 1 ha = 10.000 m²), farmingModel ("HIGH_TECH" công nghệ cao | "TRADITIONAL" quảng canh/truyền thống).
     + CREATE_POND: farmId hoặc farmName (đổi trang trại, chọn trong danh sách trang trại ở trên),
       ponds = [{ name, areaSize, depth }] — MỖI phần tử là một ao. Luôn trả lại ĐẦY ĐỦ mảng ponds:
         · Sửa riêng 1 ao ("Ao 2 sâu 1.8m"): chỉ đổi phần tử đó.
         · Sửa tất cả ("tất cả 1500m2", "mỗi ao sâu 1.6m"): đổi mọi phần tử.
         · Đổi tên ("đổi tên thành A1, A2, A3"): đổi name theo thứ tự.
         · Thêm / bớt ao: thêm / xóa phần tử (ao thêm mới lấy thông số giống ao khác nếu người dùng không nói).
       KHÔNG đặt areaSize / depth ở cấp ngoài khi phiếu đã có mảng ponds.
     + CREATE_CROP: pondId (CHỈ chọn trong "Ao đang trống") hoặc pondName, initialShrimpCount (số con, "200 nghìn" -> 200000), startDate (YYYY-MM-DD; "ngày mai", "15/12" -> quy đổi theo ngày hôm nay),
       (Đơn giá giống KHÔNG sửa được: hệ thống luôn dùng giá Tép Bạc tự động.)
       stage ("NURSERY" ương dưỡng | "COMMERCIAL" thương phẩm), seedType, targetHarvestSize (con/kg), targetSurvivalRate (%), targetTotalFeedKg (kg), expectedHarvestDate, expectedTransferDate (YYYY-MM-DD).
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

    // Override bằng Heuristics trực tiếp nếu người dùng vừa nhập trong tin nhắn này.
    // Heuristics (tên/tỉnh/diện tích) chỉ dành cho TRANG TRẠI — áp cho ao sẽ biến
    // câu "tạo 3 ao cho trang trại này" thành tên "Trang Trại 3 Ao Cho Trang Trại Này".
    if (parsed.intent === 'CREATE_FARM') {
      // Đang sửa phiếu ("đổi tên thành ...") thì để AI trích tên, tránh heuristic
      // biến cả câu lệnh thành "Trang Trại Đổi Tên Thành ...".
      if (heuristics.name && !pendingAction?.intent) collected.name = heuristics.name;
      if (heuristics.address) collected.address = heuristics.address;
      if (heuristics.area) collected.area = heuristics.area;
    }

    // AI đôi khi chỉ trả lại các ao vừa sửa thay vì cả danh sách -> gộp vào danh sách cũ theo tên
    const prevPonds = pendingAction?.collectedData?.ponds;
    const newPonds = parsed.collectedData?.ponds;
    if (parsed.intent === 'CREATE_POND' && Array.isArray(prevPonds) && Array.isArray(newPonds)) {
      const key = (n: unknown) => normalizeVietnamese(String(n || ''));
      const prevKeys = prevPonds.map((p: any) => key(p?.name));
      const isRemoving = /(bớt|giảm|bỏ|xóa|xoá|loại)/i.test(userMessage);
      if (
        !isRemoving &&
        newPonds.length < prevPonds.length &&
        newPonds.every((p: any) => prevKeys.includes(key(p?.name)))
      ) {
        collected.ponds = prevPonds.map((p: any) => ({
          ...p,
          ...(newPonds.find((n: any) => key(n?.name) === key(p?.name)) || {}),
        }));
      }
    }

    // Tên ao AI trích từ tin nhắn mới nhất (khác với "names" cũ trên phiếu)
    const newNames = parsed.collectedData?.names;
    const oldNames = pendingAction?.collectedData?.names;
    if (Array.isArray(newNames) && newNames.length && JSON.stringify(newNames) !== JSON.stringify(oldNames)) {
      collected._userNames = newNames;
    }

    return this.buildDraft(parsed.intent, collected, db, userMessage, pendingAction, parsed.replyText);
  }

  /**
   * Dựng phiếu (SLOT_FILLING / CONFIRM_ACTION) từ dữ liệu AI đã trích xuất.
   * Dùng chung cho luồng sửa phiếu (processWithOpenAI) và luồng tool calling của
   * chatbot chính (draftFromToolCall): mọi kiểm tra nghiệp vụ (trang trại tồn tại,
   * trùng tên, tự đặt tên ao, giới hạn số lượng, mật độ thả...) đều nằm ở đây.
   */
  private buildDraft(
    intent: AgentActionIntent,
    collected: Record<string, any>,
    db: DraftContext,
    userMessage: string,
    pendingAction: { intent?: AgentActionIntent; collectedData?: Record<string, any> } | undefined,
    aiReplyText?: string,
  ): Promise<AgentActionResult | null> {
    const result = this.buildDraftCore(intent, collected, db, userMessage, pendingAction, aiReplyText);
    return this.attachCropCard(result, db, pendingAction);
  }

  /**
   * Giá tôm giống thị trường (Tép Bạc) — cùng nguồn với form tạo vụ thủ công.
   * Có timeout để không làm chậm câu trả lời chat khi phải tải lại giá từ tepbac.com.
   */
  private async getSeedMarketPrice(): Promise<SeedPriceInfo | null> {
    if (!this.marketPrices) return null;
    try {
      const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), SEED_PRICE_TIMEOUT_MS));
      const seed = await Promise.race([this.marketPrices.getSeedPrice(false), timeout]);
      if (!seed || !(Number(seed.price) > 0)) return null;
      return {
        name: seed.name,
        price: Number(seed.price),
        unit: seed.unit,
        source: seed.source,
        sourceUrl: seed.sourceUrl,
        updatedAt: new Date(seed.updatedAt).toISOString(),
        isLive: seed.isLive,
      };
    } catch (err: any) {
      this.logger.warn(`Không lấy được giá tôm giống thị trường: ${err?.message || err}`);
      return null;
    }
  }

  /**
   * Phiếu tạo vụ nuôi -> gắn THẺ NHẬP LIỆU (danh sách ao trống + dữ liệu AI điền sẵn)
   * để Quản lý trang trại điền / sửa trực tiếp trong khung chat.
   */
  private async attachCropCard(
    result: AgentActionResult | null,
    db: DraftContext,
    pendingAction: { intent?: AgentActionIntent; collectedData?: Record<string, any> } | undefined,
  ): Promise<AgentActionResult | null> {
    const draft = result?.actionDraft;
    if (!result || !draft || draft.intent !== 'CREATE_CROP' || db.emptyPonds.length === 0) return result;

    // Giá giống Tép Bạc: thẻ dùng làm đơn giá mặc định + link xem nguồn + nút "Đặt lại giá Tép Bạc"
    const seedPrice = await this.getSeedMarketPrice();
    if (seedPrice) draft.seedMarketPrice = seedPrice;

    const farmModel = new Map(db.farms.map((f) => [f.id, f.farmingModel ?? null]));
    draft.cropPondOptions = db.emptyPonds.map((p) => ({
      id: p.id,
      name: p.name,
      farmId: p.farmId,
      farmName: p.farmName,
      farmingModel: farmModel.get(p.farmId) ?? null,
      areaSize: Number(p.areaSize) || 0,
      depth: Number(p.depth) || 0,
    }));

    const data = draft.collectedData;
    if (data.stage !== 'NURSERY' && data.stage !== 'COMMERCIAL') delete data.stage;
    // Bỏ giá trị tùy chọn không hợp lệ (AI trích sai) trước khi đưa lên thẻ
    const validOptional = pickCropOptionalFields(data);
    [...CROP_OPTIONAL_FIELDS.numbers, ...CROP_OPTIONAL_FIELDS.dates, ...CROP_OPTIONAL_FIELDS.strings].forEach(
      (k) => delete data[k],
    );
    Object.assign(data, validOptional);
    delete data.seedUnitPrice; // đơn giá luôn tự động theo Tép Bạc, không nhận giá AI trích

    const isEdit = pendingAction?.intent === 'CREATE_CROP';
    const isGenericAsk =
      draft.type === 'SLOT_FILLING' && draft.missingFields.includes('pondId') && draft.missingFields.includes('initialShrimpCount');
    if (draft.type === 'SLOT_FILLING' && !isGenericAsk) {
      // Thông báo cụ thể (vd ao đang có vụ) -> giữ nguyên, chỉ nhắc dùng thẻ
      result.answer = `${result.answer}\n\nBạn có thể chọn lại trực tiếp trên **thẻ tạo vụ nuôi** bên dưới.`;
    } else if (draft.type === 'SLOT_FILLING') {
      const known = [
        data.pondName && `ao **${data.pondName}**`,
        data.initialShrimpCount && `**${Number(data.initialShrimpCount).toLocaleString('vi-VN')} con giống**`,
      ].filter(Boolean);
      result.answer = `Dạ, mời bạn ${isEdit ? 'tiếp tục ' : ''}điền **thẻ tạo vụ nuôi** bên dưới${
        known.length ? ` (tôi đã điền sẵn ${known.join(', ')})` : ''
      }. Các mục có dấu * là bắt buộc; bấm **"Tạo vụ nuôi"** khi đã xong nhé!`;
    } else {
      result.answer = `${result.answer}\n\nBạn có thể chỉnh mọi thông số trực tiếp trên **thẻ tạo vụ nuôi** bên dưới (giai đoạn, ngày tách ao / thu hoạch, giống, mục tiêu...) hoặc nhắn cho tôi.`;
    }
    return result;
  }

  private buildDraftCore(
    intent: AgentActionIntent,
    collected: Record<string, any>,
    db: DraftContext,
    userMessage: string,
    pendingAction: { intent?: AgentActionIntent; collectedData?: Record<string, any> } | undefined,
    aiReplyText?: string,
  ): AgentActionResult | null {
    // ─────────────────────────────────────────────────────────────────────────
    // 1. XỬ LÝ CHUYÊN SÂU: CREATE_FARM
    // ─────────────────────────────────────────────────────────────────────────
    if (intent === 'CREATE_FARM') {
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

        let reply = aiReplyText;
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
    if (intent === 'CREATE_POND') {
      return this.buildPondDraft(collected, db, userMessage, pendingAction);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 3. XỬ LÝ CHUYÊN SÂU: CREATE_CROP
    // ─────────────────────────────────────────────────────────────────────────
    if (intent === 'CREATE_CROP') {
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
        collected.initialShrimpCount = Math.floor(Number(collected.initialShrimpCount)) || undefined;
      }
      if (!collected.startDate || !/^\d{4}-\d{2}-\d{2}$/.test(String(collected.startDate))) {
        collected.startDate = new Date().toISOString().slice(0, 10);
      }

      // Đổi ao thả giống theo tên; chỉ chấp nhận ao đang trống
      const prevCrop = (pendingAction?.intent === 'CREATE_CROP' && pendingAction.collectedData) || {};
      if (collected.pondName && collected.pondName !== prevCrop.pondName) {
        const byName = matchByName(db.emptyPonds, collected.pondName);
        if (byName) collected.pondId = byName.id;
      }
      const chosenPond = db.emptyPonds.find((p) => p.id === collected.pondId);
      if (collected.pondId && !chosenPond) {
        const busy = db.ponds.find((p) => p.id === collected.pondId);
        delete collected.pondId;
        delete collected.pondName;
        if (busy) {
          return {
            isAgentAction: true,
            answer: `Dạ, **${busy.name}** đang có vụ nuôi hoạt động nên chưa thả giống được. Bạn chọn một ao đang trống nhé:\n${db.emptyPonds.map((p) => `• **${p.name}** (${p.farmName} - ${p.areaSize} m²)`).join('\n')}`,
            actionDraft: {
              type: 'SLOT_FILLING',
              intent: 'CREATE_CROP',
              collectedData: collected,
              missingFields: ['pondId'],
              quickSuggestions: db.emptyPonds.map((p) => p.name),
            },
          };
        }
      } else if (chosenPond) {
        collected.pondName = chosenPond.name;
      }

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
   * Dựng phiếu tạo ao (1 hoặc nhiều ao). Mỗi ao có thông số riêng trong
   * collectedData.ponds = [{ name, areaSize, depth }] nên người dùng có thể sửa
   * từng ao ("Ao 2 sâu 1.8m"), sửa tất cả ("tất cả 1500m2"), đổi tên, thêm/bớt ao
   * hoặc chuyển trang trại.
   */
  private buildPondDraft(
    collected: Record<string, any>,
    db: DraftContext,
    userMessage: string,
    pendingAction: { intent?: AgentActionIntent; collectedData?: Record<string, any> } | undefined,
  ): AgentActionResult {
    if (db.farms.length === 0) {
      return {
        isAgentAction: true,
        answer: `Dạ, theo quy chuẩn quản lý trang trại của hệ thống SSFM, mỗi **Ao nuôi** bắt buộc phải trực thuộc một **Trang trại** cụ thể.\n\nHiện tại hệ thống chưa ghi nhận trang trại nào của bạn. Tôi sẵn sàng hỗ trợ bạn khởi tạo **Trang trại** trước nhé! Tên trang trại bạn dự định đặt là gì?`,
        actionDraft: {
          type: 'SLOT_FILLING',
          intent: 'CREATE_FARM',
          collectedData: { _waitingFor: 'name', farmingModel: 'HIGH_TECH' },
          missingFields: ['name', 'address', 'area'],
          quickSuggestions: ['Trang trại Tôm Huế 10ha ở Thừa Thiên Huế', 'Trang trại Tôm Bến Tre 5ha ở Bến Tre'],
        },
      };
    }

    const isEdit = pendingAction?.intent === 'CREATE_POND';
    const prev = (isEdit && pendingAction?.collectedData) || {};
    const positive = (v: unknown) => (Number(v) > 0 ? Number(v) : undefined);

    // ── 1. Trang trại: đổi theo tên (farmName) hoặc ID ──
    const byId = db.farms.find((f) => f.id === collected.farmId);
    const byName = collected.farmName ? matchByName(db.farms, collected.farmName) : undefined;
    const farmNameChanged = Boolean(collected.farmName && collected.farmName !== prev.farmName);
    const farm = (farmNameChanged && byName) || byId || byName || (db.farms.length === 1 ? db.farms[0] : undefined);
    if (!farm) {
      return {
        isAgentAction: true,
        answer: `Dạ, bạn hiện đang quản lý **${db.farms.length} trang trại**. Bạn muốn tạo ao nuôi mới trực thuộc trang trại nào? Vui lòng chọn bên dưới:\n${db.farms.map((f, i) => `${i + 1}. **${f.name}** (${f.address || ''})`).join('\n')}`,
        actionDraft: {
          type: 'SLOT_FILLING',
          intent: 'CREATE_POND',
          collectedData: { ...collected, farmId: undefined, farmName: undefined },
          missingFields: ['farmId'],
          quickSuggestions: db.farms.map((f) => f.name),
        },
      };
    }
    collected.farmId = farm.id;
    collected.farmName = farm.name;

    // ── 2. Danh sách ao hiện có trên phiếu ──
    type PondSpec = { name?: string; areaSize?: number; depth?: number };
    let specs: PondSpec[] = Array.isArray(collected.ponds)
      ? collected.ponds.map((p: any) => ({
          name: p?.name ? toTitleCase(String(p.name)) : undefined,
          areaSize: positive(p?.areaSize),
          depth: positive(p?.depth),
        }))
      : Array.isArray(collected.names)
        ? collected.names.map((n: unknown) => ({ name: toTitleCase(String(n)) }))
        : collected.name
          ? [{ name: toTitleCase(String(collected.name)) }]
          : [];

    // ── 3. Số lượng ao ──
    const aiNames = Array.isArray(collected._userNames)
      ? collected._userNames.map((n: unknown) => toTitleCase(String(n))).filter(Boolean)
      : [];
    const userNames = findPondNamesInText(userMessage) || (aiNames.length ? aiNames : null);
    const textQuantity = findPondQuantityInText(userMessage);
    const relative =
      isEdit && textQuantity
        ? userMessage.match(/(?:^|\s)(thêm|tăng|bớt|giảm|bỏ)\s+(?:\S+\s+)?(?:cái\s+)?ao(?=\s|$|[,.!?])/i)
        : null;
    const prevLen = Array.isArray(prev.ponds) ? prev.ponds.length : Number(prev.quantity) || 0;
    const aiQuantity = Math.floor(Number(collected.quantity) || 0);

    let quantity: number;
    if (userNames) {
      quantity = userNames.length; // đặt bao nhiêu tên thì tạo bấy nhiêu ao
    } else if (relative && textQuantity) {
      const sign = /thêm|tăng/i.test(relative[1]) ? 1 : -1;
      quantity = Math.max(1, (prevLen || specs.length || 1) + sign * textQuantity);
    } else if (textQuantity) {
      quantity = textQuantity;
    } else if (specs.length && specs.length !== prevLen && Array.isArray(collected.ponds)) {
      quantity = specs.length; // AI đã thêm / bớt phần tử trong danh sách
    } else if (aiQuantity && aiQuantity !== prevLen) {
      quantity = aiQuantity;
    } else {
      quantity = specs.length || aiQuantity || 1;
    }

    if (quantity > MAX_PONDS_PER_ACTION) {
      return {
        isAgentAction: true,
        answer: `Dạ, mỗi lần tôi chỉ hỗ trợ tạo tối đa **${MAX_PONDS_PER_ACTION} ao**. Bạn vui lòng chia nhỏ số lượng giúp tôi nhé!`,
        actionDraft: {
          type: 'SLOT_FILLING',
          intent: 'CREATE_POND',
          collectedData: { ...collected, quantity: undefined },
          missingFields: ['quantity'],
          quickSuggestions: [`Tạo ${MAX_PONDS_PER_ACTION} ao`, 'Tạo 5 ao'],
        },
      };
    }

    // ── 4. Co / giãn danh sách; ao thêm mới lấy thông số của ao đầu tiên ──
    const template = specs.find((s) => s.areaSize) || {};
    specs = specs.slice(0, quantity);
    while (specs.length < quantity) {
      specs.push({ areaSize: template.areaSize, depth: template.depth });
    }
    if (userNames) userNames.forEach((n, i) => (specs[i].name = n));

    // Sửa riêng từng ao đọc trực tiếp từ câu: "Ao 2 sâu 1.8m", "Ao 3 diện tích 1500m2"
    const perPondEdits = parsePerPondEdits(userMessage, specs.map((s) => s.name || ''));
    perPondEdits.forEach((edit, i) => {
      if (edit.areaSize) specs[i].areaSize = edit.areaSize;
      if (edit.depth) specs[i].depth = edit.depth;
    });
    const hasPerPondEdit = perPondEdits.some((e) => e.areaSize || e.depth);
    const saysAll = /(tất cả|cả \d+ ao|các ao|mỗi ao|toàn bộ|đều)/i.test(userMessage);

    // Thông số cấp ngoài (areaSize / depth) = áp dụng cho TẤT CẢ ao
    // (bỏ qua nếu người dùng đang sửa riêng một ao, trừ khi nói rõ "tất cả")
    const applyAll = !hasPerPondEdit || saysAll;
    const allArea = applyAll ? positive(collected.areaSize) : undefined;
    const allDepth = applyAll ? positive(collected.depth) : undefined;
    specs.forEach((s) => {
      if (allArea) s.areaSize = allArea;
      if (allDepth) s.depth = allDepth;
      if (!s.depth) s.depth = 1.5;
    });

    // ── 5. Tự đặt tên "Ao N" cho ao chưa có tên, không trùng ao hiện có ──
    const existingNames = db.ponds.filter((p) => p.farmId === farm.id).map((p) => p.name);
    const missingNameCount = specs.filter((s) => !s.name).length;
    const autoNamed = missingNameCount > 0;
    if (autoNamed) {
      const generated = generatePondNames(missingNameCount, [
        ...existingNames,
        ...specs.map((s) => s.name || '').filter(Boolean),
      ]);
      specs.filter((s) => !s.name).forEach((s, i) => (s.name = generated[i]));
    }

    // Lưu phiếu ở dạng chuẩn hóa
    collected.ponds = specs;
    collected.quantity = specs.length;
    delete collected.name;
    delete collected.names;
    delete collected.areaSize;
    delete collected.depth;
    delete collected._userNames;

    // ── 6. Kiểm tra trùng tên (với ao trong trang trại và trong chính phiếu) ──
    const existingSet = new Set(existingNames.map((n) => n.trim().toLowerCase()));
    const seen = new Set<string>();
    const conflicts = specs
      .map((s) => s.name as string)
      .filter((n) => {
        const key = n.trim().toLowerCase();
        const dup = existingSet.has(key) || seen.has(key);
        seen.add(key);
        return dup;
      });
    if (conflicts.length) {
      const suggestion = generatePondNames(specs.length, existingNames);
      return {
        isAgentAction: true,
        answer: `Dạ, tên **${conflicts.join(', ')}** bị trùng với ao đã có trong **${farm.name}** hoặc lặp lại trong phiếu. Bạn vui lòng chọn tên khác nhé (gợi ý: ${suggestion.join(', ')}).`,
        actionDraft: {
          type: 'SLOT_FILLING',
          intent: 'CREATE_POND',
          collectedData: collected,
          missingFields: ['names'],
          quickSuggestions: [`Đặt tên ${suggestion.join(', ')}`],
        },
      };
    }

    // ── 7. Thiếu diện tích ──
    const noArea = specs.filter((s) => !s.areaSize).map((s) => s.name as string);
    if (noArea.length) {
      return {
        isAgentAction: true,
        answer: `Dạ, tôi sẽ hỗ trợ bạn tạo **${specs.length} ao nuôi** (${specs.map((s) => s.name).join(', ')}) trực thuộc **${farm.name}**.\n\nBạn vui lòng cho tôi biết **diện tích mặt nước${specs.length > 1 ? ' mỗi ao' : ''} (m²)** *(thường 1.000 - 3.000 m²)*${noArea.length < specs.length ? ` cho ${noArea.join(', ')}` : ''} và độ sâu nếu khác mức chuẩn 1.5m nhé!`,
        actionDraft: {
          type: 'SLOT_FILLING',
          intent: 'CREATE_POND',
          collectedData: collected,
          missingFields: ['areaSize'],
          quickSuggestions: specs.length > 1 ? ['Mỗi ao 1500m2 sâu 1.5m', 'Mỗi ao 2000m2'] : ['Diện tích 1500m2 sâu 1.5m', 'Diện tích 2000m2'],
        },
      };
    }

    // ── 8. Phiếu xác nhận ──
    const fmtArea = (v: number) => `${v.toLocaleString('vi-VN')} m²`;
    const fmtDepth = (v: number) => `${v.toLocaleString('vi-VN')} m`;
    const totalArea = specs.reduce((sum, s) => sum + (s.areaSize || 0), 0);
    const uniform = specs.every((s) => s.areaSize === specs[0].areaSize && s.depth === specs[0].depth);

    const summary: Record<string, string> = { 'Trực thuộc trang trại': farm.name };
    if (specs.length === 1) {
      summary['Tên ao nuôi'] = specs[0].name as string;
      summary['Diện tích mặt nước'] = fmtArea(specs[0].areaSize as number);
      summary['Độ sâu mực nước'] = fmtDepth(specs[0].depth as number);
    } else if (uniform) {
      summary['Số lượng ao'] = `${specs.length} ao`;
      summary['Tên các ao'] = specs.map((s) => s.name).join(', ');
      summary['Diện tích mặt nước'] = `${fmtArea(specs[0].areaSize as number)} / ao (tổng ${fmtArea(totalArea)})`;
      summary['Độ sâu mực nước'] = fmtDepth(specs[0].depth as number);
    } else {
      summary['Số lượng ao'] = `${specs.length} ao (tổng ${fmtArea(totalArea)})`;
      specs.forEach((s) => {
        summary[s.name as string] = `${fmtArea(s.areaSize as number)} · sâu ${fmtDepth(s.depth as number)}`;
      });
    }

    // Cảnh báo (không chặn) khi tổng diện tích ao vượt diện tích trang trại
    let areaWarning = '';
    const farmArea = Number(farm.area) || 0;
    if (farmArea > 0) {
      const usedArea = db.ponds.filter((p) => p.farmId === farm.id).reduce((sum, p) => sum + (Number(p.areaSize) || 0), 0);
      if (usedArea + totalArea > farmArea) {
        summary['⚠️ Lưu ý'] = `Tổng diện tích ao (${fmtArea(usedArea + totalArea)}) vượt diện tích trang trại (${fmtArea(farmArea)})`;
        areaWarning = `\n\n⚠️ Tổng diện tích ao sau khi tạo (**${fmtArea(usedArea + totalArea)}**) sẽ vượt diện tích trang trại (**${fmtArea(farmArea)}**). Bạn kiểm tra lại giúp tôi nhé.`;
      }
    }

    const label = specs.length === 1 ? `**${specs[0].name}**` : `**${specs.length} ao nuôi** (${specs.map((s) => s.name).join(', ')})`;
    const head = isEdit
      ? `Dạ, tôi đã cập nhật phiếu: ${label} thuộc **${farm.name}**.`
      : `Dạ, thông số cho ${label} thuộc **${farm.name}** đã hoàn thiện.${autoNamed ? ' Tôi đã tự đặt tên để không trùng với các ao hiện có.' : ''}`;

    const examples =
      specs.length > 1
        ? [`${specs[specs.length - 1].name} sâu 1.8m`, 'tất cả 1500m2', 'đổi tên thành A1, A2', 'bớt 1 ao']
        : ['diện tích 1500m2', 'sâu 1.8m', 'đổi tên thành Ao Ươm', 'thêm 1 ao'];
    if (db.farms.length > 1) examples.push('chuyển sang trang trại khác');

    return {
      isAgentAction: true,
      answer: `${head}${areaWarning}\n\nBạn kiểm tra bảng bên dưới và nhấn **"Xác nhận tạo ngay"**. Muốn sửa gì cứ nhắn cho tôi, ví dụ: ${examples.map((e) => `*"${e}"*`).join(', ')}.`,
      actionDraft: {
        type: 'CONFIRM_ACTION',
        intent: 'CREATE_POND',
        collectedData: collected,
        missingFields: [],
        summary,
      },
    };
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
   * Thực thi lưu thực thể vào DB sau khi người dùng bấm nút [Xác nhận thực thi ngay]
   */
  /** Gắn mã phiếu mới cho mỗi phiếu trả về client (phiếu sửa lại cũng là phiếu mới) */
  stampDraft(draft: AgentActionDraft | undefined): AgentActionDraft | undefined {
    if (draft) draft.draftId = randomUUID();
    return draft;
  }

  /**
   * Thực thi phiếu. Có draftId -> mỗi phiếu chỉ chạy đúng 1 lần nhờ khóa chính của bảng
   * agent_action_executions (chặn bấm xác nhận nhiều lần, nhiều tab, nhiều instance):
   * - Lần đầu: ghi PROCESSING -> thực thi -> DONE (lưu phản hồi). Lỗi -> xóa để thử lại được.
   * - Lặp lại khi đã DONE: trả lại phản hồi cũ kèm alreadyExecuted, KHÔNG tạo thêm.
   * - Lặp lại khi đang PROCESSING: báo phiếu đang được xử lý.
   * Không có draftId (phiếu cũ trong lịch sử chat trước bản cập nhật): thực thi như trước.
   */
  async executeAgentAction(dto: ExecuteActionDto, currentUser: AuthUser) {
    const draftId = dto.draftId;
    if (!draftId) return this.executeAgentActionOnce(dto, currentUser);

    const uid = currentUser.userId || (currentUser as any).id;
    let claim: Awaited<ReturnType<AgentActionService['claimDraft']>>;
    try {
      claim = await this.claimDraft(draftId, uid, dto.intent);
    } catch (err: any) {
      // Database chưa có bảng agent_action_executions (chưa chạy `prisma db push`):
      // vẫn thực thi phiếu như trước, chỉ tạm thời không chặn tạo trùng.
      if (err?.code === 'P2021') {
        this.logger.warn(
          'Bảng agent_action_executions chưa tồn tại — chạy `npx prisma db push` để bật chống tạo trùng phiếu AI.',
        );
        return this.executeAgentActionOnce(dto, currentUser);
      }
      throw err;
    }
    if ('previous' in claim) return claim.previous;

    let response: any;
    try {
      response = await this.executeAgentActionOnce(dto, currentUser);
    } catch (err) {
      // Thực thi lỗi (dữ liệu sai, không đủ quyền...) -> nhả phiếu để người dùng sửa và thử lại
      await this.prisma.agentActionExecution.delete({ where: { draftId } }).catch(() => undefined);
      throw err;
    }

    await this.prisma.agentActionExecution
      .update({
        where: { draftId },
        data: {
          status: 'DONE',
          result: {
            success: response?.success ?? true,
            message: response?.message ?? '',
            type: response?.type ?? null,
            redirectTab: response?.redirectTab ?? null,
          },
        },
      })
      .catch((e: any) => this.logger.warn(`Không lưu được kết quả phiếu ${draftId}: ${e?.message || e}`));
    return response;
  }

  /**
   * Giữ chỗ thực thi cho phiếu. Trả { claimed } nếu được thực thi, { previous } (phản hồi cũ)
   * nếu phiếu đã xong; ném lỗi nếu phiếu đang được xử lý hoặc thuộc người khác.
   */
  private async claimDraft(
    draftId: string,
    userId: string,
    intent: string,
  ): Promise<{ claimed: true } | { previous: Record<string, any> }> {
    const STALE_MS = 5 * 60 * 1000; // PROCESSING quá 5 phút = tiến trình trước đã chết giữa chừng
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        await this.prisma.agentActionExecution.create({ data: { draftId, userId, intent } });
        return { claimed: true };
      } catch (err: any) {
        if (err?.code !== 'P2002') throw err; // không phải lỗi trùng khóa
      }

      const existing = await this.prisma.agentActionExecution.findUnique({ where: { draftId } });
      if (!existing) continue; // vừa bị xóa (lần trước lỗi) -> thử giữ chỗ lại
      if (existing.userId !== userId) {
        throw new ForbiddenException('Phiếu này không thuộc về tài khoản của bạn');
      }
      if (existing.status === 'DONE') {
        const prev = (existing.result || {}) as Record<string, any>;
        return {
          previous: {
            ...prev,
            success: true,
            alreadyExecuted: true,
            message: `ℹ️ Phiếu này đã được thực hiện trước đó, hệ thống không tạo thêm.\n\n${prev.message || ''}`.trim(),
          },
        };
      }
      if (Date.now() - new Date(existing.updatedAt).getTime() > STALE_MS) {
        await this.prisma.agentActionExecution.delete({ where: { draftId } }).catch(() => undefined);
        continue;
      }
      throw new ConflictException('Phiếu này đang được xử lý, vui lòng chờ trong giây lát.');
    }
    throw new ConflictException('Phiếu này đang được xử lý, vui lòng thử lại sau.');
  }

  private async executeAgentActionOnce(dto: ExecuteActionDto, currentUser: AuthUser) {
    const { intent, data } = dto;
    const uid = currentUser.userId || (currentUser as any).id;

    if (intent === 'RECORD_WATER_QUALITY') {
      if (!this.waterRecordAgent) {
        throw new BadRequestException('Tính năng nhập số đo nước bằng AI chưa được kích hoạt');
      }
      return this.waterRecordAgent.execute(data, currentUser);
    }

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

    // Tạo vụ nuôi qua thẻ AI trong khung chat: chỉ Quản lý trang trại
    if (intent === 'CREATE_CROP' && currentUser.role !== 'FARM_MANAGER') {
      throw new ForbiddenException(
        'Chỉ Quản lý trang trại mới có quyền khởi tạo vụ nuôi qua trợ lý AI',
      );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 1. EXECUTE: IMPORT_INVENTORY (NHẬP KHO VẬT TƯ QUA AI)
    // ─────────────────────────────────────────────────────────────────────────
    if (intent === 'IMPORT_INVENTORY') {
      if (currentUser.role !== 'FARM_MANAGER') {
        throw new ForbiddenException('Bạn không có quyền thực hiện nghiệp vụ nhập kho');
      }

      const items = data.items || data.inventoryItems || [];
      if (!Array.isArray(items) || items.length === 0) {
        throw new BadRequestException('Không tìm thấy mặt hàng vật tư nào để nhập vào kho');
      }

      // PHÂN QUYỀN BẢO MẬT: Chỉ lấy trang trại thuộc quyền quản lý của chính Manager này (không ảnh hưởng trang trại người khác)
      const accessibleFarmIds = await this.farmAccess.getAccessibleFarmIds(currentUser);
      let targetFarms: Array<{ id: string; name: string }> = [];

      const rawFarmIds: string[] =
        Array.isArray(data.farmIds) && data.farmIds.length > 0
          ? data.farmIds
          : (data.farmId ? [data.farmId] : []);

      if (rawFarmIds.length > 0) {
        targetFarms = await this.prisma.farm.findMany({
          where: {
            id: { in: accessibleFarmIds ? rawFarmIds.filter((id) => accessibleFarmIds.includes(id)) : rawFarmIds },
            deletedAt: null,
          },
          select: { id: true, name: true },
        });
      }

      // Nếu không chỉ định cụ thể, đồng bộ cho tất cả các trang trại của Manager này
      if (targetFarms.length === 0 && accessibleFarmIds && accessibleFarmIds.length > 0) {
        targetFarms = await this.prisma.farm.findMany({
          where: { id: { in: accessibleFarmIds }, deletedAt: null },
          select: { id: true, name: true },
        });
      }

      if (targetFarms.length === 0) {
        throw new BadRequestException('Chưa xác định được trang trại hợp lệ nào thuộc quyền quản lý của bạn để nhập kho');
      }

      const isMultiFarm = targetFarms.length > 1;
      const farmDisplayName = isMultiFarm
        ? `Kho Tổng Dùng Chung (${targetFarms.length} trang trại của bạn)`
        : targetFarms[0].name;

      const processedItems: any[] = [];

      // Nhập đồng bộ cho từng trang trại thuộc quyền sở hữu của manager
      for (const targetFarm of targetFarms) {
        const targetFarmId = targetFarm.id;
        const existingList = await this.prisma.inventory.findMany({
          where: { farmId: targetFarmId, deletedAt: null },
        });
        const existingMap = new Map<string, any>();
        existingList.forEach((it) => existingMap.set(it.itemName.trim().toLowerCase(), it));

        for (const it of items) {
          const cleanName = (it.itemName || '').trim();
          if (!cleanName) continue;

          const category = ['FEED', 'MEDICINE', 'CHEMICAL'].includes(it.category)
            ? it.category
            : 'CHEMICAL';
          const qty = Math.max(0.1, Number(it.quantity) || 1);
          const unit = (it.unit || 'kg').trim();
          const minThreshold = Number(it.minThreshold) || Math.round(qty * 0.15);
          const pricePerPackage = Number(it.pricePerPackage) || 0;
          const packageType = it.packageType?.trim() || (unit === 'lít' ? 'Chai' : 'Bao');
          const packageQty = it.packageQty != null ? Number(it.packageQty) : (it.weightPerPkg ? Math.round(qty / Number(it.weightPerPkg)) : qty);
          const weightPerPkg = it.weightPerPkg != null ? Number(it.weightPerPkg) : (packageQty > 0 ? Math.round((qty / packageQty) * 100) / 100 : 1);
          const supplierName = it.supplierName?.trim() || null;
          const description = it.description?.trim() || null;
          const shape = category === 'FEED' ? (it.shape?.trim() || 'Trụ tròn') : null;
          const sizeSpec = category === 'FEED' ? (it.sizeSpec?.trim() || null) : null;
          const imageUrl = it.imageUrl?.trim() || null;

          const existing = existingMap.get(cleanName.toLowerCase());

          try {
            if (existing) {
              const updated = await this.prisma.inventory.update({
                where: { id: existing.id },
                data: {
                  quantity: { increment: qty },
                  unit: existing.unit || unit,
                  ...(packageQty > 0 && existing.packageQty != null ? { packageQty: { increment: packageQty } } : {}),
                  ...(packageType && !existing.packageType ? { packageType } : {}),
                  ...(weightPerPkg > 0 && !existing.weightPerPkg ? { weightPerPkg } : {}),
                  ...(pricePerPackage > 0 ? { pricePerPackage } : {}),
                  ...(supplierName && !existing.supplierName ? { supplierName } : {}),
                  ...(description && !existing.description ? { description } : {}),
                  ...(shape && !existing.shape ? { shape } : {}),
                  ...(sizeSpec && !existing.sizeSpec ? { sizeSpec } : {}),
                  ...(imageUrl && !existing.imageUrl ? { imageUrl } : {}),
                },
              });

              const packageBadge = packageQty ? `+${packageQty} ${packageType}` : `${qty} ${unit}`;
              const priceInfo = pricePerPackage > 0 ? ` - Đơn giá: ${pricePerPackage.toLocaleString('vi-VN')} đ/${packageType}` : '';
              const fileSource = data.fileName ? `tệp ${data.fileName}` : 'chứng từ';

              await this.prisma.inventoryUsageLog
                .create({
                  data: {
                    inventoryId: updated.id,
                    quantityUsed: qty,
                    usageDate: new Date(),
                    notes: `[NHẬP KHO: ${packageBadge}] — [AI Tự Động] Nhập thêm: ${qty} ${unit} từ ${fileSource}${priceInfo}`,
                    createdBy: uid,
                  },
                })
                .catch((logErr) => this.logger.warn(`Failed to log usage: ${logErr?.message}`));

              processedItems.push(updated);
            } else {
              const created = await this.prisma.inventory.create({
                data: {
                  farmId: targetFarmId,
                  itemName: cleanName,
                  category: category as any,
                  quantity: qty,
                  unit,
                  packageType,
                  packageQty,
                  weightPerPkg,
                  minThreshold,
                  pricePerPackage,
                  supplierName,
                  description,
                  shape,
                  sizeSpec,
                  imageUrl,
                },
              });

              const packageBadge = packageQty ? `+${packageQty} ${packageType}` : `${qty} ${unit}`;
              const priceInfo = pricePerPackage > 0 ? ` - Đơn giá: ${pricePerPackage.toLocaleString('vi-VN')} đ/${packageType}` : '';
              const fileSource = data.fileName ? `tệp ${data.fileName}` : 'chứng từ';

              await this.prisma.inventoryUsageLog
                .create({
                  data: {
                    inventoryId: created.id,
                    quantityUsed: qty,
                    usageDate: new Date(),
                    notes: `[NHẬP KHO: ${packageBadge}] — [AI Tự Động] Khởi tạo tồn kho ban đầu: ${qty} ${unit} từ ${fileSource}${priceInfo}`,
                    createdBy: uid,
                  },
                })
                .catch((logErr) => this.logger.warn(`Failed to log usage: ${logErr?.message}`));

              processedItems.push(created);
            }
          } catch (itemErr: any) {
            this.logger.error(`Error saving inventory item "${cleanName}" for farm "${targetFarm.name}": ${itemErr?.message || itemErr}`);
          }
        }
      }

      const successMsg = isMultiFarm
        ? `🎉 Đã nhập và đồng bộ thành công **${items.length} mặt hàng vật tư** vào **Kho Tổng Hệ Thống (Đồng bộ dùng chung cho toàn bộ ${targetFarms.length} trang trại của bạn)**! Toàn bộ lịch sử biến động nhập kho đã được lưu vào **Nhật ký sử dụng / Lịch sử kho**.`
        : `🎉 Đã nhập thành công **${items.length} mặt hàng vật tư** vào kho trang trại **"${farmDisplayName}"**! Toàn bộ lịch sử biến động nhập kho đã được lưu vào **Nhật ký sử dụng / Lịch sử kho**.`;

      return {
        success: true,
        message: successMsg,
        entity: processedItems,
        type: 'INVENTORY_IMPORT',
        redirectTab: 'Quản Lý Kho',
      };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 2. EXECUTE: CREATE_FARM
    // ─────────────────────────────────────────────────────────────────────────
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

    // ─────────────────────────────────────────────────────────────────────────
    // 3. EXECUTE: CREATE_POND
    // ─────────────────────────────────────────────────────────────────────────
    if (intent === 'CREATE_POND') {
      // Dạng mới: ponds = [{name, areaSize, depth}] (mỗi ao thông số riêng)
      // Dạng cũ: names + areaSize/depth chung, hoặc name cho 1 ao
      const specs: Array<{ name: string; areaSize: number; depth: number }> = Array.isArray(data.ponds)
        ? data.ponds.map((p: any) => ({
            name: String(p?.name || '').trim(),
            areaSize: Number(p?.areaSize),
            depth: Number(p?.depth || 1.5),
          }))
        : Array.isArray(data.names)
          ? data.names.map((n: unknown) => ({
              name: String(n).trim(),
              areaSize: Number(data.areaSize),
              depth: Number(data.depth || 1.5),
            }))
          : [];

      if (specs.length > 0 && !(specs.length === 1 && !Array.isArray(data.ponds) && data.name)) {
        if (specs.length > MAX_PONDS_PER_ACTION) {
          throw new BadRequestException(`Mỗi lần chỉ tạo tối đa ${MAX_PONDS_PER_ACTION} ao`);
        }
        const invalid = specs.find((s) => !s.name || !(s.areaSize > 0) || !(s.depth > 0));
        if (invalid) {
          throw new BadRequestException(`Thông số ao "${invalid.name || '(chưa đặt tên)'}" chưa hợp lệ`);
        }
        const createdPonds: any[] = [];
        for (const spec of specs) {
          createdPonds.push(
            await this.pondsService.create(currentUser, { farmId: data.farmId, ...spec }),
          );
        }
        if (createdPonds.length === 1) {
          return {
            success: true,
            message: `🎉 Đã khởi tạo thành công **Ao nuôi "${createdPonds[0].name}"**!\n\n👉 Bước tiếp theo là bắt đầu một **Vụ nuôi mới (thả giống)** cho ao này. Bạn có muốn khởi tạo vụ nuôi ngay không?`,
            entity: createdPonds[0],
            type: 'POND',
            redirectTab: 'Quản lý Ao/Vụ',
          };
        }
        return {
          success: true,
          message: `🎉 Đã khởi tạo thành công **${createdPonds.length} ao nuôi**: ${createdPonds.map((p) => `**${p.name}**`).join(', ')}!\n\n👉 Bước tiếp theo là bắt đầu **Vụ nuôi mới (thả giống)** cho các ao này. Bạn có muốn khởi tạo vụ nuôi ngay không?`,
          entity: createdPonds,
          type: 'POND',
          redirectTab: 'Quản lý Ao/Vụ',
        };
      }

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

    // ─────────────────────────────────────────────────────────────────────────
    // 4. EXECUTE: CREATE_CROP
    // ─────────────────────────────────────────────────────────────────────────
    if (intent === 'CREATE_CROP') {
      const startDateStr = /^\d{4}-\d{2}-\d{2}/.test(String(data.startDate || ''))
        ? String(data.startDate).slice(0, 10)
        : new Date().toISOString().slice(0, 10);
      const count = Math.floor(Number(data.initialShrimpCount));
      if (!data.pondId || !(count > 0)) {
        throw new BadRequestException('Vui lòng chọn ao nuôi và nhập số lượng giống thả hợp lệ');
      }

      // Giai đoạn theo mô hình trang trại (giống form tạo thủ công):
      // Công nghệ cao -> bắt buộc Ương dưỡng; Truyền thống -> Thương phẩm
      const pond = await this.prisma.pond.findUnique({
        where: { id: data.pondId },
        select: { farm: { select: { farmingModel: true } } },
      });
      const farmingModel = pond?.farm?.farmingModel;
      const stage =
        farmingModel === 'HIGH_TECH'
          ? 'NURSERY'
          : farmingModel === 'TRADITIONAL'
            ? 'COMMERCIAL'
            : data.stage === 'NURSERY'
              ? 'NURSERY'
              : 'COMMERCIAL';

      const addDays = (base: string, days: number) => {
        const d = new Date(`${base}T00:00:00.000Z`);
        d.setUTCDate(d.getUTCDate() + days);
        return d.toISOString().slice(0, 10);
      };
      const opt = pickCropOptionalFields(data);
      // Phiếu cũ (không qua thẻ) thiếu mốc ngày -> dùng mặc định như form thủ công
      const transferDate = stage === 'NURSERY' ? opt.expectedTransferDate || addDays(startDateStr, 25) : undefined;
      const harvestDate = stage === 'NURSERY' ? transferDate : opt.expectedHarvestDate || addDays(startDateStr, 95);
      // Đơn giá giống luôn tự động theo giá Tép Bạc tại thời điểm lưu (bỏ qua mọi giá client / AI gửi lên);
      // không lấy được giá trực tuyến thì dùng giá mặc định
      const market = await this.getSeedMarketPrice();
      const seedUnitPrice = market?.price ?? DEFAULT_SEED_PRICE;

      const created = await this.cropsService.create(currentUser, {
        pondId: data.pondId,
        startDate: new Date(startDateStr).toISOString(),
        initialShrimpCount: count,
        status: 'ACTIVE',
        stage,
        expectedTransferDate: transferDate ? new Date(transferDate).toISOString() : undefined,
        expectedHarvestDate: harvestDate ? new Date(harvestDate).toISOString() : undefined,
        targetHarvestSize: opt.targetHarvestSize || undefined,
        targetSurvivalRate: opt.targetSurvivalRate,
        targetTotalFeedKg: opt.targetTotalFeedKg,
        seedUnitPrice,
        seedCost: seedUnitPrice * count,
        seedType: opt.seedType || 'Tôm thẻ chân trắng Post 10',
        seedSource: DEFAULT_SEED_SOURCE,
      } as any);

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
