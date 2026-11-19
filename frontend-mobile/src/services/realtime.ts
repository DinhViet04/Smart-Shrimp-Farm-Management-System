import AsyncStorage from '@react-native-async-storage/async-storage';
import { io, Socket } from 'socket.io-client';
import { API_BASE_URL } from '../config/api';

/** Tên các nhóm dữ liệu backend phát qua sự kiện `dataChanged`. */
export type RealtimeResource =
  | 'farms'
  | 'ponds'
  | 'crops'
  | 'environment'
  | 'water-quality'
  | 'incidents'
  | 'inventory'
  | 'suppliers'
  | 'farm-staffs'
  | 'feeding-logs'
  | 'shrimp-health'
  | 'shrimp-size'
  | 'survival-rate'
  | 'notifications'
  | 'users'
  | 'workspaces'
  | 'market-prices'
  | 'knowledge';

export interface DataChangedEvent {
  resource: RealtimeResource;
  resources: RealtimeResource[];
  action: 'created' | 'updated' | 'deleted';
  farmId?: string | null;
  entityId?: string | null;
  actorId?: string | null;
  at: string;
}

type Listener = (event: DataChangedEvent) => void;
type ReconnectListener = () => void;

let socket: Socket | null = null;
let socketToken: string | null = null;
let hasConnectedOnce = false;
const listeners = new Set<Listener>();
const reconnectListeners = new Set<ReconnectListener>();

function ensureSocket(token: string): Socket {
  // Đổi tài khoản → mở kết nối mới.
  if (socket && socketToken !== token) {
    socket.disconnect();
    socket = null;
  }
  if (socket) return socket;

  socketToken = token;
  hasConnectedOnce = false;
  socket = io(`${API_BASE_URL}/notifications`, {
    // Luôn đọc token mới nhất (apiClient có thể đã refresh token).
    auth: cb => {
      AsyncStorage.getItem('userToken')
        .then(latest => cb({ token: latest || token }))
        .catch(() => cb({ token }));
    },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10000,
  });

  socket.on('connect', () => {
    // Có thể đã bỏ lỡ sự kiện khi mất mạng → yêu cầu các màn hình tải lại.
    if (hasConnectedOnce) reconnectListeners.forEach(fn => fn());
    hasConnectedOnce = true;
  });
  const dispatch = (event: DataChangedEvent) => {
    listeners.forEach(fn => {
      try {
        fn(event);
      } catch (err) {
        console.warn('[realtime] listener error', err);
      }
    });
  };
  socket.on('dataChanged', dispatch);
  // Thông báo mới được server đẩy riêng → quy về resource 'notifications'.
  socket.on('newNotification', () =>
    dispatch({
      resource: 'notifications',
      resources: ['notifications'],
      action: 'created',
      at: new Date().toISOString(),
    }),
  );

  return socket;
}

/** Đăng ký nhận sự kiện thay đổi dữ liệu. Trả về hàm hủy đăng ký. */
export function subscribeDataChanged(
  token: string,
  listener: Listener,
  onReconnect?: ReconnectListener,
): () => void {
  ensureSocket(token);
  listeners.add(listener);
  if (onReconnect) reconnectListeners.add(onReconnect);
  return () => {
    listeners.delete(listener);
    if (onReconnect) reconnectListeners.delete(onReconnect);
    if (listeners.size === 0) disconnectRealtime();
  };
}

/** Đóng kết nối realtime (gọi khi đăng xuất). */
export function disconnectRealtime() {
  if (socket) {
    socket.disconnect();
    socket = null;
    socketToken = null;
  }
}
