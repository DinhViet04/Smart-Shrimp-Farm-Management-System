import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Scale,
  DollarSign,
  Target,
  Sparkles,
  Edit2,
  TrendingUp,
  AlertTriangle,
  HeartPulse,
  Utensils,
  Droplets,
  ShieldCheck,
  Printer,
  Info,
  AlertCircle,
  FileText,
  GitBranch,
  RefreshCw,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { cropService, type Crop, type CropDetailedReportResponse } from '../services/crop.service';

interface CropDetailReportModalProps {
  isOpen: boolean;
  crop: Crop;
  onClose: () => void;
  onEditHarvest?: (crop: Crop) => void;
}

const formatVND = (num: number | null | undefined): string => {
  if (num === null || num === undefined || isNaN(num)) return '0';
  return new Intl.NumberFormat('vi-VN').format(Math.round(num));
};

const formatDate = (dateVal: any, includeTime: boolean = false): string => {
  if (!dateVal) return '--';
  try {
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return '--';
    if (includeTime) {
      return d.toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    }
    return d.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return '--';
  }
};

type ReportTab =
  | 'overview'
  | 'feeding'
  | 'water'
  | 'growth'
  | 'health'
  | 'treatments'
  | 'financial';

export default function CropDetailReportModal({
  isOpen,
  crop,
  onClose,
  onEditHarvest,
}: CropDetailReportModalProps) {
  const [activeTab, setActiveTab] = useState<ReportTab>('overview');
  const [report, setReport] = useState<CropDetailedReportResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !crop) return;
    let isMounted = true;
    setLoading(true);
    setError(null);

    cropService
      .getDetailedReport(crop.id)
      .then((data) => {
        if (isMounted) setReport(data);
      })
      .catch((err) => {
        if (isMounted) setError(err.message || 'Lỗi khi tải báo cáo chi tiết vụ nuôi');
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, crop]);

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  const currentCrop = report?.crop || crop;
  const isHarvested = currentCrop.status === 'HARVESTED';
  const isNursery = currentCrop.stage === 'NURSERY';
  const docDays = report?.doc || 90;

  // Highlights
  const actualKg = report?.financial.actualKg || currentCrop.actualHarvestKg || 0;
  const actualSize = report?.financial.actualSize || currentCrop.actualHarvestSize || 0;
  const latestGrowthSample = report?.growth.latestSample;
  const currentBiomass = actualKg > 0 ? actualKg : (latestGrowthSample?.estimatedBiomassKg ? Number(latestGrowthSample.estimatedBiomassKg) : null);
  const currentSize = actualSize > 0 ? actualSize : (latestGrowthSample?.sizePerKg ? Number(latestGrowthSample.sizePerKg) : null);

  const totalFeedKg = report?.feeding.totalFeedKg || 0;
  const actualFcr = report?.financial.fcr || currentCrop.actualHarvestFcr;
  const survivalRate = report?.financial.survivalRate || currentCrop.actualHarvestSurvivalRate;

  const totalCost = report?.financial.costs.total || currentCrop.actualHarvestCost || 0;
  const revenue = report?.financial.actualRevenue || currentCrop.actualHarvestRevenue || 0;
  const profit = report?.financial.profit !== undefined ? report.financial.profit : (currentCrop.actualHarvestProfit || 0);

  // Targets
  const targetBiomassKg = currentCrop.targetSurvivalRate && currentCrop.targetHarvestSize && currentCrop.initialShrimpCount
    ? Math.round(((currentCrop.initialShrimpCount * currentCrop.targetSurvivalRate) / 100) / currentCrop.targetHarvestSize)
    : null;
  const targetFcr = currentCrop.targetTotalFeedKg && targetBiomassKg && targetBiomassKg > 0
    ? parseFloat((currentCrop.targetTotalFeedKg / targetBiomassKg).toFixed(2))
    : 1.2;

  // Chart data for Growth
  const growthChartData = (report?.growth.samples || []).map((s) => ({
    name: `Ngày ${s.doc || formatDate(s.samplingDate)}`,
    date: formatDate(s.samplingDate),
    abw: Number(s.abwGram) || 0,
    size: Number(s.sizePerKg) || 0,
    adg: s.adgGramPerDay ? Number(s.adgGramPerDay) : null,
    biomass: s.estimatedBiomassKg ? Number(s.estimatedBiomassKg) : null,
  }));

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4 md:p-6 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl w-full max-w-6xl shadow-2xl border border-slate-200/90 overflow-hidden max-h-[94vh] flex flex-col relative print:max-h-none print:shadow-none print:border-none print:w-full">
        {/* Top Gradient Banner */}
        <div className="h-2 bg-gradient-to-r from-blue-600 via-cyan-500 to-emerald-500 shrink-0" />

        {/* Modal Header */}
        <div className="p-4 sm:p-6 pb-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0 bg-slate-50/70">
          <div className="flex items-start gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-lg shadow-blue-500/25 shrink-0 mt-0.5">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight">
                  Báo Cáo Chi Tiết Vụ Nuôi: {currentCrop.pond?.name}
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200">
                  {currentCrop.pond?.farm?.name || 'Trang trại'}
                </span>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                  isHarvested
                    ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                    : isNursery
                    ? 'bg-purple-100 text-purple-800 border-purple-200'
                    : 'bg-cyan-100 text-cyan-800 border-cyan-200'
                }`}>
                  {isHarvested ? '● Đã thu hoạch' : isNursery ? '🌱 Ương dưỡng (Giai đoạn 1)' : '🟢 Đang nuôi (Thương phẩm)'}
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium mt-1 flex items-center gap-2 flex-wrap">
                <span>Ngày thả: <strong className="text-slate-700">{formatDate(currentCrop.startDate)}</strong></span>
                <span>•</span>
                <span>
                  {isHarvested ? (
                    <>Ngày thu hoạch: <strong className="text-slate-700">{formatDate(currentCrop.actualHarvestDate)}</strong></>
                  ) : currentCrop.transferDate ? (
                    <>Ngày tách ao: <strong className="text-slate-700">{formatDate(currentCrop.transferDate)}</strong></>
                  ) : (
                    <>Thời gian nuôi đến nay: <strong className="text-cyan-700">{docDays} ngày</strong></>
                  )}
                </span>
                <span>•</span>
                <span>Số giống thả: <strong className="text-slate-700">{currentCrop.initialShrimpCount?.toLocaleString()} con</strong></span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center print:hidden">
            <button
              type="button"
              onClick={handlePrint}
              className="px-3 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl transition-all text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-2xs hover:scale-105"
              title="In bản báo cáo hoặc xuất file PDF"
            >
              <Printer className="w-4 h-4 text-slate-500" /> In / PDF
            </button>

            {isHarvested && onEditHarvest && (
              <button
                type="button"
                onClick={() => onEditHarvest(currentCrop)}
                className="px-3 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white rounded-xl transition-all text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-md shadow-blue-500/20 hover:scale-105"
                title="Mở form chỉnh sửa thông tin thu hoạch"
              >
                <Edit2 className="w-3.5 h-3.5" /> Chỉnh sửa thu hoạch
              </button>
            )}

            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 4 Executive KPI Highlight Cards */}
        <div className="p-4 sm:p-6 pb-3 border-b border-slate-100 bg-white grid grid-cols-2 md:grid-cols-4 gap-3 shrink-0">
          {/* KPI 1: Biomass / Harvest */}
          <div className="p-3.5 bg-gradient-to-br from-blue-50 to-indigo-50/50 border border-blue-100/80 rounded-2xl">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-blue-700 uppercase tracking-wider">
                {isHarvested ? 'Sản lượng thu hoạch' : 'Sinh khối ước tính'}
              </span>
              <Scale className="w-4 h-4 text-blue-600 opacity-80" />
            </div>
            <div className="text-xl sm:text-2xl font-black text-blue-950 mt-1">
              {currentBiomass ? currentBiomass.toLocaleString() : '--'}
              <span className="text-xs font-bold text-blue-600 ml-1">kg</span>
            </div>
            <div className="text-xs font-medium text-slate-500 mt-0.5">
              Size: <strong className="text-blue-700">{currentSize ? `${currentSize} con/kg` : '--'}</strong>
              {currentSize && currentSize > 0 && (
                <span className="text-slate-400 ml-1">({(1000 / currentSize).toFixed(1)}g/con)</span>
              )}
            </div>
          </div>

          {/* KPI 2: Survival & Count */}
          <div className="p-3.5 bg-gradient-to-br from-purple-50 to-pink-50/50 border border-purple-100/80 rounded-2xl">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-purple-700 uppercase tracking-wider">
                Tỷ lệ sống & Giống
              </span>
              <HeartPulse className="w-4 h-4 text-purple-600 opacity-80" />
            </div>
            <div className="text-xl sm:text-2xl font-black text-purple-950 mt-1">
              {survivalRate !== null && survivalRate !== undefined ? `${survivalRate}%` : '--'}
            </div>
            <div className="text-xs font-medium text-slate-500 mt-0.5">
              Thả: <strong className="text-slate-700">{currentCrop.initialShrimpCount?.toLocaleString()}</strong> con
              {currentCrop.targetSurvivalRate && (
                <span className="text-slate-400 ml-1">| Mục tiêu: {currentCrop.targetSurvivalRate}%</span>
              )}
            </div>
          </div>

          {/* KPI 3: Feed & FCR */}
          <div className="p-3.5 bg-gradient-to-br from-emerald-50 to-teal-50/50 border border-emerald-100/80 rounded-2xl">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">
                Thức ăn & Hệ số FCR
              </span>
              <Utensils className="w-4 h-4 text-emerald-600 opacity-80" />
            </div>
            <div className="text-xl sm:text-2xl font-black text-emerald-950 mt-1">
              {actualFcr ? actualFcr : '--'}
              <span className="text-xs font-bold text-emerald-600 ml-1">FCR</span>
            </div>
            <div className="text-xs font-medium text-slate-500 mt-0.5">
              Đã ăn: <strong className="text-emerald-700">{totalFeedKg.toLocaleString()} kg</strong>
              {targetFcr && (
                <span className="text-slate-400 ml-1">| Mục tiêu: {targetFcr}</span>
              )}
            </div>
          </div>

          {/* KPI 4: Financial Efficiency */}
          <div className={`p-3.5 border rounded-2xl ${
            profit >= 0
              ? 'bg-gradient-to-br from-teal-50 to-emerald-50/50 border-emerald-100/80'
              : 'bg-gradient-to-br from-rose-50 to-orange-50/50 border-rose-100/80'
          }`}>
            <div className="flex items-center justify-between">
              <span className={`text-[11px] font-bold uppercase tracking-wider ${
                profit >= 0 ? 'text-emerald-700' : 'text-rose-700'
              }`}>
                {isHarvested ? (profit >= 0 ? 'Tiền lời (+)' : 'Tiền lỗ (-)') : 'Tổng chi phí đầu tư'}
              </span>
              <DollarSign className={`w-4 h-4 opacity-80 ${profit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`} />
            </div>
            <div className={`text-xl sm:text-2xl font-black mt-1 ${
              profit >= 0 ? 'text-emerald-950' : 'text-rose-950'
            }`}>
              {isHarvested
                ? `${profit >= 0 ? '+' : ''}${formatVND(profit)} đ`
                : `${formatVND(totalCost)} đ`}
            </div>
            <div className="text-xs font-medium text-slate-500 mt-0.5">
              {isHarvested ? (
                <>Doanh thu: <strong className="text-slate-700">{formatVND(revenue)} đ</strong></>
              ) : (
                <>Chi phí vật tư đã dùng: <strong className="text-slate-700">{formatVND(totalCost)} đ</strong></>
              )}
            </div>
          </div>
        </div>

        {/* Navigation Tabs Bar */}
        <div className="flex border-b border-slate-200/80 px-4 sm:px-6 gap-1 bg-white shrink-0 overflow-x-auto print:hidden">
          <button
            onClick={() => setActiveTab('overview')}
            className={`py-3 px-3 text-xs font-bold flex items-center gap-1.5 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'overview'
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <GitBranch className="w-4 h-4" /> Hành Trình 
          </button>
          <button
            onClick={() => setActiveTab('feeding')}
            className={`py-3 px-3 text-xs font-bold flex items-center gap-1.5 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'feeding'
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Utensils className="w-4 h-4" /> Lịch Sử Cho Ăn ({report?.feeding.totalSessions || 0})
          </button>
          <button
            onClick={() => setActiveTab('water')}
            className={`py-3 px-3 text-xs font-bold flex items-center gap-1.5 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'water'
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Droplets className="w-4 h-4" /> Đo Nước ({report?.waterQuality.totalMeasurements || 0})
          </button>
          <button
            onClick={() => setActiveTab('growth')}
            className={`py-3 px-3 text-xs font-bold flex items-center gap-1.5 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'growth'
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <TrendingUp className="w-4 h-4" /> Tăng Trưởng & Sinh Khối ({report?.growth.totalSamples || 0})
          </button>
          <button
            onClick={() => setActiveTab('health')}
            className={`py-3 px-3 text-xs font-bold flex items-center gap-1.5 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'health'
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <HeartPulse className="w-4 h-4" /> Sức Khỏe Tôm ({report?.health.totalInspections || 0})
          </button>
          <button
            onClick={() => setActiveTab('treatments')}
            className={`py-3 px-3 text-xs font-bold flex items-center gap-1.5 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'treatments'
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <ShieldCheck className="w-4 h-4" /> Sự Cố  ({report?.treatmentsAndSupplies.totalMaterialsUsed || 0})
          </button>
          <button
            onClick={() => setActiveTab('financial')}
            className={`py-3 px-3 text-xs font-bold flex items-center gap-1.5 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'financial'
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <DollarSign className="w-4 h-4" /> Chi Phí & Tài Chính
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1 bg-slate-50/40">
          {loading && (
            <div className="flex flex-col items-center justify-center p-12 text-slate-400">
              <RefreshCw className="w-8 h-8 animate-spin text-blue-600 mb-3" />
              <p className="font-semibold text-sm">Đang tải và tổng hợp dữ liệu toàn diện của vụ nuôi...</p>
            </div>
          )}

          {error && (
            <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-2xl flex items-center gap-3">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <p className="text-sm font-medium">{error}</p>
            </div>
          )}

          {!loading && report && (
            <>
              {/* TAB 1: OVERVIEW & TRANSFER */}
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  {/* Nursery Split Transfer Section (ĐẶC BIỆT CHÚ TRỌNG) */}
                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                    <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider flex items-center gap-2 mb-4">
                      <GitBranch className="w-4 h-4 text-purple-600" />
                      Thông Tin Tách Ao & Quy Trình 2 Giai Đoạn (Nursery & Grow-out)
                    </h3>

                    {report.transferInfo.splitFromParent ? (
                      <div className="p-4 bg-gradient-to-r from-purple-50 via-indigo-50 to-blue-50 border border-purple-200 rounded-2xl">
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                            <Sparkles className="w-5 h-5" />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-black text-purple-950 text-base">
                                Tách từ: {report.transferInfo.splitFromParent.pondName}
                              </span>
                              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-purple-200 text-purple-800">
                                Ao Ương Dưỡng Gốc
                              </span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3 text-xs">
                              <div className="bg-white/80 p-2.5 rounded-xl border border-purple-100">
                                <span className="text-slate-500 font-semibold block">Ngày tách sang ao này:</span>
                                <strong className="text-purple-900 text-sm">
                                  {formatDate(report.transferInfo.splitFromParent.transferDate)}
                                </strong>
                              </div>
                              <div className="bg-white/80 p-2.5 rounded-xl border border-purple-100">
                                <span className="text-slate-500 font-semibold block">Số lượng tôm tiếp nhận:</span>
                                <strong className="text-purple-900 text-sm">
                                  {report.transferInfo.splitFromParent.initialCountReceived?.toLocaleString()} con
                                </strong>
                              </div>
                              <div className="bg-white/80 p-2.5 rounded-xl border border-purple-100">
                                <span className="text-slate-500 font-semibold block">Kích cỡ tôm lúc tách:</span>
                                <strong className="text-purple-900 text-sm">
                                  {report.transferInfo.splitFromParent.transferSize ? `${report.transferInfo.splitFromParent.transferSize} con/kg` : 'Theo chuẩn ương dưỡng'}
                                </strong>
                              </div>
                            </div>
                            {report.transferInfo.splitFromParent.splitNote && (
                              <p className="text-xs text-purple-800/80 mt-2 italic">
                                Ghi chú tách ao: &quot;{report.transferInfo.splitFromParent.splitNote}&quot;
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : report.transferInfo.splitToChildren ? (
                      <div className="p-4 bg-gradient-to-r from-purple-50 via-indigo-50 to-blue-50 border border-purple-200 rounded-2xl">
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                            <Sparkles className="w-5 h-5" />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-black text-purple-950 text-base">
                                Đây là Ao Ương Dưỡng - Đã tách thành công sang {report.transferInfo.splitToChildren.totalChildPonds} ao nuôi tiếp theo
                              </span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3 text-xs">
                              <div className="bg-white/80 p-2.5 rounded-xl border border-purple-100">
                                <span className="text-slate-500 font-semibold block">Ngày thực hiện tách ao:</span>
                                <strong className="text-purple-900 text-sm">
                                  {formatDate(report.transferInfo.splitToChildren.transferDate)}
                                </strong>
                              </div>
                              <div className="bg-white/80 p-2.5 rounded-xl border border-purple-100">
                                <span className="text-slate-500 font-semibold block">Tổng tôm xuất ương:</span>
                                <strong className="text-purple-900 text-sm">
                                  {report.transferInfo.splitToChildren.actualNurseryHarvest?.toLocaleString()} con
                                </strong>
                              </div>
                              <div className="bg-white/80 p-2.5 rounded-xl border border-purple-100">
                                <span className="text-slate-500 font-semibold block">Tỷ lệ sống giai đoạn ương:</span>
                                <strong className="text-purple-900 text-sm">
                                  {report.transferInfo.splitToChildren.nurserySurvivalRate}%
                                </strong>
                              </div>
                            </div>

                            <div className="mt-3 pt-3 border-t border-purple-200/60">
                              <span className="text-xs font-bold text-slate-700 block mb-2">
                                Danh sách các ao nuôi thương phẩm đã tiếp nhận tôm giống:
                              </span>
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                {report.transferInfo.splitToChildren.children.map((c) => (
                                  <div key={c.id} className="p-2.5 bg-white rounded-xl border border-slate-200 text-xs flex items-center justify-between">
                                    <span className="font-bold text-slate-800">{c.pondName}</span>
                                    <span className="font-extrabold text-blue-600">{c.initialShrimpCount?.toLocaleString()} con</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs text-slate-600 flex items-center gap-3">
                        <Info className="w-5 h-5 text-slate-400 shrink-0" />
                        <span>Vụ nuôi này được thả giống trực tiếp, không qua tách ao từ ao ương dưỡng khác.</span>
                      </div>
                    )}
                  </div>

                  {/* Target vs Actual Comparison Table */}
                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                    <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider flex items-center gap-2 mb-4">
                      <Target className="w-4 h-4 text-blue-600" />
                      Đối Chiếu Chỉ Tiêu Kế Hoạch Ban Đầu vs Kết Quả Thực Tế
                    </h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-slate-50/80 text-slate-500 font-bold border-b border-slate-200">
                            <th className="py-2.5 px-3">Chỉ số kỹ thuật</th>
                            <th className="py-2.5 px-3">Mục tiêu kế hoạch</th>
                            <th className="py-2.5 px-3">Thực tế đạt được</th>
                            <th className="py-2.5 px-3">Đánh giá chuẩn 5T</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          <tr>
                            <td className="py-2.5 px-3 font-semibold text-slate-700">Tỷ lệ sống (%)</td>
                            <td className="py-2.5 px-3 font-bold text-slate-600">
                              {currentCrop.targetSurvivalRate ? `${currentCrop.targetSurvivalRate}%` : '--'}
                            </td>
                            <td className="py-2.5 px-3 font-black text-purple-700">
                              {survivalRate !== null && survivalRate !== undefined ? `${survivalRate}%` : '--'}
                            </td>
                            <td className="py-2.5 px-3 font-bold">
                              {survivalRate && currentCrop.targetSurvivalRate ? (
                                survivalRate >= currentCrop.targetSurvivalRate ? (
                                  <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">✓ Đạt mục tiêu</span>
                                ) : (
                                  <span className="text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md">✕ Dưới mục tiêu</span>
                                )
                              ) : '--'}
                            </td>
                          </tr>
                          <tr>
                            <td className="py-2.5 px-3 font-semibold text-slate-700">Kích cỡ thu hoạch (con/kg)</td>
                            <td className="py-2.5 px-3 font-bold text-slate-600">
                              {currentCrop.targetHarvestSize ? `${currentCrop.targetHarvestSize} con/kg` : '--'}
                            </td>
                            <td className="py-2.5 px-3 font-black text-emerald-700">
                              {currentSize ? `${currentSize} con/kg` : '--'}
                            </td>
                            <td className="py-2.5 px-3 font-bold">
                              {currentSize && currentCrop.targetHarvestSize ? (
                                currentSize <= currentCrop.targetHarvestSize ? (
                                  <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">✓ Tôm đạt size lớn</span>
                                ) : (
                                  <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md">⚠ Size nhỏ hơn dự kiến</span>
                                )
                              ) : '--'}
                            </td>
                          </tr>
                          <tr>
                            <td className="py-2.5 px-3 font-semibold text-slate-700">Hệ số chuyển hóa thức ăn (FCR)</td>
                            <td className="py-2.5 px-3 font-bold text-slate-600">
                              {targetFcr ? `${targetFcr}` : '1.20'}
                            </td>
                            <td className="py-2.5 px-3 font-black text-blue-700">
                              {actualFcr ? `${actualFcr}` : '--'}
                            </td>
                            <td className="py-2.5 px-3 font-bold">
                              {actualFcr ? (
                                actualFcr <= (targetFcr || 1.25) ? (
                                  <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">✓ Tiêu hóa tối ưu</span>
                                ) : (
                                  <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md">⚠ FCR cao, cần tối ưu cám</span>
                                )
                              ) : '--'}
                            </td>
                          </tr>
                          <tr>
                            <td className="py-2.5 px-3 font-semibold text-slate-700">Tổng lượng thức ăn (kg)</td>
                            <td className="py-2.5 px-3 font-bold text-slate-600">
                              {currentCrop.targetTotalFeedKg ? `${currentCrop.targetTotalFeedKg.toLocaleString()} kg` : '--'}
                            </td>
                            <td className="py-2.5 px-3 font-black text-slate-800">
                              {totalFeedKg.toLocaleString()} kg
                            </td>
                            <td className="py-2.5 px-3 font-bold">
                              <span className="text-slate-600">{report.feeding.completedSessions} cữ ăn đã nạp</span>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Harvest Notes & Evaluation */}
                  {isHarvested && (
                    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                      <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                        <FileText className="w-4 h-4 text-emerald-600" />
                        Đánh Giá & Bài Học Rút Ra Sau Vụ Nuôi
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                        <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                          <strong className="text-slate-700 block mb-1">Ghi chú & Nhật ký thu hoạch:</strong>
                          <p className="text-slate-600 leading-relaxed">
                            {currentCrop.harvestNote || 'Không có ghi chú thu hoạch đặc biệt.'}
                          </p>
                        </div>
                        <div className="p-3.5 bg-blue-50/50 rounded-xl border border-blue-100">
                          <strong className="text-blue-900 block mb-1">Đánh giá kỹ thuật & Vấn đề:</strong>
                          <p className="text-slate-600 leading-relaxed">
                            {currentCrop.harvestEvaluation || 'Vụ nuôi vận hành thuận lợi theo đúng quy chuẩn sinh học 5T.'}
                          </p>
                        </div>
                        <div className="p-3.5 bg-emerald-50/50 rounded-xl border border-emerald-100">
                          <strong className="text-emerald-900 block mb-1">Khuyến nghị & Bài học cho vụ sau:</strong>
                          <p className="text-slate-600 leading-relaxed">
                            {currentCrop.harvestNextRecommendation || currentCrop.harvestLessonsLearned || 'Duy trì chế độ quạt sục khí ban đêm và kiểm soát nhá ăn 2 giờ/cữ.'}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: FEEDING LOGS */}
              {activeTab === 'feeding' && (
                <div className="space-y-6">
                  {/* Feeding Stats Highlights */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3.5 bg-white border border-slate-200 rounded-2xl">
                      <span className="text-[11px] font-bold text-slate-500 uppercase">Tổng lượng thức ăn</span>
                      <p className="text-xl font-black text-emerald-800 mt-1">{report.feeding.totalFeedKg.toLocaleString()} kg</p>
                    </div>
                    <div className="p-3.5 bg-white border border-slate-200 rounded-2xl">
                      <span className="text-[11px] font-bold text-slate-500 uppercase">Tổng chi phí cám</span>
                      <p className="text-xl font-black text-slate-900 mt-1">{formatVND(report.feeding.totalFeedCost)} đ</p>
                    </div>
                    <div className="p-3.5 bg-white border border-slate-200 rounded-2xl">
                      <span className="text-[11px] font-bold text-slate-500 uppercase">Cữ ăn hoàn tất</span>
                      <p className="text-xl font-black text-blue-800 mt-1">
                        {report.feeding.completedSessions} / {report.feeding.totalSessions}
                      </p>
                    </div>
                    <div className="p-3.5 bg-white border border-slate-200 rounded-2xl">
                      <span className="text-[11px] font-bold text-slate-500 uppercase">Cữ cắt / Bỏ ăn</span>
                      <p className="text-xl font-black text-amber-800 mt-1">{report.feeding.skippedSessions} cữ</p>
                    </div>
                  </div>

                  {/* Feed Products Used */}
                  {report.feeding.productsSummary.length > 0 && (
                    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                      <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider mb-3">
                        Cơ cấu các dòng thức ăn đã sử dụng trong vụ
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                        {report.feeding.productsSummary.map((p) => (
                          <div key={p.productId} className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                            <span className="font-bold text-slate-800 block text-sm">{p.itemName}</span>
                            <div className="flex justify-between mt-2 text-slate-500">
                              <span>Số lượng dùng:</span>
                              <strong className="text-emerald-700">{p.totalKg} {p.unit}</strong>
                            </div>
                            <div className="flex justify-between mt-1 text-slate-500">
                              <span>Thành tiền:</span>
                              <strong className="text-slate-800">{formatVND(p.totalCost)} đ</strong>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Recent Feeding Logs Table */}
                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                    <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider mb-3">
                      Nhật ký chi tiết các cữ cho ăn hàng ngày
                    </h4>
                    <div className="overflow-x-auto max-h-[450px]">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead className="sticky top-0 bg-slate-50 z-10">
                          <tr className="border-b border-slate-200 text-slate-500 font-bold">
                            <th className="py-2.5 px-3">Ngày ăn</th>
                            <th className="py-2.5 px-3">Cữ & Giờ</th>
                            <th className="py-2.5 px-3">Loại thức ăn</th>
                            <th className="py-2.5 px-3">Lượng cám</th>
                            <th className="py-2.5 px-3">Phương thức</th>
                            <th className="py-2.5 px-3">Trạng thái & Canh nhá</th>
                            <th className="py-2.5 px-3">Người ghi</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {report.feeding.recentLogs.map((log) => (
                            <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                              <td className="py-2 px-3 font-semibold text-slate-700">
                                {formatDate(log.feedingDate)}
                              </td>
                              <td className="py-2 px-3">
                                <span className="font-bold text-slate-800">{log.feedingSession}</span>
                                <span className="text-slate-400 ml-1">({log.feedingTime})</span>
                              </td>
                              <td className="py-2 px-3 font-medium text-slate-700">
                                {log.feedProduct?.itemName || '--'}
                              </td>
                              <td className="py-2 px-3 font-black text-emerald-700">
                                {log.feedAmount} kg
                              </td>
                              <td className="py-2 px-3">
                                <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                                  log.feedingMethod === 'AUTO' ? 'bg-indigo-50 text-indigo-700' : 'bg-slate-100 text-slate-700'
                                }`}>
                                  {log.feedingMethod === 'AUTO' ? 'Tự động' : 'Thủ công'}
                                </span>
                              </td>
                              <td className="py-2 px-3">
                                <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                                  log.feedingStatus === 'COMPLETED'
                                    ? 'bg-emerald-50 text-emerald-700'
                                    : log.feedingStatus === 'SKIPPED'
                                    ? 'bg-rose-50 text-rose-700'
                                    : 'bg-amber-50 text-amber-700'
                                }`}>
                                  {log.feedingStatus === 'COMPLETED' ? 'Đã ăn hết' : log.feedingStatus === 'SKIPPED' ? 'Cắt cữ' : 'Trễ cữ'}
                                </span>
                                {log.note && <span className="text-slate-400 text-[11px] block mt-0.5">{log.note}</span>}
                              </td>
                              <td className="py-2 px-3 text-slate-500">
                                {log.creator?.fullName || '--'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: WATER QUALITY */}
              {activeTab === 'water' && (
                <div className="space-y-6">
                  {/* 7 Standard 5T Parameters Average Cards */}
                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                        <Droplets className="w-4 h-4 text-cyan-600" />
                        Chỉ số chất lượng nước trung bình trong vụ nuôi (Chuẩn 5T)
                      </h4>
                      {report.waterQuality.alerts.total > 0 && (
                        <span className="px-2.5 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-full text-xs font-bold flex items-center gap-1">
                          <AlertTriangle className="w-3.5 h-3.5" /> {report.waterQuality.alerts.total} lần chỉ số vượt ngưỡng
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2.5 text-xs">
                      {/* pH */}
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                        <span className="text-slate-500 font-semibold block">Độ pH</span>
                        <strong className="text-base font-black text-blue-900 block mt-0.5">
                          {report.waterQuality.averages?.ph ?? '--'}
                        </strong>
                        <span className="text-[10px] text-slate-400">Chuẩn: 7.5 - 8.3</span>
                      </div>

                      {/* DO */}
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                        <span className="text-slate-500 font-semibold block">Oxy DO</span>
                        <strong className="text-base font-black text-emerald-900 block mt-0.5">
                          {report.waterQuality.averages?.dissolvedOxygen ? `${report.waterQuality.averages.dissolvedOxygen} mg/L` : '--'}
                        </strong>
                        <span className="text-[10px] text-slate-400">Chuẩn: &ge; 5.0</span>
                      </div>

                      {/* Salinity */}
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                        <span className="text-slate-500 font-semibold block">Độ mặn</span>
                        <strong className="text-base font-black text-cyan-900 block mt-0.5">
                          {report.waterQuality.averages?.salinity ? `${report.waterQuality.averages.salinity} ‰` : '--'}
                        </strong>
                        <span className="text-[10px] text-slate-400">Chuẩn: 10 - 25‰</span>
                      </div>

                      {/* Temperature */}
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                        <span className="text-slate-500 font-semibold block">Nhiệt độ</span>
                        <strong className="text-base font-black text-amber-900 block mt-0.5">
                          {report.waterQuality.averages?.temperature ? `${report.waterQuality.averages.temperature} °C` : '--'}
                        </strong>
                        <span className="text-[10px] text-slate-400">Chuẩn: 28 - 31°C</span>
                      </div>

                      {/* Alkalinity */}
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                        <span className="text-slate-500 font-semibold block">Độ kiềm</span>
                        <strong className="text-base font-black text-purple-900 block mt-0.5">
                          {report.waterQuality.averages?.alkalinity ? `${report.waterQuality.averages.alkalinity} mg/L` : '--'}
                        </strong>
                        <span className="text-[10px] text-slate-400">Chuẩn: 120 - 160</span>
                      </div>

                      {/* NH3 */}
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                        <span className="text-slate-500 font-semibold block">Khí độc NH3</span>
                        <strong className="text-base font-black text-slate-900 block mt-0.5">
                          {report.waterQuality.averages?.nh3 !== undefined ? `${report.waterQuality.averages.nh3} mg/L` : '--'}
                        </strong>
                        <span className="text-[10px] text-slate-400">Chuẩn: &lt; 0.1</span>
                      </div>

                      {/* NO2 */}
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                        <span className="text-slate-500 font-semibold block">Khí độc NO2</span>
                        <strong className="text-base font-black text-slate-900 block mt-0.5">
                          {report.waterQuality.averages?.no2 !== undefined ? `${report.waterQuality.averages.no2} mg/L` : '--'}
                        </strong>
                        <span className="text-[10px] text-slate-400">Chuẩn: &lt; 0.2</span>
                      </div>
                    </div>
                  </div>

                  {/* Water Quality Records Table */}
                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                    <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider mb-3">
                      Lịch sử các lần đo đạc chất lượng nước trong suốt vụ nuôi ({report.waterQuality.totalMeasurements} lượt đo)
                    </h4>
                    <div className="overflow-x-auto max-h-[450px]">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead className="sticky top-0 bg-slate-50 z-10">
                          <tr className="border-b border-slate-200 text-slate-500 font-bold">
                            <th className="py-2.5 px-3">Thời điểm đo</th>
                            <th className="py-2.5 px-3">pH</th>
                            <th className="py-2.5 px-3">Oxy DO (mg/L)</th>
                            <th className="py-2.5 px-3">Nhiệt độ (°C)</th>
                            <th className="py-2.5 px-3">Độ mặn (‰)</th>
                            <th className="py-2.5 px-3">Độ kiềm</th>
                            <th className="py-2.5 px-3">NH3 / NO2</th>
                            <th className="py-2.5 px-3">Người đo</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {report.waterQuality.recentRecords.map((r) => (
                            <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                              <td className="py-2 px-3 font-semibold text-slate-700">
                                {formatDate(r.recordTime, true)}
                              </td>
                              <td className="py-2 px-3">
                                <span className={`font-bold ${
                                  Number(r.ph) < 7.5 || Number(r.ph) > 8.5 ? 'text-rose-600' : 'text-slate-800'
                                }`}>
                                  {r.ph}
                                </span>
                              </td>
                              <td className="py-2 px-3">
                                <span className={`font-bold ${
                                  Number(r.dissolvedOxygen) < 4.0 ? 'text-rose-600' : 'text-emerald-700'
                                }`}>
                                  {r.dissolvedOxygen}
                                </span>
                              </td>
                              <td className="py-2 px-3 font-medium text-slate-700">{r.temperature}°C</td>
                              <td className="py-2 px-3 font-medium text-slate-700">{r.salinity}‰</td>
                              <td className="py-2 px-3 font-medium text-slate-700">{r.alkalinity ?? '--'}</td>
                              <td className="py-2 px-3">
                                <span className={Number(r.nh3) > 0.1 ? 'text-rose-600 font-bold' : 'text-slate-700'}>
                                  {r.nh3}
                                </span>
                                {' / '}
                                <span className={Number(r.no2) > 0.2 ? 'text-rose-600 font-bold' : 'text-slate-700'}>
                                  {r.no2}
                                </span>
                              </td>
                              <td className="py-2 px-3 text-slate-500">{r.creator?.fullName || '--'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: GROWTH & BIOMASS */}
              {activeTab === 'growth' && (
                <div className="space-y-6">
                  {/* Chart of Shrimp Growth */}
                  {growthChartData.length > 0 && (
                    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                      <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                        <TrendingUp className="w-4 h-4 text-blue-600" />
                        Biểu đồ đường tăng trưởng trọng lượng trung bình (ABW g/con) qua các mốc thời gian
                      </h4>
                      <div className="h-64 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={growthChartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} />
                            <YAxis stroke="#94a3b8" fontSize={11} unit="g" />
                            <Tooltip
                              formatter={(value: any) => [`${value} g/con`, 'Trọng lượng ABW']}
                              labelFormatter={(label) => `Thời điểm: ${label}`}
                            />
                            <Legend />
                            <Line
                              type="monotone"
                              dataKey="abw"
                              name="Trọng lượng ABW (g/con)"
                              stroke="#2563eb"
                              strokeWidth={3}
                              dot={{ r: 4, fill: '#2563eb' }}
                              activeDot={{ r: 6 }}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}

                  {/* Growth Samples Table */}
                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                    <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider mb-3">
                      Lịch sử các lần bắt mẫu 5 mẻ chài định kỳ ({report.growth.totalSamples} lần lấy mẫu)
                    </h4>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                            <th className="py-2.5 px-3">Ngày bắt mẫu</th>
                            <th className="py-2.5 px-3">Ngày tuổi (DOC)</th>
                            <th className="py-2.5 px-3">Số tôm mẫu</th>
                            <th className="py-2.5 px-3">Khối lượng mẫu</th>
                            <th className="py-2.5 px-3">ABW (g/con)</th>
                            <th className="py-2.5 px-3">Kích cỡ (con/kg)</th>
                            <th className="py-2.5 px-3">Tốc độ lớn (ADG)</th>
                            <th className="py-2.5 px-3">Sinh khối ước tính</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {report.growth.samples.map((s, idx) => (
                            <tr key={s.id || idx} className="hover:bg-slate-50/80 transition-colors">
                              <td className="py-2.5 px-3 font-semibold text-slate-700">
                                {formatDate(s.samplingDate)}
                              </td>
                              <td className="py-2.5 px-3 font-bold text-blue-700">
                                {s.doc ? `DOC ${s.doc}` : '--'}
                              </td>
                              <td className="py-2.5 px-3 text-slate-700">{s.sampleCount} con</td>
                              <td className="py-2.5 px-3 text-slate-700">{s.sampleWeightGram} g</td>
                              <td className="py-2.5 px-3 font-black text-blue-900">{Number(s.abwGram).toFixed(2)} g</td>
                              <td className="py-2.5 px-3 font-black text-emerald-800">{Number(s.sizePerKg).toFixed(1)} con/kg</td>
                              <td className="py-2.5 px-3 font-medium text-purple-700">
                                {s.adgGramPerDay ? `+${Number(s.adgGramPerDay).toFixed(2)} g/ngày` : '--'}
                              </td>
                              <td className="py-2.5 px-3 font-bold text-slate-900">
                                {s.estimatedBiomassKg ? `${Math.round(Number(s.estimatedBiomassKg)).toLocaleString()} kg` : '--'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 5: SHRIMP HEALTH & MORTALITY */}
              {activeTab === 'health' && (
                <div className="space-y-6">
                  {/* Health Status Counters */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl">
                      <span className="text-[11px] font-bold text-emerald-700 uppercase">Khỏe mạnh bình thường</span>
                      <p className="text-xl font-black text-emerald-950 mt-1">
                        {report.health.summary.normal} lượt
                      </p>
                    </div>
                    <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl">
                      <span className="text-[11px] font-bold text-amber-700 uppercase">Tôm giảm ăn</span>
                      <p className="text-xl font-black text-amber-950 mt-1">
                        {report.health.summary.lossOfAppetite} lượt
                      </p>
                    </div>
                    <div className="p-3.5 bg-orange-50 border border-orange-200 rounded-2xl">
                      <span className="text-[11px] font-bold text-orange-700 uppercase">Tôm tấp mé</span>
                      <p className="text-xl font-black text-orange-950 mt-1">
                        {report.health.summary.edgeGathering} lượt
                      </p>
                    </div>
                    <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl">
                      <span className="text-[11px] font-bold text-rose-700 uppercase">Tôm lờ đờ / Bệnh</span>
                      <p className="text-xl font-black text-rose-950 mt-1">
                        {report.health.summary.lethargic} lượt
                      </p>
                    </div>
                  </div>

                  {/* Health Clinical Records Table */}
                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                    <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider mb-3">
                      Nhật ký ghi nhận sức khỏe lâm sàng tôm ({report.health.totalInspections} lần kiểm tra)
                    </h4>
                    {report.health.records.length === 0 ? (
                      <p className="text-xs text-slate-400 italic py-4">Chưa có ghi nhận bất thường về sức khỏe tôm trong vụ này.</p>
                    ) : (
                      <div className="overflow-x-auto max-h-[400px]">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead className="sticky top-0 bg-slate-50 z-10">
                            <tr className="border-b border-slate-200 text-slate-500 font-bold">
                              <th className="py-2.5 px-3">Thời gian khám</th>
                              <th className="py-2.5 px-3">Trạng thái sức khỏe</th>
                              <th className="py-2.5 px-3">Mức độ nghiêm trọng</th>
                              <th className="py-2.5 px-3">Tỷ lệ ảnh hưởng</th>
                              <th className="py-2.5 px-3">Ghi chú & Chẩn đoán</th>
                              <th className="py-2.5 px-3">Người ghi nhận</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {report.health.records.map((h) => (
                              <tr key={h.id} className="hover:bg-slate-50/80 transition-colors">
                                <td className="py-2.5 px-3 font-semibold text-slate-700">
                                  {formatDate(h.recordTime, true)}
                                </td>
                                <td className="py-2.5 px-3">
                                  <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                                    h.healthStatus === 'NORMAL'
                                      ? 'bg-emerald-50 text-emerald-700'
                                      : h.healthStatus === 'LOSS_OF_APPETITE'
                                      ? 'bg-amber-50 text-amber-700'
                                      : 'bg-rose-50 text-rose-700'
                                  }`}>
                                    {h.healthStatus === 'NORMAL' ? 'Bình thường' : h.healthStatus === 'LOSS_OF_APPETITE' ? 'Giảm ăn' : h.healthStatus === 'EDGE_GATHERING' ? 'Tấp mé' : 'Lờ đờ'}
                                  </span>
                                </td>
                                <td className="py-2.5 px-3 font-medium text-slate-600">
                                  {h.severity === 'NORMAL' ? 'Bình thường' : h.severity === 'MILD' ? 'Nhẹ' : h.severity === 'MODERATE' ? 'Trung bình' : 'Nghiêm trọng'}
                                </td>
                                <td className="py-2.5 px-3 font-bold text-slate-800">
                                  {h.affectedPercentage}% đàn
                                </td>
                                <td className="py-2.5 px-3 text-slate-700">
                                  {h.note || 'Không có triệu chứng bệnh.'}
                                </td>
                                <td className="py-2.5 px-3 text-slate-500">
                                  {h.recorder?.fullName || '--'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 6: TREATMENTS & SUPPLIES */}
              {activeTab === 'treatments' && (
                <div className="space-y-6">
                  {/* Supplies & Chemicals Highlights */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="p-3.5 bg-white border border-slate-200 rounded-2xl">
                      <span className="text-[11px] font-bold text-slate-500 uppercase">Tổng vật tư đã tạt xử lý</span>
                      <p className="text-xl font-black text-slate-900 mt-1">{report.treatmentsAndSupplies.totalMaterialsUsed} lượt tạt</p>
                    </div>
                    <div className="p-3.5 bg-white border border-slate-200 rounded-2xl">
                      <span className="text-[11px] font-bold text-slate-500 uppercase">Chi phí thuốc thú y</span>
                      <p className="text-xl font-black text-purple-900 mt-1">{formatVND(report.treatmentsAndSupplies.totalMedicineCost)} đ</p>
                    </div>
                    <div className="p-3.5 bg-white border border-slate-200 rounded-2xl">
                      <span className="text-[11px] font-bold text-slate-500 uppercase">Chi phí khoáng & vi sinh</span>
                      <p className="text-xl font-black text-cyan-900 mt-1">{formatVND(report.treatmentsAndSupplies.totalChemicalCost)} đ</p>
                    </div>
                  </div>

                  {/* Incidents Table */}
                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                    <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider mb-3 flex items-center justify-between">
                      <span>Sự cố phát sinh trong vụ ({report.incidents.total} vụ việc)</span>
                      <span className="text-slate-400 font-medium lowercase">Đã giải quyết: {report.incidents.resolved}</span>
                    </h4>
                    {report.incidents.list.length === 0 ? (
                      <p className="text-xs text-slate-400 italic py-2">Không phát sinh sự cố nghiêm trọng nào trong suốt chu kỳ nuôi.</p>
                    ) : (
                      <div className="space-y-2.5">
                        {report.incidents.list.map((inc) => (
                          <div key={inc.id} className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-slate-900 text-sm">{inc.title}</span>
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                inc.status === 'RESOLVED' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                              }`}>
                                {inc.status === 'RESOLVED' ? 'Đã xử lý xong' : 'Đang điều trị'}
                              </span>
                            </div>
                            <p className="text-slate-600 mt-1">{inc.description}</p>
                            {inc.treatment && (
                              <p className="text-blue-700 mt-1 font-semibold">
                                Biện pháp xử lý: {inc.treatment}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Materials & Probiotics Usage Table */}
                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                    <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider mb-3">
                      Lịch sử xuất kho tạt thuốc, men vi sinh, khoáng chất xử lý nước
                    </h4>
                    <div className="overflow-x-auto max-h-[400px]">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead className="sticky top-0 bg-slate-50 z-10">
                          <tr className="border-b border-slate-200 text-slate-500 font-bold">
                            <th className="py-2.5 px-3">Ngày sử dụng</th>
                            <th className="py-2.5 px-3">Tên vật tư / Thuốc</th>
                            <th className="py-2.5 px-3">Phân loại</th>
                            <th className="py-2.5 px-3">Số lượng tạt</th>
                            <th className="py-2.5 px-3">Thành tiền</th>
                            <th className="py-2.5 px-3">Mục đích / Ghi chú</th>
                            <th className="py-2.5 px-3">Người xuất kho</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {report.treatmentsAndSupplies.items.map((item) => (
                            <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                              <td className="py-2.5 px-3 font-semibold text-slate-700">
                                {formatDate(item.usageDate)}
                              </td>
                              <td className="py-2.5 px-3 font-bold text-slate-900">{item.itemName}</td>
                              <td className="py-2.5 px-3">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  item.category === 'MEDICINE'
                                    ? 'bg-purple-50 text-purple-700'
                                    : 'bg-cyan-50 text-cyan-700'
                                }`}>
                                  {item.category === 'MEDICINE' ? 'Thuốc thú y' : 'Khoáng / Vi sinh'}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 font-bold text-slate-800">
                                {item.quantityUsed} {item.unit}
                              </td>
                              <td className="py-2.5 px-3 font-black text-slate-900">{formatVND(item.totalCost)} đ</td>
                              <td className="py-2.5 px-3 text-slate-600">{item.notes || '--'}</td>
                              <td className="py-2.5 px-3 text-slate-500">{item.creatorName}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 7: FINANCIAL BREAKDOWN */}
              {activeTab === 'financial' && (
                <div className="space-y-6">
                  {/* Financial Overview Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-xs">
                      <span className="text-xs font-bold text-slate-500 uppercase block">Tổng Doanh Thu</span>
                      <p className="text-2xl font-black text-blue-900 mt-1">{formatVND(revenue)} đ</p>
                      <span className="text-xs text-slate-400 mt-0.5 block">
                        Đơn giá: {currentCrop.actualHarvestPricePerKg ? `${formatVND(currentCrop.actualHarvestPricePerKg)} đ/kg` : '--'}
                      </span>
                    </div>

                    <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-xs">
                      <span className="text-xs font-bold text-slate-500 uppercase block">Tổng Chi Phí Vụ</span>
                      <p className="text-2xl font-black text-rose-900 mt-1">{formatVND(totalCost)} đ</p>
                      <span className="text-xs text-slate-400 mt-0.5 block">Bao gồm cám, thuốc, giống & vận hành</span>
                    </div>

                    <div className={`p-4 border rounded-2xl shadow-xs ${
                      profit >= 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'
                    }`}>
                      <span className={`text-xs font-bold uppercase block ${profit >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                        {profit >= 0 ? 'Lợi Nhuận Ròng (Lời)' : 'Lợi Nhuận Ròng (Lỗ)'}
                      </span>
                      <p className={`text-2xl font-black mt-1 ${profit >= 0 ? 'text-emerald-950' : 'text-rose-950'}`}>
                        {profit >= 0 ? '+' : ''}{formatVND(profit)} đ
                      </p>
                      <span className="text-xs font-bold text-slate-500 mt-0.5 block">
                        Tỷ suất ROI: {totalCost > 0 ? `${((profit / totalCost) * 100).toFixed(1)}%` : '--'}
                      </span>
                    </div>
                  </div>

                  {/* Cost Breakdown Details */}
                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                    <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider mb-4">
                      Phân bổ cơ cấu các khoản chi phí đầu tư trong vụ nuôi
                    </h4>
                    <div className="space-y-3 text-xs">
                      <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl">
                        <span className="font-semibold text-slate-700">1. Chi phí thức ăn tôm</span>
                        <strong className="text-slate-900 text-sm">{formatVND(report.financial.costs.feed)} đ</strong>
                      </div>
                      <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl">
                        <span className="font-semibold text-slate-700">2. Chi phí con giống thả ban đầu</span>
                        <strong className="text-slate-900 text-sm">{formatVND(report.financial.costs.seed)} đ</strong>
                      </div>
                      <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl">
                        <span className="font-semibold text-slate-700">3. Chi phí khoáng chất & men vi sinh xử lý nước</span>
                        <strong className="text-slate-900 text-sm">{formatVND(report.financial.costs.chemical)} đ</strong>
                      </div>
                      <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl">
                        <span className="font-semibold text-slate-700">4. Chi phí thuốc thú y thủy sản</span>
                        <strong className="text-slate-900 text-sm">{formatVND(report.financial.costs.medicine)} đ</strong>
                      </div>
                      <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl">
                        <span className="font-semibold text-slate-700">5. Chi phí điện và nước</span>
                        <strong className="text-slate-900 text-sm">{formatVND(report.financial.costs.electricity)} đ</strong>
                      </div>
                      <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl">
                        <span className="font-semibold text-slate-700">6. Chi phí nhân công</span>
                        <strong className="text-slate-900 text-sm">{formatVND(report.financial.costs.labor)} đ</strong>
                      </div>
                      <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl">
                        <span className="font-semibold text-slate-700">7. Chi phí khác</span>
                        <strong className="text-slate-900 text-sm">{formatVND(report.financial.costs.other)} đ</strong>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:p-5 border-t border-slate-100 flex items-center justify-between bg-slate-50/50 shrink-0 print:hidden">
          <div className="text-xs text-slate-400 font-medium">
            Hệ thống Quản lý Vụ nuôi Thông minh SSFM 5T Care
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold cursor-pointer transition-colors"
          >
            Đóng Báo Cáo
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
