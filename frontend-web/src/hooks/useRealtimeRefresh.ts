import { useEffect, useLayoutEffect, useRef } from 'react';
import {
  subscribeDataChanged,
  type DataChangedEvent,
  type RealtimeResource,
} from '../services/realtime';

interface Options {
  /** Chỉ tải lại khi sự kiện thuộc trang trại này (bỏ qua nếu không truyền). */
  farmId?: string | null;
  /** Gộp nhiều sự kiện liên tiếp thành một lần tải lại. Mặc định 500ms. */
  debounceMs?: number;
  /** Tạm tắt (vd: modal đang đóng). */
  enabled?: boolean;
}

/**
 * Tự động gọi `onChange` khi dữ liệu thuộc các `resources` thay đổi trên
 * server (do người khác hoặc thiết bị khác). Khi tab đang ẩn, việc tải lại
 * được hoãn tới lúc người dùng quay lại.
 */
export function useRealtimeRefresh(
  resources: RealtimeResource | RealtimeResource[],
  onChange: (event?: DataChangedEvent) => void,
  options: Options = {},
) {
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
    if (!enabled) return;
    const wanted = new Set(key.split('|') as RealtimeResource[]);
    let timer: ReturnType<typeof setTimeout> | null = null;
    let pending: DataChangedEvent | undefined;
    let hasPending = false;

    const flush = () => {
      timer = null;
      if (document.visibilityState === 'hidden') return; // chờ tab hiện lại
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

    const onVisible = () => {
      if (document.visibilityState === 'visible' && hasPending && !timer) {
        flush();
      }
    };

    const unsubscribe = subscribeDataChanged(
      (event) => {
        const touched = event.resources?.length
          ? event.resources
          : [event.resource];
        if (!touched.some((r) => wanted.has(r))) return;
        const scopeFarm = farmIdRef.current;
        if (scopeFarm && event.farmId && event.farmId !== scopeFarm) return;
        schedule(event);
      },
      () => schedule(),
    );
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      unsubscribe();
      document.removeEventListener('visibilitychange', onVisible);
      if (timer) clearTimeout(timer);
    };
  }, [key, debounceMs, enabled]);
}
