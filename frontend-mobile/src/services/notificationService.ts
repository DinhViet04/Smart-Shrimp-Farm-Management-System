import { apiClient } from './apiClient';

export interface AppNotification {
  id: string;
  farmId?: string;
  userId?: string;
  pondId?: string;
  level: 'INFO' | 'WARNING' | 'DANGER';
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export const notificationService = {
  /**
   * Fetch user notifications
   */
  async getNotifications(): Promise<AppNotification[]> {
    try {
      const response = await apiClient.get<any>('/notifications');
      if (Array.isArray(response)) return response;
      if (response && Array.isArray(response.notifications)) return response.notifications;
      return [];
    } catch (e) {
      console.warn('Error loading notifications:', e);
      return [];
    }
  },

  /**
   * Get unread notification count
   */
  async getUnreadCount(): Promise<number> {
    try {
      const response = await apiClient.get<{ count: number }>('/notifications/unread-count');
      return response?.count || 0;
    } catch {
      return 0;
    }
  },

  /**
   * Mark a single notification as read
   */
  async markAsRead(id: string): Promise<void> {
    try {
      await apiClient.put(`/notifications/${id}/read`);
    } catch (e) {
      console.warn('Error marking notification as read:', e);
    }
  },

  /**
   * Mark all notifications as read
   */
  async markAllAsRead(): Promise<void> {
    try {
      await apiClient.put('/notifications/read-all');
    } catch (e) {
      console.warn('Error marking all notifications as read:', e);
    }
  },

  /**
   * Delete a single notification
   */
  async deleteNotification(id: string): Promise<void> {
    try {
      await apiClient.delete(`/notifications/${id}`);
    } catch (e) {
      console.warn('Error deleting notification:', e);
    }
  },

  /**
   * Clear all notifications
   */
  async clearAll(): Promise<void> {
    try {
      await apiClient.delete('/notifications');
    } catch (e) {
      console.warn('Error clearing notifications:', e);
    }
  },
};
