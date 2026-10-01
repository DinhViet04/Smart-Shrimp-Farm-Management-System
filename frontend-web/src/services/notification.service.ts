import { apiFetch } from '../utils/api.js';

export const notificationService = {
  getNotifications: async () => {
    const res = await apiFetch('/api/notifications');
    if (!res.ok) throw new Error('Failed to fetch notifications');
    return res.json();
  },
  getUnreadCount: async () => {
    const res = await apiFetch('/api/notifications/unread-count');
    if (!res.ok) throw new Error('Failed to fetch unread count');
    return res.json();
  },
  markAsRead: async (id: string) => {
    const res = await apiFetch(`/api/notifications/${id}/read`, {
      method: 'PUT',
    });
    if (!res.ok) throw new Error('Failed to mark as read');
    return res.json();
  },
  markAllAsRead: async () => {
    const res = await apiFetch('/api/notifications/read-all', {
      method: 'PUT',
    });
    if (!res.ok) throw new Error('Failed to mark all as read');
    return res.json();
  },
  deleteNotification: async (id: string) => {
    const res = await apiFetch(`/api/notifications/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to delete notification');
    return res.json();
  },
  clearAllNotifications: async () => {
    const res = await apiFetch('/api/notifications', {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to clear notifications');
    return res.json();
  },
};
