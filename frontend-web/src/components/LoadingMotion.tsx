import type { ReactNode } from 'react';
import { Package } from 'lucide-react';

export interface LoadingMotionProps {
  title?: string;
  subtitle?: string;
  icon?: ReactNode;
  headerTitle?: string;
  headerSubtitle?: string;
  headerIcon?: ReactNode;
  color?: 'blue' | 'indigo' | 'cyan' | 'emerald' | 'rose' | 'amber' | 'teal';
  mode?: 'page' | 'card';
  badgeText?: string;
  className?: string;
  skeletonCount?: number;
}

const ACCENTS = {
  blue: 'bg-blue-500',
  indigo: 'bg-indigo-500',
  cyan: 'bg-cyan-500',
  emerald: 'bg-emerald-500',
  rose: 'bg-rose-500',
  amber: 'bg-amber-500',
  teal: 'bg-teal-500',
};

export default function LoadingMotion({
  title = 'Đang tải dữ liệu...',
  subtitle = 'Hệ thống đang đồng bộ dữ liệu mới nhất.',
  icon,
  headerTitle,
  headerSubtitle,
  headerIcon,
  color = 'blue',
  mode = 'page',
  className = '',
  skeletonCount = 3,
}: LoadingMotionProps) {
  const accent = ACCENTS[color];
  const displayIcon = icon || <Package className="h-6 w-6 text-slate-400" />;

  if (mode === 'card') {
    return (
      <section className={`rounded-3xl border border-slate-200 bg-white p-5 shadow-sm ${className}`} role="status" aria-label={title}>
        <span className="sr-only">{title}</span>
        <div className="mb-5 flex items-center gap-3">
          <span className={`h-2.5 w-2.5 animate-pulse rounded-full ${accent}`} />
          <div><p className="text-sm font-bold text-slate-700">{title}</p><p className="mt-0.5 text-xs text-slate-400">{subtitle}</p></div>
        </div>
        <SkeletonRows count={Math.max(3, skeletonCount)} />
      </section>
    );
  }

  return (
    <div className={`mx-auto max-w-7xl space-y-6 ${className}`} role="status" aria-label={title}>
      <span className="sr-only">{title}</span>
      {headerTitle && (
        <div className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-100 bg-slate-50">{headerIcon || displayIcon}</div>
            <div><h2 className="text-2xl font-black text-slate-800">{headerTitle}</h2>{headerSubtitle && <p className="mt-1 text-sm text-slate-500">{headerSubtitle}</p>}</div>
          </div>
          <div className="h-10 w-36 animate-pulse rounded-xl bg-slate-100" />
        </div>
      )}

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-5 flex items-center gap-3">
          <span className={`h-2.5 w-2.5 animate-pulse rounded-full ${accent}`} />
          <div><p className="text-sm font-bold text-slate-700">{title}</p><p className="mt-0.5 text-xs text-slate-400">{subtitle}</p></div>
        </div>
        {skeletonCount > 0 && (
          <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-3">
            {Array.from({ length: Math.min(skeletonCount, 3) }, (_, index) => (
              <div key={index} className="animate-pulse rounded-2xl border border-slate-100 p-4">
                <div className="h-10 w-10 rounded-xl bg-slate-100" /><div className="mt-3 h-3 w-20 rounded bg-slate-100" /><div className="mt-3 h-6 w-28 rounded-lg bg-slate-200" />
              </div>
            ))}
          </div>
        )}
        <SkeletonRows count={4} />
      </section>
    </div>
  );
}

function SkeletonRows({ count }: { count: number }) {
  return <div className="animate-pulse space-y-3">{Array.from({ length: count }, (_, index) => (
    <div key={index} className="grid grid-cols-[2fr_1fr_1fr] gap-4 rounded-2xl border border-slate-100 p-4">
      <div className="space-y-2"><div className="h-4 w-2/3 rounded bg-slate-200" /><div className="h-3 w-1/2 rounded bg-slate-100" /></div><div className="h-4 rounded bg-slate-100" /><div className="h-4 rounded bg-slate-100" />
    </div>
  ))}</div>;
}
