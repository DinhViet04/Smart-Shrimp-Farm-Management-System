import { ChevronLeft, ChevronRight } from 'lucide-react';

/** Danh sách số trang gọn: 1 … 4 5 6 … 12 */
function pageList(page: number, total: number): (number | '…')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i);
  const set = new Set([0, total - 1, page - 1, page, page + 1].filter((p) => p >= 0 && p < total));
  const sorted = [...set].sort((a, b) => a - b);
  const out: (number | '…')[] = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) out.push('…');
    out.push(p);
  });
  return out;
}

interface PaginationProps {
  page: number;
  totalPages: number;
  total: number;
  from: number;
  to: number;
  onChange: (page: number) => void;
  /** Đơn vị đếm, vd "sản phẩm", "giao dịch" */
  unit?: string;
  className?: string;
}

export default function Pagination({ page, totalPages, total, from, to, onChange, unit = 'mục', className = '' }: PaginationProps) {
  if (total === 0) return null;
  const btn =
    'h-8 min-w-8 px-2 rounded-lg text-sm font-medium flex items-center justify-center transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed';
  return (
    <nav aria-label="Phân trang" className={`flex flex-col sm:flex-row items-center justify-between gap-2 ${className}`}>
      <p className="text-sm text-slate-500 tabular-nums">
        {from}–{to} / {total.toLocaleString('vi-VN')} {unit}
      </p>
      {totalPages > 1 && (
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => onChange(page - 1)} disabled={page === 0} aria-label="Trang trước" className={`${btn} text-slate-600 hover:bg-slate-100`}>
            <ChevronLeft className="w-4 h-4" />
          </button>
          {pageList(page, totalPages).map((p, i) =>
            p === '…' ? (
              <span key={`e${i}`} className="px-1 text-slate-400">
                …
              </span>
            ) : (
              <button
                key={p}
                type="button"
                onClick={() => onChange(p)}
                aria-current={p === page ? 'page' : undefined}
                className={`${btn} tabular-nums ${p === page ? 'bg-blue-600 text-white' : 'text-slate-700 hover:bg-slate-100'}`}
              >
                {p + 1}
              </button>
            ),
          )}
          <button
            type="button"
            onClick={() => onChange(page + 1)}
            disabled={page >= totalPages - 1}
            aria-label="Trang sau"
            className={`${btn} text-slate-600 hover:bg-slate-100`}
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </nav>
  );
}
