import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { AuthContext } from '../context/AuthContext';
import { API_BASE_URL } from '../config/api';

/**
 * Đếm số cuộc trò chuyện (groupId) có tin nhắn mới chưa đọc khi người dùng
 * đang ở ngoài tab Nhóm Chat trên Mobile.
 */
export function useUnreadChatConversations() {
  const { userId, userToken } = useContext(AuthContext);
  const [unreadGroupIds, setUnreadGroupIds] = useState<string[]>([]);
  const isChatOpenRef = useRef(false);
  const userTokenRef = useRef<string | null>(userToken);

  useEffect(() => {
    userTokenRef.current = userToken;
  }, [userToken]);

  const setChatOpen = useCallback((open: boolean) => {
    isChatOpenRef.current = open;
    if (open) {
      setUnreadGroupIds(prev => (prev.length === 0 ? prev : []));
    }
  }, []);

  useEffect(() => {
    if (!userId || !userToken) return;

    const socket: Socket = io(`${API_BASE_URL}/notifications`, {
      query: { userId },
      auth: cb => {
        cb({ token: userTokenRef.current || userToken });
      },
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    socket.on(
      'newChatMessage',
      (msg: { groupId?: string; senderId?: string }) => {
        if (!msg?.groupId || msg.senderId === userId) return;
        if (isChatOpenRef.current) return;
        setUnreadGroupIds(prev =>
          prev.includes(msg.groupId!) ? prev : [...prev, msg.groupId!],
        );
      },
    );

    return () => {
      socket.disconnect();
    };
  }, [userId, userToken]);

  return {
    unreadConversationCount: unreadGroupIds.length,
    setChatOpen,
  };
}

