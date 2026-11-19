/**
 * Lấy thông điệp lỗi từ giá trị bắt được trong `catch` (kiểu `unknown`).
 * Trả về `fallback` nếu không có message dạng chuỗi.
 */
export function getErrorMessage(err: unknown, fallback = ''): string {
  if (err && typeof err === 'object' && 'message' in err) {
    const { message } = err as { message?: unknown };
    if (typeof message === 'string' && message) return message;
  }
  return fallback;
}
