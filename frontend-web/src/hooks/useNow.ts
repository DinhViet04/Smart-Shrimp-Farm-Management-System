import { useEffect, useState } from 'react';

/**
 * Thời điểm hiện tại (ms), tự cập nhật sau mỗi `intervalMs`.
 * Dùng thay cho `Date.now()` trong lúc render để giá trị không bị "đóng băng"
 * và component vẫn thuần (pure).
 */
export function useNow(intervalMs = 60_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}
