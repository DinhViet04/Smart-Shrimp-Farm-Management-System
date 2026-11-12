import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Calendar,
  GitFork,
  CheckCircle2,
  Building2,
  Waves,
  FileText,
  Sparkles,
  Award,
  Info,
  ShieldCheck,
  Table as TableIcon,
  Layers,
  FileDown,
  Lock,
  ArrowLeft,
} from 'lucide-react';
import toast from 'react-hot-toast';
import CropReportExportModal from './CropReportExportModal';
import { type CropCycle } from '../utils/cropCycleGrouping';
import { type Crop } from '../services/crop.service';
import { scrollToTop } from '../utils/scrollHelper';

interface CropCycleDetailModalProps {
  isOpen: boolean;
  cycle: CropCycle;
  onClose: () => void;
  onOpenCropReport: (crop: Crop) => void;
  asPage?: boolean;
}

const formatVND = (num: number | null | undefined): string => {
  if (num === null || num === undefined || isNaN(num)) return '0 đ';
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

export default function CropCycleDetailModal({
  isOpen,
  cycle,
  onClose,
  onOpenCropReport,
  asPage = false,
}: CropCycleDetailModalProps) {
  const [activeTab, setActiveTab] = useState<'lineage' | 'ponds' | 'comparison'>('lineage');
  const [showExportModal, setShowExportModal] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen && asPage) {
      scrollToTop();
    }
  }, [isOpen, asPage]);

  if (!isOpen) return null;

  const isProfitPositive = cycle.totals.totalProfit >= 0;

  const modalContent = (
    <div className={`bg-white w-full rounded-3xl border border-slate-200/90 flex flex-col overflow-hidden ${asPage ? 'shadow-sm' : 'max-w-6xl max-h-[92vh] shadow-2xl'}`}>
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-cyan-700 text-white p-5 sm:p-6 relative overflow-hidden shrink-0">
          <div className="absolute -right-10 -bottom-10 w-44 h-44 bg-white/10 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute left-1/3 -top-10 w-40 h-40 bg-cyan-400/20 rounded-full blur-2xl pointer-events-none" />

          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-white/15 backdrop-blur-md border border-white/20 flex items-center justify-center shadow-inner shrink-0">
                <Layers className="w-6 h-6 text-cyan-200" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                    {cycle.name}
                  </h3>
                  <span className="px-2.5 py-0.5 rounded-md bg-white/20 text-white text-xs font-black backdrop-blur-xs">
                    {cycle.code}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                      cycle.status === 'COMPLETED'
                        ? 'bg-emerald-400 text-slate-950 font-black'
                        : cycle.status === 'IN_PROGRESS'
                        ? 'bg-amber-300 text-slate-950 font-black'
                        : 'bg-rose-400 text-white font-bold'
                    }`}
                  >
                    {cycle.status === 'COMPLETED' ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" /> Vụ đã hoàn thành
                      </>
                    ) : cycle.status === 'IN_PROGRESS' ? (
                      <>
                        <span className="w-2 h-2 rounded-full bg-slate-950 animate-pulse" /> Đang nuôi
                      </>
                    ) : (
                      'Đóng vụ sớm'
                    )}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-3 text-xs text-blue-100 mt-1.5 font-medium">
                  <span className="flex items-center gap-1 text-cyan-200 font-bold">
                    <Building2 className="w-3.5 h-3.5" /> {cycle.farmName}
                  </span>
                  <span>•</span>
                  <span>
                    Mô hình: <strong>{cycle.isHighTech ? 'Công nghệ cao 2 giai đoạn (Ương ➔ Nuôi)' : 'Truyền thống'}</strong>
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" /> {formatDate(cycle.startDate)} ➔ {formatDate(cycle.endDate)} ({cycle.durationDays} ngày)
                  </span>
                </div>
              </div>
            </div>

            {/* Top Right Financial Pill & Close */}
            <div className="flex items-center gap-3 self-end md:self-center">
              <div className="bg-white/15 backdrop-blur-md rounded-2xl px-4 py-2 border border-white/20 text-right">
                <span className="text-[10px] uppercase font-bold text-cyan-200 block">
                  Tổng lợi nhuận vụ
                </span>
                <span className="text-base sm:text-lg font-black text-white">
                  {isProfitPositive ? '+' : ''}
                  {formatVND(cycle.totals.totalProfit)}
                </span>
              </div>

              {cycle.status === 'COMPLETED' ? (
                <button
                  onClick={() => setShowExportModal(true)}
                  className="h-10 px-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-black text-xs flex items-center gap-1.5 shadow-lg shadow-emerald-600/25 transition-all cursor-pointer border border-emerald-400/40 hover:scale-105"
                  title="Tải báo cáo toàn vụ (Gói ZIP / Từng ao)"
                >
                  <FileDown className="w-4 h-4" />
                  <span>Tải báo cáo</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    toast.error('Vụ nuôi này đang nuôi, chưa thu hoạch nên chưa thể tải file báo cáo!', { id: 'status-check-toast' });
                  }}
                  className="h-10 px-3.5 rounded-2xl bg-white/10 hover:bg-white/15 text-white/60 font-bold text-xs flex items-center gap-1.5 transition-all border border-white/15 cursor-not-allowed"
                  title="Vụ đang nuôi, chỉ tải báo cáo sau khi đã hoàn thành thu hoạch"
                >
                  <Lock className="w-3.5 h-3.5 text-cyan-200/60" />
                  <span>Chưa thu hoạch</span>
                </button>
              )}

              {asPage ? (
                <button
                  type="button"
                  onClick={onClose}
                  className="h-10 px-4 rounded-2xl bg-white/15 hover:bg-white/25 text-white font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer border border-white/20 shadow-2xs hover:scale-105"
                >
                  <ArrowLeft className="w-4 h-4 text-cyan-200" />
                  <span>Quay lại</span>
                </button>
              ) : (
                <button
                  onClick={onClose}
                  className="w-10 h-10 rounded-2xl bg-white/15 hover:bg-white/25 text-white flex items-center justify-center transition-all cursor-pointer border border-white/20"
                  title="Đóng modal"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-2 mt-6 pt-2 border-t border-white/15 text-xs font-bold">
            <button
              onClick={() => setActiveTab('lineage')}
              className={`px-4 py-2 rounded-xl flex items-center gap-2 transition-all cursor-pointer ${
                activeTab === 'lineage'
                  ? 'bg-white text-blue-800 shadow-md'
                  : 'text-white/80 hover:text-white hover:bg-white/10'
              }`}
            >
              <GitFork className="w-4 h-4" />
              <span>Sơ đồ dòng đời & Tách ao</span>
            </button>

            <button
              onClick={() => setActiveTab('ponds')}
              className={`px-4 py-2 rounded-xl flex items-center gap-2 transition-all cursor-pointer ${
                activeTab === 'ponds'
                  ? 'bg-white text-blue-800 shadow-md'
                  : 'text-white/80 hover:text-white hover:bg-white/10'
              }`}
            >
              <Waves className="w-4 h-4" />
              <span>Tất cả ao thuộc vụ ({cycle.allCrops.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('comparison')}
              className={`px-4 py-2 rounded-xl flex items-center gap-2 transition-all cursor-pointer ${
                activeTab === 'comparison'
                  ? 'bg-white text-blue-800 shadow-md'
                  : 'text-white/80 hover:text-white hover:bg-white/10'
              }`}
            >
              <TableIcon className="w-4 h-4" />
              <span>Bảng so sánh & Tổng kết</span>
            </button>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className={`p-5 sm:p-6 space-y-6 ${asPage ? '' : 'overflow-y-auto flex-1'}`}>
          {/* ── TAB 1: SƠ ĐỒ DÒNG ĐỜI & TÁCH AO ────────────────────────────── */}
          {activeTab === 'lineage' && (
            <div className="space-y-6">
              {/* Highlight Banner */}
              <div className="p-4 bg-gradient-to-r from-blue-50 via-indigo-50/60 to-cyan-50/60 rounded-2xl border border-blue-200/80 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-slate-800">
                      Sơ đồ hành trình toàn diện vụ nuôi công nghệ cao
                    </h4>
                    <p className="text-xs text-slate-500">
                      Theo dõi chi tiết từ giai đoạn thả giống ương dưỡng ➔ tách chuyển giao ➔ thu hoạch các ao thương phẩm.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 text-xs shrink-0">
                  <div className="bg-white px-3 py-1.5 rounded-xl border border-blue-200 shadow-2xs">
                    <span className="text-slate-400 block text-[10px] font-bold uppercase">Tổng sản lượng</span>
                    <strong className="text-blue-700 font-black text-sm">
                      {cycle.totals.totalHarvestKg.toLocaleString()} kg ({cycle.totals.totalHarvestTons} tấn)
                    </strong>
                  </div>
                  <div className="bg-white px-3 py-1.5 rounded-xl border border-emerald-200 shadow-2xs">
                    <span className="text-slate-400 block text-[10px] font-bold uppercase">Sống toàn vụ</span>
                    <strong className="text-emerald-700 font-black text-sm">
                      {cycle.totals.overallSurvivalRate || '--'}%
                    </strong>
                  </div>
                </div>
              </div>

              {/* FLOW DIAGRAM CONTAINER */}
              <div className="space-y-6">
                {/* ── STAGE 1: AO ƯƠNG DƯỠNG (NURSERY) ── */}
                <div className="bg-white rounded-3xl border-2 border-purple-200 shadow-sm overflow-hidden">
                  <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-5 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-base">🌱</span>
                      <h4 className="text-sm font-black uppercase tracking-wider">
                        Giai đoạn 1: Ương dưỡng tôm giống (Nursery Phase)
                      </h4>
                    </div>
                    <span className="text-xs font-bold bg-white/20 px-2.5 py-0.5 rounded-md backdrop-blur-xs">
                      {cycle.nurseryInfo ? `${cycle.nurseryInfo.durationDays} ngày ương (DOC)` : 'Ương dưỡng'}
                    </span>
                  </div>

                  <div className="p-5 grid grid-cols-1 md:grid-cols-3 gap-5 items-center">
                    {/* Pond info & Stocking */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="w-10 h-10 rounded-2xl bg-purple-50 text-purple-700 flex items-center justify-center font-black text-base border border-purple-200">
                          {cycle.nurseryInfo?.pondName.slice(0, 2) || 'A1'}
                        </div>
                        <div>
                          <h5 className="text-base font-black text-slate-800">
                            {cycle.nurseryInfo?.pondName || cycle.rootCrop.pond?.name || 'Ao Ương'}
                          </h5>
                          <p className="text-xs text-slate-400">
                            Diện tích:{' '}
                            <strong className="text-slate-700">
                              {cycle.nurseryInfo?.areaSize ? `${cycle.nurseryInfo.areaSize.toLocaleString()} m²` : 'Không xác định'}
                            </strong>
                          </p>
                        </div>
                      </div>

                      <div className="bg-purple-50/70 p-3 rounded-2xl border border-purple-100 text-xs space-y-1">
                        <div className="flex justify-between">
                          <span className="text-slate-500">Ngày thả giống:</span>
                          <span className="font-bold text-slate-800">{formatDate(cycle.nurseryInfo?.startDate)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Số giống ban đầu:</span>
                          <span className="font-black text-purple-900">
                            {cycle.totals.totalStockedShrimp.toLocaleString()} con
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Giống tôm:</span>
                          <span className="font-medium text-slate-700">{cycle.nurseryInfo?.seedType || 'Tôm thẻ Post 10'}</span>
                        </div>
                        {cycle.nurseryInfo?.seedCost && (
                          <div className="flex justify-between pt-1 border-t border-purple-200/60">
                            <span className="text-slate-500">Chi phí con giống:</span>
                            <span className="font-bold text-slate-800">{formatVND(cycle.nurseryInfo.seedCost)}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Nursery Harvest & Quality */}
                    <div className="space-y-2">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-purple-700 block">
                        Nghiệm thu sau ương dưỡng
                      </span>
                      <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80 text-xs space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500">Ngày tách ao:</span>
                          <span className="font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md border border-purple-100">
                            {formatDate(cycle.nurseryInfo?.transferDate)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500">Số tôm xuất ương:</span>
                          <span className="font-black text-slate-800 text-sm">
                            {cycle.nurseryInfo?.actualNurseryHarvest
                              ? `${cycle.nurseryInfo.actualNurseryHarvest.toLocaleString()} con`
                              : '--'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500">Tỷ lệ sống giai đoạn ương:</span>
                          <span className="font-black text-emerald-700 text-sm">
                            {cycle.nurseryInfo?.nurserySurvivalRate ? `${cycle.nurseryInfo.nurserySurvivalRate}%` : '--'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500">Kích cỡ tôm khi tách:</span>
                          <span className="font-bold text-slate-700">
                            {cycle.nurseryInfo?.transferSize ? `${cycle.nurseryInfo.transferSize} con/kg` : '--'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Status & Options Note */}
                    <div className="space-y-2 flex flex-col justify-between h-full">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                        Tùy chọn tách ao & Ghi chú
                      </span>
                      <div className="bg-indigo-50/60 p-3.5 rounded-2xl border border-indigo-100 text-xs space-y-2 flex-1 flex flex-col justify-between">
                        <div>
                          <div className="flex items-center gap-1.5 font-bold text-indigo-900 mb-1">
                            {cycle.nurseryInfo?.isContinuedInSamePond ? (
                              <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 font-bold">
                                <CheckCircle2 className="w-3.5 h-3.5" /> Giữ ao ương để nuôi tiếp
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md border border-purple-200 font-bold">
                                ➔ Tách toàn bộ sang ao khác
                              </span>
                            )}
                          </div>
                          <p className="text-[11.5px] text-slate-600 italic line-clamp-3">
                            "{cycle.nurseryInfo?.splitNote || 'Không có ghi chú tách ao.'}"
                          </p>
                        </div>

                        <button
                          onClick={() => {
                            if (cycle.status === 'COMPLETED' || cycle.rootCrop.status === 'HARVESTED') {
                              onOpenCropReport(cycle.rootCrop);
                            } else {
                              toast.error(
                                'Ao ương đang nuôi. Cần các ao của vụ nuôi hoàn tất thu hoạch mới có thể xuất báo cáo!',
                                { id: 'status-check-toast', duration: 4000 }
                              );
                            }
                          }}
                          className="w-full mt-2 py-1.5 px-3 bg-white hover:bg-purple-50 text-purple-700 border border-purple-200 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer shadow-2xs"
                        >
                          <FileText className="w-3.5 h-3.5" /> Báo cáo chi tiết ao ương
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* ── SPLIT EVENT CONNECTOR (MŨI TÊN PHÂN BỔ) ── */}
                <div className="relative py-2">
                  <div className="flex items-center justify-center">
                    <div className="bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 text-white px-5 py-2 rounded-2xl shadow-md border border-indigo-200 flex items-center gap-2 text-xs font-black tracking-wide">
                      <GitFork className="w-4 h-4" />
                      <span>SỰ KIỆN TÁCH AO — PHÂN BỔ SANG {cycle.splitAllocations.length || cycle.commercialPonds.length} AO</span>
                    </div>
                  </div>

                  {/* Branches allocation cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 mt-4">
                    {cycle.splitAllocations.map((alloc, idx) => (
                      <div
                        key={idx}
                        className="bg-white p-3.5 rounded-2xl border border-indigo-100 shadow-2xs flex items-center justify-between hover:border-indigo-300 transition-all"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold text-xs border border-indigo-200">
                            #{idx + 1}
                          </div>
                          <div>
                            <span className="font-bold text-slate-800 text-xs block">
                              {alloc.destinationPondName}
                            </span>
                            <span className="text-[10px] font-medium text-slate-400">
                              {alloc.isCurrentPond ? 'Ao gốc giữ lại nuôi tiếp' : 'Ao thương phẩm mới'}
                            </span>
                          </div>
                        </div>

                        <div className="text-right">
                          <span className="font-black text-indigo-700 text-xs block">
                            {alloc.shrimpCount.toLocaleString()} con
                          </span>
                          <span className="text-[10px] font-bold text-indigo-500 bg-indigo-50 px-1.5 py-0.5 rounded-md">
                            {alloc.ratioPercent}% mẻ tôm
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* ── STAGE 2: CÁC AO NUÔI THƯƠNG PHẨM (COMMERCIAL PONDS) ── */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-base">🦐</span>
                      <h4 className="text-sm font-black uppercase tracking-wider text-slate-800">
                        Giai đoạn 2: Nuôi thương phẩm & Kết quả thu hoạch
                      </h4>
                    </div>
                    <span className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded-xl">
                      {cycle.commercialPonds.length} ao thương phẩm
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {cycle.commercialPonds.map((cp) => {
                      const pondProfitPos = cp.profit >= 0;
                      return (
                        <div
                          key={cp.crop.id}
                          className="bg-white rounded-3xl border border-slate-200/90 shadow-xs hover:shadow-lg transition-all duration-300 flex flex-col justify-between overflow-hidden"
                        >
                          {/* Card Head */}
                          <div className="p-4 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                              <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-700 flex items-center justify-center font-black text-sm border border-blue-200">
                                {cp.pondName.slice(0, 2)}
                              </div>
                              <div>
                                <h5 className="text-sm font-black text-slate-900">{cp.pondName}</h5>
                                <p className="text-[11px] text-slate-400">
                                  {cp.areaSize > 0 ? `${cp.areaSize.toLocaleString()} m²` : 'Ao thương phẩm'}
                                  {cp.isOriginNurseryPond && ' • Ao gốc nuôi tiếp'}
                                </p>
                              </div>
                            </div>

                            <span
                              className={`px-2 py-0.5 rounded-md text-[10.5px] font-bold ${
                                cp.status === 'HARVESTED'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : cp.status === 'ACTIVE'
                                  ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                  : 'bg-rose-50 text-rose-700 border border-rose-200'
                              }`}
                            >
                              {cp.status === 'HARVESTED' ? 'Đã thu hoạch' : cp.status === 'ACTIVE' ? 'Đang nuôi' : 'Thất bại'}
                            </span>
                          </div>

                          {/* Card Metrics Body */}
                          <div className="p-4 space-y-3 flex-1 flex flex-col justify-between">
                            {/* Dates & DOC */}
                            <div className="grid grid-cols-2 gap-2 text-[11px] bg-slate-50/70 p-2.5 rounded-xl border border-slate-100">
                              <div>
                                <span className="text-slate-400 block text-[10px]">Ngày nhận tôm:</span>
                                <span className="font-bold text-slate-800">{formatDate(cp.startDate)}</span>
                              </div>
                              <div>
                                <span className="text-slate-400 block text-[10px]">Ngày thu hoạch:</span>
                                <span className="font-bold text-slate-800">{formatDate(cp.harvestDate)}</span>
                              </div>
                              <div className="pt-1.5 border-t border-slate-200/50">
                                <span className="text-slate-400 block text-[10px]">Thời gian nuôi:</span>
                                <span className="font-black text-blue-600">{cp.durationDays} ngày DOC</span>
                              </div>
                              <div className="pt-1.5 border-t border-slate-200/50">
                                <span className="text-slate-400 block text-[10px]">Số tôm nuôi:</span>
                                <span className="font-black text-slate-800">{cp.initialShrimpCount.toLocaleString()} con</span>
                              </div>
                            </div>

                            {/* Harvest Technical Metrics */}
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <div className="p-2.5 bg-blue-50/60 rounded-xl border border-blue-100">
                                <span className="text-[10px] text-blue-600 font-bold block uppercase">
                                  ⚖️ Sản lượng thu
                                </span>
                                <span className="font-black text-blue-900 text-sm">
                                  {cp.harvestKg.toLocaleString()} kg
                                </span>
                                <span className="text-[10px] text-blue-600 block">
                                  (~{(cp.harvestKg / 1000).toFixed(2)} tấn)
                                </span>
                              </div>

                              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                                <span className="text-[10px] text-slate-400 font-bold block uppercase">
                                  🎯 Size tôm thu
                                </span>
                                <span className="font-black text-slate-800 text-sm">
                                  {cp.harvestSize ? `${cp.harvestSize}` : '--'}
                                </span>
                                <span className="text-[10px] text-slate-400 block">con/kg</span>
                              </div>

                              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                                <span className="text-[10px] text-slate-400 font-bold block uppercase">
                                  📊 FCR thực tế
                                </span>
                                <span className="font-black text-slate-800 text-sm">
                                  {cp.fcr !== null ? cp.fcr : '--'}
                                </span>
                              </div>

                              <div className="p-2.5 bg-emerald-50/60 rounded-xl border border-emerald-100">
                                <span className="text-[10px] text-emerald-700 font-bold block uppercase">
                                  🛡️ Tỷ lệ sống
                                </span>
                                <span className="font-black text-emerald-800 text-sm">
                                  {cp.survivalRate !== null ? `${cp.survivalRate}%` : '--'}
                                </span>
                              </div>
                            </div>

                            {/* Financial Summary */}
                            <div className="p-3 bg-gradient-to-r from-slate-50 to-indigo-50/30 rounded-xl border border-slate-200/80 text-xs space-y-1">
                              <div className="flex justify-between">
                                <span className="text-slate-500">Doanh thu:</span>
                                <span className="font-bold text-slate-800">{formatVND(cp.revenue)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-500">Tổng chi phí:</span>
                                <span className="font-medium text-slate-600">{formatVND(cp.cost)}</span>
                              </div>
                              <div className="flex justify-between pt-1 border-t border-slate-200/60">
                                <span className="font-bold text-slate-700">Lợi nhuận:</span>
                                <span
                                  className={`font-black text-sm ${
                                    pondProfitPos ? 'text-emerald-700' : 'text-rose-700'
                                  }`}
                                >
                                  {pondProfitPos ? '+' : ''}
                                  {formatVND(cp.profit)}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Card Footer Button */}
                          <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-2">
                            <button
                              onClick={() => {
                                if (cp.status === 'HARVESTED') {
                                  onOpenCropReport(cp.crop);
                                } else {
                                  toast.error(
                                    `Ao ${cp.pondName} đang nuôi. Cần các ao của vụ nuôi hoàn tất thu hoạch mới có thể xuất báo cáo!`,
                                    { id: 'status-check-toast', duration: 4000 }
                                  );
                                }
                              }}
                              className="flex-1 py-1.5 px-3 bg-white hover:bg-blue-50 text-blue-700 border border-blue-200 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                              title="Xem báo cáo chi tiết vận hành 5T, tăng trưởng và thức ăn của ao này"
                            >
                              <FileText className="w-3.5 h-3.5" /> Báo cáo chi tiết ao
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── TAB 2: TẤT CẢ CÁC AO THUỘC VỤ ─────────────────────────────── */}
          {activeTab === 'ponds' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-base font-black text-slate-800">
                    Danh sách tất cả các ao tham gia vụ nuôi ({cycle.allCrops.length} bản ghi ao)
                  </h4>
                  <p className="text-xs text-slate-500">
                    Bao gồm ao ương dưỡng ban đầu và toàn bộ các ao thương phẩm sau khi tách ao.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {cycle.allCrops.map((crop) => {
                  const isNursery = crop.stage === 'NURSERY';
                  return (
                    <div
                      key={crop.id}
                      className="bg-white rounded-3xl border border-slate-200/90 shadow-xs hover:shadow-md transition-all p-5 flex flex-col justify-between space-y-4"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div>
                            <h5 className="text-base font-black text-slate-800">
                              {crop.pond?.name || 'Ao nuôi'}
                            </h5>
                            <span className="text-xs text-slate-400">
                              Diện tích: {crop.pond?.areaSize ? `${crop.pond.areaSize.toLocaleString()} m²` : '--'}
                            </span>
                          </div>

                          <span
                            className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                              isNursery
                                ? 'bg-purple-50 text-purple-700 border border-purple-200'
                                : 'bg-blue-50 text-blue-700 border border-blue-200'
                            }`}
                          >
                            {isNursery ? '🌱 Ao Ương' : '🦐 Nuôi Thương phẩm'}
                          </span>
                        </div>

                        <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 text-xs space-y-1.5">
                          <div className="flex justify-between">
                            <span className="text-slate-500">Ngày bắt đầu:</span>
                            <span className="font-bold text-slate-800">{formatDate(crop.startDate)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500">Số lượng giống:</span>
                            <span className="font-black text-slate-800">
                              {crop.initialShrimpCount.toLocaleString()} con
                            </span>
                          </div>
                          {crop.actualHarvestDate && (
                            <div className="flex justify-between">
                              <span className="text-slate-500">Ngày thu hoạch:</span>
                              <span className="font-bold text-slate-800">{formatDate(crop.actualHarvestDate)}</span>
                            </div>
                          )}
                          {crop.actualHarvestKg && (
                            <div className="flex justify-between">
                              <span className="text-slate-500">Sản lượng:</span>
                              <span className="font-black text-blue-700">
                                {crop.actualHarvestKg.toLocaleString()} kg (~{(crop.actualHarvestKg / 1000).toFixed(2)} tấn)
                              </span>
                            </div>
                          )}
                          {crop.actualHarvestProfit !== null && crop.actualHarvestProfit !== undefined && (
                            <div className="flex justify-between pt-1 border-t border-slate-200/60">
                              <span className="font-bold text-slate-600">Lợi nhuận ròng:</span>
                              <span
                                className={`font-black ${
                                  crop.actualHarvestProfit >= 0 ? 'text-emerald-700' : 'text-rose-700'
                                }`}
                              >
                                {crop.actualHarvestProfit >= 0 ? '+' : ''}
                                {formatVND(crop.actualHarvestProfit)}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      <button
                        onClick={() => {
                          if (crop.status === 'HARVESTED') {
                            onOpenCropReport(crop);
                          } else {
                            toast.error(
                              `Ao ${crop.pond?.name || ''} đang nuôi. Cần các ao của vụ nuôi hoàn tất thu hoạch mới có thể xuất báo cáo!`,
                              { id: 'status-check-toast', duration: 4000 }
                            );
                          }
                        }}
                        className="w-full py-2 px-3 bg-gradient-to-r from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100 text-blue-700 border border-blue-200 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                      >
                        <FileText className="w-3.5 h-3.5" /> Báo cáo chi tiết vụ nuôi
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── TAB 3: BẢNG SO SÁNH & TỔNG KẾT VỤ ──────────────────────────── */}
          {activeTab === 'comparison' && (
            <div className="space-y-6">
              {/* Comparison Table */}
              <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden">
                <div className="p-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TableIcon className="w-4 h-4 text-blue-600" />
                    <h4 className="text-sm font-black text-slate-800">
                      Bảng so sánh hiệu quả kỹ thuật và tài chính giữa các ao
                    </h4>
                  </div>
                  <span className="text-xs text-slate-500">
                    Đơn vị tiền: VNĐ • Sản lượng: kg
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100/80 text-slate-600 font-bold border-b border-slate-200">
                      <tr>
                        <th className="p-3 pl-4">Ao nuôi</th>
                        <th className="p-3">Vai trò</th>
                        <th className="p-3 text-right">Diện tích (m²)</th>
                        <th className="p-3 text-right">Giống thả/nhận</th>
                        <th className="p-3 text-right">DOC</th>
                        <th className="p-3 text-right">Sản lượng (kg)</th>
                        <th className="p-3 text-right">Size (con/kg)</th>
                        <th className="p-3 text-right">FCR</th>
                        <th className="p-3 text-right">Tỷ lệ sống</th>
                        <th className="p-3 text-right">Doanh thu</th>
                        <th className="p-3 text-right">Chi phí</th>
                        <th className="p-3 text-right pr-4">Lợi nhuận</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {cycle.commercialPonds.map((cp) => {
                        const profPos = cp.profit >= 0;
                        return (
                          <tr key={cp.crop.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="p-3 pl-4 font-bold text-slate-800">{cp.pondName}</td>
                            <td className="p-3">
                              <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 text-[10.5px] font-bold">
                                {cp.isOriginNurseryPond ? 'Ao gốc nuôi tiếp' : 'Thương phẩm'}
                              </span>
                            </td>
                            <td className="p-3 text-right text-slate-600">
                              {cp.areaSize > 0 ? cp.areaSize.toLocaleString() : '--'}
                            </td>
                            <td className="p-3 text-right font-medium text-slate-800">
                              {cp.initialShrimpCount.toLocaleString()}
                            </td>
                            <td className="p-3 text-right text-slate-600">{cp.durationDays} ngày</td>
                            <td className="p-3 text-right font-black text-blue-900">
                              {cp.harvestKg.toLocaleString()}
                            </td>
                            <td className="p-3 text-right text-slate-700 font-medium">
                              {cp.harvestSize || '--'}
                            </td>
                            <td className="p-3 text-right font-bold text-purple-700">
                              {cp.fcr !== null ? cp.fcr : '--'}
                            </td>
                            <td className="p-3 text-right font-bold text-emerald-700">
                              {cp.survivalRate !== null ? `${cp.survivalRate}%` : '--'}
                            </td>
                            <td className="p-3 text-right font-medium text-slate-700">
                              {formatVND(cp.revenue)}
                            </td>
                            <td className="p-3 text-right text-slate-500">
                              {formatVND(cp.cost)}
                            </td>
                            <td className={`p-3 text-right pr-4 font-black ${profPos ? 'text-emerald-700' : 'text-rose-700'}`}>
                              {profPos ? '+' : ''}
                              {formatVND(cp.profit)}
                            </td>
                          </tr>
                        );
                      })}

                      {/* Total row */}
                      <tr className="bg-slate-100 font-black text-slate-900 border-t-2 border-slate-300">
                        <td className="p-3 pl-4" colSpan={2}>
                          TỔNG CỘNG / TRUNG BÌNH TOÀN VỤ
                        </td>
                        <td className="p-3 text-right">
                          {cycle.commercialPonds.reduce((s, cp) => s + cp.areaSize, 0).toLocaleString()}
                        </td>
                        <td className="p-3 text-right">
                          {cycle.totals.totalStockedShrimp.toLocaleString()}
                        </td>
                        <td className="p-3 text-right">{cycle.durationDays} ngày</td>
                        <td className="p-3 text-right text-blue-900 text-sm">
                          {cycle.totals.totalHarvestKg.toLocaleString()} kg
                        </td>
                        <td className="p-3 text-right text-slate-800">
                          ~{cycle.totals.avgHarvestSize || '--'}
                        </td>
                        <td className="p-3 text-right text-purple-700">
                          {cycle.totals.avgFcr || '--'}
                        </td>
                        <td className="p-3 text-right text-emerald-700">
                          {cycle.totals.overallSurvivalRate || '--'}%
                        </td>
                        <td className="p-3 text-right">{formatVND(cycle.totals.totalRevenue)}</td>
                        <td className="p-3 text-right text-slate-600">{formatVND(cycle.totals.totalCost)}</td>
                        <td className={`p-3 text-right pr-4 text-sm ${isProfitPositive ? 'text-emerald-700' : 'text-rose-700'}`}>
                          {isProfitPositive ? '+' : ''}
                          {formatVND(cycle.totals.totalProfit)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Harvest Review & Lessons Learned */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
                  <div className="flex items-center gap-2 text-blue-700 font-bold text-xs uppercase tracking-wider">
                    <Award className="w-4 h-4" /> Đánh giá & Phân tích tổng thể
                  </div>
                  <p className="text-xs text-slate-700 leading-relaxed">
                    {cycle.rootCrop.harvestEvaluation ||
                      'Vụ nuôi đã hoàn thành các chỉ tiêu cơ bản. Tốc độ tăng trưởng và tỷ lệ sống đạt mức tốt theo quy trình công nghệ cao.'}
                  </p>
                </div>

                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
                  <div className="flex items-center gap-2 text-indigo-700 font-bold text-xs uppercase tracking-wider">
                    <ShieldCheck className="w-4 h-4" /> Bài học & Khuyến nghị vụ sau
                  </div>
                  <p className="text-xs text-slate-700 leading-relaxed">
                    {cycle.rootCrop.harvestLessonsLearned ||
                      cycle.rootCrop.harvestNextRecommendation ||
                      'Cần tiếp tục duy trì quản lý môi trường nước 5T, kiểm soát chặt chẽ lượng thức ăn trong 20 ngày đầu ương dưỡng để hạn chế thất thoát giống.'}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Bottom Footer */}
        <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Info className="w-4 h-4 text-blue-500" />
            <span>Mọi số liệu tài chính và kỹ thuật được tổng hợp từ lúc thả giống đến thu hoạch.</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer"
            >
              {asPage ? 'Quay lại danh sách vụ nuôi' : 'Đóng'}
            </button>
          </div>
        </div>
      </div>
  );

  if (asPage) {
    return (
      <div className="w-full space-y-4 animate-in fade-in duration-200 pb-12">
        {modalContent}
        {showExportModal && (
          <CropReportExportModal
            isOpen={showExportModal}
            cycle={cycle}
            crop={cycle.allCrops[0] || null}
            onClose={() => setShowExportModal(false)}
          />
        )}
      </div>
    );
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-200">
      {modalContent}
      {showExportModal && (
        <CropReportExportModal
          isOpen={showExportModal}
          cycle={cycle}
          crop={cycle.allCrops[0] || null}
          onClose={() => setShowExportModal(false)}
        />
      )}
    </div>,
    document.body
  );
}
