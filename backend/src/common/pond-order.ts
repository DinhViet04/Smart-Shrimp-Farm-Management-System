/**
 * Thứ tự hiển thị ao dùng chung cho mọi API trả danh sách ao:
 * ao đang có vụ nuôi (ACTIVE) lên trước, ao trống xuống sau;
 * trong mỗi nhóm sắp theo tên tự nhiên (A1, A2, ..., A10).
 * Nhóm theo trang trại vẫn giữ nguyên vì frontend lọc theo farmId trên danh sách đã sắp.
 */
export const comparePondName = (a?: string | null, b?: string | null) =>
  String(a ?? '').localeCompare(String(b ?? ''), 'vi', {
    numeric: true,
    sensitivity: 'base',
  });

export function sortPondsActiveFirst<T extends { id: string; name: string }>(
  ponds: T[],
  activePondIds: ReadonlySet<string>,
): T[] {
  return [...ponds].sort(
    (a, b) =>
      Number(activePondIds.has(b.id)) - Number(activePondIds.has(a.id)) ||
      comparePondName(a.name, b.name),
  );
}
