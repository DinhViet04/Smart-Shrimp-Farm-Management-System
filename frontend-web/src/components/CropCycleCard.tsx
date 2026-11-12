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

export default function CropCycleCard({
  cycle,
  onOpenDetail,
  onOpenPondReport,
}: CropCycleCardProps) {
  const isProfitPositive = cycle.totals.totalProfit >= 0;

  return (
    <div
      onClick={() => onOpenDetail(cycle)}
      className="bg-white rounded-3xl border border-slate-200/90 shadow-xs hover:shadow-xl hover:shadow-blue-900/10 transition-all duration-300 hover:-translate-y-1 cursor-pointer overflow-hidden flex flex-col group relative"
    >
      {/* Top Gradient Banner */}
      <div className="h-20 bg-gradient-to-r from-blue-700 via-indigo-600 to-cyan-600 p-4 sm:p-5 flex items-start justify-between relative overflow-hidden">
        {/* Glow circles */}
        <div className="absolute -right-6 -bottom-8 w-28 h-28 bg-white/10 rounded-full blur-xl pointer-events-none" />
        <div className="absolute -left-4 -top-8 w-24 h-24 bg-cyan-400/20 rounded-full blur-lg pointer-events-none" />

        <div className="relative z-10 flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-white/15 backdrop-blur-md border border-white/20 flex items-center justify-center text-white shadow-inner">
            <Waves className="w-6 h-6 text-cyan-200" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-white font-black text-base sm:text-lg tracking-tight group-hover:text-cyan-200 transition-colors">
                {cycle.name}
              </span>
              <span className="px-2 py-0.5 rounded-md bg-white/20 text-white text-[11px] font-bold backdrop-blur-xs">
                {cycle.code}
              </span>
            </div>
            <p className="text-xs text-blue-100 flex items-center gap-1.5 mt-0.5 font-medium">
              <Building2 className="w-3.5 h-3.5 text-cyan-200" />
              {cycle.farmName}
            </p>
          </div>
        </div>

        {/* Status & Model Badges */}
        <div className="relative z-10 flex flex-col items-end gap-1.5">
          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold shadow-xs ${
              cycle.status === 'COMPLETED'
                ? 'bg-emerald-500/90 text-white border border-emerald-400/50'
                : cycle.status === 'IN_PROGRESS'
                ? 'bg-amber-400 text-slate-900 border border-amber-300 font-black'
                : 'bg-rose-500/90 text-white'
            }`}
          >
            {cycle.status === 'COMPLETED' ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-white" /> Đã hoàn thành
              </>
            ) : cycle.status === 'IN_PROGRESS' ? (
              <>
                <span className="w-2 h-2 rounded-full bg-slate-900 animate-pulse" /> Đang nuôi
              </>
            ) : (
              <>
                <AlertTriangle className="w-3.5 h-3.5 text-white" /> Đóng sớm
              </>
            )}
          </span>

          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-white/20 text-white text-[10.5px] font-bold backdrop-blur-xs">
            {cycle.isHighTech ? '⚡ Công nghệ cao (2 Giai đoạn)' : '🌿 Truyền thống'}
          </span>
        </div>
      </div>

      {/* Main Body */}
      <div className="p-5 sm:p-6 flex-1 flex flex-col justify-between space-y-4">
        {/* Timeline & Pond Count Meta */}
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100 text-xs">
          <div className="flex items-center gap-3 text-slate-600 font-medium">
            <span className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-blue-600" />
              Thả: <strong>{formatDate(cycle.startDate)}</strong>
            </span>
            <span>➔</span>
            <span className="flex items-center gap-1">
              Thu: <strong>{formatDate(cycle.endDate)}</strong>
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 text-xs font-bold border border-indigo-100 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" /> {cycle.durationDays} ngày nuôi
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 text-xs font-bold border border-blue-100 flex items-center gap-1">
              <GitFork className="w-3.5 h-3.5" /> {cycle.totals.totalPondsCount} ao tham gia
            </span>
          </div>
        </div>

        {/* 3 Key Performance Indicators (Compact, Clean & Focused) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* 1. Tổng giống thả */}
          <div className="bg-slate-50/80 p-3.5 rounded-2xl border border-slate-100 flex flex-col justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              🦐 Giống thả ban đầu
            </span>
            <span className="text-base sm:text-lg font-black text-slate-800 mt-1">
              {cycle.totals.totalStockedShrimp.toLocaleString()} <span className="text-xs font-medium text-slate-400">con</span>
            </span>
          </div>

          {/* 2. Tổng sản lượng */}
          <div className="bg-blue-50/70 p-3.5 rounded-2xl border border-blue-100 flex flex-col justify-between">
            <span className="text-[11px] font-bold text-blue-600 uppercase tracking-wider flex items-center gap-1">
              <Scale className="w-3.5 h-3.5" /> Tổng sản lượng
            </span>
            <span className="text-base sm:text-lg font-black text-blue-900 mt-1">
              {cycle.totals.totalHarvestKg.toLocaleString()} <span className="text-xs font-medium text-blue-600">kg</span>
              <span className="text-xs font-bold text-blue-600 ml-1.5">
                (~{cycle.totals.totalHarvestTons} tấn)
              </span>
            </span>
          </div>

          {/* 3. Lợi nhuận ròng */}
          <div
            className={`p-3.5 rounded-2xl border flex flex-col justify-between ${
              isProfitPositive
                ? 'bg-emerald-50/80 border-emerald-100 text-emerald-900'
                : 'bg-rose-50/80 border-rose-100 text-rose-900'
            }`}
          >
            <span className="text-[11px] font-bold uppercase tracking-wider flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5" /> Lợi nhuận ròng
            </span>
            <span className="text-base sm:text-lg font-black mt-1">
              {isProfitPositive ? '+' : ''}
              {formatVND(cycle.totals.totalProfit)}
            </span>
          </div>
        </div>

        {/* Card Footer Actions */}
        <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {cycle.commercialPonds.slice(0, 3).map((cp) => (
              <span
                key={cp.pondId}
                onClick={(e) => {
                  e.stopPropagation();
                  if (cp.status === 'HARVESTED') {
                    onOpenPondReport?.(cp.crop);
                  } else {
                    toast.error(
                      `Ao ${cp.pondName} đang nuôi. Cần các ao của vụ nuôi hoàn tất thu hoạch mới có thể xuất báo cáo!`,
                      { id: 'status-check-toast', duration: 4000 }
                    );
                  }
                }}
                className={`px-2 py-0.5 rounded-md text-[11px] font-bold border transition-colors ${
                  cp.status === 'HARVESTED'
                    ? 'bg-slate-100 hover:bg-blue-100 text-slate-700 hover:text-blue-700 border-slate-200'
                    : 'bg-amber-50 hover:bg-amber-100 text-amber-700 border-amber-200 cursor-pointer'
                }`}
                title={
                  cp.status === 'HARVESTED'
                    ? `Xem báo cáo ao ${cp.pondName}`
                    : `Ao ${cp.pondName} đang nuôi - Cần hoàn tất thu hoạch mới xuất được báo cáo`
                }
              >
                {cp.pondName}
              </span>
            ))}
            {cycle.commercialPonds.length > 3 && (
              <span className="text-[11px] font-bold text-slate-400">
                +{cycle.commercialPonds.length - 3} ao nữa
              </span>
            )}
          </div>

          <button
            type="button"
            className="px-3.5 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 group-hover:from-blue-700 group-hover:to-indigo-700 text-white rounded-xl text-xs font-black flex items-center gap-1.5 transition-all shadow-sm group-hover:shadow-md group-hover:shadow-blue-500/20"
          >
            <span>Xem chi tiết vụ & các ao</span>
            <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </button>
        </div>
      </div>
    </div>
  );
}
