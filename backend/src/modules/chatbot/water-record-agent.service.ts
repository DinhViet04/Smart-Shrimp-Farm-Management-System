import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import OpenAI from 'openai';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CropStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthUser, FarmAccessService } from '../farm-access/farm-access.service';
import { WaterQualityService } from '../water-quality/water-quality.service';
import { CreateWaterQualityDto } from '../water-quality/dto/create-water-quality.dto';
import {
  assessWaterMetrics,
  WATER_STATUS_LABEL,
  WaterStatus,
} from '../water-quality/water-quality-status';
import type { AgentActionResult } from './agent-action.service';

const TZ = 'Asia/Ho_Chi_Minh';

/** Các chỉ số đo nước AI có thể bóc tách từ tin nhắn */
const NUMERIC_FIELDS = [
  'temperature',
  'ph',
  'dissolvedOxygen',
  'salinity',
  'alkalinity',
  'nh3',
  'no2',
  'h2s',
  'transparency',
] as const;
export type NumericField = (typeof NUMERIC_FIELDS)[number];

/** Bắt buộc theo biểu mẫu nhập thủ công (CreateWaterQualityDto) */
const REQUIRED_FIELDS: NumericField[] = [
  'temperature',
  'ph',
  'dissolvedOxygen',
  'salinity',
  'alkalinity',
  'nh3',
  'transparency',
];

const FIELD_LABELS: Record<NumericField | 'pondId', string> = {
  pondId: 'Ao nuôi',
  temperature: 'Nhiệt độ (°C)',
  ph: 'pH',
  dissolvedOxygen: 'Oxy hòa tan DO (mg/L)',
  salinity: 'Độ mặn (‰)',
  alkalinity: 'Độ kiềm (mg/L)',
  nh3: 'NH3 (mg/L)',
  no2: 'NO2 (mg/L)',
  h2s: 'H2S (mg/L)',
  transparency: 'Độ trong (cm)',
};

/** Giới hạn hợp lệ khớp CreateWaterQualityDto */
const VALID_RANGES: Record<NumericField, [number, number]> = {
  temperature: [15, 40],
  ph: [5, 10],
  dissolvedOxygen: [0, 20],
  salinity: [0, 50],
  alkalinity: [0, 300],
  nh3: [0, 100],
  no2: [0, 100],
  h2s: [0, 100],
  transparency: [0, 500],
};

/** Số chữ số thập phân tối đa — khớp độ chính xác cột Decimal trong bảng water_quality_records */
const MAX_DECIMALS: Record<NumericField, number> = {
  temperature: 2,
  ph: 2,
  dissolvedOxygen: 2,
  salinity: 2,
  alkalinity: 2,
  nh3: 3,
  no2: 3,
  h2s: 3,
  transparency: 2,
};

const MAX_WATER_COLOR_LENGTH = 60;
const MAX_NOTE_LENGTH = 500;

function decimalsOf(value: number | string): number {
  const s = String(value).replace(',', '.');
  if (/e/i.test(s)) return 99;
  const dot = s.indexOf('.');
  return dot === -1 ? 0 : s.length - dot - 1;
}

/**
 * Kiểm tra một chỉ số: là số hữu hạn, trong giới hạn hợp lệ, không vượt số chữ số thập phân.
 * Trả về thông báo lỗi tiếng Việt hoặc null nếu hợp lệ.
 */
export function validateWaterField(field: NumericField, raw: unknown): string | null {
  const label = FIELD_LABELS[field];
  if (typeof raw === 'string' && !/^\s*-?\d+(?:[.,]\d+)?\s*$/.test(raw)) {
    return `${label}: "${raw}" không phải số hợp lệ`;
  }
  const n = typeof raw === 'number' ? raw : Number(String(raw).replace(',', '.'));
  if (!Number.isFinite(n)) return `${label}: giá trị không phải số hợp lệ`;
  const [min, max] = VALID_RANGES[field];
  if (n < min || n > max) return `${label} = ${n} nằm ngoài giới hạn hợp lệ (${min} - ${max})`;
  if (decimalsOf(raw as number | string) > MAX_DECIMALS[field]) {
    return `${label} = ${raw} chỉ được tối đa ${MAX_DECIMALS[field]} chữ số thập phân`;
  }
  return null;
}

const NUM = String.raw`(\d+(?:[.,]\d+)?)`;
const SEP = String.raw`\s*(?:là|=|:|khoảng|đạt)?\s*`;

/** Mẫu nhận diện từng chỉ số trong tin nhắn tự do (đã chuyển chữ thường) */
const FIELD_PATTERNS: Record<NumericField, RegExp[]> = {
  ph: [new RegExp(String.raw`\bph${SEP}${NUM}`)],
  dissolvedOxygen: [
    // "do" đứng riêng (không phải "nhiet do" viết không dấu)
    new RegExp(String.raw`(?:^|[\s,;(])(?<!nhiet\s)(?<!nhiệt\s)(?:do|d\.o)${SEP}${NUM}`),
    new RegExp(String.raw`(?:oxy|ôxy|oxi)(?:\s*hòa\s*tan)?${SEP}${NUM}`),
  ],
  temperature: [
    new RegExp(String.raw`(?:nhiệt\s*độ(?:\s*nước)?|nhiet\s*do|\btemp(?:erature)?)${SEP}${NUM}`),
    new RegExp(String.raw`${NUM}\s*(?:°\s*c|độ\s*c\b)`),
  ],
  salinity: [
    new RegExp(String.raw`(?:độ\s*mặn|\bmặn|\bsalinity|\bsal)${SEP}${NUM}`),
    new RegExp(String.raw`${NUM}\s*(?:‰|ppt|phần\s*nghìn)`),
  ],
  alkalinity: [new RegExp(String.raw`(?:độ\s*kiềm|\bkiềm|\balk(?:alinity)?)${SEP}${NUM}`)],
  nh3: [new RegExp(String.raw`(?:\bnh3|\bnh4|amoniac|ammonia)${SEP}${NUM}`)],
  no2: [new RegExp(String.raw`(?:\bno2|nitrit|nitrite)${SEP}${NUM}`)],
  h2s: [new RegExp(String.raw`\bh2s${SEP}${NUM}`)],
  transparency: [new RegExp(String.raw`(?:độ\s*trong|\btransparency|secchi)${SEP}${NUM}`)],
};

