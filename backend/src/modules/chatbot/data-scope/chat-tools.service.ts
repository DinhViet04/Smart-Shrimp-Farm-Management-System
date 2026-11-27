import { Injectable, Logger, Optional } from '@nestjs/common';
import { CropStatus, Prisma } from '@prisma/client';
import type OpenAI from 'openai';
import { PrismaService } from '../../../prisma/prisma.service';
import { WeatherService } from '../weather.service';
import {
  assessWaterMetrics,
  WATER_METRIC_INFO,
  WATER_STATUS_LABEL,
} from '../../water-quality/water-quality-status';
import {
  ChatDataScopeService,
  ChatDomain,
  ChatScope,
} from './chat-data-scope.service';
import { FeedingRecordAgentService } from '../feeding-record-agent.service';

type ToolDef = OpenAI.Chat.Completions.ChatCompletionFunctionTool;

interface CommonArgs {
  cropId?: string;
  pondName?: string;
  /** Id ao đã quy đổi từ pondName bằng so khớp gần đúng (xem resolvePondIds) */
  pondIds?: string[];
  farmName?: string;
  fromDate?: string;
  toDate?: string;
  staffName?: string;
}

const MAX_RECORDS = 50;
const TZ = 'Asia/Ho_Chi_Minh';

const COMMON_PROPS = {
  cropId: {
    type: 'string',
    description:
      'ID vụ nuôi (lấy từ list_crops). Dùng khi hỏi về một vụ cụ thể, ví dụ "vụ trước".',
  },
  pondName: {
    type: 'string',
    description:
      'Tên (hoặc một phần tên) ao nuôi. CHỈ truyền khi CÂU HỎI HIỆN TẠI nêu tên ao (hoặc nói rõ "ao đó / ao này / ao vừa rồi"). ' +
      'KHÔNG tự lấy ao từ các câu trả lời trước. Bỏ trống = TẤT CẢ ao trong phạm vi.',
  },
  farmName: {
    type: 'string',
    description:
      'Tên (hoặc một phần tên) trang trại. CHỈ truyền khi câu hỏi hiện tại nêu trang trại; bỏ trống = tất cả trang trại trong phạm vi.',
  },
  fromDate: { type: 'string', description: 'Từ ngày, định dạng YYYY-MM-DD' },
  toDate: {
    type: 'string',
    description: 'Đến ngày (bao gồm), định dạng YYYY-MM-DD',
  },
};
const STAFF_PROP = {
  staffName: {
    type: 'string',
    description: 'Tên nhân viên đã tạo bản ghi (chỉ dành cho quản lý)',
  },
};

/** SESSION_3 -> "Cử 3" */
const sessionLabel = (s?: string | null) =>
  s ? `Cử ${String(s).replace('SESSION_', '')}` : null;

/**
 * Chuẩn hóa tên ao để so khớp gần đúng: bỏ dấu, chữ thường, bỏ các từ chung ("ao", "nuôi", "số")
 * và ký tự không phải chữ/số. "Ao nuôi D3", "ao d 3", "D3" -> "d3".
 */
const normalizePondName = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/\b(ao|nuoi|so)\b/g, ' ')
    .replace(/[^a-z0-9]/g, '');

const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));
const day = (d?: Date | null) =>
  d ? d.toLocaleDateString('vi-VN', { timeZone: TZ }) : null;
const time = (d?: Date | null) =>
  d ? d.toLocaleString('vi-VN', { timeZone: TZ }) : null;
const round = (v: unknown, digits = 2) =>
  v === null || v === undefined
    ? null
    : Math.round(Number(v) * 10 ** digits) / 10 ** digits;
const contains = (s?: string) =>
  s ? { contains: s.trim(), mode: 'insensitive' as const } : undefined;

@Injectable()
export class ChatToolsService {
  private readonly logger = new Logger(ChatToolsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly scopeService: ChatDataScopeService,
    @Optional() private readonly weatherService?: WeatherService,
    @Optional() private readonly feedingAgent?: FeedingRecordAgentService,
  ) {}

  // ───────────────────────────── TOOL DEFINITIONS ─────────────────────────────

  /** Chỉ trả về những tool mà role được phép dùng (lớp phòng thủ thứ 2 ngoài bộ lọc where) */
  getToolDefinitions(scope: ChatScope): ToolDef[] {
    const staff = this.scopeService.canAccess(scope, 'STAFF_FILTER')
      ? STAFF_PROP
      : {};
    const tool = (
      name: string,
      description: string,
      properties: Record<string, unknown>,
      required: string[] = [],
    ): ToolDef => ({
      type: 'function',
      function: {
        name,
        description,
        parameters: { type: 'object', properties, required },
      },
    });

    const defs: Array<[ChatDomain | ChatDomain[] | null, ToolDef]> = [
      [
        null,
        tool(
          'list_crops',
          'Liệt kê trang trại, ao và các vụ nuôi (đang nuôi và đã kết thúc) trong phạm vi người dùng, kèm thứ tự vụ trong từng ao. Gọi đầu tiên khi cần xác định "vụ trước", "vụ hiện tại" hoặc cropId.',
          {
            pondName: COMMON_PROPS.pondName,
            farmName: COMMON_PROPS.farmName,
            status: { type: 'string', enum: ['ACTIVE', 'HARVESTED', 'FAILED'] },
          },
        ),
      ],
      [
        'CROP_RESULTS',
        tool(
          'get_crop_summary',
          'Tổng hợp toàn diện một vụ nuôi: mục tiêu, kết quả thu hoạch, chi phí, lợi nhuận, FCR, tỉ lệ sống, tổng thức ăn, tôm hao, sự cố, chỉ số nước trung bình, tăng trưởng, đánh giá và bài học.',
          { cropId: COMMON_PROPS.cropId },
          ['cropId'],
        ),
      ],
      [
        'FEEDING',
        tool(
          'get_feeding_status',
          'TÌNH HÌNH CHO ĂN TRONG 1 NGÀY (mặc định hôm nay) của TẤT CẢ ao đang nuôi trong phạm vi: từng ao -> từng cử đã cho ăn (giờ, loại thức ăn, số kg, người ghi), cử bỏ, tổng kg, và danh sách AO CHƯA CHO ĂN. ' +
            'Gọi khi hỏi "hôm nay đã cho ăn chưa", "cho ăn mấy cử rồi", "cử nào còn thiếu", "ao nào chưa cho ăn", "hôm qua cho ăn thế nào".',
          {
            date: { type: 'string', description: 'Ngày cần xem, YYYY-MM-DD (bỏ trống = hôm nay)' },
            pondName: COMMON_PROPS.pondName,
            farmName: COMMON_PROPS.farmName,
          },
        ),
      ],
      [
        'FEEDING',
        tool(
          'query_feeding_logs',
          'Tra cứu LỊCH SỬ nhật ký cho ăn theo khoảng thời gian / vụ: tổng lượng thức ăn, số cữ, chi tiết từng cữ. Hỏi tình hình 1 ngày cụ thể (hôm nay đã cho ăn chưa) thì dùng get_feeding_status.',
          { ...COMMON_PROPS, ...staff },
        ),
      ],
      [
        'WATER',
        tool(
          'query_water_quality',
          'Tra cứu LỊCH SỬ đo môi trường nước (pH, DO, nhiệt độ, độ mặn, kiềm, NH3, NO2, H2S, độ trong, màu nước): thống kê trung bình/thấp nhất/cao nhất, số lần đo theo mức đánh giá, trung bình theo từng ngày (xu hướng) và chi tiết từng lần đo kèm đánh giá.',
          { ...COMMON_PROPS, ...staff },
        ),
      ],
      [
        'WATER',
        tool(
          'get_water_status',
          'ĐÁNH GIÁ HIỆN TRẠNG môi trường nước: lần đo MỚI NHẤT của từng ao (đánh giá từng chỉ số theo ngưỡng hệ thống, chỉ số vượt ngưỡng, thay đổi so với lần đo trước, đo cách đây bao lâu) kèm diện tích, độ sâu, THỂ TÍCH NƯỚC ao (để tính liều thuốc), DOC và mật độ vụ đang nuôi. Gọi khi hỏi "nước ao X thế nào", "ao nào đang có vấn đề", "cần xử lý gì".',
          { pondName: COMMON_PROPS.pondName, farmName: COMMON_PROPS.farmName },
        ),
      ],
      [
        'WATER',
        tool(
          'query_water_treatments',
          'Tra cứu LỊCH SỬ XỬ LÝ NƯỚC: các lần dùng hóa chất/thuốc xử lý ao (tên, số lượng, người thực hiện, ghi chú biện pháp).',
          {
            cropId: COMMON_PROPS.cropId,
            pondName: COMMON_PROPS.pondName,
            farmName: COMMON_PROPS.farmName,
            fromDate: COMMON_PROPS.fromDate,
            toDate: COMMON_PROPS.toDate,
          },
        ),
      ],
      [
        'WATER',
        tool(
          'get_treatment_stock',
          'Danh sách HÓA CHẤT / THUỐC xử lý nước đang có trong kho trang trại (tồn kho, công dụng). Gọi khi tư vấn phác đồ xử lý nước để đánh dấu loại CÓ SẴN / CHƯA CÓ.',
          { pondName: COMMON_PROPS.pondName, farmName: COMMON_PROPS.farmName },
        ),
      ],
      [
        'WATER',
        tool(
          'get_farm_weather',
          'Thời tiết hiện tại tại vị trí trang trại (nhiệt độ, mưa, gió, độ ẩm) để đánh giá ảnh hưởng tới môi trường nước ao.',
          { pondName: COMMON_PROPS.pondName, farmName: COMMON_PROPS.farmName },
        ),
      ],
      [
        'HEALTH',
        tool(
          'query_shrimp_health',
          'Tra cứu lịch sử kiểm tra sức khỏe tôm: trạng thái, mức độ, tỉ lệ ảnh hưởng.',
          { ...COMMON_PROPS, ...staff },
        ),
      ],
      [
        'GROWTH',
        tool(
          'query_growth_samples',
          'Tra cứu lịch sử bắt mẫu tăng trưởng: DOC, trọng lượng trung bình (ABW), size con/kg, ADG, sinh khối ước tính.',
          { ...COMMON_PROPS, ...staff },
        ),
      ],
      [
        'INCIDENT',
        tool(
          'query_incidents',
          'Tra cứu sự cố ao nuôi và toàn bộ lịch sử xử lý của từng sự cố.',
          {
            ...COMMON_PROPS,
            ...staff,
            status: { type: 'string', enum: ['OPEN', 'TREATING', 'RESOLVED'] },
            mine: {
              type: 'string',
              enum: ['ASSIGNED', 'REPORTED'],
              description:
                'ASSIGNED = sự cố được giao cho chính người dùng xử lý; REPORTED = sự cố do chính người dùng báo cáo',
            },
          },
        ),
      ],
      [
        'MORTALITY',
        tool(
          'query_mortality',
          'Tra cứu nhật ký tôm hao (chết): tổng số con và nguyên nhân.',
          { ...COMMON_PROPS, ...staff },
        ),
      ],
      [
        'INVENTORY',
        tool(
          'query_inventory',
          'Tra cứu tồn kho vật tư (thức ăn, thuốc, hóa chất) và lịch sử xuất kho sử dụng.',
          {
            ...COMMON_PROPS,
            ...staff,
            itemName: { type: 'string', description: 'Tên vật tư' },
            category: {
              type: 'string',
              enum: ['FEED', 'MEDICINE', 'CHEMICAL'],
            },
          },
        ),
      ],
      [
        'FARM_INFO',
        tool(
          'get_farm_overview',
          'Tổng quan trang trại & ao nuôi trong phạm vi: địa chỉ, diện tích, mô hình nuôi; từng ao: diện tích, độ sâu, thể tích, vụ đang nuôi (DOC, giai đoạn, số giống, mật độ), lần đo nước gần nhất, sự cố đang mở, mẫu tăng trưởng gần nhất. Gọi khi hỏi "trại/ao của tôi thế nào", "ao nào đang nuôi", "tình hình chung".',
          { pondName: COMMON_PROPS.pondName, farmName: COMMON_PROPS.farmName },
        ),
      ],
      [
        'FARM_INFO',
        tool(
          'list_farm_staff',
          'Danh sách nhân sự của trang trại (họ tên, vai trò: quản lý, kỹ thuật viên, nông dân).',
          {
            farmName: COMMON_PROPS.farmName,
            role: { type: 'string', enum: ['FARM_MANAGER', 'TECHNICIAN', 'FARMER'] },
          },
        ),
      ],
      [
        'FARM_INFO',
        tool(
          'query_suppliers',
          'Danh sách nhà cung cấp vật tư của trang trại (liên hệ, các mặt hàng đang cung cấp).',
          {
            farmName: COMMON_PROPS.farmName,
            name: { type: 'string', description: 'Tên (một phần) nhà cung cấp' },
          },
        ),
      ],
    ];

    // Gợi ý lượng ăn / loại thức ăn theo giai đoạn tôm: cùng bộ tính với thẻ nhật ký cho ăn (chỉ Nông dân)
    if (scope.role === 'FARMER' && this.feedingAgent) {
      defs.push([
        'FEEDING',
        tool(
          'get_feeding_suggestion',
          'GỢI Ý CHO ĂN theo giai đoạn tôm của ao đang nuôi: tổng kg nên cho ăn trong ngày, đã cho bao nhiêu, còn lại bao nhiêu, ' +
            'trọng lượng tôm, sinh khối, tỷ lệ cho ăn, cỡ / loại thức ăn phù hợp trong kho, điều chỉnh theo chất lượng nước, các cữ đã ghi hôm nay. ' +
            'Gọi khi hỏi "hôm nay nên cho ăn bao nhiêu", "cữ tới cho mấy ký", "dùng cám số mấy", "có nên tăng / giảm thức ăn".',
          {
            pondName: COMMON_PROPS.pondName,
            date: { type: 'string', description: 'Ngày YYYY-MM-DD (bỏ trống = hôm nay)' },
          },
        ),
      ]);
    }

    return defs
      .filter(([domain]) => {
        if (domain === null) return true;
        const domains = Array.isArray(domain) ? domain : [domain];
        return domains.some((d) => this.scopeService.canAccess(scope, d));
      })
      .map(([, def]) => def);
  }

