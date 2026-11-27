import { apiFetch } from '../utils/api';

const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export interface ChatbotSource {
  title: string;
  chunkIndex: number;
  snippet: string;
  relevanceScore: number;
}

export interface RealtimeWeather {
  cityName: string;
  temperature: number;
  feelsLike: number;
  humidity: number;
  description: string;
  windSpeed: number;
  rain1h: number;
  cloudiness?: number;
  isRaining: boolean;
  isHot: boolean;
  isCold: boolean;
  isWindy: boolean;
  provider: string;
  recordedAt: string;
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

export type AgentActionIntent =
  | 'CREATE_FARM'
  | 'CREATE_POND'
  | 'CREATE_CROP'
  | 'IMPORT_INVENTORY'
  | 'EXPORT_INVENTORY'
  | 'RECORD_WATER_QUALITY'
  | 'RECORD_FEEDING';

export type FeedingSessionKey = 'SESSION_1' | 'SESSION_2' | 'SESSION_3' | 'SESSION_4' | 'SESSION_5' | 'SESSION_6' | 'SESSION_7';
export type FeedingStatusKey = 'COMPLETED' | 'SKIPPED' | 'DELAYED';

/** Ao đang có vụ nuôi cho thẻ ghi nhật ký cho ăn (chỉ Nông dân) */
export interface FeedingPondOption {
  id: string;
  name: string;
  farmId: string;
  farmName: string;
  cropId: string;
  doc: number;
  /** Số cữ đã ghi hôm nay (không tính cữ bỏ) và tổng kg */
  todaySessions?: number;
  todayKg?: number;
}

/** Gợi ý loại thức ăn & số ký theo giai đoạn tôm (backend phân tích dữ liệu vụ nuôi) */
export interface FeedingSuggestion {
  pondId: string;
  pondName: string;
  farmName: string;
  date: string;
  doc: number;
  stage: string | null;
  abwSource: 'SAMPLE' | 'PLAN' | 'DOC_CURVE';
  abwGram: number;
  aliveCount: number;
  biomassKg: number;
  feedRatePercent: number | null;
  dailyKg: number;
  fedTodayKg: number;
  remainingKg: number;
  recentDailyAvgKg: number | null;
  recentSessionsPerDay: number | null;
  recommendedFeedSize: string;
  /** Tên giai đoạn tăng trưởng theo trọng lượng tôm */
  growthStage?: string;
  /** Thức ăn đúng cỡ / gần cỡ đang còn trong kho */
  matchingFeeds?: Array<{ id: string; name: string; stock: number; unit: string }>;
  nearFeeds?: Array<{ id: string; name: string; stock: number; unit: string }>;
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
  todayLogs: Array<{
    session: FeedingSessionKey;
    time: string;
    feedProductId: string;
    feedName: string;
    amountKg: number;
    status: FeedingStatusKey;
  }>;
  notes: string[];
  warnings: string[];
}

export interface AgentActionDraft {
  /** Mã phiếu duy nhất do backend cấp */
  draftId?: string;
  type: 'SLOT_FILLING' | 'CONFIRM_ACTION';
  intent: AgentActionIntent;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dữ liệu do AI điền, cấu trúc thay đổi theo intent
  collectedData: Record<string, any>;
  missingFields: string[];
  quickSuggestions?: string[];
  summary?: Record<string, string>;
  isExecuted?: boolean;
  inventoryItems?: InventoryParsedItem[];
  farmName?: string;
  fileName?: string;
  exportUrl?: string;
  /** Danh sách ao cho thẻ nhập thông số nước */
  pondOptions?: WaterPondOption[];
  /** Ao đang trống cho thẻ tạo vụ nuôi (chỉ Quản lý trang trại) */
  cropPondOptions?: CropPondOption[];
  /** Giá tôm giống thị trường (Tép Bạc) cho mục đơn giá giống trên thẻ tạo vụ */
  seedMarketPrice?: SeedPriceInfo;
  /** Ao (đang có vụ) cho thẻ ghi nhật ký cho ăn — chỉ Nông dân */
  feedingPondOptions?: FeedingPondOption[];
  /** Kho (trang trại) có thể chọn trên phiếu nhập kho — mỗi trang trại là một kho riêng */
  farmOptions?: Array<{ id: string; name: string }>;
}

/** Giá tôm giống thị trường gửi kèm thẻ tạo vụ (cùng nguồn với form tạo vụ thủ công) */
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

/** Ao đang trống kèm mô hình trang trại cho thẻ tạo vụ nuôi trong khung chat */
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

/** Ao kèm dữ liệu cho thẻ thông số nước trong khung chat */
export interface WaterPondOption {
  id: string;
  name: string;
  farmId?: string;
  farmName: string;
  areaSize?: number;
  depth?: number;
  waterVolume?: number;
  doc?: number | null;
  lastRecord?: ({ recordTime: string; waterColor?: string | null } & Record<string, number | string | null | undefined>) | null;
}

export interface ChatbotResponse {
  answer: string;
  sources?: ChatbotSource[];
  pondName?: string;
  sourceType?: 'LOCAL_DOCUMENT' | 'OPENAI_KNOWLEDGE' | 'HYBRID';
  hasLocalKnowledge?: boolean;
  weather?: RealtimeWeather;
  actionDraft?: AgentActionDraft;
  /** true khi agent kết thúc luồng (hủy, không đủ quyền...) -> xoá phiếu đang chờ */
  clearPendingAction?: boolean;
  poweredBy?: string;
}

export interface KnowledgeDoc {
  id: string;
  title: string;
  category: string;
  fileName?: string;
  fileSize?: number;
  content: string;
  createdAt: string;
  _count?: {
    chunks: number;
  };
}

/** Cuộc trò chuyện lưu trên server (messages giữ nguyên cấu trúc ChatMessage của khung chat) */
export interface StoredChatSession {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: unknown[];
}

export const chatHistoryService = {
  /** available=false: server chưa có bảng lịch sử -> chỉ dùng bản lưu trên trình duyệt */
  list: async (): Promise<{ available: boolean; sessions: StoredChatSession[] }> => {
    const res = await apiFetch(`${apiUrl}/api/chatbot/sessions`);
    if (!res.ok) throw new Error('Không tải được lịch sử trò chuyện');
    return res.json();
  },
  save: async (session: StoredChatSession): Promise<void> => {
    const res = await apiFetch(`${apiUrl}/api/chatbot/sessions/${encodeURIComponent(session.id)}`, {
      method: 'PUT',
      body: JSON.stringify({
        title: session.title,
        messages: session.messages,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
      }),
    });
    if (!res.ok) throw new Error('Không lưu được cuộc trò chuyện');
  },
  remove: async (id: string): Promise<void> => {
    await apiFetch(`${apiUrl}/api/chatbot/sessions/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },
  clear: async (): Promise<void> => {
    await apiFetch(`${apiUrl}/api/chatbot/sessions`, { method: 'DELETE' });
  },
};

export const chatbotService = {
  ask: async (
    question: string,
    pondId?: string,
    history?: Array<{ sender: 'user' | 'ai'; text: string }>,
    pendingAction?: AgentActionDraft | null,
  ): Promise<ChatbotResponse> => {
    const res = await apiFetch(`${apiUrl}/api/chatbot/ask`, {
      method: 'POST',
      body: JSON.stringify({ question, pondId, history, pendingAction }),
    });
    if (!res.ok) {
      let errMsg = 'Không thể kết nối đến Trợ lý AI';
      try {
        const errJson = await res.json();
        if (errJson?.message) {
          errMsg = Array.isArray(errJson.message) ? errJson.message.join(', ') : errJson.message;
        }
      } catch {
        if (res.status === 403) errMsg = 'Bạn không có quyền truy cập dữ liệu trang trại/ao nuôi này';
        else if (res.status === 429) errMsg = 'Đã vượt quá số lượt hỏi AI cho phép trong 1 phút. Vui lòng chờ giây lát';
        else if (res.status === 504) errMsg = 'Dịch vụ AI phản hồi quá lâu (Timeout). Vui lòng thử lại';
      }
      throw new Error(errMsg);
    }
    return res.json();
  },

  /**
   * Tải tệp (Excel, PDF, Word) lên để AI phân tích và chuẩn bị lệnh nhập kho
   */
  uploadAndParse: async (
    file: File,
    question?: string,
    history?: Array<{ sender: 'user' | 'ai'; text: string }>,
  ): Promise<ChatbotResponse> => {
    const formData = new FormData();
    formData.append('file', file);
    if (question) formData.append('question', question);
    if (history) formData.append('history', JSON.stringify(history));

    const res = await apiFetch(`${apiUrl}/api/chatbot/upload-and-parse`, {
      method: 'POST',
      body: formData,
    });

    if (!res.ok) {
      let errMsg = 'Không thể tải và phân tích tệp';
      try {
        const errJson = await res.json();
        if (errJson?.message) {
          errMsg = Array.isArray(errJson.message) ? errJson.message.join(', ') : errJson.message;
        }
      } catch {
        if (res.status === 401) errMsg = 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại';
        else if (res.status === 403) errMsg = 'Chỉ Quản lý Trang trại hoặc Quản trị viên mới có quyền tải tệp lên';
        else if (res.status === 413) errMsg = 'Kích thước tệp quá lớn (tối đa 15MB)';
      }
      throw new Error(errMsg);
    }
    return res.json();
  },

  getInventoryExportUrl: (farmId: string): string => {
    return `${apiUrl}/api/chatbot/export/inventory/${farmId}`;
  },

  getFeedingSuggestion: async (pondId: string, date?: string): Promise<FeedingSuggestion> => {
    const query = new URLSearchParams({ pondId });
    if (date) query.set('date', date);
    const res = await apiFetch(`${apiUrl}/api/chatbot/feeding-suggestion?${query.toString()}`);
    if (!res.ok) {
      let errMsg = 'Không tải được gợi ý cho ăn';
      try {
        const errJson = await res.json();
        if (errJson?.message) errMsg = Array.isArray(errJson.message) ? errJson.message.join(', ') : errJson.message;
      } catch {
        /* giữ thông báo mặc định */
      }
      throw new Error(errMsg);
    }
    return res.json();
  },

  executeAction: async (action: {
    intent: AgentActionIntent;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dữ liệu do AI điền, cấu trúc thay đổi theo intent
    data: Record<string, any>;
    /** Mã phiếu: backend chỉ thực thi mỗi phiếu 1 lần */
    draftId?: string;
  }): Promise<{
    success: boolean;
    message: string;
    entity: unknown;
    type: string;
    redirectTab?: string;
    /** Phiếu đã được thực thi trước đó (bấm lặp / tab khác) -> không tạo thêm */
    alreadyExecuted?: boolean;
  }> => {
    const res = await apiFetch(`${apiUrl}/api/chatbot/execute-action`, {
      method: 'POST',
      body: JSON.stringify(action),
    });
    if (!res.ok) {
      let errMsg = 'Không thể thực thi hành động';
      try {
        const errJson = await res.json();
        if (errJson?.message) {
          errMsg = Array.isArray(errJson.message) ? errJson.message.join(', ') : errJson.message;
        }
      } catch {
        /* ignore */
      }
      throw new Error(errMsg);
    }
    return res.json();
  },

  getDocuments: async (): Promise<KnowledgeDoc[]> => {
    const res = await apiFetch(`${apiUrl}/api/chatbot/documents`);
    if (!res.ok) throw new Error('Không thể tải danh sách tài liệu tri thức');
    return res.json();
  },

  createDocument: async (data: {
    title: string;
    category?: string;
    content: string;
    fileName?: string;
  }): Promise<{ message: string; documentId: string }> => {
    const res = await apiFetch(`${apiUrl}/api/chatbot/documents`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    const resData = await res.json();
    if (!res.ok) throw new Error(resData.message || 'Lỗi khi lưu tài liệu');
    return resData;
  },

  deleteDocument: async (id: string): Promise<{ message: string }> => {
    const res = await apiFetch(`${apiUrl}/api/chatbot/documents/${id}`, {
      method: 'DELETE',
    });
    const resData = await res.json();
    if (!res.ok) throw new Error(resData.message || 'Lỗi khi xóa tài liệu');
    return resData;
  },
};