const RECORD_VERB =
  /(nhập|ghi|lưu|cập nhật|thêm|ghi nhận|báo cáo|gửi)\s+(?:lại\s+|giúp\s+(?:tôi|em|mình)\s+|cho\s+(?:tôi|em|mình)\s+)?(?:các\s+|bộ\s+|kết quả\s+)?(số đo|số liệu|thông số|chỉ số|kết quả đo|chất lượng nước|môi trường nước|đo nước)/i;
const JUST_MEASURED = /(vừa đo|mới đo|đo được|kết quả đo (?:hôm nay|sáng nay|chiều nay|tối nay|lúc))/i;
const QUESTION_HINT =
  /\?|có ổn không|ổn không|thế nào|ra sao|nên làm gì|làm sao|đánh giá|có sao không|bình thường không|tốt không|xử lý|tư vấn|giải thích|tại sao|vì sao/i;

function normalize(str: string): string {
  return (str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function containsPhrase(haystackNorm: string, needle: string) {
  const n = normalize(needle);
  if (!n) return false;
  return new RegExp(`(^|\\s)${escapeRegExp(n)}(\\s|$)`).test(haystackNorm);
}

const POND_PREFIX = /^(?:trang trai\s+)?(?:ao nuoi|ao so|ao)\s+/;

/**
 * Các tên gọi của một ao (đã chuẩn hóa): tên đầy đủ + bỏ tiền tố "Ao nuôi"/"Ao".
 * Vd "Ao nuôi C1" -> ["ao nuoi c1", "ao c1", "ao so c1", "c1"].
 * Mã ngắn chỉ toàn số ("1") không dùng đứng riêng vì dễ trùng với số đo.
 */
export function pondAliases(name: string): string[] {
  const full = normalize(name);
  const aliases = new Set<string>(full ? [full] : []);
  const core = full.replace(POND_PREFIX, '');
  if (core && core !== full) {
    aliases.add(`ao ${core}`);
    aliases.add(`ao so ${core}`);
    aliases.add(`ao nuoi ${core}`);
    const distinctive = (/[a-z]/.test(core) && /\d/.test(core)) || (core.length >= 4 && !/^[\d\s]+$/.test(core));
    if (distinctive) aliases.add(core);
  }
  return [...aliases];
}

/** Độ dài tên gọi dài nhất của ao xuất hiện trong văn bản (0 = không nhắc tới) */
function pondMatchScore(textNorm: string, pondName: string): number {
  return pondAliases(pondName).reduce(
    (best, alias) => (alias.length > best && containsPhrase(textNorm, alias) ? alias.length : best),
    0,
  );
}

const FARM_PREFIXES = [
  /^(?:trang trai|nong trai|trai)\s+/,
  /^(?:cong nghe cao|cnc)\s+/,
  /^(?:tom the chan trang|tom the|tom su|tom)\s+/,
];

/** Các tên gọi của trang trại: "Trang trại công nghệ cao Quảng Trị" -> [..., "cong nghe cao quang tri", "quang tri"] */
export function farmAliases(name: string): string[] {
  let current = normalize(name);
  const aliases = new Set<string>(current ? [current] : []);
  for (const prefix of FARM_PREFIXES) {
    const stripped = current.replace(prefix, '');
    if (stripped !== current && stripped.length >= 3) {
      aliases.add(stripped);
      current = stripped;
    }
  }
  return [...aliases];
}

/** Các phần ngày giờ theo múi giờ Việt Nam */
function vnParts(d: Date) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value || '00';
  return {
    y: get('year'),
    m: get('month'),
    d: get('day'),
    hh: get('hour') === '24' ? '00' : get('hour'),
    mm: get('minute'),
  };
}

function formatVn(d: Date) {
  const p = vnParts(d);
  return `${p.hh}:${p.mm} ${p.d}/${p.m}/${p.y}`;
}

const STATUS_ICON: Record<WaterStatus, string> = {
  Optimal: '🟢',
  Warning: '🟡',
  Danger: '🔴',
};

interface PondInfo {
  id: string;
  name: string;
  farmId: string;
  farmName: string;
  areaSize: number;
  depth: number;
  hasActiveCrop: boolean;
  /** Ngày nuôi của vụ đang chạy */
  doc: number | null;
  /** Lần đo gần nhất của ao (để đối chiếu trên thẻ thông số nước) */
  lastRecord: (Partial<Record<NumericField, number | null>> & {
    recordTime: string;
    waterColor: string | null;
  }) | null;
}

/** Ao kèm dữ liệu cho thẻ thông số nước trong khung chat */
export interface WaterPondOption {
  id: string;
  name: string;
  farmId: string;
  farmName: string;
  areaSize: number;
  depth: number;
  waterVolume: number;
  doc: number | null;
  lastRecord: PondInfo['lastRecord'];
}

export interface WaterRecordDraftData {
  pondId?: string;
  pondName?: string;
  farmId?: string;
  farmName?: string;
  recordTime?: string;
  temperature?: number;
  ph?: number;
  dissolvedOxygen?: number;
  salinity?: number;
  alkalinity?: number;
  nh3?: number;
  no2?: number;
  h2s?: number;
  transparency?: number;
  waterColor?: string;
  note?: string;
}

/**
 * Trợ lý AI nhập số đo môi trường nước cho Kỹ thuật viên:
 * đọc tin nhắn tự do -> bóc tách chỉ số -> hỏi bổ sung phần thiếu ->
 * phiếu xác nhận (kèm đánh giá theo ngưỡng hệ thống) -> lưu qua WaterQualityService.
 */
@Injectable()
export class WaterRecordAgentService {
  private readonly logger = new Logger(WaterRecordAgentService.name);
  private openai: OpenAI | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly farmAccess: FarmAccessService,
    private readonly waterQualityService: WaterQualityService,
  ) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (apiKey) this.openai = new OpenAI({ apiKey });
  }

  // ───────────────────────────── NHẬN DIỆN Ý ĐỊNH ─────────────────────────────

  /** Số chỉ số nước có kèm giá trị xuất hiện trong tin nhắn */
  static countMeasurements(text: string): number {
    const lower = (text || '').toLowerCase();
    return NUMERIC_FIELDS.filter((f) =>
      FIELD_PATTERNS[f].some((re) => re.test(lower)),
    ).length;
  }

  /**
   * explicit: người dùng nói rõ muốn nhập/lưu số đo.
   * implicit: tin nhắn chứa >= 3 chỉ số kèm giá trị và không phải câu hỏi.
   */
  static detectIntent(text: string): { explicit: boolean; implicit: boolean } {
    const lower = (text || '').toLowerCase();
    const explicit = RECORD_VERB.test(lower) || (JUST_MEASURED.test(lower) && WaterRecordAgentService.countMeasurements(lower) >= 1);
    const implicit =
      !explicit &&
      !QUESTION_HINT.test(lower) &&
      WaterRecordAgentService.countMeasurements(lower) >= 3;
    return { explicit, implicit };
  }

  /** Câu hỏi tư vấn chen ngang (không chứa số đo) -> nhường cho luồng tư vấn */
  static isSideQuestion(text: string): boolean {
    const lower = (text || '').toLowerCase();
    return (
      QUESTION_HINT.test(lower) &&
      WaterRecordAgentService.countMeasurements(lower) === 0
    );
  }

  // ───────────────────────────── HỘI THOẠI ─────────────────────────────

  async handleConversation(
    question: string,
    currentUser: AuthUser,
    pendingData?: Record<string, any>,
    focusPondId?: string,
    history?: Array<{ sender: 'user' | 'ai'; text: string }>,
  ): Promise<AgentActionResult> {
    const ponds = await this.loadPonds(currentUser);
    if (ponds.length === 0) {
      return {
        isAgentAction: true,
        answer:
          'Dạ, tài khoản của bạn hiện chưa được phân công vào trang trại/ao nuôi nào nên chưa thể ghi nhận số đo môi trường nước. Bạn vui lòng liên hệ Quản lý trang trại để được phân công nhé!',
      };
    }

    const collected: WaterRecordDraftData = { ...(pendingData || {}) };
    const invalidNotes: string[] = [];

    // 1. Bóc tách bằng regex (chính xác với số liệu viết rõ ràng)
    const regexValues = this.extractWithRegex(question);

    // 2. Bóc tách bằng OpenAI (hiểu ngữ cảnh: tên ao viết tắt, thời điểm đo, màu nước, ghi chú)
    const aiValues = await this.extractWithOpenAI(question, ponds, collected);

    for (const f of NUMERIC_FIELDS) {
      const value = regexValues[f] ?? aiValues[f];
      if (value === undefined || value === null || value === '') continue;
      const error = validateWaterField(f, value);
      if (error) {
        invalidNotes.push(error);
        delete collected[f];
        continue;
      }
      collected[f] = Number(String(value).replace(',', '.'));
    }

    const color = regexValues.waterColor || aiValues.waterColor;
    if (color) collected.waterColor = String(color).trim().slice(0, MAX_WATER_COLOR_LENGTH);
    if (aiValues.note) collected.note = String(aiValues.note).trim().slice(0, MAX_NOTE_LENGTH);

    const recordTime = this.extractTime(question) || this.parseAiTime(aiValues.recordTime);
    if (recordTime) collected.recordTime = recordTime.toISOString();

    // 3. Xác định ao nuôi
    const pondResult = this.resolvePond(question, aiValues, ponds, collected, focusPondId, history);
    let pond: PondInfo | undefined;
    if (pondResult.pond) {
      pond = pondResult.pond;
      collected.pondId = pond.id;
      collected.pondName = pond.name;
    } else if (collected.pondId && pondResult.farmId) {
      // Người dùng đổi sang trang trại khác -> bỏ ao cũ không thuộc trại này
      const prev = ponds.find((p) => p.id === collected.pondId);
      if (prev && prev.farmId !== pondResult.farmId) {
        delete collected.pondId;
        delete collected.pondName;
      }
    }
    const farmPonds = pondResult.farmId ? ponds.filter((p) => p.farmId === pondResult.farmId) : [];
    if (pondResult.farmId) {
      collected.farmId = pondResult.farmId;
      collected.farmName = ponds.find((p) => p.farmId === pondResult.farmId)?.farmName;
    }

    if (!collected.recordTime) collected.recordTime = new Date().toISOString();
    if (new Date(collected.recordTime).getTime() > Date.now() + 10 * 60 * 1000) {
      invalidNotes.push('Thời điểm đo nằm trong tương lai, tôi tạm dùng thời điểm hiện tại');
      collected.recordTime = new Date().toISOString();
    }

    const missing: string[] = [
      ...(collected.pondId ? [] : ['pondId']),
      ...REQUIRED_FIELDS.filter((f) => collected[f] === undefined || collected[f] === null),
    ];

    const invalidText = invalidNotes.length
      ? `\n\n⚠️ **Giá trị chưa hợp lệ (đã bỏ qua):**\n${invalidNotes.map((n) => `- ${n}`).join('\n')}`
      : '';

    const got = NUMERIC_FIELDS.filter((f) => collected[f] !== undefined)
      .map((f) => `${FIELD_LABELS[f]}: **${collected[f]}**`)
      .join(' • ');
    const keptText = got ? `\n\n📝 Tôi đã ghi tạm các số đo bạn gửi: ${got}` : '';

    // 4a. CHƯA RÕ AO -> hỏi trang trại / ao trước, CHƯA hiện thẻ
    if (!collected.pondId) {
      const farms = this.farmsOf(ponds);
      const pondChip = (p: PondInfo) => (this.isNameUnique(p, ponds) ? p.name : `${p.name} (${p.farmName})`);
      let answer: string;
      let quickSuggestions: string[];

      if (pondResult.ambiguous?.length) {
        // Tên ao trùng ở nhiều trại -> chọn đúng ao kèm tên trại
        answer =
          `Dạ, có **${pondResult.ambiguous.length} ao** cùng tên **${pondResult.ambiguous[0].name}**. Bạn đang đo ở ao của trang trại nào ạ?\n` +
          pondResult.ambiguous.map((p) => `- **${p.name}** — ${p.farmName}`).join('\n');
        quickSuggestions = pondResult.ambiguous.map((p) => `${p.name} (${p.farmName})`);
      } else if (!collected.farmId && farms.length > 1) {
        // Bước 1: chọn trang trại
        answer =
          `Dạ, bạn muốn ghi nhận số đo môi trường nước cho **trang trại nào** ạ?\n` +
          farms
            .map((f) => `- **${f.name}** (${ponds.filter((p) => p.farmId === f.id).length} ao)`)
            .join('\n');
        quickSuggestions = farms.slice(0, 10).map((f) => f.name);
      } else {
        // Bước 2: chọn ao trong trang trại
        const list = farmPonds.length ? farmPonds : ponds;
        const farmName = collected.farmName || list[0]?.farmName || '';
        answer =
          `Dạ, bạn đo ở **ao nào** của **${farmName}** ạ? Trang trại có ${list.length} ao:\n` +
          list.slice(0, 20).map((p) => `**${p.name}**`).join(', ');
        quickSuggestions = list.slice(0, 12).map(pondChip);
      }

      return {
        isAgentAction: true,
        answer:
          answer +
          keptText +
          invalidText +
          `\n\n👉 *Chọn nhanh bên dưới hoặc nhắn tên ${!collected.farmId && farms.length > 1 && !pondResult.ambiguous?.length ? 'trang trại' : 'ao'}. Xác định xong ao, tôi sẽ mở **thẻ thông số nước** để bạn điền. Nhắn "hủy" để dừng.*`,
        actionDraft: {
          type: 'SLOT_FILLING',
          intent: 'RECORD_WATER_QUALITY',
          collectedData: collected,
          missingFields: missing,
          quickSuggestions,
          // Không gửi pondOptions -> giao diện chưa hiện thẻ ở bước chọn trang trại/ao
        },
      };
    }

    // 4b. ĐÃ RÕ AO nhưng còn thiếu chỉ số -> mở thẻ thông số nước
    if (missing.length > 0) {
      const placeText = ` cho **${pond!.name}** (${pond!.farmName})`;
      const cardHint =
        `\n\n👉 *Bạn điền trực tiếp vào **thẻ thông số nước** bên dưới rồi bấm **Lưu số đo**, hoặc nhắn gộp trong 1 câu (vd: "nhiệt độ 29, pH 8.3, DO 5.2, mặn 15, kiềm 120, NH3 0.1, độ trong 35"). Nhắn "hủy" để dừng.*`;
      const missingNumeric = missing.filter((m) => m !== 'pondId');
      const answer = !got
        ? `Dạ, mời bạn nhập số đo môi trường nước${placeText} vào thẻ bên dưới nhé.` + invalidText + cardHint
        : `Dạ, tôi đang ghi nhận số đo môi trường nước${placeText}.` +
          `\n\n✅ **Đã có:** ${got}` +
          (missingNumeric.length
            ? `\n\n📝 **Còn thiếu:** ${missingNumeric.map((m) => FIELD_LABELS[m as NumericField]).join(', ')}`
            : '') +
          invalidText +
          cardHint;

      return {
        isAgentAction: true,
        answer,
        actionDraft: {
          type: 'SLOT_FILLING',
          intent: 'RECORD_WATER_QUALITY',
          collectedData: collected,
          missingFields: missing,
          pondOptions: this.pondOptions(ponds),
        },
      };
    }

    // 5. Đủ thông tin -> đánh giá theo ngưỡng hệ thống & tạo phiếu xác nhận
    const assessment = assessWaterMetrics({
      ...collected,
      h2s: collected.h2s ?? collected.no2,
    } as any);
    const statusOf = new Map(assessment.metrics.map((m) => [m.key, m.status]));

    const summary: Record<string, string> = {
      'Ao nuôi': `${pond!.name} (${pond!.farmName})`,
      'Thời điểm đo': formatVn(new Date(collected.recordTime)),
    };
    for (const f of NUMERIC_FIELDS) {
      if (collected[f] === undefined) continue;
      const st = statusOf.get(f as any);
      summary[FIELD_LABELS[f]] = `${collected[f]}${st ? ` ${STATUS_ICON[st]} ${WATER_STATUS_LABEL[st]}` : ''}`;
    }
    if (collected.waterColor) summary['Màu nước'] = collected.waterColor;
    if (collected.note) summary['Ghi chú'] = collected.note;
    summary['Đánh giá tổng quan'] = `${STATUS_ICON[assessment.overall]} ${WATER_STATUS_LABEL[assessment.overall]}`;

    const duplicate = await this.findNearbyRecord(collected.pondId!, new Date(collected.recordTime));
    const duplicateText = duplicate
      ? `\n\n🔁 *Lưu ý: ao này đã có một bản ghi đo lúc ${formatVn(duplicate.recordTime)}. Nếu đây là lần đo mới, bạn cứ xác nhận lưu bình thường.*`
      : '';

    const alertText = assessment.alerts.length
      ? `\n\n⚠️ **Chỉ số cần chú ý:**\n${assessment.alerts.map((a) => `- ${a}`).join('\n')}\n\nSau khi lưu, bạn có thể hỏi tôi *"Đánh giá và hướng xử lý nước ${pond!.name}"* để nhận phác đồ xử lý kèm liều lượng theo thể tích ao.`
      : '\n\n🟢 Tất cả chỉ số đều nằm trong ngưỡng tối ưu.';

    return {
      isAgentAction: true,
      answer:
        `Dạ, tôi đã đọc xong bộ số đo môi trường nước của **${pond!.name}** (${pond!.farmName}) lúc **${formatVn(new Date(collected.recordTime))}**.` +
        alertText +
        duplicateText +
        invalidText +
        `\n\nBạn kiểm tra lại **thẻ thông số nước** bên dưới (sửa trực tiếp nếu cần) rồi bấm **"Lưu số đo"** nhé! Hoặc nhắn ví dụ *"sửa pH 8.1"*.`,
      actionDraft: {
        type: 'CONFIRM_ACTION',
        intent: 'RECORD_WATER_QUALITY',
        collectedData: collected,
        missingFields: [],
        summary,
        pondOptions: this.pondOptions(ponds),
      },
    };
  }

  // ───────────────────────────── LƯU BẢN GHI ─────────────────────────────

  async execute(data: Record<string, any>, currentUser: AuthUser) {
    if (currentUser.role !== 'TECHNICIAN') {
      throw new ForbiddenException(
        'Chỉ Kỹ thuật viên (TECHNICIAN) mới có quyền ghi nhận số đo môi trường nước',
      );
    }

    const isEmpty = (v: unknown) =>
      v === null || v === undefined || (typeof v === 'string' && v.trim() === '');
    const toNum = (v: unknown) =>
      isEmpty(v) ? undefined : Number(String(v).replace(',', '.'));

    // Gom toàn bộ lỗi để báo một lần (thay vì sửa từng lỗi một)
    const problems: string[] = [];
    if (typeof data.pondId !== 'string' || !data.pondId.trim()) {
      problems.push('Chưa chọn ao nuôi');
    }
    for (const f of NUMERIC_FIELDS) {
      if (isEmpty(data[f])) {
        if (REQUIRED_FIELDS.includes(f)) problems.push(`${FIELD_LABELS[f]}: chưa nhập`);
        continue;
      }
      if (typeof data[f] !== 'number' && typeof data[f] !== 'string') {
        problems.push(`${FIELD_LABELS[f]}: giá trị không phải số hợp lệ`);
        continue;
      }
      const error = validateWaterField(f, data[f]);
      if (error) problems.push(error);
    }

    const recordTime = isEmpty(data.recordTime) ? new Date() : new Date(data.recordTime);
    if (Number.isNaN(recordTime.getTime())) {
      problems.push('Thời điểm đo không hợp lệ');
    } else if (recordTime.getTime() > Date.now() + 10 * 60 * 1000) {
      problems.push('Thời điểm đo không được nằm trong tương lai');
    }
    if (!isEmpty(data.waterColor) && String(data.waterColor).trim().length > MAX_WATER_COLOR_LENGTH) {
      problems.push(`Màu nước tối đa ${MAX_WATER_COLOR_LENGTH} ký tự`);
    }
    if (!isEmpty(data.note) && String(data.note).trim().length > MAX_NOTE_LENGTH) {
      problems.push(`Ghi chú tối đa ${MAX_NOTE_LENGTH} ký tự`);
    }
    if (problems.length > 0) {
      throw new BadRequestException(`Số đo chưa hợp lệ: ${problems.join('; ')}`);
    }

    const dto = plainToInstance(CreateWaterQualityDto, {
      pondId: data.pondId,
      recordTime: recordTime.toISOString(),
      temperature: toNum(data.temperature),
      ph: toNum(data.ph),
      dissolvedOxygen: toNum(data.dissolvedOxygen),
      salinity: toNum(data.salinity),
      alkalinity: toNum(data.alkalinity),
      nh3: toNum(data.nh3),
      no2: toNum(data.no2),
      h2s: toNum(data.h2s),
      transparency: toNum(data.transparency),
      waterColor: isEmpty(data.waterColor) ? undefined : String(data.waterColor).trim(),
      note: isEmpty(data.note)
        ? 'Nhập qua Trợ lý AI'
        : `${String(data.note).trim()} (nhập qua Trợ lý AI)`,
    });

    const errors = await validate(dto);
    if (errors.length > 0) {
      const messages = errors.flatMap((e) => Object.values(e.constraints || {}));
      throw new BadRequestException(messages.join(', '));
    }

    // WaterQualityService.create tự kiểm tra quyền truy cập ao và gửi thông báo cho Quản lý / Nông dân
    const created = await this.waterQualityService.create(currentUser, dto);

    const pond = await this.prisma.pond.findUnique({
      where: { id: dto.pondId },
      select: { name: true, farmId: true, farm: { select: { name: true } } },
    });
    const assessment = assessWaterMetrics({
      ...dto,
      h2s: dto.h2s ?? dto.no2,
    } as any);

    const pondName = pond?.name || 'ao nuôi';
    const alerts = assessment.alerts.length
      ? `\n\n⚠️ **Chỉ số cần xử lý:**\n${assessment.alerts.map((a) => `- ${a}`).join('\n')}\n\n👉 Hỏi tôi *"Hướng xử lý nước ${pondName}"* để nhận phác đồ và liều lượng đối chiếu kho hóa chất.`
      : '';

    return {
      success: true,
      message: `🎉 Đã lưu số đo môi trường nước **${pondName}** lúc **${formatVn(recordTime)}** — đánh giá: ${STATUS_ICON[assessment.overall]} **${WATER_STATUS_LABEL[assessment.overall]}**. Quản lý và nông dân của trang trại đã được thông báo.${alerts}`,
      entity: {
        id: created.id,
        pondId: dto.pondId,
        farmId: pond?.farmId,
        overallStatus: assessment.overall,
      },
      type: 'WATER_QUALITY',
      redirectTab: 'Môi trường nước',
    };
  }

  // ───────────────────────────── HELPERS ─────────────────────────────

  private async loadPonds(currentUser: AuthUser): Promise<PondInfo[]> {
    const farmIds = await this.farmAccess.getAccessibleFarmIds(currentUser);
    const ponds = await this.prisma.pond.findMany({
      where: {
        ...(farmIds === undefined ? {} : { farmId: { in: farmIds } }),
        farm: { deletedAt: null },
      },
      select: {
        id: true,
        name: true,
        farmId: true,
        areaSize: true,
        depth: true,
        farm: { select: { name: true } },
        crops: {
          where: { status: CropStatus.ACTIVE },
          select: { id: true, startDate: true },
          orderBy: { startDate: 'desc' },
          take: 1,
        },
        waterQualityRecords: {
          orderBy: { recordTime: 'desc' },
          take: 1,
          select: {
            recordTime: true,
            temperature: true,
            ph: true,
            dissolvedOxygen: true,
            salinity: true,
            alkalinity: true,
            nh3: true,
            no2: true,
            h2s: true,
            transparency: true,
            waterColor: true,
          },
        },
      },
      orderBy: [{ farm: { name: 'asc' } }, { name: 'asc' }],
      take: 200,
    });
    const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));
    return ponds.map((p) => {
      const crop = p.crops?.[0];
      const last = p.waterQualityRecords?.[0];
      return {
        id: p.id,
        name: p.name,
        farmId: p.farmId,
        farmName: p.farm?.name || '',
        areaSize: Number(p.areaSize) || 0,
        depth: Number(p.depth) || 0,
        hasActiveCrop: Boolean(crop),
        doc: crop
          ? Math.max(1, Math.floor((Date.now() - new Date(crop.startDate).getTime()) / 86_400_000))
          : null,
        lastRecord: last
          ? {
              recordTime: new Date(last.recordTime).toISOString(),
              temperature: num(last.temperature),
              ph: num(last.ph),
              dissolvedOxygen: num(last.dissolvedOxygen),
              salinity: num(last.salinity),
              alkalinity: num(last.alkalinity),
              nh3: num(last.nh3),
              no2: num(last.no2),
              h2s: num(last.h2s),
              transparency: num(last.transparency),
              waterColor: last.waterColor ?? null,
            }
          : null,
      };
    });
  }

  private pondOptions(ponds: PondInfo[]): WaterPondOption[] {
    return ponds.slice(0, 100).map((p) => ({
      id: p.id,
      name: p.name,
      farmId: p.farmId,
      farmName: p.farmName,
      areaSize: p.areaSize,
      depth: p.depth,
      waterVolume: Math.round(p.areaSize * p.depth * 100) / 100,
      doc: p.doc,
      lastRecord: p.lastRecord,
    }));
  }

  private isNameUnique(pond: PondInfo, ponds: PondInfo[]) {
    const n = normalize(pond.name);
    return ponds.filter((p) => normalize(p.name) === n).length === 1;
  }

  /** Tên trang trại có được nhắc trong văn bản không (chấp nhận gọi tắt: bỏ "Trang trại"/"Trại") */
  private farmMentioned(textNorm: string, farmName: string): boolean {
    if (!farmName) return false;
    return farmAliases(farmName).some((alias) => containsPhrase(textNorm, alias));
  }

  /** Các trang trại (không trùng) trong danh sách ao */
  private farmsOf(ponds: PondInfo[]) {
    const map = new Map<string, string>();
    ponds.forEach((p) => map.set(p.farmId, p.farmName));
    return [...map.entries()].map(([id, name]) => ({ id, name }));
  }

  /**
   * Xác định trang trại người dùng nhắc tới.
   * explicit: nhắc trong tin nhắn hiện tại (hoặc OpenAI nhận ra) — dùng để ràng buộc ao.
   */
  private resolveFarm(
    question: string,
    aiValues: Record<string, any>,
    ponds: PondInfo[],
    collected: WaterRecordDraftData,
    history?: Array<{ sender: 'user' | 'ai'; text: string }>,
  ): { farmId?: string; explicit: boolean } {
    const farms = this.farmsOf(ponds);
    if (farms.length === 1) return { farmId: farms[0].id, explicit: false };
    // Ưu tiên tên dài nhất để "Tôm Huế 2" không bị khớp nhầm thành "Tôm Huế"
    const sorted = [...farms].sort((a, b) => b.name.length - a.name.length);
    const pick = (textNorm: string) => {
      const hits = sorted.filter((f) => this.farmMentioned(textNorm, f.name));
      if (hits.length === 0) return undefined;
      const longest = normalize(hits[0].name);
      const same = hits.filter((f) => normalize(f.name) === longest);
      const distinct = new Set(hits.map((f) => normalize(f.name)));
      // Nhắc nhiều trang trại khác nhau -> chưa chắc chắn
      return same.length === 1 && (distinct.size === 1 || hits.every((f) => longest.includes(normalize(f.name)))) ? same[0].id : undefined;
    };

    const fromText = pick(normalize(question));
    if (fromText) return { farmId: fromText, explicit: true };

    if (aiValues.farmName) {
      const fromAi = pick(normalize(String(aiValues.farmName)));
      if (fromAi) return { farmId: fromAi, explicit: true };
      const aiNorm = farmAliases(String(aiValues.farmName)).pop() || '';
      const loose = farms.filter((f) => aiNorm.length >= 3 && normalize(f.name).includes(aiNorm));
      if (loose.length === 1) return { farmId: loose[0].id, explicit: true };
    }

    if (collected.farmId && farms.some((f) => f.id === collected.farmId)) {
      return { farmId: collected.farmId, explicit: false };
    }

    for (const msg of [...(history || [])].reverse().slice(0, 10)) {
      const fromHistory = pick(normalize(String(msg?.text || '')));
      if (fromHistory) return { farmId: fromHistory, explicit: false };
    }
    return { explicit: false };
  }

  private resolvePond(
    question: string,
    aiValues: Record<string, any>,
    ponds: PondInfo[],
    collected: WaterRecordDraftData,
    focusPondId?: string,
    history?: Array<{ sender: 'user' | 'ai'; text: string }>,
  ): { pond?: PondInfo; ambiguous?: PondInfo[]; farmId?: string } {
    const textNorm = normalize(question);
    const farm = this.resolveFarm(question, aiValues, ponds, collected, history);
    const farmId = farm.farmId;
    // Lọc theo trang trại đã biết (nếu lọc ra rỗng thì giữ nguyên danh sách)
    const byFarm = (list: PondInfo[]) => {
      if (!farmId) return list;
      const narrowed = list.filter((p) => p.farmId === farmId);
      return narrowed.length > 0 ? narrowed : list;
    };
    // Trang trại nhắc trong tin nhắn hiện tại: ao lấy từ ngữ cảnh cũ phải thuộc trại đó
    const fitsExplicitFarm = (p: PondInfo) => !farm.explicit || p.farmId === farmId;
    const done = (r: { pond?: PondInfo; ambiguous?: PondInfo[] }) => ({
      ...r,
      farmId: r.pond?.farmId ?? farmId,
    });

    // 1. Ao được nhắc trong tin nhắn — tên đầy đủ hoặc gọi tắt ("ao C1", "C1" cho "Ao nuôi C1")
    const sorted = [...ponds].sort((a, b) => b.name.length - a.name.length);
    const direct = this.bestPondMatches(textNorm, ponds);
    if (direct.length > 0) {
      const candidates = byFarm(direct);
      if (candidates.length === 1) return done({ pond: candidates[0] });
      return done({ ambiguous: candidates });
    }

    // 2. Tên ao do OpenAI nhận diện (ví dụ "ao số 1" -> "Ao 1")
    const aiPond = aiValues.pondName ? normalize(String(aiValues.pondName)) : '';
    if (aiPond) {
      let matches = ponds.filter((p) => pondAliases(p.name).includes(aiPond));
      if (matches.length === 0) {
        matches = ponds.filter(
          (p) => normalize(p.name).includes(aiPond) || aiPond.includes(normalize(p.name)),
        );
      }
      matches = byFarm(matches);
      if (matches.length === 1) return done({ pond: matches[0] });
      if (matches.length > 1) return done({ ambiguous: matches });
    }

    // 3. Giữ ao đã chọn ở lượt trước
    if (collected.pondId) {
      const prev = ponds.find((p) => p.id === collected.pondId);
      if (prev && fitsExplicitFarm(prev)) return done({ pond: prev });
    }

    // 4. Ao đang chọn trên giao diện (bộ lọc ao trên mobile / màn hình xử lý nước)
    if (focusPondId) {
      const focus = ponds.find((p) => p.id === focusPondId);
      if (focus && fitsExplicitFarm(focus)) return done({ pond: focus });
    }

    // 5. Ao đã được nhắc ở các tin nhắn trước trong cuộc trò chuyện (gần nhất trước)
    const fromHistory = this.findPondInHistory(history, byFarm(sorted));
    if (fromHistory && fitsExplicitFarm(fromHistory)) return done({ pond: fromHistory });

    // 6. Trang trại đã biết mà chỉ có đúng 1 ao, hoặc chỉ phụ trách đúng 1 ao -> tự gán
    const farmPonds = farmId ? ponds.filter((p) => p.farmId === farmId) : ponds;
    if (farmPonds.length === 1) return done({ pond: farmPonds[0] });
    return done({});
  }

  /**
   * Tìm ao được nhắc gần nhất trong lịch sử hội thoại. Bỏ qua tin nhắn nhắc nhiều ao khác nhau
   * (vd: danh sách ao AI liệt kê) để tránh chọn nhầm.
   */
  private findPondInHistory(
    history: Array<{ sender: 'user' | 'ai'; text: string }> | undefined,
    pondsByNameLength: PondInfo[],
  ): PondInfo | undefined {
    if (!history?.length) return undefined;
    for (const msg of [...history].reverse().slice(0, 10)) {
      const textNorm = normalize(String(msg?.text || ''));
      if (!textNorm) continue;
      const hits = this.bestPondMatches(textNorm, pondsByNameLength);
      if (hits.length === 0) continue;
      if (hits.length === 1) {
        // Chỉ chắc chắn khi tin nhắn không nhắc thêm ao nào khác
        const mentioned = pondsByNameLength.filter((p) => pondMatchScore(textNorm, p.name) > 0);
        if (mentioned.length === 1) return hits[0];
        continue;
      }
      // Nhiều ao cùng tên ở các trại khác nhau -> dùng tên trại trong cùng tin nhắn
      const byFarm = hits.filter((p) => this.farmMentioned(textNorm, p.farmName));
      if (byFarm.length === 1) return byFarm[0];
      // Tin nhắn nhắc nhiều ao -> không đủ chắc chắn, xét tin nhắn cũ hơn
    }
    return undefined;
  }

  /** Các ao khớp tốt nhất (tên gọi dài nhất) với văn bản; [] nếu không nhắc ao nào */
  private bestPondMatches(textNorm: string, ponds: PondInfo[]): PondInfo[] {
    const scored = ponds
      .map((p) => ({ p, score: pondMatchScore(textNorm, p.name) }))
      .filter((x) => x.score > 0);
    if (scored.length === 0) return [];
    const best = Math.max(...scored.map((x) => x.score));
    return scored.filter((x) => x.score === best).map((x) => x.p);
  }

  private extractWithRegex(text: string): Partial<Record<NumericField, number>> & {
    waterColor?: string;
  } {
    const lower = (text || '').toLowerCase();
    const out: Partial<Record<NumericField, number>> & { waterColor?: string } = {};
    for (const f of NUMERIC_FIELDS) {
      for (const re of FIELD_PATTERNS[f]) {
        const m = lower.match(re);
        if (m?.[1]) {
          out[f] = parseFloat(m[1].replace(',', '.'));
          break;
        }
      }
    }
    const color = text.match(/màu\s*nước\s*(?:là|:)?\s*([^,.;\n]+)/i);
    if (color?.[1]) out.waterColor = color[1].trim();
    return out;
  }

  /** "lúc 6h", "6h30", "lúc 14:15" -> hôm nay (giờ VN); nếu ở tương lai thì hiểu là hôm qua */
  private extractTime(text: string): Date | null {
    const m = (text || '')
      .toLowerCase()
      .match(/(?:lúc|vào|đo)\s*(\d{1,2})\s*(?:h|giờ|:)\s*(\d{1,2})?/);
    if (!m) return null;
    const hh = Number(m[1]);
    const mm = Number(m[2] || 0);
    if (hh > 23 || mm > 59) return null;
    const p = vnParts(new Date());
    let date = new Date(
      `${p.y}-${p.m}-${p.d}T${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00+07:00`,
    );
    if (date.getTime() > Date.now() + 10 * 60 * 1000) {
      date = new Date(date.getTime() - 24 * 60 * 60 * 1000);
    }
    return date;
  }

  private parseAiTime(value: unknown): Date | null {
    if (!value || typeof value !== 'string') return null;
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  private async extractWithOpenAI(
    question: string,
    ponds: PondInfo[],
    collected: WaterRecordDraftData,
  ): Promise<Record<string, any>> {
    if (!this.openai) return {};
    const now = vnParts(new Date());
    try {
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        response_format: { type: 'json_object' },
        temperature: 0,
        messages: [
          {
            role: 'system',
            content: `Bạn bóc tách số đo môi trường nước ao tôm từ tin nhắn của kỹ thuật viên.
Thời điểm hiện tại (giờ Việt Nam, UTC+7): ${now.y}-${now.m}-${now.d} ${now.hh}:${now.mm}.
Danh sách ao người dùng phụ trách: ${JSON.stringify(ponds.slice(0, 100).map((p) => ({ pond: p.name, farm: p.farmName })))}
Dữ liệu đã thu thập ở lượt trước (chỉ để tham khảo ngữ cảnh, KHÔNG lặp lại): ${JSON.stringify(collected)}

QUY TẮC:
- CHỈ lấy giá trị xuất hiện trong TIN NHẮN HIỆN TẠI. Không đoán, không bịa. Không có thì để null.
- "DO"/"oxy" = dissolvedOxygen (mg/L); "mặn" = salinity (‰); "kiềm" = alkalinity (mg/L); "độ trong" = transparency (cm).
- pondName: đúng tên ao trong danh sách nếu nhận ra (vd "ao số 1" -> "Ao 1"); farmName nếu người dùng nhắc trang trại.
- recordTime: ISO 8601 có "+07:00" nếu tin nhắn nói thời điểm đo (vd "sáng nay 6h", "hôm qua 17h"); không nói thì null.
- note: quan sát thêm của kỹ thuật viên (vd "tôm nổi đầu", "nước có bọt"); không có thì null.

Trả về JSON: {"pondName":string|null,"farmName":string|null,"recordTime":string|null,"temperature":number|null,"ph":number|null,"dissolvedOxygen":number|null,"salinity":number|null,"alkalinity":number|null,"nh3":number|null,"no2":number|null,"h2s":number|null,"transparency":number|null,"waterColor":string|null,"note":string|null}`,
          },
          { role: 'user', content: question.slice(0, 2000) },
        ],
      });
      const parsed = JSON.parse(completion.choices[0]?.message?.content || '{}');
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (err: any) {
      this.logger.warn(`OpenAI water extraction failed: ${err?.message || err}`);
      return {};
    }
  }

  private async findNearbyRecord(pondId: string, recordTime: Date) {
    const windowMs = 30 * 60 * 1000;
    return this.prisma.waterQualityRecord.findFirst({
      where: {
        pondId,
        recordTime: {
          gte: new Date(recordTime.getTime() - windowMs),
          lte: new Date(recordTime.getTime() + windowMs),
        },
      },
      select: { recordTime: true },
      orderBy: { recordTime: 'desc' },
    });
  }
}
