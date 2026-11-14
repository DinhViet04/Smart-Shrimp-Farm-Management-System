import { useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';

const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';

/**
 * Đếm số cuộc trò chuyện (groupId) có tin nhắn mới chưa đọc khi người dùng
 * đang ở ngoài tab Nhóm Chat.
 */
export function useUnreadChatConversations(isChatTabOpen: boolean) {
  const [unreadGroupIds, setUnreadGroupIds] = useState<string[]>([]);
  const isChatOpenRef = useRef(isChatTabOpen);

  useEffect(() => {
    isChatOpenRef.current = isChatTabOpen;
    if (isChatTabOpen) {
      setUnreadGroupIds((prev) => (prev.length === 0 ? prev : []));
    }
  }, [isChatTabOpen]);

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    const rawUser = localStorage.getItem('user');
    let currentUserId: string | null = null;
    try {
      const parsed = rawUser ? JSON.parse(rawUser) : null;
      currentUserId = parsed?.id || parsed?.userId || null;
    } catch {
      currentUserId = null;
    }

    if (!currentUserId || !token) return;

    const socket: Socket = io(`${apiUrl}/notifications`, {
      query: { userId: currentUserId },
      auth: (cb) => {
        cb({ token: localStorage.getItem('accessToken') });
      },
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    socket.on(
      'newChatMessage',
      (msg: { groupId?: string; senderId?: string }) => {
        if (!msg?.groupId || msg.senderId === currentUserId) return;
        if (isChatOpenRef.current) return;
        setUnreadGroupIds((prev) =>
          prev.includes(msg.groupId!) ? prev : [...prev, msg.groupId!],
        );
      },
    );

    return () => {
      socket.disconnect();
    };
  }, []);

  return unreadGroupIds.length;
}

