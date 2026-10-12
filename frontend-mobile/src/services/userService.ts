import { apiClient } from './apiClient';

export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  role: 'ADMIN' | 'FARM_MANAGER' | 'TECHNICIAN' | 'FARMER';
  phone?: string;
  address?: string;
  avatarUrl?: string;
  status?: string;
  createdAt?: string;
}

export interface UpdateProfilePayload {
  fullName: string;
  phone?: string;
  address?: string;
  avatarUrl?: string;
}

export interface ChangePasswordPayload {
  currentPassword?: string;
  newPassword: string;
  confirmPassword: string;
}

export const userService = {
  /**
   * Get currently logged-in user profile
   */
  async getProfile(): Promise<UserProfile> {
    return apiClient.get<UserProfile>('/users/profile');
  },

  /**
   * Update profile info (fullName, phone, address, avatarUrl)
   */
  async updateProfile(payload: UpdateProfilePayload): Promise<UserProfile> {
    return apiClient.patch<UserProfile>('/users/profile', payload);
  },

  /**
   * Change account password
   */
  async changePassword(payload: ChangePasswordPayload): Promise<{ message: string }> {
    return apiClient.patch<{ message: string }>('/users/password', payload);
  },
};
