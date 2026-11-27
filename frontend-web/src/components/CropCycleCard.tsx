import {
  Calendar,
  Clock,
  Scale,
  TrendingUp,
  GitFork,
  ChevronRight,
  Waves,
  Building2,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { type CropCycle } from '../utils/cropCycleGrouping';
import { type Crop } from '../services/crop.service';

interface CropCycleCardProps {
  cycle: CropCycle;
  onOpenDetail: (cycle: CropCycle) => void;
  onOpenPondReport?: (crop: Crop) => void;
}

const formatVND = (num: number | null | undefined): string => {
  if (num === null || num === undefined || isNaN(num)) return '0 đ';
  if (Math.abs(num) >= 1_000_000_000) {
    return `${(num / 1_000_000_000).toFixed(2)} tỷ đ`;
  }
  if (Math.abs(num) >= 1_000_000) {
    return `${(num / 1_000_000).toFixed(1)} tr đ`;
  }
  return `${new Intl.NumberFormat('vi-VN').format(Math.round(num))} đ`;
};

const formatDate = (dateStr?: string | null): string => {
  if (!dateStr) return '--';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '--';
    return d.toLocaleDateString('vi-VN');
  } catch {
    return '--';
  }
};

const STATUS_STYLE: Record<CropCycle['status'], { label: string; pill: string; accent: string }> = {
  IN_PROGRESS: { label: 'Đang nuôi', pill: 'bg-amber-50 text-amber-700 ring-amber-200', accent: 'from-amber-400 to-orange-400' },
  COMPLETED: { label: 'Đã thu hoạch', pill: 'bg-emerald-50 text-emerald-700 ring-emerald-200', accent: 'from-emerald-500 to-teal-500' },
  FAILED: { label: 'Đóng vụ sớm', pill: 'bg-rose-50 text-rose-700 ring-rose-200', accent: 'from-rose-500 to-red-500' },
};

const POND_DOT: Record<string, string> = {
  ACTIVE: 'bg-amber-400',
  HARVESTED: 'bg-emerald-500',
  FAILED: 'bg-rose-500',
};

