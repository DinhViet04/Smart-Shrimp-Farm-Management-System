import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiClient } from './apiClient';
import { pondService } from './pondService';

export interface ChatbotSource {
  title: string;
  chunkIndex?: number;
  snippet?: string;
  relevanceScore?: number;
}

export interface AgentActionDraft {
  /** Mã phiếu duy nhất do backend cấp */
  draftId?: string;
  type: 'SLOT_FILLING' | 'CONFIRM_ACTION';
  intent: 'CREATE_FARM' | 'CREATE_POND' | 'CREATE_CROP' | 'RECORD_WATER_QUALITY';
  collectedData: Record<string, any>;
  missingFields: string[];
  quickSuggestions?: string[];
  summary?: Record<string, string>;
  isExecuted?: boolean;
  /** Danh sách ao cho thẻ nhập thông số nước */
  pondOptions?: WaterPondOption[];
  /** Ao đang trống cho thẻ tạo vụ nuôi (chỉ Quản lý trang trại) */
  cropPondOptions?: CropPondOption[];
  /** Giá tôm giống thị trường (Tép Bạc) cho mục đơn giá giống trên thẻ tạo vụ */
  seedMarketPrice?: SeedPriceInfo;
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

export interface ChatMessage {
  id: string;
  sender: 'ai' | 'user' | 'bot';
  text: string;
  time: string;
  timestamp?: number;
  pondId?: string;
  pondName?: string;
  sources?: (ChatbotSource | string)[];
  recommendations?: string[];
  poweredBy?: string;
  isError?: boolean;
  actionDraft?: AgentActionDraft;
  /** Tin nhắn kết thúc phiếu đang chờ (hủy, không đủ quyền...) -> khóa các phiếu trước đó */
  endsPendingAction?: boolean;
}

export interface ChatSession {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
}

export interface ChatbotResponse {
  answer: string;
  sources?: (ChatbotSource | string)[];
  pondName?: string;
  recommendations?: string[];
  poweredBy?: string;
  actionDraft?: AgentActionDraft;
  /** true khi agent kết thúc luồng (hủy, không đủ quyền...) -> xoá phiếu đang chờ */
  clearPendingAction?: boolean;
}

export interface PondOption {
  id: string;
  name: string;
  farmId?: string;
}

// Lịch sử chat được lưu RIÊNG theo từng tài khoản (khóa gắn với userId)
const SESSIONS_STORAGE_PREFIX = '@ssfm_ai_chatgpt_sessions_v3';
const ACTIVE_SESSION_STORAGE_PREFIX = '@ssfm_ai_active_session_id_v3';
// Khóa cũ dùng chung cho mọi tài khoản -> xóa để không lộ lịch sử chat giữa các tài khoản
const LEGACY_SHARED_KEYS = ['@ssfm_ai_chatgpt_sessions_v2', '@ssfm_ai_active_session_id_v2'];

const getStorageKeys = async () => {
  const userId = (await AsyncStorage.getItem('userId')) || 'guest';
  return {
    sessions: `${SESSIONS_STORAGE_PREFIX}:${userId}`,
    active: `${ACTIVE_SESSION_STORAGE_PREFIX}:${userId}`,
  };
};

export const createNewSession = (title = 'Cuộc trò chuyện mới'): ChatSession => {
  const now = new Date();
  return {
    id: `session-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    title,
    createdAt: now.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }),
    updatedAt: now.toISOString(),
    messages: [
      {
        id: 'welcome-chatgpt',
        sender: 'ai',
        text: 'Tôi có thể giúp gì cho vụ nuôi tôm của bạn hôm nay?',
        time: now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
        timestamp: Date.now(),
      },
    ],
  };
};

export const chatbotService = {
  /**
   * Send question to AI RAG backend
   */
  async ask(
    question: string,
    pondId?: string,
    farmId?: string,
    history?: Array<{ sender: 'user' | 'ai'; text: string }>,
    pendingAction?: any,
  ): Promise<ChatbotResponse> {
    const payload: {
      question: string;
      pondId?: string;
      farmId?: string;
      history?: Array<{ sender: 'user' | 'ai'; text: string }>;
      pendingAction?: any;
    } = {
      question: question.trim(),
    };

    if (pondId && pondId !== 'ALL') {
      payload.pondId = pondId;
    }
    if (farmId) {
      payload.farmId = farmId;
    }
    if (history) {
      payload.history = history;
    }
    if (pendingAction) {
      payload.pendingAction = pendingAction;
    }

    return apiClient.post<ChatbotResponse>('/chatbot/ask', payload);
  },

  /**
   * Thực thi hành động do AI đề xuất sau khi người dùng xác nhận
   */
  async executeAction(action: {
    intent: 'CREATE_FARM' | 'CREATE_POND' | 'CREATE_CROP' | 'RECORD_WATER_QUALITY';
    data: Record<string, any>;
    /** Mã phiếu: backend chỉ thực thi mỗi phiếu 1 lần */
    draftId?: string;
  }): Promise<{
    success: boolean;
    message: string;
    entity: any;
    type: string;
    redirectTab?: string;
    /** Phiếu đã được thực thi trước đó (bấm lặp / thiết bị khác) -> không tạo thêm */
    alreadyExecuted?: boolean;
  }> {
    return apiClient.post('/chatbot/execute-action', action);
  },

  /**
   * Fetch active ponds for context selection
   */
  async getPonds(): Promise<PondOption[]> {
    try {
      const overview = await pondService.getOverview();
      if (Array.isArray(overview?.ponds) && overview.ponds.length > 0) {
        return overview.ponds.map((p) => ({
          id: p.id,
          name: p.name,
          farmId: p.farmId,
        }));
      }
    } catch {
      // Fallback to /ponds below
    }

    try {
      const response = await apiClient.get<any[]>('/ponds');
      if (Array.isArray(response)) {
        return response.map((p) => ({
          id: p.id,
          name: p.name,
          farmId: p.farmId,
        }));
      }
      return [];
    } catch (error) {
      console.warn('Failed to load ponds list for chatbot context:', error);
      return [];
    }
  },

  /**
   * Load all chat sessions
   */
  async getSessions(): Promise<ChatSession[]> {
    try {
      await AsyncStorage.multiRemove(LEGACY_SHARED_KEYS);
      const json = await AsyncStorage.getItem((await getStorageKeys()).sessions);
      if (json) {
        return JSON.parse(json);
      }
    } catch (e) {
      console.error('Error loading chat sessions', e);
    }
    const defaultSession = createNewSession();
    await this.saveSessions([defaultSession]);
    return [defaultSession];
  },

  /**
   * Save all chat sessions
   */
  async saveSessions(sessions: ChatSession[]): Promise<void> {
    try {
      await AsyncStorage.setItem((await getStorageKeys()).sessions, JSON.stringify(sessions));
    } catch (e) {
      console.error('Error saving chat sessions', e);
    }
  },

  /**
   * Get active session ID
   */
  async getActiveSessionId(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem((await getStorageKeys()).active);
    } catch (e) {
      return null;
    }
  },

  /**
   * Set active session ID
   */
  async setActiveSessionId(id: string): Promise<void> {
    try {
      await AsyncStorage.setItem((await getStorageKeys()).active, id);
    } catch (e) {
      console.error('Error setting active session ID', e);
    }
  },

  /**
   * Delete a session
   */
  async deleteSession(sessionId: string): Promise<ChatSession[]> {
    const sessions = await this.getSessions();
    const filtered = sessions.filter((s) => s.id !== sessionId);
    if (filtered.length === 0) {
      const newDef = createNewSession();
      await this.saveSessions([newDef]);
      await this.setActiveSessionId(newDef.id);
      return [newDef];
    }
    await this.saveSessions(filtered);
    const activeId = await this.getActiveSessionId();
    if (activeId === sessionId) {
      await this.setActiveSessionId(filtered[0].id);
    }
    return filtered;
  },
};
