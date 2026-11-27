import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import OpenAI from 'openai';
import { CropStatus, FeedingMethod, FeedingSession, FeedingStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthUser, FarmAccessService } from '../farm-access/farm-access.service';
import { FeedingLogsService } from '../feeding-logs/feeding-logs.service';

/**
 * GHI NHẬT KÝ CHO ĂN BẰNG TRỢ LÝ AI — CHỈ DÀNH CHO NÔNG DÂN (FARMER)
 *
 * - AI chỉ nhận diện ý định + điền sẵn những gì người dùng đã nói; NÔNG DÂN tự chọn ao, cữ
 *   (cữ nào, mấy giờ, bao nhiêu cữ), loại thức ăn trong kho và số ký trên thẻ.
 * - Hệ thống phân tích dữ liệu vụ nuôi (DOC, mẫu cân, tôm hao, nhật ký cho ăn, chất lượng nước)
 *   để GỢI Ý loại thức ăn và số ký phù hợp giai đoạn của tôm — chỉ là gợi ý, không áp đặt.
 * - Lưu qua FeedingLogsService (cùng kiểm tra quyền, vụ ACTIVE, trừ / hoàn kho như form thủ công).
 */

export const FEEDING_SESSIONS: Array<{ session: FeedingSession; label: string; defaultTime: string }> = [
  { session: 'SESSION_1', label: 'Cữ 1 (Sáng sớm)', defaultTime: '05:30' },
  { session: 'SESSION_2', label: 'Cữ 2 (Sáng)', defaultTime: '08:00' },
  { session: 'SESSION_3', label: 'Cữ 3 (Trưa)', defaultTime: '10:30' },
  { session: 'SESSION_4', label: 'Cữ 4 (Đầu chiều)', defaultTime: '13:00' },
  { session: 'SESSION_5', label: 'Cữ 5 (Chiều)', defaultTime: '15:30' },
  { session: 'SESSION_6', label: 'Cữ 6 (Chiều tối)', defaultTime: '18:00' },
  { session: 'SESSION_7', label: 'Cữ 7 (Tối)', defaultTime: '21:00' },
];

/** Trọng lượng trung bình (g/con) ước tính theo ngày nuôi khi chưa có mẫu cân — tôm thẻ chân trắng */
const ABW_BY_DOC: Array<[number, number]> = [
  [0, 0.01], [10, 0.2], [20, 0.9], [30, 2.5], [40, 4.5], [50, 7], [60, 10],
  [70, 13], [80, 16], [90, 19], [100, 21.5], [120, 26], [150, 30],
];

/** Tỷ lệ cho ăn (% sinh khối / ngày) theo trọng lượng trung bình (g/con) */
const FEED_RATE_BY_ABW: Array<[number, number]> = [
  [1, 9], [2, 7.5], [3, 6.5], [5, 5.2], [8, 4.2], [12, 3.4], [15, 3], [20, 2.6], [25, 2.2], [Infinity, 1.9],
];

/** Cỡ viên thức ăn theo trọng lượng trung bình (số thức ăn thường gặp trên bao) */
const FEED_SIZE_BY_ABW: Array<[number, number, string]> = [
  [0.3, 0, 'số 0 (dạng bột / mảnh mịn)'],
  [1, 1, 'số 1 (mảnh nhỏ)'],
  [3, 2, 'số 2'],
  [8, 3, 'số 3'],
  [15, 4, 'số 4'],
  [Infinity, 5, 'số 5 trở lên'],
];

/** Tên giai đoạn tăng trưởng theo trọng lượng trung bình (g/con) */
const GROWTH_STAGE_BY_ABW: Array<[number, string]> = [
  [1, 'giai đoạn tôm bột (dưới 1 g)'],
  [3, 'giai đoạn tôm nhỏ (1–3 g)'],
  [8, 'giai đoạn tôm giống lớn (3–8 g)'],
  [15, 'giai đoạn tôm thịt (8–15 g)'],
  [Infinity, 'giai đoạn cuối vụ (trên 15 g)'],
];

const MAX_DAILY_INCREASE = 0.15; // không tăng quá 15%/ngày so với trung bình 3 ngày gần nhất
const SAMPLE_FRESH_DAYS = 14;

export interface FeedingSuggestion {
  pondId: string;
  pondName: string;
  farmId: string;
  farmName: string;
  cropId: string;
  date: string;
  doc: number;
  stage: string | null;
  /** Nguồn trọng lượng: mẫu cân / mốc tăng trưởng kế hoạch / ước tính theo DOC */
  abwSource: 'SAMPLE' | 'PLAN' | 'DOC_CURVE';
  abwGram: number;
  aliveCount: number;
  biomassKg: number;
  feedRatePercent: number | null;
  /** Tổng thức ăn khuyến nghị cả ngày (kg) */
  dailyKg: number;
  fedTodayKg: number;
  remainingKg: number;
  /** Trung bình thức ăn / ngày 3 ngày gần nhất (kg) */
  recentDailyAvgKg: number | null;
  /** Số cữ thường dùng mỗi ngày gần đây (chỉ để tham khảo) */
  recentSessionsPerDay: number | null;
  recommendedFeedSize: string;
  /** Tên giai đoạn tăng trưởng theo trọng lượng tôm */
  growthStage: string;
  /** Thức ăn ĐÚNG CỠ đang còn trong kho */
  matchingFeeds: Array<{ id: string; name: string; stock: number; unit: string }>;
  /** Thức ăn gần cỡ (±1 số) còn trong kho — dùng khi kho chưa có loại đúng cỡ */
  nearFeeds: Array<{ id: string; name: string; stock: number; unit: string }>;
  recommendedFeedProductId: string | null;
  feedOptions: Array<{
    id: string;
    name: string;
    unit: string;
    stock: number;
    sizeSpec: string | null;
    recommended: boolean;
    lastUsed: boolean;
  }>;
  /** Các cữ đã ghi trong ngày (để cảnh báo ghi đè) */
  todayLogs: Array<{
    session: FeedingSession;
    time: string;
    feedProductId: string;
    feedName: string;
    amountKg: number;
    status: FeedingStatus;
  }>;
  /** Giải thích ngắn gọn vì sao gợi ý như vậy */
  notes: string[];
  warnings: string[];
}

export interface FeedingPondOption {
  id: string;
  name: string;
  farmId: string;
  farmName: string;
  cropId: string;
  doc: number;
  /** Số cữ đã ghi hôm nay (không tính cữ bỏ) và tổng kg — để nông dân chọn ao nhanh */
  todaySessions: number;
  todayKg: number;
}

