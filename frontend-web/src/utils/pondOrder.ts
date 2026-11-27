/**
 * Thứ tự hiển thị ao / vụ dùng chung trên giao diện:
 * ao / vụ đang hoạt động lên trước, ao trống / vụ đã kết thúc xuống sau.
 * (Backend cũng trả danh sách ao theo thứ tự này — xem backend/src/common/pond-order.ts.)
 */
export const comparePondName = (a?: string | null, b?: string | null) =>
  String(a ?? '').localeCompare(String(b ?? ''), 'vi', { numeric: true, sensitivity: 'base' });

/** Ao đang nuôi trước, ao trống sau; trong từng nhóm sắp theo tên tự nhiên (A1, A2, ..., A10) */
export function sortPondsActiveFirst<T extends { id: string; name: string }>(
  ponds: T[],
  activePondIds: ReadonlySet<string> | { has: (id: string) => boolean },
): T[] {
  return [...ponds].sort(
    (a, b) =>
      Number(activePondIds.has(b.id)) - Number(activePondIds.has(a.id)) ||
      comparePondName(a.name, b.name),
  );
}

/** Vụ đang nuôi (ACTIVE) trước; cùng nhóm thì vụ bắt đầu gần nhất lên trước */
export function sortCropsActiveFirst<T extends { status: string; startDate?: string | null }>(crops: T[]): T[] {
  const time = (c: T) => (c.startDate ? new Date(c.startDate).getTime() : 0);
  return [...crops].sort(
    (a, b) => Number(b.status === 'ACTIVE') - Number(a.status === 'ACTIVE') || time(b) - time(a),
  );
}
