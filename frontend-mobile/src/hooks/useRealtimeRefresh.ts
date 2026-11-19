import { useContext, useEffect, useLayoutEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { AuthContext } from '../context/AuthContext';
import {
  subscribeDataChanged,
  DataChangedEvent,
  RealtimeResource,
} from '../services/realtime';

interface Options {
  /** Chỉ tải lại khi sự kiện thuộc trang trại này (bỏ qua nếu không truyền). */
  farmId?: string | null;
  /** Gộp nhiều sự kiện liên tiếp thành một lần tải lại. Mặc định 500ms. */
  debounceMs?: number;
  enabled?: boolean;
}

/**
 * Tự động gọi `onChange` khi dữ liệu thuộc `resources` thay đổi trên server.
 * Khi app ở nền, việc tải lại được hoãn tới lúc app hoạt động trở lại.
 */
export function useRealtimeRefresh(
  resources: RealtimeResource | RealtimeResource[],
  onChange: (event?: DataChangedEvent) => void,
  options: Options = {},
) {
  const { userToken } = useContext(AuthContext);
  const { farmId, debounceMs = 500, enabled = true } = options;
  const callbackRef = useRef(onChange);
  const farmIdRef = useRef(farmId);
  // Luôn giữ callback / farmId mới nhất mà không phải đăng ký lại socket.
  useLayoutEffect(() => {
    callbackRef.current = onChange;
    farmIdRef.current = farmId;
  });

  const key = (Array.isArray(resources) ? resources : [resources])
    .slice()
    .sort()
    .join('|');

  useEffect(() => {
    if (!enabled || !userToken) return;
    const wanted = new Set(key.split('|') as RealtimeResource[]);
    let timer: ReturnType<typeof setTimeout> | null = null;
    let pending: DataChangedEvent | undefined;
    let hasPending = false;

    const flush = () => {
      timer = null;
      if (AppState.currentState !== 'active') return; // chờ app hoạt động lại
      const event = pending;
      hasPending = false;
      pending = undefined;
      callbackRef.current(event);
    };

    const schedule = (event?: DataChangedEvent) => {
      hasPending = true;
      pending = event;
      if (timer) clearTimeout(timer);
      timer = setTimeout(flush, debounceMs);
    };

    const unsubscribe = subscribeDataChanged(
      userToken,
      event => {
        const touched = event.resources?.length
          ? event.resources
          : [event.resource];
        if (!touched.some(r => wanted.has(r))) return;
        const scopeFarm = farmIdRef.current;
        if (scopeFarm && event.farmId && event.farmId !== scopeFarm) return;
        schedule(event);
      },
      () => schedule(),
    );

    const appStateSub = AppState.addEventListener('change', state => {
      if (state === 'active' && hasPending && !timer) flush();
    });

    return () => {
      unsubscribe();
      appStateSub.remove();
      if (timer) clearTimeout(timer);
    };
  }, [key, debounceMs, enabled, userToken]);
}
