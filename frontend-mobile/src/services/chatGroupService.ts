import { apiClient } from './apiClient';
import { API_ENDPOINT } from '../config/api';

export interface MobileChatAttachment {
  attachmentUrl: string;
  attachmentName: string;
  attachmentType: string;
  attachmentSize: number;
}

export interface MobileChatMember {
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

export interface MobileChatReplyPreview {
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

export interface MobileChatMessage {
  id: string;
  groupId: string;
  senderId: string;
  content: string;
  attachmentUrl?: string | null;
  attachmentName?: string | null;
  attachmentType?: string | null;
  attachmentSize?: number | null;
  replyToId?: string | null;
  replyTo?: MobileChatReplyPreview | null;
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

export interface MobileChatGroup {
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
  members?: MobileChatMember[];
  messages?: MobileChatMessage[];
  _count?: {
    members: number;
    messages: number;
  };
}

export const chatGroupService = {
  async getGroups(): Promise<MobileChatGroup[]> {
    return apiClient.get<MobileChatGroup[]>('/chat-groups');
  },

  async getMessages(groupId: string): Promise<MobileChatMessage[]> {
    return apiClient.get<MobileChatMessage[]>(
      `/chat-groups/${groupId}/messages`,
    );
  },

  async sendMessage(
    groupId: string,
    content: string,
    attachment?: MobileChatAttachment,
    replyToId?: string,
  ): Promise<MobileChatMessage> {
    return apiClient.post<MobileChatMessage>(
      `/chat-groups/${groupId}/messages`,
      {
        content,
        ...(attachment || {}),
        ...(replyToId ? { replyToId } : {}),
      },
    );
  },

  async uploadAttachment(
    groupId: string,
    file: { uri: string; name: string; type: string },
    token: string,
  ): Promise<MobileChatAttachment> {
    const formData = new FormData();
    formData.append('file', {
      uri: file.uri,
      name: file.name,
      type: file.type,
    } as any);

    const response = await fetch(
      `${API_ENDPOINT}/chat-groups/${groupId}/attachments`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      },
    );
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data?.message || 'Không thể tải tệp đính kèm');
    }
    return data;
  },

  async startDirectChat(targetUserId: string): Promise<MobileChatGroup> {
    return apiClient.post<MobileChatGroup>('/chat-groups/direct', {
      targetUserId,
    });
  },
};

