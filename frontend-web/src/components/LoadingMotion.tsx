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

const COLOR_MAP = {
  blue: {
    gradient: 'from-blue-600 via-indigo-600 to-cyan-500',
    iconColor: 'text-blue-600',
    titleGradient: 'from-blue-700 to-indigo-600',
    borderRing: 'border-blue-400/40',
    pingRing: 'border-indigo-400/30',
    blob1: 'bg-blue-400/15',
    blob2: 'bg-indigo-400/15',
    progress: 'from-blue-600 via-indigo-600 to-cyan-400',
    badge: 'bg-blue-50 border-blue-100 text-blue-700',
    badgeDot: 'bg-blue-600',
    headerIconBg: 'from-blue-50 to-indigo-50 text-blue-600 border-blue-100/50',
  },
  cyan: {
    gradient: 'from-cyan-600 via-blue-600 to-teal-400',
    iconColor: 'text-cyan-600',
    titleGradient: 'from-cyan-700 to-blue-600',
    borderRing: 'border-cyan-400/40',
    pingRing: 'border-blue-400/30',
    blob1: 'bg-cyan-400/15',
    blob2: 'bg-blue-400/15',
    progress: 'from-cyan-600 via-blue-600 to-teal-400',
    badge: 'bg-cyan-50 border-cyan-100 text-cyan-700',
    badgeDot: 'bg-cyan-600',
    headerIconBg: 'from-cyan-50 to-blue-50 text-cyan-600 border-cyan-100/50',
  },
  emerald: {
    gradient: 'from-emerald-600 via-teal-600 to-cyan-500',
    iconColor: 'text-emerald-600',
    titleGradient: 'from-emerald-700 to-teal-600',
    borderRing: 'border-emerald-400/40',
    pingRing: 'border-teal-400/30',
    blob1: 'bg-emerald-400/15',
    blob2: 'bg-teal-400/15',
    progress: 'from-emerald-600 via-teal-600 to-cyan-400',
    badge: 'bg-emerald-50 border-emerald-100 text-emerald-700',
    badgeDot: 'bg-emerald-600',
    headerIconBg: 'from-emerald-50 to-teal-50 text-emerald-600 border-emerald-100/50',
  },
  amber: {
    gradient: 'from-amber-500 via-orange-500 to-amber-400',
    iconColor: 'text-amber-600',
    titleGradient: 'from-amber-700 to-orange-600',
    borderRing: 'border-amber-400/40',
    pingRing: 'border-orange-400/30',
    blob1: 'bg-amber-400/15',
    blob2: 'bg-orange-400/15',
    progress: 'from-amber-500 via-orange-500 to-yellow-400',
    badge: 'bg-amber-50 border-amber-100 text-amber-700',
    badgeDot: 'bg-amber-600',
    headerIconBg: 'from-amber-50 to-orange-50 text-amber-600 border-amber-100/50',
  },
  rose: {
    gradient: 'from-rose-600 via-pink-600 to-orange-400',
    iconColor: 'text-rose-600',
    titleGradient: 'from-rose-700 to-pink-600',
    borderRing: 'border-rose-400/40',
    pingRing: 'border-pink-400/30',
    blob1: 'bg-rose-400/15',
    blob2: 'bg-pink-400/15',
    progress: 'from-rose-600 via-pink-600 to-orange-400',
    badge: 'bg-rose-50 border-rose-100 text-rose-700',
    badgeDot: 'bg-rose-600',
    headerIconBg: 'from-rose-50 to-pink-50 text-rose-600 border-rose-100/50',
  },
  indigo: {
    gradient: 'from-indigo-600 via-purple-600 to-blue-500',
    iconColor: 'text-indigo-600',
    titleGradient: 'from-indigo-700 to-purple-600',
    borderRing: 'border-indigo-400/40',
    pingRing: 'border-purple-400/30',
    blob1: 'bg-indigo-400/15',
    blob2: 'bg-purple-400/15',
    progress: 'from-indigo-600 via-purple-600 to-blue-400',
    badge: 'bg-indigo-50 border-indigo-100 text-indigo-700',
    badgeDot: 'bg-indigo-600',
    headerIconBg: 'from-indigo-50 to-purple-50 text-indigo-600 border-indigo-100/50',
  },
  teal: {
    gradient: 'from-teal-600 via-cyan-600 to-emerald-500',
    iconColor: 'text-teal-600',
    titleGradient: 'from-teal-700 to-cyan-600',
    borderRing: 'border-teal-400/40',
    pingRing: 'border-cyan-400/30',
    blob1: 'bg-teal-400/15',
    blob2: 'bg-cyan-400/15',
    progress: 'from-teal-600 via-cyan-600 to-emerald-400',
    badge: 'bg-teal-50 border-teal-100 text-teal-700',
    badgeDot: 'bg-teal-600',
    headerIconBg: 'from-teal-50 to-cyan-50 text-teal-600 border-teal-100/50',
  },
};

