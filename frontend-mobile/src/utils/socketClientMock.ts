// Minimal mock for socket.io-client used in React Native environment when the real library
// cannot be installed (offline / network blocked). It provides the subset of API
// that `SocketService` consumes: `on`, `off`, `disconnect` and a dummy `id`.
// The mock simply logs events to the console and stores listeners in a map.

export function io(_url: string, _options?: any) {
  const listeners: Record<string, ((...args: any[]) => void)[]> = {};

  const socket = {
    id: 'mock-socket-id',
    on(event: string, cb: (...args: any[]) => void) {
      if (!listeners[event]) listeners[event] = [];
      listeners[event].push(cb);
      // Immediately fire a fake 'connect' for convenience if needed
      if (event === 'connect') {
        cb();
      }
    },
    off(event: string) {
      delete listeners[event];
    },
    disconnect() {
      // Simulate a disconnect event
      if (listeners['disconnect']) {
        listeners['disconnect'].forEach((cb) => cb('client disconnect'));
      }
      // Clear all listeners
      for (const key in listeners) delete listeners[key];
    },
    // Helper to emit events manually (useful for tests)
    __emit(event: string, ...args: any[]) {
      if (listeners[event]) {
        listeners[event].forEach((cb) => cb(...args));
      }
    },
  } as any;

  return socket;
}
