import { apiFetch } from '../utils/api';

const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export interface ChatMemberItem {
  id: string;
  userId: string;
  role: 'FARM_MANAGER' | 'FARMER' | 'TECHNICIAN';
  joinedAt: string;
  user?: {
    id: string;
    fullName: string;
    email: string;
    role: string;
    avatarUrl?: string;
    phone?: string;
  };
}

export interface ChatMessageItem {
  id: string;
  groupId: string;
  senderId: string;
  content: string;
  isSystem: boolean;
  createdAt: string;
  sender?: {
    id: string;
    fullName: string;
    email: string;
    role: string;
    avatarUrl?: string;
  };
}

export interface ChatGroupItem {
  id: string;
  farmId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  farm?: {
    id: string;
    name: string;
    address: string;
    status: string;
    ownerId: string;
  };
  members?: ChatMemberItem[];
  messages?: ChatMessageItem[];
  _count?: {
    members: number;
    messages: number;
  };
}

export const chatGroupService = {
  getGroups: async (): Promise<ChatGroupItem[]> => {
    const response = await apiFetch(`${apiUrl}/api/chat-groups`);
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || 'Không thể tải danh sách nhóm chat');
    }
    return data;
  },

  getMessages: async (groupId: string): Promise<ChatMessageItem[]> => {
    const response = await apiFetch(
      `${apiUrl}/api/chat-groups/${groupId}/messages`,
    );
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || 'Không thể tải tin nhắn nhóm');
    }
    return data;
  },

  sendMessage: async (
    groupId: string,
    content: string,
  ): Promise<ChatMessageItem> => {
    const response = await apiFetch(
      `${apiUrl}/api/chat-groups/${groupId}/messages`,
      {
        method: 'POST',
        body: JSON.stringify({ content }),
      },
    );
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || 'Không thể gửi tin nhắn');
    }
    return data;
  },
};