export default function LoadingMotion({
  title = 'Đang tải dữ liệu...',
  subtitle = 'Hệ thống đang đồng bộ dữ liệu mới nhất từ máy chủ...',
  icon,
  headerTitle,
  headerSubtitle,
  headerIcon,
  color = 'blue',
  mode = 'page',
  badgeText = 'Đang kết nối dữ liệu máy chủ',
  className = '',
  skeletonCount = 3,
}: LoadingMotionProps) {
  const theme = COLOR_MAP[color] || COLOR_MAP.blue;
  const displayIcon = icon || <Package className={`w-10 h-10 ${theme.iconColor} animate-pulse`} />;

  if (mode === 'card') {
    return (
      <div className={`bg-white/90 backdrop-blur-2xl border border-white/80 rounded-[2.5rem] p-8 sm:p-12 shadow-xl shadow-blue-900/5 relative overflow-hidden flex flex-col items-center justify-center text-center animate-in fade-in duration-200 ${className}`}>
        {/* Ambient Glowing Blobs */}
        <div className={`absolute -top-20 -left-20 w-64 h-64 ${theme.blob1} rounded-full blur-3xl animate-pulse pointer-events-none`} />
        <div className={`absolute -bottom-20 -right-20 w-64 h-64 ${theme.blob2} rounded-full blur-3xl animate-pulse delay-200 pointer-events-none`} />

        {/* Animated 3D Floating Icon Box */}
        <div className="relative mb-5 z-10">
          <div className={`w-20 h-20 rounded-3xl bg-gradient-to-tr ${theme.gradient} p-1 shadow-xl shadow-blue-500/20 animate-bounce duration-700`}>
            <div className="w-full h-full bg-white rounded-[22px] flex items-center justify-center">
              {displayIcon}
            </div>
          </div>
          <div className={`absolute -inset-2.5 rounded-[1.75rem] border-2 border-dashed ${theme.borderRing} animate-spin duration-3000 pointer-events-none`} />
          <div className={`absolute -inset-1 rounded-3xl border-2 ${theme.pingRing} animate-ping pointer-events-none`} />
        </div>

        <h3 className="text-lg sm:text-xl font-black text-slate-800 tracking-tight mb-1.5 z-10">
          {title}
        </h3>
        <p className="text-xs text-slate-500 font-medium max-w-sm leading-relaxed mb-5 z-10">
          {subtitle}
        </p>

        {/* Shimmering Progress Bar */}
        <div className="w-56 sm:w-72 h-1.5 bg-slate-100 rounded-full overflow-hidden relative shadow-inner mb-3 z-10">
          <div className={`h-full bg-gradient-to-r ${theme.progress} rounded-full animate-pulse w-full`} />
        </div>

        <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border text-[11px] font-bold shadow-2xs z-10 ${theme.badge}`}>
          <span className={`w-2 h-2 rounded-full ${theme.badgeDot} animate-ping`} />
          {badgeText}
        </div>
      </div>
    );
  }

  return (
    <div className={`max-w-7xl mx-auto space-y-6 animate-in fade-in duration-200 relative ${className}`}>
      {/* Header Placeholder (if title provided) */}
      {headerTitle && (
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/80 backdrop-blur-xl p-4 sm:p-6 rounded-3xl shadow-xl shadow-blue-900/5 border border-white/60">
          <div className="flex items-center gap-4">
            <div className={`w-14 h-14 bg-gradient-to-br ${theme.headerIconBg} rounded-2xl flex items-center justify-center border shadow-inner`}>
              {headerIcon || displayIcon}
            </div>
            <div>
              <h2 className={`text-2xl font-black bg-clip-text text-transparent bg-gradient-to-r ${theme.titleGradient} tracking-tight`}>
                {headerTitle}
              </h2>
              {headerSubtitle && (
                <p className="text-sm text-slate-500 font-medium">{headerSubtitle}</p>
              )}
            </div>
          </div>
          <div className="h-10 w-36 bg-slate-100/80 rounded-xl animate-pulse" />
        </div>
      )}

      {/* Khung Motion Trung Tâm Loading */}
      <div className="bg-white/90 backdrop-blur-2xl border border-white/80 rounded-[2.5rem] p-8 sm:p-14 shadow-2xl shadow-blue-900/10 relative overflow-hidden flex flex-col items-center justify-center text-center">
        {/* Ambient Glowing Blobs */}
        <div className={`absolute -top-24 -left-24 w-80 h-80 ${theme.blob1} rounded-full blur-3xl animate-pulse pointer-events-none`} />
        <div className={`absolute -bottom-24 -right-24 w-80 h-80 ${theme.blob2} rounded-full blur-3xl animate-pulse delay-200 pointer-events-none`} />

        {/* Animated 3D Floating Icon Box */}
        <div className="relative mb-6 z-10">
          <div className={`w-24 h-24 rounded-3xl bg-gradient-to-tr ${theme.gradient} p-1 shadow-2xl shadow-blue-500/30 animate-bounce duration-700`}>
            <div className="w-full h-full bg-white rounded-[22px] flex items-center justify-center">
              {displayIcon}
            </div>
          </div>
          {/* Spinning decorative ring */}
          <div className={`absolute -inset-3 rounded-[2rem] border-2 border-dashed ${theme.borderRing} animate-spin duration-3000 pointer-events-none`} />
          {/* Ping wave */}
          <div className={`absolute -inset-1 rounded-3xl border-2 ${theme.pingRing} animate-ping pointer-events-none`} />
        </div>

        <h3 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight mb-2 z-10">
          {title}
        </h3>
        <p className="text-xs sm:text-sm text-slate-500 font-medium max-w-md leading-relaxed mb-6 z-10">
          {subtitle}
        </p>

        {/* Shimmering Progress Bar */}
        <div className="w-64 sm:w-80 h-2 bg-slate-100 rounded-full overflow-hidden relative shadow-inner mb-4 z-10">
          <div className={`h-full bg-gradient-to-r ${theme.progress} rounded-full animate-pulse w-full`} />
        </div>

        <div className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border text-[11px] font-bold shadow-2xs z-10 ${theme.badge}`}>
          <span className={`w-2 h-2 rounded-full ${theme.badgeDot} animate-ping`} />
          {badgeText}
        </div>

        {/* Skeleton Preview Cards */}
        {skeletonCount > 0 && (
          <div className={`grid grid-cols-1 md:grid-cols-${Math.min(skeletonCount, 3)} gap-4 w-full mt-10 max-w-4xl pt-8 border-t border-slate-100 z-10`}>
            {Array.from({ length: skeletonCount }).map((_, idx) => (
              <div
                key={idx}
                className="p-5 rounded-2xl bg-slate-50/70 border border-slate-100 flex flex-col gap-2.5 animate-pulse text-left"
              >
                <div className="w-8 h-8 rounded-xl bg-slate-200" />
                <div className="w-24 h-3 bg-slate-200 rounded" />
                <div className="w-36 h-6 bg-slate-300 rounded" />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
