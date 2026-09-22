import { apiFetch } from '../utils/api';

const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export interface ChatbotSource {
  title: string;
  chunkIndex: number;
  snippet: string;
  relevanceScore: number;
}

export interface ChatbotResponse {
  answer: string;
  sources?: ChatbotSource[];
  pondName?: string;
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
  ask: async (question: string, pondId?: string): Promise<ChatbotResponse> => {
    const res = await apiFetch(`${apiUrl}/api/chatbot/ask`, {
      method: 'POST',
      body: JSON.stringify({ question, pondId }),
    });
    if (!res.ok) throw new Error('Không thể kết nối đến Trợ lý AI');
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