export default function CropCycleCard({
  cycle,
  onOpenDetail,
  onOpenPondReport,
}: CropCycleCardProps) {
  const isOngoing = cycle.status === 'IN_PROGRESS';
  const isProfitPositive = cycle.totals.totalProfit >= 0;
  const style = STATUS_STYLE[cycle.status] ?? STATUS_STYLE.IN_PROGRESS;
  const activePonds = cycle.allCrops.filter((c) => c.status === 'ACTIVE').length;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpenDetail(cycle)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onOpenDetail(cycle);
      }}
      className="group relative flex flex-col bg-white rounded-2xl border border-slate-200 shadow-xs hover:shadow-lg hover:border-blue-200 transition-all duration-200 cursor-pointer overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
    >
      {/* Vạch màu theo trạng thái */}
      <div className={`h-1 bg-gradient-to-r ${style.accent}`} />

      <div className="p-5 flex flex-col gap-4 flex-1">
        {/* Tiêu đề: tên vụ + mã vụ + trạng thái */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <Waves className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-bold text-slate-900 leading-snug truncate group-hover:text-blue-700 transition-colors" title={cycle.name}>
                {cycle.name}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5 flex-wrap">
                <span className="font-mono font-semibold text-slate-600">{cycle.code}</span>
                <span className="text-slate-300">•</span>
                <Building2 className="w-3.5 h-3.5 text-slate-400" />
                <span className="truncate">{cycle.farmName}</span>
                <span className="text-slate-300">•</span>
                <span>{cycle.isHighTech ? 'Công nghệ cao (2 giai đoạn)' : 'Truyền thống'}</span>
              </p>
            </div>
          </div>
          <span className={`shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ring-1 whitespace-nowrap ${style.pill}`}>
            {cycle.status === 'COMPLETED' ? (
              <CheckCircle2 className="w-3.5 h-3.5" />
            ) : cycle.status === 'FAILED' ? (
              <AlertTriangle className="w-3.5 h-3.5" />
            ) : (
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
            )}
            {style.label}
          </span>
        </div>

        {/* Thời gian */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-600">
          <span className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            Thả <strong className="text-slate-800">{formatDate(cycle.startDate)}</strong>
            <span className="text-slate-300">→</span>
            {isOngoing ? (
              <span className="text-amber-700 font-semibold">đang nuôi</span>
            ) : (
              <>
                Thu <strong className="text-slate-800">{formatDate(cycle.endDate)}</strong>
              </>
            )}
          </span>
          <span className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <strong className="text-slate-800">{cycle.durationDays}</strong> ngày {isOngoing ? 'tuổi' : 'nuôi'}
          </span>
          <span className="flex items-center gap-1.5">
            <GitFork className="w-3.5 h-3.5 text-slate-400" />
            <strong className="text-slate-800">{cycle.totals.totalPondsCount}</strong> ao
          </span>
        </div>

        {/* 3 chỉ số chính (vụ đang nuôi chưa có sản lượng / lợi nhuận) */}
        <div className="grid grid-cols-3 gap-2.5">
          <div className="rounded-xl bg-slate-50 px-3 py-2.5">
            <p className="text-[11px] font-medium text-slate-500">Giống thả</p>
            <p className="text-base font-bold text-slate-900 mt-0.5 truncate">
              {cycle.totals.totalStockedShrimp.toLocaleString('vi-VN')}
              <span className="text-[11px] font-medium text-slate-400 ml-1">con</span>
            </p>
          </div>

          {isOngoing ? (
            <div className="rounded-xl bg-amber-50/70 px-3 py-2.5">
              <p className="text-[11px] font-medium text-amber-700">Ao đang nuôi</p>
              <p className="text-base font-bold text-amber-900 mt-0.5">
                {activePonds}
                <span className="text-[11px] font-medium text-amber-700/70 ml-1">/ {cycle.totals.totalPondsCount} ao</span>
              </p>
            </div>
          ) : (
            <div className="rounded-xl bg-blue-50/70 px-3 py-2.5">
              <p className="text-[11px] font-medium text-blue-700 flex items-center gap-1">
                <Scale className="w-3 h-3" /> Sản lượng
              </p>
              <p className="text-base font-bold text-blue-900 mt-0.5 truncate">
                {cycle.totals.totalHarvestTons}
                <span className="text-[11px] font-medium text-blue-700/70 ml-1">tấn</span>
              </p>
            </div>
          )}

          {isOngoing ? (
            <div className="rounded-xl bg-slate-50 px-3 py-2.5">
              <p className="text-[11px] font-medium text-slate-500 flex items-center gap-1">
                <TrendingUp className="w-3 h-3" /> Lợi nhuận
              </p>
              <p className="text-sm font-semibold text-slate-400 mt-1">Chưa thu hoạch</p>
            </div>
          ) : (
            <div className={`rounded-xl px-3 py-2.5 ${isProfitPositive ? 'bg-emerald-50/80' : 'bg-rose-50/80'}`}>
              <p className={`text-[11px] font-medium flex items-center gap-1 ${isProfitPositive ? 'text-emerald-700' : 'text-rose-700'}`}>
                <TrendingUp className="w-3 h-3" /> {isProfitPositive ? 'Lời' : 'Lỗ'}
              </p>
              <p className={`text-base font-bold mt-0.5 truncate ${isProfitPositive ? 'text-emerald-800' : 'text-rose-800'}`}>
                {isProfitPositive ? '+' : ''}
                {formatVND(cycle.totals.totalProfit)}
              </p>
            </div>
          )}
        </div>

        {/* Ao thuộc vụ + nút xem chi tiết */}
        <div className="mt-auto pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 flex-wrap min-w-0">
            {cycle.commercialPonds.slice(0, 3).map((cp) => (
              <button
                type="button"
                key={cp.pondId}
                onClick={(e) => {
                  e.stopPropagation();
                  if (cp.status === 'HARVESTED') {
                    onOpenPondReport?.(cp.crop);
                  } else {
                    toast.error(
                      `Ao ${cp.pondName} đang nuôi. Cần hoàn tất thu hoạch mới xem được báo cáo!`,
                      { id: 'status-check-toast', duration: 4000 }
                    );
                  }
                }}
                className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-semibold text-slate-700 bg-slate-100 hover:bg-blue-50 hover:text-blue-700 transition-colors cursor-pointer"
                title={cp.status === 'HARVESTED' ? `Xem báo cáo ao ${cp.pondName}` : `Ao ${cp.pondName} đang nuôi`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${POND_DOT[cp.status] ?? 'bg-slate-400'}`} />
                {cp.pondName}
              </button>
            ))}
            {cycle.commercialPonds.length > 3 && (
              <span className="text-[11px] font-semibold text-slate-400">+{cycle.commercialPonds.length - 3} ao</span>
            )}
          </div>

          <span className="shrink-0 inline-flex items-center gap-1 text-xs font-semibold text-blue-600 group-hover:text-blue-700 whitespace-nowrap">
            Xem chi tiết
            <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </span>
        </div>
      </div>
    </div>
  );
}
