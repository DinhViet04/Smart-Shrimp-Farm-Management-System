import { apiClient } from './apiClient';

export interface MobileChatMember {
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

export interface MobileChatMessage {
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

export interface MobileChatGroup {
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
  ): Promise<MobileChatMessage> {
    return apiClient.post<MobileChatMessage>(
      `/chat-groups/${groupId}/messages`,
      { content },
    );
  },
};

