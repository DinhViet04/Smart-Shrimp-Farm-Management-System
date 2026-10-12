import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiClient } from './apiClient';

export interface ChatbotSource {
  title: string;
  chunkIndex?: number;
  snippet?: string;
  relevanceScore?: number;
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
  async ask(question: string, pondId?: string, farmId?: string): Promise<ChatbotResponse> {
    const payload: { question: string; pondId?: string; farmId?: string } = {
      question: question.trim(),
    };

    if (pondId && pondId !== 'ALL') {
      payload.pondId = pondId;
    }
    if (farmId) {
      payload.farmId = farmId;
    }

    return apiClient.post<ChatbotResponse>('/chatbot/ask', payload);
  },

  /**
   * Fetch active ponds for context selection
   */
  async getPonds(): Promise<PondOption[]> {
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
        const parsed = JSON.parse(json);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.error('Error loading chat sessions:', e);
    }
    const defaultSession = createNewSession();
    return [defaultSession];
  },

  /**
   * Save all chat sessions
   */
  async saveSessions(sessions: ChatSession[]): Promise<void> {
    try {
      await AsyncStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(sessions));
    } catch (e) {
      console.error('Error saving chat sessions:', e);
    }
  },

  /**
   * Get active session ID
   */
  async getActiveSessionId(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(ACTIVE_SESSION_STORAGE_KEY);
    } catch {
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
      console.error('Error setting active session ID:', e);
    }
  },

  /**
   * Backward compatibility: get single session history
   */
  async getLocalHistory(): Promise<ChatMessage[]> {
    const sessions = await this.getSessions();
    return sessions[0]?.messages || [];
  },

  /**
   * Backward compatibility: clear history
   */
  async clearLocalHistory(): Promise<void> {
    try {
      const fresh = createNewSession();
      await this.saveSessions([fresh]);
      await this.setActiveSessionId(fresh.id);
    } catch (e) {
      console.error('Error clearing sessions:', e);
    }
  },
};
