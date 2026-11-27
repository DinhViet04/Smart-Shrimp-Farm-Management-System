import { DEFAULT_FEEDING_SESSIONS, type FeedingSession } from '../../services/feeding-log.service';

/** Ngày hôm nay theo giờ máy (YYYY-MM-DD). Không dùng toISOString vì đó là giờ UTC. */
export function localToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const WEEKDAYS = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'];

/** "2026-11-23" → "Thứ hai, 23/11/2026" (đọc theo ngày, không lệch múi giờ) */
export function formatDayVN(isoDate: string): string {
  const [y, m, d] = isoDate.slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return isoDate;
  const date = new Date(y, m - 1, d);
  return `${WEEKDAYS[date.getDay()]}, ${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;
}

export function isToday(isoDate: string): boolean {
  return isoDate.slice(0, 10) === localToday();
}

/** "Cử 1 (Sáng sớm)" → { name: "Cử 1", period: "Sáng sớm" } */
export function sessionInfo(session: FeedingSession) {
  const def = DEFAULT_FEEDING_SESSIONS.find((s) => s.session === session);
  const match = def?.label.match(/^(.*?)\s*\((.*)\)$/);
  return {
    name: match?.[1] ?? def?.label ?? session,
    period: match?.[2] ?? '',
    defaultTime: def?.defaultTime ?? '',
  };
}

export const roundKg = (n: number) => Math.round(n * 100) / 100;
