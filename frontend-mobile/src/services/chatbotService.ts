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
  type: 'SLOT_FILLING' | 'CONFIRM_ACTION';
  intent: 'CREATE_FARM' | 'CREATE_POND' | 'CREATE_CROP';
  collectedData: Record<string, any>;
  missingFields: string[];
  quickSuggestions?: string[];
  summary?: Record<string, string>;
  isExecuted?: boolean;
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
}

export interface PondOption {
  id: string;
  name: string;
  farmId?: string;
}

const SESSIONS_STORAGE_KEY = '@ssfm_ai_chatgpt_sessions_v2';
const ACTIVE_SESSION_STORAGE_KEY = '@ssfm_ai_active_session_id_v2';

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
    intent: 'CREATE_FARM' | 'CREATE_POND' | 'CREATE_CROP';
    data: Record<string, any>;
  }): Promise<{
    success: boolean;
    message: string;
    entity: any;
    type: string;
    redirectTab?: string;
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
      const json = await AsyncStorage.getItem(SESSIONS_STORAGE_KEY);
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
      await AsyncStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(sessions));
    } catch (e) {
      console.error('Error saving chat sessions', e);
    }
  },

  /**
   * Get active session ID
   */
  async getActiveSessionId(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(ACTIVE_SESSION_STORAGE_KEY);
    } catch (e) {
      return null;
    }
  },

  /**
   * Set active session ID
   */
  async setActiveSessionId(id: string): Promise<void> {
    try {
      await AsyncStorage.setItem(ACTIVE_SESSION_STORAGE_KEY, id);
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
