let counter = 0;

/**
 * Tạo id duy nhất phía client (cho toast, tin nhắn chat...).
 * Ghép timestamp với bộ đếm để 2 id tạo trong cùng 1 ms không bị trùng.
 */
export function createId(): string {
  counter = (counter + 1) % Number.MAX_SAFE_INTEGER;
  return `${Date.now().toString(36)}-${counter.toString(36)}`;
}
