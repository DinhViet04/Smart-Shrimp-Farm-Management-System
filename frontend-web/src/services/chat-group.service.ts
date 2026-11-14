import { apiFetch } from '../utils/api';

const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export interface ChatMemberItem {
  id: string;
  userId: string;
  role: 'FARM_MANAGER' | 'FARMER' | 'TECHNICIAN';
  joinedAt: string;
  lastDeliveredAt?: string | null;
  lastReadAt?: string | null;
  user?: {
    id: string;
    fullName: string;
    email: string;
    role: string;
    avatarUrl?: string;
    phone?: string;
  };
}

export interface ChatAttachment {
  attachmentUrl: string;
  attachmentName: string;
  attachmentType: string;
  attachmentSize: number;
}

export interface ChatReplyPreview {
  id: string;
  content: string;
  attachmentName?: string | null;
  attachmentType?: string | null;
  senderId?: string | null;
  sender?: {
    id: string;
    fullName: string;
  } | null;
}

export interface ChatMessageItem {
  id: string;
  groupId: string;
  senderId: string;
  content: string;
  attachmentUrl?: string | null;
  attachmentName?: string | null;
  attachmentType?: string | null;
  attachmentSize?: number | null;
  replyToId?: string | null;
  replyTo?: ChatReplyPreview | null;
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
  type?: 'FARM_GROUP' | 'DIRECT';
  farmId: string | null;
  directKey?: string | null;
  name: string;
  createdAt: string;
  updatedAt: string;
  farm?: {
    id: string;
    name: string;
    address: string;
    status: string;
    ownerId: string;
  } | null;
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
    attachment?: ChatAttachment,
    replyToId?: string,
  ): Promise<ChatMessageItem> => {
    const response = await apiFetch(
      `${apiUrl}/api/chat-groups/${groupId}/messages`,
      {
        method: 'POST',
        body: JSON.stringify({
          content,
          ...(attachment || {}),
          ...(replyToId ? { replyToId } : {}),
        }),
      },
    );
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || 'Không thể gửi tin nhắn');
    }
    return data;
  },

  uploadAttachment: async (
    groupId: string,
    file: File,
  ): Promise<ChatAttachment> => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await apiFetch(
      `${apiUrl}/api/chat-groups/${groupId}/attachments`,
      {
        method: 'POST',
        body: formData,
      },
    );
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || 'Không thể tải tệp đính kèm');
    }
    return data;
  },

  startDirectChat: async (targetUserId: string): Promise<ChatGroupItem> => {
    const response = await apiFetch(`${apiUrl}/api/chat-groups/direct`, {
      method: 'POST',
      body: JSON.stringify({ targetUserId }),
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || 'Không thể mở cuộc trò chuyện riêng');
    }
    return data;
  },
};

