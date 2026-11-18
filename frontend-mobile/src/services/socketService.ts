import { io } from '../utils/socketClientMock';

// Adjust URL according to your backend. For Android emulator use 10.0.2.2,
// iOS simulator use localhost.
const SOCKET_URL = process.env.EXPO_PUBLIC_SOCKET_URL || 'http://192.168.1.50:3000';

class SocketService {
  private socket: any = null;

  connect() {
    if (this.socket) return;
    this.socket = io(SOCKET_URL, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    });

    this.socket.on('connect', () => {
      console.log('🟢 Mobile socket connected:', this.socket?.id);
    });

    // Explicit types for callbacks (any is acceptable when typings unavailable)
    this.socket.on('disconnect', (reason: string) => {
      console.log('🔴 Mobile socket disconnected:', reason);
    });

    this.socket.on('connect_error', (err: any) => {
      console.warn('⚠️ Mobile socket connection error:', err?.message ?? err);
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  /** Listen for real‑time notification pushes from the server */
  onNotification(callback: (notification: any) => void) {
    if (!this.socket) return;
    this.socket.on('notification:new', (data: any) => {
      callback(data);
    });
  }

  /** Remove listener when component unmounts */
  offNotification() {
    if (this.socket) this.socket.off('notification:new');
  }
}

export default new SocketService();