  /**
   * Bảng "cách hỏi thường gặp -> công cụ" để AI nhận diện câu hỏi đời thường của người nuôi.
   * Chỉ liệt kê công cụ mà role được dùng (khớp getToolDefinitions), kèm hướng dẫn riêng theo role.
   */
  describeRouting(scope: ChatScope): string {
    const available = new Set(
      this.getToolDefinitions(scope).map((t) => t.function.name),
    );
    const hints: Array<[string, string]> = [
      ['get_feeding_suggestion', '"hôm nay nên cho ăn bao nhiêu", "cữ tới cho mấy ký", "tôm cỡ này ăn cám số mấy", "có nên tăng/giảm cám" -> dùng ĐÚNG số liệu công cụ trả về (dailyKg, remainingKg, recommendedFeed...), giải thích ngắn lý do (notes/warnings); muốn ghi lại việc cho ăn thì nói người dùng nhắn "ao X vừa cho ăn cữ Y"'],
      ['get_feeding_status', '"hôm nay (tôi) đã cho ăn chưa", "cho ăn mấy cữ/cử rồi", "cử nào còn thiếu / bỏ", "ao nào chưa cho ăn", "hôm qua cho ăn thế nào" -> trả lời ĐỦ TẤT CẢ ao (kể cả ao chưa cho ăn) và từng cử (Cử 1, Cử 2... giờ, loại cám, kg)'],
      ['query_feeding_logs', '"tổng thức ăn tuần này / tháng này / cả vụ", "lịch sử cho ăn ao X", "ăn có giảm không", "trung bình mỗi ngày bao nhiêu kg cám"'],
      ['query_growth_samples', '"size tôm", "bao nhiêu con/kg", "tôm được mấy gam", "ABW/ADG", "tôm lớn nhanh không", "sinh khối ước tính"'],
      ['query_shrimp_health', '"tôm bệnh", "đốm trắng", "phân trắng", "gan tụy", "mềm vỏ", "tôm yếu/lờ đờ", "kết quả kiểm tra sức khỏe"'],
      ['query_mortality', '"tôm chết", "tôm hao", "rớt đáy", "hao hụt bao nhiêu con", "chết vì sao"'],
      ['query_inventory', '"kho còn bao nhiêu", "cám còn mấy bao", "thuốc/hóa chất trong kho", "sắp hết hàng", "đã xuất kho gì"'],
      ['get_crop_summary', '"vụ trước lời hay lỗ", "FCR vụ", "tỉ lệ sống", "thu hoạch được bao nhiêu tấn", "chi phí vụ", "đánh giá vụ" (gọi list_crops trước để lấy cropId)'],
      ['query_incidents', '"sự cố", "ao đang có vấn đề gì đã báo", "sự cố đang xử lý", "lịch sử điều trị sự cố"'],
      ['get_water_status', '"nước ao X thế nào", "pH/DO/kiềm/NH3 hiện tại", "ao nào có vấn đề", "nước có ổn không"'],
      ['query_water_quality', '"diễn biến pH tuần qua", "so sánh chỉ số nước các ngày", "lịch sử đo nước"'],
      ['get_farm_overview', '"tình hình trại/ao của tôi", "ao nào đang nuôi", "ao bao nhiêu ngày tuổi (DOC)", "mật độ thả"'],
      ['list_farm_staff', '"ai đang làm ở trại", "kỹ thuật viên phụ trách là ai"'],
      ['query_suppliers', '"mua cám ở đâu", "nhà cung cấp", "số điện thoại đại lý"'],
    ];
    const lines = hints
      .filter(([name]) => available.has(name))
      .map(([name, examples]) => `   - ${name}: ${examples}`);

    const roleGuide: Record<string, string> = {
      FARMER:
        'Người dùng là NÔNG DÂN: thường hỏi ngắn, dùng từ địa phương (cám = thức ăn, cữ = cử ăn, rớt = chết chìm đáy). Được hỏi / xem mọi dữ liệu của trang trại được phân công và CHỈ được ghi NHẬT KÝ CHO ĂN qua trợ lý (thẻ để nông dân tự chọn cữ, giờ, loại thức ăn, số ký). Trả lời ngắn gọn, dễ hiểu, ưu tiên việc cần làm ngay.',
      TECHNICIAN:
        'Người dùng là KỸ THUẬT VIÊN: thường hỏi về chỉ số nước, sức khỏe, tăng trưởng, sự cố được giao và phác đồ xử lý. Được xem mọi dữ liệu trang trại được phân công và CHỈ được nhập số đo môi trường nước qua trợ lý. Trả lời chuyên môn, có số liệu và liều lượng cụ thể.',
      FARM_MANAGER:
        'Người dùng là QUẢN LÝ TRANG TRẠI: thường hỏi tổng quan nhiều ao, so sánh vụ, chi phí - lợi nhuận, FCR, kho, nhân sự. Là role DUY NHẤT được tạo trang trại / ao / vụ và nhập / xuất kho qua trợ lý. Ưu tiên tổng hợp, so sánh và cảnh báo.',
      ADMIN:
        'Người dùng là QUẢN TRỊ VIÊN: giám sát toàn hệ thống, thường hỏi tổng hợp nhiều trang trại. Chỉ xem, không tạo/sửa dữ liệu nghiệp vụ.',
    };

    return (
      `NHẬN DIỆN CÂU HỎI (cách hỏi thường gặp -> công cụ nên gọi):\n` +
      (lines.length ? lines.join('\n') + '\n' : '   (không có công cụ dữ liệu)\n') +
      `   - Mốc thời gian "hôm nay / hôm qua / tuần này / tháng này / 7 ngày qua" -> tự quy đổi ra fromDate/toDate (YYYY-MM-DD) theo ngày hôm nay.\n` +
      `   - Câu nêu tên ao/trang trại viết tắt hoặc sai chính tả nhẹ ("ao 1", "a1", "ao A 1") -> truyền vào pondName/farmName, hệ thống tự so khớp gần đúng.\n` +
      `   - PHẠM VI AO: câu hỏi hiện tại KHÔNG nêu ao/trang trại -> KHÔNG truyền pondName/farmName, tra cứu & trả lời TỔNG HỢP TẤT CẢ ao (liệt kê theo từng ao). ` +
      `Ao được nhắc ở các lượt trước KHÔNG tự áp dụng cho câu mới; chỉ dùng lại khi người dùng nói "ao đó", "ao này", "còn ao đó thì sao".\n` +
      `${roleGuide[scope.role] ? `VAI TRÒ: ${roleGuide[scope.role]}\n` : ''}`
    );
  }