interface PrefillSession {
  session?: FeedingSession;
  time?: string;
  feedProductId?: string;
  amountKg?: number;
  status?: FeedingStatus;
  method?: FeedingMethod;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** YYYY-MM-DD theo giờ Việt Nam */
export function vnToday(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
}

function vnNowHHmm(): string {
  return new Date().toLocaleTimeString('en-GB', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit' });
}

function dateOnly(value: string | Date): Date {
  const s = typeof value === 'string' ? value.slice(0, 10) : value.toISOString().slice(0, 10);
  return new Date(`${s}T00:00:00.000Z`);
}

function daysBetween(from: Date, to: Date) {
  return Math.floor((dateOnly(to).getTime() - dateOnly(from).getTime()) / 86_400_000);
}

function interpolate(table: Array<[number, number]>, x: number) {
  if (x <= table[0][0]) return table[0][1];
  for (let i = 1; i < table.length; i++) {
    const [x1, y1] = table[i];
    const [x0, y0] = table[i - 1];
    if (x <= x1) return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
  }
  return table[table.length - 1][1];
}

function normalize(str: string) {
  return (str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9.\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Lấy "số" cỡ viên trong tên / quy cách thức ăn: "Cám CP số 2", "No.3", "size 4", "#1" */
export function feedSizeNumber(text: string): number | null {
  const n = normalize(text);
  const m = n.match(/(?:\bso|\bno\.?|\bsize|#|\bco)\s*(\d)\b/) || n.match(/\b(\d)\s*(?:mm)?\s*$/);
  return m ? Number(m[1]) : null;
}

export function feedingSessionFromNumber(n: unknown): FeedingSession | undefined {
  const v = Math.floor(Number(n));
  return v >= 1 && v <= 7 ? (`SESSION_${v}` as FeedingSession) : undefined;
}

/** "sáng sớm / sáng / trưa / chiều / tối" hoặc giờ "16h" -> cữ gần nhất theo giờ mặc định */
export function feedingSessionFromText(text: string): FeedingSession | undefined {
  const n = normalize(text);
  const num = n.match(/\b(?:cu|bua|lan)\s*(?:thu\s*)?(\d)\b/);
  if (num) return feedingSessionFromNumber(num[1]);
  if (/sang som|rang sang|binh minh/.test(n)) return 'SESSION_1';
  if (/chieu toi|chap toi|xam toi/.test(n)) return 'SESSION_6';
  if (/dau chieu/.test(n)) return 'SESSION_4';
  if (/\b(toi|dem)\b/.test(n)) return 'SESSION_7';
  if (/\btrua\b/.test(n)) return 'SESSION_3';
  if (/\bchieu\b/.test(n)) return 'SESSION_5';
  if (/\bsang\b/.test(n)) return 'SESSION_2';
  return undefined;
}

export function sessionForTime(hhmm: string): FeedingSession {
  const [h, m] = hhmm.split(':').map(Number);
  const minutes = h * 60 + (m || 0);
  let best = FEEDING_SESSIONS[0];
  let bestDiff = Infinity;
  for (const s of FEEDING_SESSIONS) {
    const [sh, sm] = s.defaultTime.split(':').map(Number);
    const diff = Math.abs(sh * 60 + sm - minutes);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = s;
    }
  }
  return best.session;
}

export function normalizeTime(raw: unknown): string | undefined {
  const s = String(raw ?? '').trim().toLowerCase();
  const m = s.match(/^(\d{1,2})\s*(?:[:hg]\s*(\d{1,2})?)?\s*(?:phut|p)?$/);
  if (!m) return undefined;
  const h = Number(m[1]);
  const min = Number(m[2] || 0);
  if (h > 23 || min > 59) return undefined;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

@Injectable()
export class FeedingRecordAgentService {
  private readonly logger = new Logger(FeedingRecordAgentService.name);
  private readonly openai: OpenAI | null = process.env.OPENAI_API_KEY
    ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    : null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly farmAccess: FarmAccessService,
    private readonly feedingLogs: FeedingLogsService,
  ) {}

  /** Câu kể lại việc cho ăn (dùng khi KHÔNG có / lỗi OpenAI) */
  static detectIntent(text: string): boolean {
    if (/\?/.test(text)) return false; // kiểm tra trên câu gốc: normalize() đã bỏ dấu "?"
    const n = normalize(text);
    if (
      /\b(co nen|nen khong|nen cho an|co can|bao nhieu|the nao|nhu nao|lam sao|tai sao|vi sao|goi y|tu van|khi nao|luc nao|may gio|may cu|may ky|chua|khong)\b/.test(
        n,
      )
    ) {
      return false;
    }
    return /\b(cho an|rai cam|tha cam|cho tom an|bo cu|bo bua|ghi (nhat ky )?cho an)\b/.test(n);
  }

  /** Lọc nhanh: câu có nhắc tới việc cho ăn / cám / cữ không (để chỉ gọi bộ phân loại khi cần) */
  static mentionsFeeding(text: string): boolean {
    return /\b(cho an|an|cam|cu|bua|thuc an|rai|tha cam|nhat ky)\b/.test(normalize(text));
  }

  /**
   * OpenAI phân loại câu của Nông dân:
   * - RECORD: muốn cho ăn / báo đã cho ăn / bỏ cữ / muốn ghi nhật ký cho ăn -> mở thẻ
   * - QUESTION: hỏi, xin tư vấn, tra cứu, than phiền, nhận xét về việc cho ăn -> trả lời bình thường
   * - OTHER: không liên quan việc cho ăn
   * Lỗi / không có OpenAI -> dùng detectIntent (regex) làm dự phòng.
   */
  async classifyFeedingIntent(
    message: string,
    history?: Array<{ sender: 'user' | 'ai'; text: string }>,
  ): Promise<'RECORD' | 'QUESTION' | 'OTHER'> {
    if (!FeedingRecordAgentService.mentionsFeeding(message)) return 'OTHER';
    const fallback = FeedingRecordAgentService.detectIntent(message) ? 'RECORD' : 'QUESTION';
    if (!this.openai) return fallback;
    const recent = (history || [])
      .slice(-2)
      .map((h) => `${h.sender === 'user' ? 'Nông dân' : 'Trợ lý'}: ${String(h.text || '').slice(0, 300)}`)
      .join('\n');
    try {
      const completion = await this.openai.chat.completions.create(
        {
          model: 'gpt-4o-mini',
          temperature: 0,
          max_tokens: 20,
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'system',
              content:
                'Phân loại tin nhắn của NÔNG DÂN nuôi tôm gửi cho trợ lý. Trả về JSON {"intent": "RECORD" | "QUESTION" | "OTHER"}.\n' +
                'Từ địa phương: "thả cám", "rải cám", "quăng cám", "tạt cám", "cho tôm ăn", "cho ăn" đều là việc CHO ĂN; "cám" = thức ăn; "cữ / bữa / cử" = lần cho ăn trong ngày; "ký / kg" = kilogram.\n' +
                'RECORD = người dùng MUỐN cho ăn ngay / BÁO LẠI việc đã cho ăn, bỏ cữ, cho ăn trễ / yêu cầu GHI nhật ký cho ăn — tức là cần mở phiếu ghi. ' +
                'Ví dụ: "tôi muốn cho ăn", "cho tôm ăn", "giờ cho ăn đây", "ao 1 vừa cho ăn cữ 2 12 ký", "sáng nay rải 8 ký cám số 2 ao A1", ' +
                '"ao 3 bỏ cữ trưa", "ghi cho ăn ao B2", "cữ 5 ao 2 cho trễ 10kg lúc 16h", "cho ăn ao C1".\n' +
                'QUESTION = HỎI, xin tư vấn, tra cứu số liệu, nhận xét, than phiền, kể tình trạng tôm (không yêu cầu ghi). ' +
                'Ví dụ: "hôm nay nên cho ăn bao nhiêu", "ao 1 cho ăn chưa", "cho ăn mấy cữ rồi", "tôm ăn yếu quá", "ao 1 hôm qua cho ăn ít quá", ' +
                '"có nên giảm cám không", "cám số mấy hợp với tôm 5 gam", "lịch sử cho ăn tuần này", "tôm bỏ ăn phải làm sao", "cách cho ăn khi trời mưa".\n' +
                'OTHER = không liên quan việc cho ăn.\n' +
                'Nếu câu vừa kể việc đã cho ăn vừa hỏi thêm thì vẫn là RECORD khi có số liệu cụ thể của lần cho ăn (cữ / số ký / ao).',
            },
            {
              role: 'user',
              content: (recent ? `Hội thoại trước:\n${recent}\n\n` : '') + `Tin nhắn cần phân loại: "${message.slice(0, 500)}"`,
            },
          ],
        },
        { timeout: 8_000 },
      );
      const raw = completion.choices[0]?.message?.content || '';
      const intent = String(JSON.parse(raw)?.intent || '').toUpperCase();
      if (intent === 'RECORD' || intent === 'QUESTION' || intent === 'OTHER') return intent;
      return fallback;
    } catch (err: any) {
      this.logger.warn(`Không phân loại được ý định cho ăn bằng OpenAI: ${err?.message || err}`);
      return fallback;
    }
  }

  assertFarmer(user: AuthUser) {
    if (user.role !== 'FARMER') {
      throw new ForbiddenException('Chỉ Nông dân mới ghi nhật ký cho ăn qua trợ lý AI.');
    }
  }

  /** Ao đang có vụ ACTIVE trong các trang trại người dùng được phân công */
  async listPonds(user: AuthUser): Promise<FeedingPondOption[]> {
    const farmIds = (await this.farmAccess.getAccessibleFarmIds(user)) || [];
    if (farmIds.length === 0) return [];
    const ponds = await this.prisma.pond.findMany({
      where: { farmId: { in: farmIds }, farm: { deletedAt: null }, crops: { some: { status: CropStatus.ACTIVE } } },
      select: {
        id: true,
        name: true,
        farmId: true,
        farm: { select: { name: true } },
        crops: { where: { status: CropStatus.ACTIVE }, select: { id: true, startDate: true }, take: 1 },
      },
      orderBy: [{ farm: { name: 'asc' } }, { name: 'asc' }],
    });
    const today = dateOnly(vnToday());
    const active = ponds.filter((p) => p.crops[0]);

    // Tình hình cho ăn hôm nay của từng ao (để hiện trên danh sách chọn ao)
    const todayLogs = active.length
      ? await this.prisma.feedingLog.findMany({
          where: {
            cropId: { in: active.map((p) => p.crops[0].id) },
            feedingDate: today,
            feedingStatus: { not: FeedingStatus.SKIPPED },
          },
          select: { pondId: true, feedAmount: true },
        })
      : [];
    const byPond = new Map<string, { sessions: number; kg: number }>();
    for (const l of todayLogs) {
      const cur = byPond.get(l.pondId) || { sessions: 0, kg: 0 };
      cur.sessions += 1;
      cur.kg += Number(l.feedAmount) || 0;
      byPond.set(l.pondId, cur);
    }

    return active.map((p) => ({
      id: p.id,
      name: p.name,
      farmId: p.farmId,
      farmName: p.farm?.name || '',
      cropId: p.crops[0].id,
      doc: Math.max(1, daysBetween(p.crops[0].startDate, today) + 1),
      todaySessions: byPond.get(p.id)?.sessions || 0,
      todayKg: round1(byPond.get(p.id)?.kg || 0),
    }));
  }

  /**
   * Phân tích dữ liệu vụ nuôi -> gợi ý tổng thức ăn trong ngày, loại thức ăn phù hợp cỡ tôm.
   */
  async getSuggestion(user: AuthUser, pondId: string, date?: string): Promise<FeedingSuggestion> {
    this.assertFarmer(user);
    const day = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : vnToday();
    const dayDate = dateOnly(day);

    const pond = await this.prisma.pond.findUnique({
      where: { id: pondId },
      select: {
        id: true,
        name: true,
        farmId: true,
        farm: { select: { name: true, deletedAt: true } },
        crops: { where: { status: CropStatus.ACTIVE }, take: 1 },
      },
    });
    if (!pond || pond.farm?.deletedAt) throw new NotFoundException('Không tìm thấy ao nuôi.');
    await this.farmAccess.assertCanAccessFarm(user, pond.farmId);
    const crop = pond.crops[0];
    if (!crop) throw new BadRequestException(`Ao ${pond.name} chưa có vụ nuôi đang hoạt động.`);

    const notes: string[] = [];
    const warnings: string[] = [];
    const doc = Math.max(1, daysBetween(crop.startDate, dayDate) + 1);

    const [sample, mortality, recentLogs, feedItems, water] = await Promise.all([
      this.prisma.shrimpSizeSample.findFirst({
        where: { pondId, samplingDate: { gte: crop.startDate, lte: new Date(dayDate.getTime() + 86_400_000) } },
        orderBy: { samplingDate: 'desc' },
      }),
      this.prisma.mortalityLog.aggregate({
        where: { cropId: crop.id, recordedDate: { lte: new Date(dayDate.getTime() + 86_400_000) } },
        _sum: { deadQuantityPcs: true },
      }),
      this.prisma.feedingLog.findMany({
        where: { cropId: crop.id, feedingDate: { gte: new Date(dayDate.getTime() - 3 * 86_400_000), lte: dayDate } },
        include: { feedProduct: { select: { itemName: true } } },
        orderBy: [{ feedingDate: 'desc' }, { feedingSession: 'asc' }],
      }),
      this.prisma.inventory.findMany({
        where: { farmId: pond.farmId, category: 'FEED', deletedAt: null },
        select: { id: true, itemName: true, unit: true, quantity: true, sizeSpec: true },
        orderBy: { itemName: 'asc' },
      }),
      this.prisma.waterQualityRecord.findFirst({
        where: { pondId, recordTime: { gte: new Date(Date.now() - 24 * 3_600_000) } },
        orderBy: { recordTime: 'desc' },
      }),
    ]);

    // ── 1. Số tôm còn sống ──
    const dead = mortality._sum.deadQuantityPcs || 0;
    let aliveCount = Math.max(0, (crop.initialShrimpCount || 0) - dead);
    const sampleAgeDays = sample ? daysBetween(sample.samplingDate, dayDate) : Infinity;
    if (sample?.estimatedTotalShrimp && sampleAgeDays <= SAMPLE_FRESH_DAYS) {
      aliveCount = Math.min(aliveCount || Infinity, sample.estimatedTotalShrimp);
      notes.push(`Số tôm ước tính theo lần chài mẫu ngày ${sample.samplingDate.toLocaleDateString('vi-VN')}: ${aliveCount.toLocaleString('vi-VN')} con.`);
    } else {
      notes.push(
        `Số tôm còn lại ≈ ${aliveCount.toLocaleString('vi-VN')} con (thả ${(crop.initialShrimpCount || 0).toLocaleString('vi-VN')}${dead ? `, đã ghi hao ${dead.toLocaleString('vi-VN')}` : ''}).`,
      );
    }

    // ── 2. Trọng lượng trung bình ──
    let abwGram: number;
    let abwSource: FeedingSuggestion['abwSource'];
    if (sample && sampleAgeDays <= SAMPLE_FRESH_DAYS) {
      const adg = Number(sample.adgGramPerDay) || 0;
      abwGram = Number(sample.abwGram) + Math.max(0, adg) * Math.max(0, sampleAgeDays);
      abwSource = 'SAMPLE';
      notes.push(
        `Trọng lượng TB ≈ ${round1(abwGram)} g/con (mẫu cân ${Number(sample.abwGram)} g ngày ${sample.samplingDate.toLocaleDateString('vi-VN')}${adg && sampleAgeDays ? `, cộng tăng trưởng ${adg} g/ngày` : ''}).`,
      );
    } else {
      const plan = this.planAbw(crop.growthMilestones, doc);
      if (plan) {
        abwGram = plan;
        abwSource = 'PLAN';
        notes.push(`Chưa có mẫu cân gần đây — trọng lượng TB ≈ ${round1(abwGram)} g/con theo mốc tăng trưởng kế hoạch của vụ.`);
      } else {
        abwGram = interpolate(ABW_BY_DOC, doc);
        abwSource = 'DOC_CURVE';
        notes.push(`Chưa có mẫu cân gần đây — trọng lượng TB ước tính ≈ ${round1(abwGram)} g/con theo ngày nuôi ${doc}. Nên chài mẫu để gợi ý chính xác hơn.`);
      }
    }

    // ── 3. Tổng thức ăn khuyến nghị trong ngày ──
    const biomassKg = (aliveCount * abwGram) / 1000;
    let feedRatePercent: number | null = null;
    let dailyKg: number;
    if (abwSource === 'DOC_CURVE' && doc <= 20) {
      // Giai đoạn đầu chưa cân mẫu: cho ăn "mù" theo bảng / 100.000 con giống
      const per100k =
        2 + 0.2 * Math.min(doc, 7) + 0.3 * Math.min(Math.max(doc - 7, 0), 7) + 0.4 * Math.min(Math.max(doc - 14, 0), 7);
      dailyKg = ((crop.initialShrimpCount || 0) / 100_000) * per100k;
      notes.push(`Giai đoạn cho ăn theo bảng (DOC ${doc}): ≈ ${round1(per100k)} kg / 100.000 con giống / ngày.`);
    } else {
      feedRatePercent = FEED_RATE_BY_ABW.find(([max]) => abwGram <= max)![1];
      dailyKg = (biomassKg * feedRatePercent) / 100;
      notes.push(`Sinh khối ≈ ${round1(biomassKg).toLocaleString('vi-VN')} kg × ${feedRatePercent}% / ngày.`);
    }

    // ── 4. Điều chỉnh theo môi trường nước (24 giờ gần nhất) ──
    let reduce = 0;
    if (water) {
      const reasons: string[] = [];
      const doVal = water.dissolvedOxygen != null ? Number(water.dissolvedOxygen) : null;
      const temp = water.temperature != null ? Number(water.temperature) : null;
      const nh3 = water.nh3 != null ? Number(water.nh3) : null;
      const no2 = water.no2 != null ? Number(water.no2) : null;
      if (doVal != null && doVal < 4) {
        reduce = Math.max(reduce, 0.3);
        reasons.push(`DO thấp (${doVal} mg/L)`);
      }
      if (temp != null && (temp < 25 || temp > 33)) {
        reduce = Math.max(reduce, 0.2);
        reasons.push(`nhiệt độ ${temp}°C`);
      }
      if ((nh3 != null && nh3 > 0.3) || (no2 != null && no2 > 0.5)) {
        reduce = Math.max(reduce, 0.2);
        reasons.push('khí độc NH3/NO2 cao');
      }
      if (reduce > 0) {
        dailyKg *= 1 - reduce;
        warnings.push(`Đã giảm ${Math.round(reduce * 100)}% lượng ăn vì ${reasons.join(', ')} ở lần đo nước gần nhất.`);
      }
    }

    // ── 5. Không tăng đột ngột so với thực tế 3 ngày trước ──
    const byDay = new Map<string, { kg: number; sessions: number }>();
    for (const log of recentLogs) {
      const key = log.feedingDate.toISOString().slice(0, 10);
      if (key === day) continue;
      const cur = byDay.get(key) || { kg: 0, sessions: 0 };
      if (log.feedingStatus !== FeedingStatus.SKIPPED) {
        cur.kg += Number(log.feedAmount) || 0;
        cur.sessions += 1;
      }
      byDay.set(key, cur);
    }
    const pastDays = [...byDay.values()].filter((d) => d.kg > 0);
    const recentDailyAvgKg = pastDays.length ? pastDays.reduce((s, d) => s + d.kg, 0) / pastDays.length : null;
    const recentSessionsPerDay = pastDays.length
      ? Math.round(pastDays.reduce((s, d) => s + d.sessions, 0) / pastDays.length)
      : null;
    if (recentDailyAvgKg && dailyKg > recentDailyAvgKg * (1 + MAX_DAILY_INCREASE)) {
      dailyKg = recentDailyAvgKg * (1 + MAX_DAILY_INCREASE);
      notes.push(
        `Giới hạn tăng tối đa ${MAX_DAILY_INCREASE * 100}% so với trung bình ${round1(recentDailyAvgKg)} kg/ngày của 3 ngày trước để tôm kịp thích nghi.`,
      );
    }
    dailyKg = round1(Math.max(0, dailyKg));

    // ── 6. Đã cho ăn trong ngày ──
    const todayLogs = recentLogs
      .filter((l) => l.feedingDate.toISOString().slice(0, 10) === day)
      .map((l) => ({
        session: l.feedingSession,
        time: l.feedingTime,
        feedProductId: l.feedProductId,
        feedName: l.feedProduct?.itemName || '',
        amountKg: Number(l.feedAmount) || 0,
        status: l.feedingStatus,
      }));
    const fedTodayKg = round1(
      todayLogs.filter((l) => l.status !== FeedingStatus.SKIPPED).reduce((s, l) => s + l.amountKg, 0),
    );
    const remainingKg = round1(Math.max(0, dailyKg - fedTodayKg));

    // ── 7. Loại thức ăn phù hợp cỡ tôm ──
    const sizeRow = FEED_SIZE_BY_ABW.find(([max]) => abwGram <= max)!;
    const wantedSize = sizeRow[1];
    const lastUsedId = recentLogs.find((l) => l.feedingStatus !== FeedingStatus.SKIPPED)?.feedProductId || null;
    const scored = feedItems.map((f) => {
      const size = feedSizeNumber(`${f.itemName} ${f.sizeSpec || ''}`);
      let score = 0;
      if (size === wantedSize) score += 100;
      else if (size != null && Math.abs(size - wantedSize) === 1) score += 40;
      if (f.id === lastUsedId) score += 30;
      if (f.quantity > 0) score += 20;
      if (f.quantity >= remainingKg && remainingKg > 0) score += 10;
      return { f, score };
    });
    scored.sort((a, b) => b.score - a.score);
    const recommended = scored.find((s) => s.f.quantity > 0) || scored[0];
    const recommendedFeedProductId = recommended?.f.id ?? null;
    const growthStage = GROWTH_STAGE_BY_ABW.find(([max]) => abwGram <= max)![1];
    const feedBrief = (f: (typeof feedItems)[number]) => ({ id: f.id, name: f.itemName, stock: round1(f.quantity), unit: f.unit });
    const sizeOf = (f: (typeof feedItems)[number]) => feedSizeNumber(`${f.itemName} ${f.sizeSpec || ''}`);
    const matchingFeeds = feedItems.filter((f) => f.quantity > 0 && sizeOf(f) === wantedSize).map(feedBrief);
    const nearFeeds = feedItems
      .filter((f) => {
        const sz = sizeOf(f);
        return f.quantity > 0 && sz != null && Math.abs(sz - wantedSize) === 1;
      })
      .map(feedBrief);

    if (feedItems.length === 0) {
      warnings.push('Kho của trang trại chưa có thức ăn nào — cần nhập kho trước khi ghi nhật ký.');
    } else if (recommended) {
      const sizeOfRec = feedSizeNumber(`${recommended.f.itemName} ${recommended.f.sizeSpec || ''}`);
      if (sizeOfRec === wantedSize) {
        notes.push(`Tôm ≈ ${round1(abwGram)} g/con nên dùng thức ăn ${sizeRow[2]} → gợi ý "${recommended.f.itemName}".`);
      } else {
        notes.push(
          `Tôm ≈ ${round1(abwGram)} g/con nên dùng thức ăn ${sizeRow[2]}. Kho chưa có loại khớp cỡ, tạm gợi ý "${recommended.f.itemName}"${recommended.f.id === lastUsedId ? ' (loại đang dùng)' : ''}.`,
        );
      }
      if (remainingKg > 0 && recommended.f.quantity < remainingKg) {
        warnings.push(
          `"${recommended.f.itemName}" chỉ còn ${round1(recommended.f.quantity)} ${recommended.f.unit}, chưa đủ ${remainingKg} kg còn lại hôm nay.`,
        );
      }
    }
    if (todayLogs.length) {
      notes.push(`Hôm nay đã ghi ${todayLogs.length} cữ, tổng ${fedTodayKg} kg → còn khoảng ${remainingKg} kg.`);
    }

    return {
      pondId: pond.id,
      pondName: pond.name,
      farmId: pond.farmId,
      farmName: pond.farm?.name || '',
      cropId: crop.id,
      date: day,
      doc,
      stage: crop.stage ?? null,
      abwSource,
      abwGram: Math.round(abwGram * 100) / 100,
      aliveCount,
      biomassKg: round1(biomassKg),
      feedRatePercent,
      dailyKg,
      fedTodayKg,
      remainingKg,
      recentDailyAvgKg: recentDailyAvgKg != null ? round1(recentDailyAvgKg) : null,
      recentSessionsPerDay,
      recommendedFeedSize: sizeRow[2],
      growthStage,
      matchingFeeds,
      nearFeeds,
      recommendedFeedProductId,
      feedOptions: feedItems.map((f) => ({
        id: f.id,
        name: f.itemName,
        unit: f.unit,
        stock: round1(f.quantity),
        sizeSpec: f.sizeSpec,
        recommended: f.id === recommendedFeedProductId,
        lastUsed: f.id === lastUsedId,
      })),
      todayLogs,
      notes,
      warnings,
    };
  }

  /** Trọng lượng theo mốc tăng trưởng kế hoạch của vụ: [{ day, weight }] (nội suy) */
  private planAbw(milestones: unknown, doc: number): number | null {
    if (!Array.isArray(milestones)) return null;
    const pts = milestones
      .map((m: any) => [Number(m?.day), Number(m?.weight)] as [number, number])
      .filter(([d, w]) => Number.isFinite(d) && Number.isFinite(w) && w > 0)
      .sort((a, b) => a[0] - b[0]);
    if (pts.length < 2) return null;
    return interpolate([[0, 0.01], ...pts], doc);
  }

  /**
   * Dựng phiếu (thẻ) ghi nhật ký cho ăn. Thông tin AI bóc tách từ câu nói chỉ để ĐIỀN SẴN,
   * nông dân chọn / sửa tất cả trên thẻ.
   */
  async buildDraft(
    user: AuthUser,
    args: Record<string, any>,
    userMessage: string,
    focusPondId?: string,
  ) {
    if (user.role !== 'FARMER') {
      return {
        isAgentAction: true,
        answer: 'Dạ, việc **ghi nhật ký cho ăn qua trợ lý AI** chỉ dành cho **Nông dân** phụ trách ao. Bạn vẫn có thể hỏi tôi về lượng ăn, lịch sử cho ăn của các ao nhé!',
      };
    }
    const ponds = await this.listPonds(user);
    if (ponds.length === 0) {
      return {
        isAgentAction: true,
        answer: 'Dạ, hiện bạn chưa được phân công ao nào đang có **vụ nuôi hoạt động**, nên chưa thể ghi nhật ký cho ăn.',
      };
    }

    const pond =
      this.matchPond(ponds, args.pondName) ||
      this.matchPondInText(ponds, userMessage) ||
      ponds.find((p) => p.id === focusPondId) ||
      (ponds.length === 1 ? ponds[0] : undefined);

    const date =
      typeof args.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(args.date) && args.date <= vnToday()
        ? args.date
        : /\bhom qua\b/.test(normalize(userMessage))
          ? new Date(dateOnly(vnToday()).getTime() - 86_400_000).toISOString().slice(0, 10)
          : vnToday();

    const feedItems = pond
      ? await this.prisma.inventory.findMany({
          where: { farmId: pond.farmId, category: 'FEED', deletedAt: null },
          select: { id: true, itemName: true },
        })
      : [];

    const rawSessions: any[] = Array.isArray(args.sessions) && args.sessions.length ? args.sessions : [{}];
    const sessions: PrefillSession[] = rawSessions.slice(0, 7).map((s) => {
      const time = normalizeTime(s?.time);
      const session =
        feedingSessionFromNumber(s?.session) ||
        feedingSessionFromText(String(s?.session || '')) ||
        (time ? sessionForTime(time) : undefined);
      const feed = s?.feedName
        ? feedItems.find((f) => normalize(f.itemName) === normalize(s.feedName)) ||
          feedItems.find((f) => normalize(f.itemName).includes(normalize(s.feedName)) || normalize(s.feedName).includes(normalize(f.itemName)))
        : undefined;
      const status = ['COMPLETED', 'SKIPPED', 'DELAYED'].includes(s?.status) ? (s.status as FeedingStatus) : undefined;
      const amount = Number(s?.amountKg);
      return {
        session,
        time,
        feedProductId: feed?.id,
        amountKg: Number.isFinite(amount) && amount >= 0 ? amount : undefined,
        status,
        method: s?.method === 'AUTO' ? FeedingMethod.AUTO : undefined,
      };
    });
    // Câu không nêu cữ nào -> gợi ý cữ theo cách nói ("sáng nay", "chiều") hoặc giờ hiện tại
    if (rawSessions.length === 1 && !sessions[0].session) {
      sessions[0].session = feedingSessionFromText(userMessage) || (date === vnToday() ? sessionForTime(vnNowHHmm()) : undefined);
    }

    // Gợi ý theo dữ liệu thật của ao -> câu trả lời đúng ngữ cảnh (OpenAI viết, có bản dự phòng)
    let suggestion: FeedingSuggestion | null = null;
    if (pond) {
      suggestion = await this.getSuggestion(user, pond.id, date).catch((e: any) => {
        this.logger.warn(`Không tính được gợi ý cho ăn ao ${pond.name}: ${e?.message || e}`);
        return null;
      });
    }
    const feedNameById = new Map(feedItems.map((f) => [f.id, f.itemName]));
    const answer = pond
      ? await this.composeReply(userMessage, pond.name, sessions, suggestion, feedNameById)
      : this.pondListReply(ponds);

    return {
      isAgentAction: true,
      answer,
      actionDraft: {
        type: 'CONFIRM_ACTION' as const,
        intent: 'RECORD_FEEDING' as const,
        collectedData: { pondId: pond?.id || '', date, sessions },
        missingFields: [],
        feedingPondOptions: ponds,
      },
    };
  }

  /** Câu trả lời kèm thẻ: dựa trên gợi ý thực tế của ao và điều người dùng vừa nói */
  private async composeReply(
    userMessage: string,
    pondName: string,
    sessions: PrefillSession[],
    suggestion: FeedingSuggestion | null,
    feedNameById: Map<string, string>,
  ): Promise<string> {
    const said = sessions.map((s) => ({
      cu: s.session ? FEEDING_SESSIONS.find((x) => x.session === s.session)?.label : undefined,
      gio: s.time,
      soKy: s.amountKg,
      thucAn: s.feedProductId ? feedNameById.get(s.feedProductId) : undefined,
      trangThai: s.status,
    }));
    const fallback = this.fallbackReply(pondName, suggestion);
    if (!this.openai || !suggestion) return fallback;

    const recommendedFeed = suggestion.feedOptions.find((f) => f.recommended);
    // Ước tính số cữ còn lại trong ngày (theo thói quen gần đây, mặc định 4 cữ/ngày) -> kg gợi ý mỗi cữ
    const doneToday = suggestion.todayLogs.filter((l) => !said.some((x) => x.cu && x.cu === FEEDING_SESSIONS.find((f) => f.session === l.session)?.label)).length;
    const sessionsLeft = Math.max(1, (suggestion.recentSessionsPerDay || 4) - doneToday);
    const perSessionKg = round1(suggestion.remainingKg / sessionsLeft);
    const context = {
      ao: pondName,
      ngay: suggestion.date,
      ngayNuoi: suggestion.doc,
      trongLuongTomGam: suggestion.abwGram,
      nguonTrongLuong: suggestion.abwSource,
      soTomConLai: suggestion.aliveCount,
      sinhKhoiKg: suggestion.biomassKg,
      goiYCaNgayKg: suggestion.dailyKg,
      daChoAnHomNayKg: suggestion.fedTodayKg,
      conLaiKg: suggestion.remainingKg,
      soCuTrungBinhGanDay: suggestion.recentSessionsPerDay,
      soCuConLaiDuKien: sessionsLeft,
      goiYMoiCuKg: perSessionKg,
      giaiDoanTom: suggestion.growthStage,
      coThucAnPhuHop: suggestion.recommendedFeedSize,
      thucAnDungCoTrongKho: suggestion.matchingFeeds.map((f) => `${f.name} (tồn ${f.stock} ${f.unit})`),
      thucAnGanCoTrongKho: suggestion.nearFeeds.map((f) => `${f.name} (tồn ${f.stock} ${f.unit})`),
      thucAnGoiY: recommendedFeed ? `${recommendedFeed.name} (tồn ${recommendedFeed.stock} ${recommendedFeed.unit})` : null,
      cacCuDaGhiHomNay: suggestion.todayLogs.map((l) => ({
        cu: FEEDING_SESSIONS.find((f) => f.session === l.session)?.label || l.session,
        kg: l.amountKg,
        thucAn: l.feedName || null,
        trangThai: l.status,
      })),
      canhBao: suggestion.warnings,
      nguoiDungDaNoi: said,
    };

    try {
      const completion = await this.openai.chat.completions.create(
        {
          model: 'gpt-4o-mini',
          temperature: 0.3,
          max_tokens: 260,
          messages: [
            {
              role: 'system',
              content:
                'Bạn là trợ lý nuôi tôm, đang trả lời NÔNG DÂN vừa nhắn về việc cho ăn. Hệ thống ĐÃ MỞ một thẻ "Nhật ký cho ăn" bên dưới tin nhắn ' +
                'để nông dân tự chọn cữ, giờ, loại thức ăn và số ký rồi bấm "Lưu nhật ký" (chưa lưu gì). ' +
                'Viết 2-4 câu tiếng Việt thân thiện, ngắn gọn, dùng **in đậm** cho số liệu quan trọng:\n' +
                '- Xác nhận đã mở thẻ cho ao và tóm tắt điều người dùng đã nói (nếu có).\n' +
                '- Nêu gợi ý: tổng kg cả ngày, còn lại bao nhiêu kg hôm nay.\n' +
                '- Nêu tôm đang ở giai đoạn nào (giaiDoanTom, trọng lượng) nên dùng thức ăn cỡ nào, và GỌI TÊN loại trong kho phù hợp kèm tồn kho ' +
                '(thucAnDungCoTrongKho; nếu trống thì nói kho chưa có loại đúng cỡ và nêu thucAnGanCoTrongKho để dùng tạm; cả hai trống thì khuyên nhập thêm).\n' +
                '- Nêu gợi ý mỗi cữ (goiYMoiCuKg, ứng với soCuConLaiDuKien cữ còn lại). Nếu số ký người dùng nói cho 1 cữ lệch hơn ~30% so với goiYMoiCuKg ' +
                'thì nhắc nhẹ kèm con số cụ thể; nếu loại thức ăn họ nói khác cỡ phù hợp thì nhắc nhẹ. Không ra lệnh — số cữ, giờ, số ký do nông dân quyết định.\n' +
                '- Nêu ngắn các cảnh báo (canhBao) nếu có; KHÔNG có thì không nhắc gì về cảnh báo.\n' +
                'CHỈ dùng số liệu trong dữ liệu được cung cấp, không bịa, không đoán thông tin không có (vd loại cám của cữ đã ghi). ' +
                'Không mở đầu bằng lời chào dài, không nhắc tới "JSON" hay tên trường kỹ thuật.',
            },
            { role: 'user', content: `Tin nhắn: "${userMessage.slice(0, 500)}"\nDữ liệu: ${JSON.stringify(context)}` },
          ],
        },
        { timeout: 12_000 },
      );
      const text = completion.choices[0]?.message?.content?.trim();
      return text || fallback;
    } catch (err: any) {
      this.logger.warn(`OpenAI không viết được câu trả lời nhật ký cho ăn: ${err?.message || err}`);
      return fallback;
    }
  }

  /** Chưa rõ ao nào -> liệt kê các ao đang có vụ nuôi để nông dân bấm chọn trên thẻ */
  /**
   * Chưa rõ ao nào -> chỉ liệt kê các ao đang nuôi để nông dân bấm chọn trên thẻ.
   * Gợi ý giai đoạn / loại cám trong kho / số ký CHỈ hiện trên thẻ sau khi đã chọn ao.
   */
  private pondListReply(ponds: FeedingPondOption[]): string {
    const multiFarm = new Set(ponds.map((p) => p.farmId)).size > 1;
    const lines = ponds.map((p) => {
      const status = p.todaySessions ? `hôm nay đã cho ${p.todaySessions} cữ, ${p.todayKg} kg` : 'hôm nay chưa cho ăn';
      return `- **${p.name}**${multiFarm ? ` (${p.farmName})` : ''} — ngày nuôi ${p.doc}, ${status}`;
    });
    return [
      `Dạ, bạn đang có **${ponds.length} ao đang nuôi**. Bạn bấm chọn ao trên phiếu bên dưới, hệ thống sẽ gợi ý loại cám trong kho và số ký phù hợp giai đoạn tôm của ao đó:`,
      ...lines,
    ].join('\n');
  }

  /** "Tôm ≈ 5.8 g/con – giai đoạn ...: nên dùng thức ăn số 3 → trong kho có Cám CP số 3 (tồn 150 kg)" */
  feedAdviceLine(s: FeedingSuggestion): string {
    const list = (feeds: FeedingSuggestion['matchingFeeds']) =>
      feeds
        .slice(0, 3)
        .map((f) => `**${f.name}** (tồn ${f.stock} ${f.unit})`)
        .join(', ');
    const stage = `Tôm ≈ ${s.abwGram} g/con – ${s.growthStage}: nên dùng thức ăn **${s.recommendedFeedSize}**`;
    let stock: string;
    if (s.matchingFeeds.length) stock = `trong kho có ${list(s.matchingFeeds)}`;
    else if (s.nearFeeds.length) stock = `kho chưa có loại đúng cỡ, có thể dùng tạm loại gần cỡ: ${list(s.nearFeeds)}`;
    else if (s.feedOptions.some((f) => f.stock > 0)) stock = 'kho chưa có thức ăn đúng / gần cỡ này — nên nhập thêm';
    else stock = 'kho đang hết thức ăn — cần nhập kho';
    const kg = s.dailyKg > 0 ? `; gợi ý cả ngày ≈ **${s.dailyKg} kg**` : '';
    return `${stage} → ${stock}${kg}.`;
  }

  private fallbackReply(pondName: string, s: FeedingSuggestion | null): string {
    const head = `Dạ, tôi đã mở **phiếu ghi nhật ký cho ăn – ${pondName}**.`;
    if (!s) return `${head} Bạn chọn cữ, giờ, loại thức ăn và số ký rồi bấm **Lưu nhật ký** nhé.`;
    const parts = [
      `${head} Ngày nuôi ${s.doc}: gợi ý cả ngày **${s.dailyKg} kg**` +
        (s.fedTodayKg > 0 ? `, đã cho ${s.fedTodayKg} kg, còn **${s.remainingKg} kg**` : '') +
        '.',
      this.feedAdviceLine(s),
      ...s.warnings.map((w) => `⚠️ ${w}`),
      'Bạn tự chọn cữ, giờ, loại thức ăn và số ký trên thẻ rồi bấm **Lưu nhật ký** nhé.',
    ];
    return parts.join('\n');
  }

  private matchPond(ponds: FeedingPondOption[], raw: unknown) {
    const t = normalize(String(raw || ''));
    if (!t) return undefined;
    return (
      ponds.find((p) => normalize(p.name) === t) ||
      ponds.find((p) => normalize(p.name) === `ao ${t}`) ||
      ponds.find((p) => normalize(p.name).includes(t) || t.includes(normalize(p.name)))
    );
  }

  private matchPondInText(ponds: FeedingPondOption[], text: string) {
    const n = ` ${normalize(text)} `;
    const sorted = [...ponds].sort((a, b) => b.name.length - a.name.length);
    return sorted.find((p) => n.includes(` ${normalize(p.name)} `));
  }

  /** Lưu nhật ký cho ăn từ thẻ (chỉ Nông dân) — dùng chung nghiệp vụ với form thủ công */
  async execute(data: Record<string, any>, user: AuthUser) {
    this.assertFarmer(user);
    const pondId = String(data?.pondId || '');
    const date = String(data?.date || '');
    if (!pondId) throw new BadRequestException('Vui lòng chọn ao.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new BadRequestException('Ngày cho ăn không hợp lệ.');
    if (date > vnToday()) throw new BadRequestException('Không thể ghi nhật ký cho ăn cho ngày trong tương lai.');

    const rows: any[] = Array.isArray(data?.sessions) ? data.sessions : [];
    if (rows.length === 0) throw new BadRequestException('Vui lòng thêm ít nhất 1 cữ ăn.');
    if (rows.length > 7) throw new BadRequestException('Một ngày tối đa 7 cữ ăn.');

    const seen = new Set<string>();
    const sessions = rows.map((r, i) => {
      const session = feedingSessionFromNumber(String(r?.session || '').replace('SESSION_', ''));
      if (!session) throw new BadRequestException(`Cữ ăn thứ ${i + 1} chưa chọn cữ.`);
      if (seen.has(session)) throw new BadRequestException(`${FEEDING_SESSIONS.find((s) => s.session === session)?.label} bị chọn trùng.`);
      seen.add(session);
      const status: FeedingStatus = ['COMPLETED', 'SKIPPED', 'DELAYED'].includes(r?.status) ? r.status : FeedingStatus.COMPLETED;
      const time = normalizeTime(r?.time);
      if (!time) throw new BadRequestException(`Giờ cho ăn của cữ ${session.replace('SESSION_', '')} không hợp lệ.`);
      const feedProductId = String(r?.feedProductId || '');
      if (!feedProductId) throw new BadRequestException(`Cữ ${session.replace('SESSION_', '')} chưa chọn loại thức ăn.`);
      const amount = status === FeedingStatus.SKIPPED ? 0 : Number(r?.amountKg);
      if (!Number.isFinite(amount) || amount < 0 || (status !== FeedingStatus.SKIPPED && amount <= 0)) {
        throw new BadRequestException(`Số ký thức ăn của cữ ${session.replace('SESSION_', '')} phải lớn hơn 0.`);
      }
      if (amount > 2000) throw new BadRequestException(`Số ký của cữ ${session.replace('SESSION_', '')} quá lớn, vui lòng kiểm tra lại.`);
      return {
        feedingSession: session,
        feedingTime: time,
        feedProductId,
        feedAmount: Math.round(amount * 100) / 100,
        feedingMethod: r?.method === 'AUTO' ? FeedingMethod.AUTO : FeedingMethod.MANUAL,
        feedingStatus: status,
        note: r?.note ? String(r.note).slice(0, 500) : undefined,
      };
    });

    const pond = await this.prisma.pond.findUnique({
      where: { id: pondId },
      select: { name: true, farmId: true, crops: { where: { status: CropStatus.ACTIVE }, select: { id: true }, take: 1 } },
    });
    if (!pond) throw new NotFoundException('Không tìm thấy ao nuôi.');
    const cropId = pond.crops[0]?.id;
    if (!cropId) throw new BadRequestException(`Ao ${pond.name} chưa có vụ nuôi đang hoạt động.`);

    // Loại thức ăn phải thuộc kho của chính trang trại này
    const productIds = [...new Set(sessions.map((s) => s.feedProductId))];
    const validCount = await this.prisma.inventory.count({
      where: { id: { in: productIds }, farmId: pond.farmId, category: 'FEED', deletedAt: null },
    });
    if (validCount !== productIds.length) {
      throw new BadRequestException('Loại thức ăn đã chọn không có trong kho của trang trại này.');
    }

    await this.feedingLogs.createOrUpdateDailyLog(user, {
      farmId: pond.farmId,
      pondId,
      cropId,
      feedingDate: date,
      sessions,
    });

    const total = sessions.filter((s) => s.feedingStatus !== FeedingStatus.SKIPPED).reduce((sum, s) => sum + s.feedAmount, 0);
    const lines = sessions.map((s) => {
      const label = FEEDING_SESSIONS.find((x) => x.session === s.feedingSession)?.label || s.feedingSession;
      return s.feedingStatus === FeedingStatus.SKIPPED
        ? `- ${label} (${s.feedingTime}): bỏ cữ`
        : `- ${label} (${s.feedingTime}): **${s.feedAmount} kg**${s.feedingStatus === FeedingStatus.DELAYED ? ' (trễ)' : ''}`;
    });
    const [y, m, d] = date.split('-');
    return {
      success: true,
      type: 'FEEDING_LOG',
      redirectTab: 'Nhật ký cho ăn',
      message: `✅ Đã ghi nhật ký cho ăn **${pond.name}** ngày ${d}/${m}/${y}:\n${lines.join('\n')}\n\nTổng: **${Math.round(total * 100) / 100} kg** — kho thức ăn đã được trừ tương ứng.`,
    };
  }
}
