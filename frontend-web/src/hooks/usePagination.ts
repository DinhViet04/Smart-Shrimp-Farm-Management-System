import { useState } from 'react';

/**
 * Phân trang phía trình duyệt.
 * `resetKey` đổi (vd: đổi bộ lọc / từ khoá) → tự quay về trang 1.
 */
export function usePagination<T>(items: T[], pageSize: number, resetKey = '') {
  const [state, setState] = useState({ page: 0, key: resetKey });
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const page = Math.min(state.key === resetKey ? state.page : 0, totalPages - 1);
  const start = page * pageSize;
  return {
    page,
    totalPages,
    total: items.length,
    from: items.length ? start + 1 : 0,
    to: Math.min(start + pageSize, items.length),
    pageItems: items.slice(start, start + pageSize),
    setPage: (p: number) => setState({ page: Math.max(0, Math.min(p, totalPages - 1)), key: resetKey }),
  };
}
