/**
 * Trả về ngày theo GIỜ ĐỊA PHƯƠNG dạng YYYY-MM-DD.
 * Không dùng toISOString() vì nó trả về ngày theo UTC
 * (ở Việt Nam UTC+7, từ 0:00–6:59 sáng sẽ bị lùi về hôm qua).
 */
export const toLocalDateString = (date: Date = new Date()): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

/** Cộng/trừ số ngày cho chuỗi YYYY-MM-DD, tính theo giờ địa phương. */
export const shiftLocalDate = (dateStr: string, daysDelta: number): string => {
  const [y, m, d] = dateStr.split('-').map(Number);
  return toLocalDateString(new Date(y, m - 1, d + daysDelta));
};

/**
 * Trả về ngày giờ theo GIỜ ĐỊA PHƯƠNG dạng YYYY-MM-DDTHH:mm.
 */
export const toLocalDateTimeString = (date: Date = new Date()): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${d}T${hh}:${mm}`;
};


