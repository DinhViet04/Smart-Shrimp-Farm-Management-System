/** Thông tin người dùng đăng nhập được lưu trong localStorage ('user'). */
export interface StoredUser {
  id: string;
  email?: string;
  fullName?: string;
  name?: string;
  role?: string;
  avatarUrl?: string | null;
  phone?: string;
  /** Một số luồng cũ lưu id theo tên này */
  userId?: string;
  sub?: string;
}
