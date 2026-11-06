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

export interface AgentActionDraft {
  type: 'SLOT_FILLING' | 'CONFIRM_ACTION';
  intent: 'CREATE_FARM' | 'CREATE_POND' | 'CREATE_CROP';
  collectedData: Record<string, any>;
  missingFields: string[];
  quickSuggestions?: string[];
  summary?: Record<string, string>;
  isExecuted?: boolean;
}

export interface ChatbotResponse {
  answer: string;
  sources?: ChatbotSource[];
  pondName?: string;
  sourceType?: 'LOCAL_DOCUMENT' | 'OPENAI_KNOWLEDGE' | 'HYBRID';
  hasLocalKnowledge?: boolean;
  weather?: RealtimeWeather;
  actionDraft?: AgentActionDraft;
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

export const chatbotService = {
  ask: async (
    question: string,
    pondId?: string,
    history?: Array<{ sender: 'user' | 'ai'; text: string }>,
    pendingAction?: any,
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

  executeAction: async (action: {
    intent: 'CREATE_FARM' | 'CREATE_POND' | 'CREATE_CROP';
    data: Record<string, any>;
  }): Promise<{
    success: boolean;
    message: string;
    entity: any;
    type: string;
    redirectTab?: string;
  }> => {
    const res = await apiFetch(`${apiUrl}/api/chatbot/execute-action`, {
      method: 'POST',
      body: JSON.stringify(action),
    });
    if (!res.ok) {
      let errMsg = 'Không thể thực thi hành động tạo mới';
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