  /** Tóm tắt ngắn phạm vi dữ liệu của người dùng để đưa vào system prompt */
  async describeScope(scope: ChatScope): Promise<string> {
    const [user, farms] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: scope.userId },
        select: { fullName: true },
      }),
      this.prisma.farm.findMany({
        where: this.scopeService.farmWhere(scope),
        select: {
          name: true,
          ponds: { select: { name: true }, orderBy: { name: 'asc' } },
        },
        orderBy: { name: 'asc' },
        take: 30,
      }),
    ]);

    const domainLabels: Record<ChatDomain, string> = {
      CROP_RESULTS: 'kết quả thu hoạch, chi phí, lợi nhuận của vụ nuôi',
      FEEDING: 'nhật ký cho ăn',
      WATER: 'môi trường nước',
      HEALTH: 'sức khỏe tôm',
      GROWTH: 'theo dõi tăng trưởng',
      INCIDENT: 'sự cố',
      MORTALITY: 'tôm hao',
      INVENTORY: 'kho vật tư',
      FARM_INFO: 'thông tin trang trại, ao nuôi, nhân sự, nhà cung cấp',
      STAFF_FILTER: 'dữ liệu theo từng nhân viên',
    };
    const allowed = this.scopeService.allowedDomains(scope);
    const ownership =
      scope.role === 'ADMIN' || scope.role === 'FARM_MANAGER'
        ? 'toàn bộ dữ liệu trong các trang trại (của mình và của nhân viên)'
        : 'toàn bộ dữ liệu của các trang trại được phân công (do mọi nhân viên ghi nhận); chỉ ĐỌC qua trợ lý';

    const farmText = farms.length
      ? farms
          .map(
            (f) =>
              `   - ${f.name}: ${f.ponds.map((p) => p.name).join(', ') || '(chưa có ao)'}`,
          )
          .join('\n')
      : '   (Chưa sở hữu hoặc chưa được phân công vào trang trại nào)';

    return (
      `[PHẠM VI DỮ LIỆU NGƯỜI DÙNG]\n` +
      `- Người dùng: ${user?.fullName || 'Người dùng'} | Vai trò: ${scope.role}\n` +
      `- Trang trại và ao trong phạm vi:\n${farmText}\n` +
      `- Được tra cứu: ${
        allowed
          .filter((d) => d !== 'STAFF_FILTER')
          .map((d) => domainLabels[d])
          .join(', ') || 'không có'
      } — ${ownership}.\n` +
      `- KHÔNG được tiết lộ dữ liệu ngoài phạm vi trên.\n`
    );
  }

  // ───────────────────────────── EXECUTION ─────────────────────────────

  async execute(
    name: string,
    args: Record<string, any>,
    scope: ChatScope,
  ): Promise<unknown> {
    try {
      // Tên ao do AI truyền có thể viết tắt / khác dấu ("Ao D3" cho "Ao nuôi D3") -> quy đổi ra id ao
      if (typeof args.pondName === 'string' && args.pondName.trim()) {
        args = { ...args, pondIds: await this.resolvePondIds(scope, args.pondName) };
      }
      switch (name) {
        case 'list_crops':
          return await this.listCrops(scope, args);
        case 'get_crop_summary':
          return await this.getCropSummary(scope, args.cropId);
        case 'get_feeding_status':
          return await this.getFeedingStatus(scope, args);
        case 'get_feeding_suggestion':
          return await this.getFeedingSuggestion(scope, args);
        case 'query_feeding_logs':
          return await this.queryFeeding(scope, args);
        case 'query_water_quality':
          return await this.queryWater(scope, args);
        case 'get_water_status':
          return await this.getWaterStatus(scope, args);
        case 'query_water_treatments':
          return await this.queryWaterTreatments(scope, args);
        case 'get_treatment_stock':
          return await this.getTreatmentStock(scope, args);
        case 'get_farm_weather':
          return await this.getFarmWeather(scope, args);
        case 'query_shrimp_health':
          return await this.queryHealth(scope, args);
        case 'query_growth_samples':
          return await this.queryGrowth(scope, args);
        case 'query_incidents':
          return await this.queryIncidents(scope, args);
        case 'query_mortality':
          return await this.queryMortality(scope, args);
        case 'query_inventory':
          return await this.queryInventory(scope, args);
        case 'get_farm_overview':
          return await this.getFarmOverview(scope, args);
        case 'list_farm_staff':
          return await this.listFarmStaff(scope, args);
        case 'query_suppliers':
          return await this.querySuppliers(scope, args);
        default:
          return { error: `Công cụ không tồn tại: ${name}` };
      }
    } catch (err: any) {
      this.logger.warn(`Tool ${name} failed: ${err?.message || err}`);
      return { error: 'Không truy vấn được dữ liệu cho yêu cầu này.' };
    }
  }

  /** Gợi ý cho ăn (cùng bộ tính với thẻ nhật ký cho ăn) cho 1 ao hoặc tất cả ao đang nuôi */
  private async getFeedingSuggestion(scope: ChatScope, args: CommonArgs & { date?: string }) {
    if (scope.role !== 'FARMER' || !this.feedingAgent) return this.denied();
    const user = { userId: scope.userId, role: scope.role };
    const ponds = await this.feedingAgent.listPonds(user);
    const targets = args.pondIds?.length ? ponds.filter((p) => args.pondIds!.includes(p.id)) : ponds;
    if (targets.length === 0) {
      return { message: args.pondName ? `Không có ao "${args.pondName}" đang nuôi trong phạm vi của bạn.` : 'Chưa có ao nào đang có vụ nuôi.' };
    }
    const suggestions = await Promise.all(
      targets.slice(0, 10).map((p) =>
        this.feedingAgent!.getSuggestion(user, p.id, args.date).catch((e: any) => ({ pondName: p.name, error: e?.message })),
      ),
    );
    return {
      note: 'Số liệu là GỢI Ý tham khảo; nông dân tự quyết số cữ, giờ và số ký.',
      ponds: suggestions.map((s: any) =>
        s.error
          ? s
          : {
              pondName: s.pondName,
              farmName: s.farmName,
              date: s.date,
              doc: s.doc,
              abwGram: s.abwGram,
              abwSource: s.abwSource,
              aliveCount: s.aliveCount,
              biomassKg: s.biomassKg,
              feedRatePercent: s.feedRatePercent,
              dailyKg: s.dailyKg,
              fedTodayKg: s.fedTodayKg,
              remainingKg: s.remainingKg,
              recentDailyAvgKg: s.recentDailyAvgKg,
              recentSessionsPerDay: s.recentSessionsPerDay,
              recommendedFeedSize: s.recommendedFeedSize,
              recommendedFeed: s.feedOptions.find((f: any) => f.recommended) || null,
              feedInStock: s.feedOptions.map((f: any) => ({ name: f.name, stock: f.stock, unit: f.unit })),
              todayLogs: s.todayLogs,
              notes: s.notes,
              warnings: s.warnings,
            },
      ),
    };
  }

  private denied() {
    return {
      error: 'Tài khoản của bạn không có quyền tra cứu loại dữ liệu này.',
    };
  }

  // ───────────────────────────── HELPERS ─────────────────────────────

  private dateRange(args: CommonArgs): { gte?: Date; lte?: Date } | undefined {
    const range: { gte?: Date; lte?: Date } = {};
    if (args.fromDate && !isNaN(Date.parse(args.fromDate)))
      range.gte = new Date(`${args.fromDate}T00:00:00+07:00`);
    if (args.toDate && !isNaN(Date.parse(args.toDate)))
      range.lte = new Date(`${args.toDate}T23:59:59.999+07:00`);
    return range.gte || range.lte ? range : undefined;
  }

  private pondFilter(args: CommonArgs): Prisma.PondWhereInput | undefined {
    if (!args.pondName && !args.farmName) return undefined;
    return {
      ...(args.pondIds
        ? { id: { in: args.pondIds } }
        : args.pondName
          ? { name: contains(args.pondName) }
          : {}),
      ...(args.farmName ? { farm: { name: contains(args.farmName) } } : {}),
    };
  }

  /**
   * So khớp gần đúng tên ao trong phạm vi người dùng: ưu tiên trùng khớp sau chuẩn hóa
   * ("Ao D3" = "Ao nuôi D3"), sau đó mới tới chứa nhau. Không khớp ao nào -> [] (không có dữ liệu).
   */
  private async resolvePondIds(scope: ChatScope, rawName: string): Promise<string[]> {
    const target = normalizePondName(rawName);
    if (!target) return [];
    const ponds = await this.prisma.pond.findMany({
      where: this.scopeService.pondWhere(scope),
      select: { id: true, name: true },
      take: 500,
    });
    const exact = ponds.filter((p) => normalizePondName(p.name) === target);
    if (exact.length) return exact.map((p) => p.id);
    return ponds
      .filter((p) => {
        const n = normalizePondName(p.name);
        return Boolean(n) && (n.includes(target) || target.includes(n));
      })
      .map((p) => p.id);
  }

  private async staffIds(
    scope: ChatScope,
    args: CommonArgs,
  ): Promise<string[] | undefined> {
    if (!args.staffName || !this.scopeService.canAccess(scope, 'STAFF_FILTER'))
      return undefined;
    const users = await this.prisma.user.findMany({
      where: { fullName: contains(args.staffName) },
      select: { id: true },
      take: 20,
    });
    return users.map((u) => u.id);
  }

  /**
   * Bản ghi nước & mẫu tăng trưởng không lưu cropId -> quy đổi vụ nuôi thành (ao + khoảng thời gian của vụ).
   * Vụ phải nằm trong phạm vi của người dùng.
   */
  private async cropWindow(scope: ChatScope, cropId: string) {
    const crop = await this.prisma.crop.findFirst({
      where: { AND: [this.scopeService.cropWhere(scope), { id: cropId }] },
      select: {
        pondId: true,
        startDate: true,
        actualHarvestDate: true,
        transferDate: true,
      },
    });
    if (!crop) return null;
    return {
      pondId: crop.pondId,
      range: {
        gte: crop.startDate,
        lte: crop.actualHarvestDate ?? crop.transferDate ?? new Date(),
      },
    };
  }

  private page<T>(total: number, records: T[]) {
    return {
      totalRecords: total,
      returnedRecords: records.length,
      truncated: total > records.length,
      records,
    };
  }

  // ───────────────────────────── TOOLS ─────────────────────────────

  private async listCrops(
    scope: ChatScope,
    args: CommonArgs & { status?: CropStatus },
  ) {
    const isManager = this.scopeService.canAccess(scope, 'CROP_RESULTS');
    const crops = await this.prisma.crop.findMany({
      where: {
        AND: [
          this.scopeService.cropWhere(scope),
          ...(this.pondFilter(args) ? [{ pond: this.pondFilter(args) }] : []),
        ],
      },
      select: {
        id: true,
        pondId: true,
        status: true,
        stage: true,
        startDate: true,
        actualHarvestDate: true,
        transferDate: true,
        initialShrimpCount: true,
        parentCropId: true,
        actualHarvestKg: true,
        actualHarvestFcr: true,
        actualHarvestSurvivalRate: true,
        actualHarvestProfit: true,
        pond: { select: { name: true, farm: { select: { name: true } } } },
      },
      orderBy: { startDate: 'asc' },
      take: 300,
    });

    const orderInPond = new Map<string, number>();
    const rows = crops.map((c) => {
      const n = (orderInPond.get(c.pondId) ?? 0) + 1;
      orderInPond.set(c.pondId, n);
      return {
        cropId: c.id,
        farm: c.pond.farm.name,
        pond: c.pond.name,
        cropNumberInPond: n,
        status: c.status,
        stage: c.stage,
        startDate: day(c.startDate),
        endDate: day(c.actualHarvestDate ?? c.transferDate),
        initialShrimpCount: c.initialShrimpCount,
        splitFromCropId: c.parentCropId,
        ...(isManager
          ? {
              harvestKg: c.actualHarvestKg,
              fcr: c.actualHarvestFcr,
              survivalRate: c.actualHarvestSurvivalRate,
              profit: c.actualHarvestProfit,
            }
          : {}),
      };
    });

    const filtered = args.status
      ? rows.filter((r) => r.status === args.status)
      : rows;
    return {
      note: 'cropNumberInPond: thứ tự vụ trong ao (1 = vụ đầu tiên).',
      crops: filtered.reverse(),
    };
  }

  private async getCropSummary(scope: ChatScope, cropId?: string) {
    if (!this.scopeService.canAccess(scope, 'CROP_RESULTS'))
      return this.denied();
    if (!cropId) return { error: 'Thiếu cropId' };

    const crop = await this.prisma.crop.findFirst({
      where: { AND: [this.scopeService.cropWhere(scope), { id: cropId }] },
      include: {
        pond: {
          select: {
            name: true,
            areaSize: true,
            farm: { select: { name: true } },
          },
        },
      },
    });
    if (!crop)
      return { error: 'Không tìm thấy vụ nuôi trong phạm vi của bạn.' };

    const window = {
      gte: crop.startDate,
      lte: crop.actualHarvestDate ?? crop.transferDate ?? new Date(),
    };
    const [feed, mortality, incidents, water, samples] = await Promise.all([
      this.prisma.feedingLog.aggregate({
        where: { cropId },
        _sum: { feedAmount: true },
        _count: true,
      }),
      this.prisma.mortalityLog.aggregate({
        where: { cropId },
        _sum: { deadQuantityPcs: true },
        _count: true,
      }),
      this.prisma.incident.groupBy({
        by: ['status'],
        where: { cropId },
        _count: true,
      }),
      this.prisma.waterQualityRecord.aggregate({
        where: { pondId: crop.pondId, recordTime: window },
        _avg: {
          ph: true,
          dissolvedOxygen: true,
          temperature: true,
          salinity: true,
          alkalinity: true,
          nh3: true,
          no2: true,
        },
        _count: true,
      }),
      this.prisma.shrimpSizeSample.findMany({
        where: { pondId: crop.pondId, samplingDate: window },
        orderBy: { samplingDate: 'asc' },
        select: {
          samplingDate: true,
          doc: true,
          abwGram: true,
          sizePerKg: true,
        },
      }),
    ]);

    const { pond, growthMilestones, ...rest } = crop;
    return {
      farm: pond.farm.name,
      pond: pond.name,
      pondAreaM2: pond.areaSize,
      crop: {
        ...rest,
        startDate: day(crop.startDate),
        expectedHarvestDate: day(crop.expectedHarvestDate),
        actualHarvestDate: day(crop.actualHarvestDate),
        transferDate: day(crop.transferDate),
        expectedTransferDate: day(crop.expectedTransferDate),
        growthMilestones,
      },
      totals: {
        feedingSessions: feed._count,
        totalFeedKg: round(feed._sum.feedAmount),
        mortalityRecords: mortality._count,
        totalDeadShrimp: mortality._sum.deadQuantityPcs ?? 0,
        incidentsByStatus: Object.fromEntries(
          incidents.map((i) => [i.status, i._count]),
        ),
        waterMeasurements: water._count,
        waterAverages: Object.fromEntries(
          Object.entries(water._avg).map(([k, v]) => [k, round(v)]),
        ),
      },
      growthSamples: samples.map((s) => ({
        date: day(s.samplingDate),
        doc: s.doc,
        abwGram: num(s.abwGram),
        sizePerKg: num(s.sizePerKg),
      })),
    };
  }

  /**
   * Tình hình cho ăn trong 1 ngày của mọi ao đang nuôi: cử đã cho ăn / bỏ cử / ao chưa cho ăn.
   * Cử chưa cho ăn không có bản ghi trong DB nên phải đối chiếu từ danh sách ao.
   */
  private async getFeedingStatus(scope: ChatScope, args: CommonArgs & { date?: string }) {
    const scopeWhere = this.scopeService.feedingWhere(scope);
    if (!scopeWhere) return this.denied();

    const today = new Date().toLocaleDateString('en-CA', { timeZone: TZ });
    const date = args.date && /^\d{4}-\d{2}-\d{2}$/.test(args.date) ? args.date : today;
    const pondFilter = this.pondFilter(args);

    const [ponds, logs] = await Promise.all([
      // Ao đang có vụ nuôi trong phạm vi người dùng
      this.prisma.pond.findMany({
        where: {
          AND: [
            this.scopeService.pondWhere(scope),
            { crops: { some: { status: CropStatus.ACTIVE } } },
            ...(pondFilter ? [pondFilter] : []),
          ],
        },
        select: {
          id: true,
          name: true,
          farm: { select: { name: true } },
          crops: {
            where: { status: CropStatus.ACTIVE },
            select: { startDate: true },
            orderBy: { startDate: 'desc' },
            take: 1,
          },
        },
        orderBy: [{ farm: { name: 'asc' } }, { name: 'asc' }],
        take: 100,
      }),
      this.prisma.feedingLog.findMany({
        where: {
          AND: [
            scopeWhere,
            { feedingDate: this.dateRange({ fromDate: date, toDate: date }) },
            ...(pondFilter ? [{ pond: pondFilter }] : []),
          ],
        },
        orderBy: [{ feedingSession: 'asc' }],
        select: {
          pondId: true,
          feedingSession: true,
          feedingTime: true,
          feedAmount: true,
          feedingStatus: true,
          note: true,
          feedProduct: { select: { itemName: true } },
          pond: { select: { name: true, farm: { select: { name: true } } } },
          creator: { select: { fullName: true } },
        },
      }),
    ]);

    // Gộp: ao đang nuôi + ao có bản ghi trong ngày (vd vụ vừa kết thúc)
    const pondMap = new Map<string, { pond: string; farm: string; doc: number | null }>();
    const startOfDay = new Date(`${date}T00:00:00+07:00`).getTime();
    for (const p of ponds) {
      const crop = p.crops[0];
      pondMap.set(p.id, {
        pond: p.name,
        farm: p.farm?.name ?? '',
        doc: crop ? Math.max(1, Math.floor((startOfDay - crop.startDate.getTime()) / 86_400_000) + 1) : null,
      });
    }
    for (const l of logs) {
      if (!pondMap.has(l.pondId)) {
        pondMap.set(l.pondId, { pond: l.pond.name, farm: l.pond.farm?.name ?? '', doc: null });
      }
    }

    const result = [...pondMap.entries()].map(([pondId, info]) => {
      const pondLogs = logs.filter((l) => l.pondId === pondId);
      const fed = pondLogs.filter((l) => l.feedingStatus !== 'SKIPPED' && Number(l.feedAmount) > 0);
      const skipped = pondLogs.filter((l) => l.feedingStatus === 'SKIPPED');
      return {
        pond: info.pond,
        farm: info.farm,
        doc: info.doc,
        fedToday: fed.length > 0,
        fedSessionCount: fed.length,
        totalFeedKg: round(fed.reduce((s, l) => s + (Number(l.feedAmount) || 0), 0)),
        fedSessions: fed.map((l) => ({
          session: sessionLabel(l.feedingSession),
          time: l.feedingTime,
          feed: l.feedProduct?.itemName ?? null,
          amountKg: num(l.feedAmount),
          status: l.feedingStatus === 'DELAYED' ? 'Trễ giờ' : 'Hoàn thành',
          by: l.creator?.fullName ?? null,
          note: l.note,
        })),
        skippedSessions: skipped.map((l) => sessionLabel(l.feedingSession)),
      };
    });

    return {
      date: day(new Date(`${date}T12:00:00+07:00`)),
      isToday: date === today,
      summary: {
        pondCount: result.length,
        pondsFed: result.filter((r) => r.fedToday).map((r) => r.pond),
        pondsNotFedYet: result.filter((r) => !r.fedToday).map((r) => r.pond),
        totalFeedKg: round(result.reduce((s, r) => s + (r.totalFeedKg || 0), 0)),
        totalFedSessions: result.reduce((s, r) => s + r.fedSessionCount, 0),
      },
      ponds: result,
      note: 'Cử chưa cho ăn chưa có bản ghi. Khi trả lời phải liệt kê ĐỦ mọi ao (kể cả ao chưa cho ăn) và từng cử đã cho ăn.',
    };
  }

  private async queryFeeding(scope: ChatScope, args: CommonArgs) {
    const scopeWhere = this.scopeService.feedingWhere(scope);
    if (!scopeWhere) return this.denied();
    const staff = await this.staffIds(scope, args);
    const where: Prisma.FeedingLogWhereInput = {
      AND: [
        scopeWhere,
        {
          ...(args.cropId ? { cropId: args.cropId } : {}),
          ...(this.pondFilter(args) ? { pond: this.pondFilter(args) } : {}),
          ...(this.dateRange(args)
            ? { feedingDate: this.dateRange(args) }
            : {}),
          ...(staff ? { createdBy: { in: staff } } : {}),
        },
      ],
    };

    const [agg, byStatus, rows] = await Promise.all([
      this.prisma.feedingLog.aggregate({
        where,
        _sum: { feedAmount: true },
        _count: true,
        _min: { feedingDate: true },
        _max: { feedingDate: true },
      }),
      this.prisma.feedingLog.groupBy({
        by: ['feedingStatus'],
        where,
        _count: true,
      }),
      this.prisma.feedingLog.findMany({
        where,
        orderBy: [{ feedingDate: 'desc' }, { feedingSession: 'desc' }],
        take: MAX_RECORDS,
        select: {
          feedingDate: true,
          feedingSession: true,
          feedingTime: true,
          feedAmount: true,
          feedingMethod: true,
          feedingStatus: true,
          note: true,
          cropId: true,
          feedProduct: { select: { itemName: true } },
          pond: { select: { name: true } },
          creator: { select: { fullName: true } },
        },
      }),
    ]);

    return {
      summary: {
        totalFeedKg: round(agg._sum.feedAmount),
        firstDate: day(agg._min.feedingDate),
        lastDate: day(agg._max.feedingDate),
        sessionsByStatus: Object.fromEntries(
          byStatus.map((s) => [s.feedingStatus, s._count]),
        ),
      },
      ...this.page(
        agg._count,
        rows.map((r) => ({
          date: day(r.feedingDate),
          session: sessionLabel(r.feedingSession),
          time: r.feedingTime,
          pond: r.pond.name,
          cropId: r.cropId,
          feed: r.feedProduct?.itemName,
          amountKg: num(r.feedAmount),
          method: r.feedingMethod,
          status: r.feedingStatus,
          note: r.note,
          by: r.creator.fullName,
        })),
      ),
    };
  }

  private async queryWater(scope: ChatScope, args: CommonArgs) {
    const scopeWhere = this.scopeService.waterWhere(scope);
    if (!scopeWhere) return this.denied();
    const extra: Prisma.WaterQualityRecordWhereInput = {};
    if (args.cropId) {
      const w = await this.cropWindow(scope, args.cropId);
      if (!w) return { error: 'Không tìm thấy vụ nuôi trong phạm vi của bạn.' };
      extra.pondId = w.pondId;
      extra.recordTime = { ...w.range, ...(this.dateRange(args) ?? {}) };
    } else if (this.dateRange(args)) {
      extra.recordTime = this.dateRange(args);
    }
    if (this.pondFilter(args)) extra.pond = this.pondFilter(args);
    const staff = await this.staffIds(scope, args);
    if (staff) extra.createdBy = { in: staff };
    const where: Prisma.WaterQualityRecordWhereInput = {
      AND: [scopeWhere, extra],
    };

    const fields = {
      ph: true,
      dissolvedOxygen: true,
      temperature: true,
      salinity: true,
      alkalinity: true,
      nh3: true,
      no2: true,
      h2s: true,
      transparency: true,
    } as const;
    const [agg, rows, seriesRows] = await Promise.all([
      this.prisma.waterQualityRecord.aggregate({
        where,
        _count: true,
        _avg: fields,
        _min: fields,
        _max: fields,
      }),
      this.prisma.waterQualityRecord.findMany({
        where,
        orderBy: { recordTime: 'desc' },
        take: MAX_RECORDS,
        include: {
          pond: { select: { name: true } },
          creator: { select: { fullName: true } },
        },
      }),
      // Bản ghi rút gọn để tính xu hướng theo ngày & số lần đo theo mức đánh giá
      this.prisma.waterQualityRecord.findMany({
        where,
        orderBy: { recordTime: 'desc' },
        take: 2000,
        select: { recordTime: true, ...fields, waterColor: true },
      }),
    ]);

    const stats = Object.fromEntries(
      (Object.keys(fields) as Array<keyof typeof fields>).map((k) => [
        k,
        {
          avg: round(agg._avg[k]),
          min: round(agg._min[k]),
          max: round(agg._max[k]),
        },
      ]),
    );

    type SeriesRow = (typeof seriesRows)[number];
    const statusCounts = { Optimal: 0, Warning: 0, Danger: 0 };
    const byDay = new Map<string, SeriesRow[]>();
    for (const r of seriesRows ?? []) {
      statusCounts[this.assess(r).overall] += 1;
      const key = day(r.recordTime)!;
      if (!byDay.has(key)) byDay.set(key, []);
      byDay.get(key)!.push(r);
    }
    const avgOf = (list: SeriesRow[], k: keyof typeof fields) => {
      const vals = list
        .map((r) => r[k])
        .filter((v) => v !== null && v !== undefined)
        .map(Number);
      return vals.length
        ? round(vals.reduce((a, b) => a + b, 0) / vals.length)
        : null;
    };
    const dailyAverages = [...byDay.entries()].slice(0, 45).map(([date, list]) => ({
      date,
      measurements: list.length,
      ph: avgOf(list, 'ph'),
      dissolvedOxygen: avgOf(list, 'dissolvedOxygen'),
      minDissolvedOxygen: round(
        Math.min(...list.map((r) => Number(r.dissolvedOxygen))),
      ),
      temperature: avgOf(list, 'temperature'),
      salinity: avgOf(list, 'salinity'),
      alkalinity: avgOf(list, 'alkalinity'),
      nh3: avgOf(list, 'nh3'),
      transparency: avgOf(list, 'transparency'),
    }));

    return {
      thresholds: WATER_METRIC_INFO,
      summary: stats,
      statusCounts: {
        optimal: statusCounts.Optimal,
        warning: statusCounts.Warning,
        danger: statusCounts.Danger,
        basedOnRecords: (seriesRows ?? []).length,
      },
      dailyAverages,
      ...this.page(
        agg._count,
        rows.map((r) => {
          const a = this.assess(r);
          return {
            time: time(r.recordTime),
            pond: r.pond.name,
            temperature: num(r.temperature),
            ph: num(r.ph),
            dissolvedOxygen: num(r.dissolvedOxygen),
            salinity: num(r.salinity),
            alkalinity: num(r.alkalinity),
            nh3: num(r.nh3),
            no2: num(r.no2),
            h2s: num(r.h2s),
            transparency: num(r.transparency),
            waterColor: r.waterColor,
            status: WATER_STATUS_LABEL[a.overall],
            alerts: a.alerts,
            note: r.note,
            by: r.creator.fullName,
          };
        }),
      ),
    };
  }

  /** Đánh giá một bản ghi nước theo ngưỡng hệ thống (H2S cũ có thể lưu ở cột NO2) */
  private assess(r: Record<string, any>) {
    return assessWaterMetrics({
      temperature: r.temperature,
      ph: r.ph,
      dissolvedOxygen: r.dissolvedOxygen,
      salinity: r.salinity,
      alkalinity: r.alkalinity,
      nh3: r.nh3,
      h2s: r.h2s ?? r.no2,
      transparency: r.transparency,
      waterColor: r.waterColor,
    });
  }

  private async getWaterStatus(scope: ChatScope, args: CommonArgs) {
    const pondWhere = this.scopeService.waterPondWhere(scope);
    const recordWhere = this.scopeService.waterWhere(scope);
    if (!pondWhere || !recordWhere) return this.denied();
    const filter = this.pondFilter(args);

    const ponds = await this.prisma.pond.findMany({
      where: { AND: [pondWhere, ...(filter ? [filter] : [])] },
      select: {
        name: true,
        areaSize: true,
        depth: true,
        farm: { select: { name: true } },
        crops: {
          where: { status: CropStatus.ACTIVE },
          select: { startDate: true, initialShrimpCount: true, stage: true },
          orderBy: { startDate: 'desc' },
          take: 1,
        },
        waterQualityRecords: {
          where: recordWhere,
          orderBy: { recordTime: 'desc' },
          take: 2,
          include: { creator: { select: { fullName: true } } },
        },
      },
      orderBy: [{ farm: { name: 'asc' } }, { name: 'asc' }],
      take: 30,
    });

    const now = Date.now();
    const counts = { danger: 0, warning: 0, optimal: 0, noData: 0 };
    const result = ponds.map((p) => {
      const area = Number(p.areaSize) || 0;
      const depth = Number(p.depth) || 0;
      const crop = p.crops[0];
      const doc = crop
        ? Math.max(1, Math.floor((now - crop.startDate.getTime()) / 86_400_000))
        : null;
      const [latest, previous] = p.waterQualityRecords;
      const base = {
        farm: p.farm.name,
        pond: p.name,
        areaM2: area,
        depthM: depth,
        waterVolumeM3: round(area * depth),
        activeCrop: crop
          ? {
              doc,
              stage: crop.stage,
              initialShrimpCount: crop.initialShrimpCount,
              densityPerM2:
                area > 0 ? round(Number(crop.initialShrimpCount) / area, 1) : null,
            }
          : null,
      };
      if (!latest) {
        counts.noData += 1;
        return { ...base, latest: null, note: 'Chưa có lần đo nào' };
      }
      const a = this.assess(latest);
      if (a.overall === 'Danger') counts.danger += 1;
      else if (a.overall === 'Warning') counts.warning += 1;
      else counts.optimal += 1;
      const delta = (k: string) =>
        previous
          ? round(Number((latest as any)[k]) - Number((previous as any)[k]))
          : null;
      return {
        ...base,
        latest: {
          time: time(latest.recordTime),
          hoursAgo: round((now - latest.recordTime.getTime()) / 3_600_000, 1),
          by: latest.creator.fullName,
          overallStatus: WATER_STATUS_LABEL[a.overall],
          metrics: a.metrics.map((m) => ({
            name: m.label,
            value: m.value,
            unit: m.unit,
            status: WATER_STATUS_LABEL[m.status],
            optimalRange: m.optimalRange,
          })),
          no2: num(latest.no2),
          waterColor: latest.waterColor,
          alerts: a.alerts,
          note: latest.note,
        },
        changeSincePrevious: previous
          ? {
              previousTime: time(previous.recordTime),
              ph: delta('ph'),
              dissolvedOxygen: delta('dissolvedOxygen'),
              temperature: delta('temperature'),
              salinity: delta('salinity'),
              alkalinity: delta('alkalinity'),
              nh3: delta('nh3'),
            }
          : null,
      };
    });

    return {
      thresholds: WATER_METRIC_INFO,
      overview: { ponds: result.length, ...counts },
      ponds: result,
    };
  }

  private async queryWaterTreatments(scope: ChatScope, args: CommonArgs) {
    const base = this.scopeService.waterTreatmentWhere(scope);
    const pondWhere = this.scopeService.waterPondWhere(scope);
    if (!base || !pondWhere) return this.denied();

    const extra: Prisma.InventoryUsageLogWhereInput[] = [];
    let pondIds: string[] | undefined;
    if (args.cropId) {
      const w = await this.cropWindow(scope, args.cropId);
      if (!w) return { error: 'Không tìm thấy vụ nuôi trong phạm vi của bạn.' };
      pondIds = [w.pondId];
      extra.push({ usageDate: { ...w.range, ...(this.dateRange(args) ?? {}) } });
    } else if (this.dateRange(args)) {
      extra.push({ usageDate: this.dateRange(args) });
    }

    const filter = this.pondFilter(args);
    if (filter || pondIds) {
      const ponds = await this.prisma.pond.findMany({
        where: {
          AND: [
            pondWhere,
            ...(filter ? [filter] : []),
            ...(pondIds ? [{ id: { in: pondIds } }] : []),
          ],
        },
        select: { id: true, name: true },
        take: 50,
      });
      if (ponds.length === 0) {
        return { totalRecords: 0, records: [], note: 'Không tìm thấy ao phù hợp' };
      }
      extra.push({
        OR: [
          { pondId: { in: ponds.map((p) => p.id) } },
          ...ponds.map((p) => ({ notes: contains(p.name) })),
        ],
      });
    } else {
      extra.push({
        OR: [
          { pondId: { not: null } },
          { notes: contains('xử lý môi trường') },
          { notes: contains('xử lý nước') },
        ],
      });
    }

    const where: Prisma.InventoryUsageLogWhereInput = { AND: [base, ...extra] };
    const [total, rows] = await Promise.all([
      this.prisma.inventoryUsageLog.count({ where }),
      this.prisma.inventoryUsageLog.findMany({
        where,
        orderBy: { usageDate: 'desc' },
        take: MAX_RECORDS,
        include: {
          inventory: { select: { itemName: true, category: true, unit: true } },
          creator: { select: { fullName: true } },
        },
      }),
    ]);

    const usedPondIds = [
      ...new Set(rows.map((r) => r.pondId).filter((id): id is string => !!id)),
    ];
    const pondNames = new Map(
      usedPondIds.length
        ? (
            await this.prisma.pond.findMany({
              where: { id: { in: usedPondIds } },
              select: { id: true, name: true },
            })
          ).map((p) => [p.id, p.name] as const)
        : [],
    );

    const totals = new Map<
      string,
      { item: string; unit: string; quantity: number; times: number }
    >();
    for (const r of rows) {
      const key = r.inventory.itemName;
      const t = totals.get(key) ?? {
        item: key,
        unit: r.inventory.unit,
        quantity: 0,
        times: 0,
      };
      t.quantity = round(t.quantity + r.quantityUsed) ?? 0;
      t.times += 1;
      totals.set(key, t);
    }

    return {
      totalsByItem: [...totals.values()],
      ...this.page(
        total,
        rows.map((r) => ({
          time: time(r.usageDate),
          pond: (r.pondId && pondNames.get(r.pondId)) || null,
          item: r.inventory.itemName,
          category: r.inventory.category,
          quantity: r.quantityUsed,
          unit: r.inventory.unit,
          note: r.notes,
          by: r.creator?.fullName ?? null,
        })),
      ),
    };
  }

  private async getTreatmentStock(scope: ChatScope, args: CommonArgs) {
    const base = this.scopeService.treatmentStockWhere(scope);
    if (!base) return this.denied();
    const farmFilter: Prisma.FarmWhereInput = {
      ...(args.farmName ? { name: contains(args.farmName) } : {}),
      ...(args.pondName
        ? { ponds: { some: { name: contains(args.pondName) } } }
        : {}),
    };
    const items = await this.prisma.inventory.findMany({
      where: {
        AND: [base, ...(Object.keys(farmFilter).length ? [{ farm: farmFilter }] : [])],
      },
      select: {
        itemName: true,
        category: true,
        quantity: true,
        unit: true,
        minThreshold: true,
        description: true,
        farm: { select: { name: true } },
      },
      orderBy: [{ category: 'asc' }, { itemName: 'asc' }],
      take: 100,
    });
    return {
      totalItems: items.length,
      items: items.map((i) => ({
        farm: i.farm?.name,
        item: i.itemName,
        category:
          i.category === 'CHEMICAL' ? 'Hóa chất / khoáng' : 'Thuốc / men vi sinh',
        stock: i.quantity,
        unit: i.unit,
        lowStock: i.quantity <= (i.minThreshold ?? 0),
        usage: i.description,
      })),
    };
  }

  private async getFarmWeather(scope: ChatScope, args: CommonArgs) {
    if (!this.scopeService.waterPondWhere(scope)) return this.denied();
    if (!this.weatherService) return { error: 'Dịch vụ thời tiết chưa sẵn sàng.' };
    const farm = await this.prisma.farm.findFirst({
      where: {
        AND: [
          this.scopeService.farmWhere(scope),
          ...(args.farmName ? [{ name: contains(args.farmName) }] : []),
          ...(args.pondName
            ? [{ ponds: { some: { name: contains(args.pondName) } } }]
            : []),
        ],
      },
      select: { name: true, location: true, address: true },
    });
    if (!farm) return { error: 'Không tìm thấy trang trại trong phạm vi của bạn.' };
    const location = farm.location || farm.address || farm.name;
    const weather = await this.weatherService.getWeather(location, location);
    if (!weather) return { error: 'Chưa lấy được dữ liệu thời tiết lúc này.' };
    return { farm: farm.name, location, weather };
  }

  private async queryHealth(scope: ChatScope, args: CommonArgs) {
    const scopeWhere = this.scopeService.healthWhere(scope);
    if (!scopeWhere) return this.denied();
    const staff = await this.staffIds(scope, args);
    const where: Prisma.ShrimpHealthRecordWhereInput = {
      AND: [
        scopeWhere,
        {
          ...(args.cropId ? { cropId: args.cropId } : {}),
          ...(this.pondFilter(args) ? { pond: this.pondFilter(args) } : {}),
          ...(this.dateRange(args) ? { recordTime: this.dateRange(args) } : {}),
          ...(staff ? { recordedBy: { in: staff } } : {}),
        },
      ],
    };

    const [total, byStatus, bySeverity, rows] = await Promise.all([
      this.prisma.shrimpHealthRecord.count({ where }),
      this.prisma.shrimpHealthRecord.groupBy({
        by: ['healthStatus'],
        where,
        _count: true,
      }),
      this.prisma.shrimpHealthRecord.groupBy({
        by: ['severity'],
        where,
        _count: true,
      }),
      this.prisma.shrimpHealthRecord.findMany({
        where,
        orderBy: { recordTime: 'desc' },
        take: MAX_RECORDS,
        include: {
          pond: { select: { name: true } },
          recorder: { select: { fullName: true } },
        },
      }),
    ]);

    return {
      summary: {
        byHealthStatus: Object.fromEntries(
          byStatus.map((s) => [s.healthStatus, s._count]),
        ),
        bySeverity: Object.fromEntries(
          bySeverity.map((s) => [s.severity, s._count]),
        ),
      },
      ...this.page(
        total,
        rows.map((r) => ({
          time: time(r.recordTime),
          pond: r.pond.name,
          cropId: r.cropId,
          healthStatus: r.healthStatus,
          severity: r.severity,
          affectedPercentage: r.affectedPercentage,
          note: r.note,
          by: r.recorder.fullName,
        })),
      ),
    };
  }

  private async queryGrowth(scope: ChatScope, args: CommonArgs) {
    const scopeWhere = this.scopeService.growthWhere(scope);
    if (!scopeWhere) return this.denied();
    const extra: Prisma.ShrimpSizeSampleWhereInput = {};
    if (args.cropId) {
      const w = await this.cropWindow(scope, args.cropId);
      if (!w) return { error: 'Không tìm thấy vụ nuôi trong phạm vi của bạn.' };
      extra.pondId = w.pondId;
      extra.samplingDate = { ...w.range, ...(this.dateRange(args) ?? {}) };
    } else if (this.dateRange(args)) {
      extra.samplingDate = this.dateRange(args);
    }
    if (this.pondFilter(args)) extra.pond = this.pondFilter(args);
    const staff = await this.staffIds(scope, args);
    if (staff) extra.createdBy = { in: staff };
    const where: Prisma.ShrimpSizeSampleWhereInput = {
      AND: [scopeWhere, extra],
    };

    const [total, rows] = await Promise.all([
      this.prisma.shrimpSizeSample.count({ where }),
      this.prisma.shrimpSizeSample.findMany({
        where,
        orderBy: { samplingDate: 'desc' },
        take: MAX_RECORDS,
        include: {
          pond: { select: { name: true } },
          creator: { select: { fullName: true } },
        },
      }),
    ]);

    return this.page(
      total,
      rows.map((r) => ({
        date: day(r.samplingDate),
        pond: r.pond.name,
        doc: r.doc,
        sampleCount: r.sampleCount,
        abwGram: num(r.abwGram),
        sizePerKg: num(r.sizePerKg),
        adgGramPerDay: num(r.adgGramPerDay),
        estimatedTotalShrimp: r.estimatedTotalShrimp,
        estimatedBiomassKg: num(r.estimatedBiomassKg),
        notes: r.notes,
        by: r.creator?.fullName ?? null,
      })),
    );
  }

  private async getFarmOverview(scope: ChatScope, args: CommonArgs) {
    if (!this.scopeService.canAccess(scope, 'FARM_INFO')) return this.denied();
    const canSeeGrowth = this.scopeService.canAccess(scope, 'GROWTH');
    const pondFilter = this.pondFilter(args);
    const farms = await this.prisma.farm.findMany({
      where: {
        AND: [
          this.scopeService.farmWhere(scope),
          ...(args.farmName ? [{ name: contains(args.farmName) }] : []),
        ],
      },
      select: {
        name: true,
        address: true,
        area: true,
        farmingModel: true,
        ponds: {
          where: pondFilter?.name ? { name: pondFilter.name } : undefined,
          select: {
            name: true,
            areaSize: true,
            depth: true,
            crops: {
              where: { status: CropStatus.ACTIVE },
              select: { startDate: true, stage: true, initialShrimpCount: true },
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
            sizeSamples: {
              orderBy: { samplingDate: 'desc' },
              take: 1,
              select: { samplingDate: true, abwGram: true, sizePerKg: true, estimatedBiomassKg: true },
            },
          },
          orderBy: { name: 'asc' },
        },
      },
      orderBy: { name: 'asc' },
      take: 20,
    });

    // Sự cố đang mở theo ao (đúng phạm vi sự cố của người dùng)
    const incidentScope = this.scopeService.incidentWhere(scope);
    const openIncidents = incidentScope
      ? await this.prisma.incident.findMany({
          where: { AND: [incidentScope, { status: { in: ['OPEN', 'TREATING'] } }] },
          select: { title: true, status: true, crop: { select: { pond: { select: { name: true, farm: { select: { name: true } } } } } } },
          take: 200,
        })
      : [];

    const now = Date.now();
    return {
      farms: farms.map((f) => ({
        farm: f.name,
        address: f.address,
        areaM2: f.area,
        farmingModel: f.farmingModel === 'TRADITIONAL' ? 'Truyền thống' : 'Công nghệ cao',
        pondCount: f.ponds.length,
        activePonds: f.ponds.filter((p) => p.crops.length > 0).length,
        ponds: f.ponds.map((p) => {
          const area = Number(p.areaSize) || 0;
          const depth = Number(p.depth) || 0;
          const crop = p.crops[0];
          const last = p.waterQualityRecords[0];
          const sample = p.sizeSamples[0];
          const incidents = openIncidents.filter(
            (i) => i.crop?.pond?.name === p.name && i.crop?.pond?.farm?.name === f.name,
          );
          return {
            pond: p.name,
            areaM2: area,
            depthM: depth,
            waterVolumeM3: round(area * depth),
            activeCrop: crop
              ? {
                  doc: Math.max(1, Math.floor((now - crop.startDate.getTime()) / 86_400_000)),
                  stage: crop.stage,
                  startDate: day(crop.startDate),
                  initialShrimpCount: crop.initialShrimpCount,
                  densityPerM2: area > 0 ? round(Number(crop.initialShrimpCount) / area, 1) : null,
                }
              : null,
            latestWater: last
              ? {
                  time: time(last.recordTime),
                  status: WATER_STATUS_LABEL[this.assess(last).overall],
                  alerts: this.assess(last).alerts,
                }
              : null,
            latestGrowthSample: sample && canSeeGrowth
              ? {
                  date: day(sample.samplingDate),
                  averageWeightG: num(sample.abwGram),
                  estimatedBiomassKg: num(sample.estimatedBiomassKg),
                  sizePerKg: num(sample.sizePerKg),
                }
              : null,
            openIncidents: incidents.map((i) => ({ title: i.title, status: i.status })),
          };
        }),
      })),
    };
  }

  private async listFarmStaff(
    scope: ChatScope,
    args: CommonArgs & { role?: 'FARM_MANAGER' | 'TECHNICIAN' | 'FARMER' },
  ) {
    const base = this.scopeService.staffWhere(scope);
    if (!base) return this.denied();
    const [staff, farms] = await Promise.all([
      this.prisma.farmStaff.findMany({
        where: {
          AND: [
            base,
            { isActive: true },
            ...(args.farmName ? [{ farm: { name: contains(args.farmName) } }] : []),
            ...(args.role ? [{ role: args.role }] : []),
          ],
        },
        select: {
          role: true,
          assignedAt: true,
          farm: { select: { name: true } },
          user: { select: { fullName: true } },
        },
        orderBy: [{ farm: { name: 'asc' } }, { role: 'asc' }],
        take: 200,
      }),
      // Chủ trang trại (quản lý) không nằm trong bảng nhân sự
      args.role && args.role !== 'FARM_MANAGER'
        ? Promise.resolve([])
        : this.prisma.farm.findMany({
            where: {
              AND: [
                this.scopeService.farmWhere(scope),
                ...(args.farmName ? [{ name: contains(args.farmName) }] : []),
              ],
            },
            select: { name: true, owner: { select: { fullName: true } } },
            take: 30,
          }),
    ]);
    const roleLabel: Record<string, string> = {
      FARM_MANAGER: 'Quản lý',
      TECHNICIAN: 'Kỹ thuật viên',
      FARMER: 'Nông dân',
    };
    return {
      owners: farms.map((f) => ({ farm: f.name, manager: f.owner?.fullName })),
      staff: staff.map((s) => ({
        farm: s.farm.name,
        name: s.user.fullName,
        role: roleLabel[s.role] ?? s.role,
        since: day(s.assignedAt),
      })),
    };
  }

  private async querySuppliers(scope: ChatScope, args: CommonArgs & { name?: string }) {
    const base = this.scopeService.supplierWhere(scope);
    if (!base) return this.denied();
    const suppliers = await this.prisma.supplier.findMany({
      where: {
        AND: [
          base,
          ...(args.farmName ? [{ farm: { name: contains(args.farmName) } }] : []),
          ...(args.name ? [{ name: contains(args.name) }] : []),
        ],
      },
      select: {
        name: true,
        phone: true,
        email: true,
        address: true,
        note: true,
        farm: { select: { name: true } },
        inventories: {
          where: { deletedAt: null },
          select: { itemName: true, category: true },
          take: 30,
        },
      },
      orderBy: { name: 'asc' },
      take: 50,
    });
    return {
      totalSuppliers: suppliers.length,
      suppliers: suppliers.map((s) => ({
        farm: s.farm.name,
        name: s.name,
        phone: s.phone,
        email: s.email,
        address: s.address,
        note: s.note,
        items: s.inventories.map((i) => i.itemName),
      })),
    };
  }

  private async queryIncidents(
    scope: ChatScope,
    args: CommonArgs & {
      status?: 'OPEN' | 'TREATING' | 'RESOLVED';
      mine?: 'ASSIGNED' | 'REPORTED';
    },
  ) {
    const scopeWhere = this.scopeService.incidentWhere(scope);
    if (!scopeWhere) return this.denied();
    const staff = await this.staffIds(scope, args);
    const where: Prisma.IncidentWhereInput = {
      AND: [
        scopeWhere,
        ...(args.mine === 'ASSIGNED' ? [{ assignedToId: scope.userId }] : []),
        ...(args.mine === 'REPORTED' ? [{ reporterId: scope.userId }] : []),
        {
          ...(args.cropId ? { cropId: args.cropId } : {}),
          ...(args.status ? { status: args.status } : {}),
          ...(this.pondFilter(args)
            ? { crop: { pond: this.pondFilter(args) } }
            : {}),
          ...(this.dateRange(args) ? { createdAt: this.dateRange(args) } : {}),
          ...(staff
            ? {
                OR: [
                  { reporterId: { in: staff } },
                  { assignedToId: { in: staff } },
                ],
              }
            : {}),
        },
      ],
    };

    const [total, byStatus, rows] = await Promise.all([
      this.prisma.incident.count({ where }),
      this.prisma.incident.groupBy({ by: ['status'], where, _count: true }),
      this.prisma.incident.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 30,
        include: {
          crop: { select: { id: true, pond: { select: { name: true } } } },
          reporter: { select: { fullName: true } },
          assignedTo: { select: { fullName: true } },
          updates: {
            orderBy: { createdAt: 'asc' },
            take: 10,
            include: { author: { select: { fullName: true } } },
          },
        },
      }),
    ]);

    return {
      summary: {
        byStatus: Object.fromEntries(byStatus.map((s) => [s.status, s._count])),
      },
      ...this.page(
        total,
        rows.map((r) => ({
          title: r.title,
          description: r.description,
          pond: r.crop.pond.name,
          cropId: r.crop.id,
          status: r.status,
          treatment: r.treatment,
          reportedAt: time(r.createdAt),
          startedAt: time(r.startedAt),
          resolvedAt: time(r.resolvedAt),
          reporter: r.reporter?.fullName ?? null,
          assignedTo: r.assignedTo?.fullName ?? null,
          history: r.updates.map((u) => ({
            at: time(u.createdAt),
            event: u.eventType,
            treatment: u.treatment,
            observation: u.observation,
            result: u.result,
            status: u.status,
            by: u.author.fullName,
          })),
        })),
      ),
    };
  }

  private async queryMortality(scope: ChatScope, args: CommonArgs) {
    const scopeWhere = this.scopeService.mortalityWhere(scope);
    if (!scopeWhere) return this.denied();
    const staff = await this.staffIds(scope, args);
    const where: Prisma.MortalityLogWhereInput = {
      AND: [
        scopeWhere,
        {
          ...(args.cropId ? { cropId: args.cropId } : {}),
          ...(this.pondFilter(args)
            ? { crop: { pond: this.pondFilter(args) } }
            : {}),
          ...(this.dateRange(args)
            ? { recordedDate: this.dateRange(args) }
            : {}),
          ...(staff ? { createdBy: { in: staff } } : {}),
        },
      ],
    };

    const [agg, rows] = await Promise.all([
      this.prisma.mortalityLog.aggregate({
        where,
        _sum: { deadQuantityPcs: true },
        _count: true,
      }),
      this.prisma.mortalityLog.findMany({
        where,
        orderBy: { recordedDate: 'desc' },
        take: MAX_RECORDS,
        include: {
          crop: { select: { pond: { select: { name: true } } } },
          creator: { select: { fullName: true } },
        },
      }),
    ]);

    return {
      summary: { totalDeadShrimp: agg._sum.deadQuantityPcs ?? 0 },
      ...this.page(
        agg._count,
        rows.map((r) => ({
          date: day(r.recordedDate),
          pond: r.crop.pond.name,
          cropId: r.cropId,
          dead: r.deadQuantityPcs,
          cause: r.cause,
          note: r.note,
          by: r.creator?.fullName ?? null,
        })),
      ),
    };
  }

  private async queryInventory(
    scope: ChatScope,
    args: CommonArgs & {
      itemName?: string;
      category?: 'FEED' | 'MEDICINE' | 'CHEMICAL';
    },
  ) {
    const scopeWhere = this.scopeService.inventoryWhere(scope);
    if (!scopeWhere) return this.denied();
    const itemWhere: Prisma.InventoryWhereInput = {
      AND: [
        scopeWhere,
        {
          ...(args.itemName ? { itemName: contains(args.itemName) } : {}),
          ...(args.category ? { category: args.category } : {}),
          ...(args.farmName ? { farm: { name: contains(args.farmName) } } : {}),
        },
      ],
    };
    const staff = await this.staffIds(scope, args);
    const usageWhere: Prisma.InventoryUsageLogWhereInput = {
      inventory: itemWhere,
      ...(args.cropId ? { cropId: args.cropId } : {}),
      ...(this.dateRange(args) ? { usageDate: this.dateRange(args) } : {}),
      ...(staff ? { createdBy: { in: staff } } : {}),
    };

    const [items, usageTotal, usage] = await Promise.all([
      this.prisma.inventory.findMany({
        where: itemWhere,
        orderBy: [{ category: 'asc' }, { itemName: 'asc' }],
        take: 60,
        select: {
          itemName: true,
          category: true,
          quantity: true,
          unit: true,
          minThreshold: true,
          farm: { select: { name: true } },
        },
      }),
      this.prisma.inventoryUsageLog.count({ where: usageWhere }),
      this.prisma.inventoryUsageLog.findMany({
        where: usageWhere,
        orderBy: { usageDate: 'desc' },
        take: MAX_RECORDS,
        include: {
          inventory: { select: { itemName: true, unit: true } },
          creator: { select: { fullName: true } },
        },
      }),
    ]);

    return {
      stock: items.map((i) => ({
        item: i.itemName,
        category: i.category,
        quantity: i.quantity,
        unit: i.unit,
        minThreshold: i.minThreshold,
        lowStock: i.quantity <= i.minThreshold,
        farm: i.farm.name,
      })),
      usage: this.page(
        usageTotal,
        usage.map((u) => ({
          date: day(u.usageDate),
          item: u.inventory.itemName,
          quantity: u.quantityUsed,
          unit: u.inventory.unit,
          cropId: u.cropId,
          notes: u.notes,
          by: u.creator?.fullName ?? null,
        })),
      ),
    };
  }
}
