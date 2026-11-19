import { io, type Socket } from 'socket.io-client';

const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';

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

const getToken = () =>
  localStorage.getItem('accessToken') || localStorage.getItem('token');

let socket: Socket | null = null;
let socketToken: string | null = null;
let hasConnectedOnce = false;
const listeners = new Set<Listener>();
const reconnectListeners = new Set<ReconnectListener>();

function ensureSocket(): Socket | null {
  const token = getToken();
  if (!token) return null;

  // Người dùng khác đăng nhập → tạo kết nối mới với token mới.
  if (socket && socketToken !== token && !socket.connected) {
    socket.disconnect();
    socket = null;
  }
  if (socket) return socket;

  socketToken = token;
  hasConnectedOnce = false;
  socket = io(`${apiUrl}/notifications`, {
    auth: (cb) => cb({ token: getToken() }),
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10000,
  });

  socket.on('connect', () => {
    // Sau khi mất kết nối, dữ liệu có thể đã đổi → yêu cầu các màn hình tải lại.
    if (hasConnectedOnce) reconnectListeners.forEach((fn) => fn());
    hasConnectedOnce = true;
  });
  socket.on('dataChanged', (event: DataChangedEvent) => {
    listeners.forEach((fn) => {
      try {
        fn(event);
      } catch (err) {
        console.error('[realtime] listener error', err);
      }
    });
  });

  return socket;
}

/** Đăng ký nhận sự kiện thay đổi dữ liệu. Trả về hàm hủy đăng ký. */
export function subscribeDataChanged(
  listener: Listener,
  onReconnect?: ReconnectListener,
): () => void {
  ensureSocket();
  listeners.add(listener);
  if (onReconnect) reconnectListeners.add(onReconnect);
  return () => {
    listeners.delete(listener);
    if (onReconnect) reconnectListeners.delete(onReconnect);
    if (listeners.size === 0 && socket) {
      socket.disconnect();
      socket = null;
      socketToken = null;
    }
  };
}

/** Gọi khi đăng xuất để đóng kết nối realtime của phiên hiện tại. */
export function disconnectRealtime() {
  if (socket) {
    socket.disconnect();
    socket = null;
    socketToken = null;
  }
}
