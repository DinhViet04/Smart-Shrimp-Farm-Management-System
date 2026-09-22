import { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  ArrowLeft, Activity, Plus, Trash2, TrendingUp, AlertCircle, 
  Scale, Calculator, CheckCircle2, Waves, Calendar, Clock,
  Sparkles, Info
} from 'lucide-react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, Legend 
} from 'recharts';
import { format, isValid } from 'date-fns';
import { shrimpSizeService } from '../../services/shrimpSizeService';
import type { CastDto } from '../../services/shrimpSizeService';
import { cropService } from '../../services/crop.service';
import type { Crop } from '../../services/crop.service';
import GrowthHeaderTabs, { type GrowthTabType } from '../growth/GrowthHeaderTabs';

interface Pond {
  id: string;
  name: string;
  areaSize?: number;
  depth?: number;
  farmId?: string;
}

interface ShrimpSizeSample {
  id: string;
  samplingDate: string;
  doc: number | null;
  sampleCount: number;
  sampleWeightGram: number;
  sampleLengthCm: number | null;
  abwGram: number;
  sizePerKg: number;
  adgGramPerDay: number | null;
  notes: string | null;
}

interface PondSizeDetailProps {
  pond: Pond;
  viewOnly?: boolean;
  onBack: () => void;
  onNavigateTab?: (tab: GrowthTabType) => void;
}

// Helper an toàn chống crash khi format ngày tháng
const safeFormatDate = (dateVal: any, formatStr: string = 'dd/MM/yyyy') => {
  if (!dateVal) return '--';
  try {
    const d = new Date(dateVal);
    if (!isValid(d) || isNaN(d.getTime())) return '--';
    return format(d, formatStr);
  } catch {
    return '--';
  }
};

// Helper an toàn format số
const safeFormatNumber = (val: any, decimals?: number) => {
  if (val === null || val === undefined || isNaN(Number(val))) return '--';
  const num = Number(val);
  return decimals !== undefined ? num.toFixed(decimals) : num.toLocaleString();
};

export default function PondSizeDetail({ 
  pond, 
  viewOnly = false, 
  onBack,
  onNavigateTab
}: PondSizeDetailProps) {
  const [samples, setSamples] = useState<ShrimpSizeSample[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [activeCrop, setActiveCrop] = useState<Crop | null>(null);

  // Form states
  const [netAreaSqM, setNetAreaSqM] = useState<number | ''>('');
  const [casts, setCasts] = useState<CastDto[]>([
    { count: 0, weightGram: 0 },
    { count: 0, weightGram: 0 },
    { count: 0, weightGram: 0 },
    { count: 0, weightGram: 0 },
    { count: 0, weightGram: 0 },
  ]);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Role check
  const currentUserRole = useMemo(() => {
    try {
      const u = localStorage.getItem('user');
      return u ? JSON.parse(u).role : 'FARMER';
    } catch {
      return 'FARMER';
    }
  }, []);

  const canEdit = !viewOnly && (currentUserRole === 'ADMIN' || currentUserRole === 'FARM_MANAGER' || currentUserRole === 'TECHNICIAN');

  const fetchSamples = useCallback(async () => {
    if (!pond?.id) return;
    try {
      setError(null);
      const data = await shrimpSizeService.getSamplesByPond(pond.id);
      setSamples(Array.isArray(data) ? data : []);
      
      const cropsData = await cropService.getAll({ pondId: pond.id, status: 'ACTIVE' });
      if (Array.isArray(cropsData) && cropsData.length > 0) {
        setActiveCrop(cropsData[0]);
      } else {
        setActiveCrop(null);
      }
    } catch (err: any) {
      setError(err.message || 'Lỗi tải dữ liệu mẫu tôm');
      setSamples([]);
      setActiveCrop(null);
    }
  }, [pond?.id]);

  useEffect(() => {
    fetchSamples();
  }, [fetchSamples]);

  // Live Calculations from current casts
  const liveTotals = useMemo(() => {
    let totalCount = 0;
    let totalWeight = 0;
    casts.forEach(c => {
      totalCount += Number(c.count) || 0;
      totalWeight += Number(c.weightGram) || 0;
    });

    const abw = totalCount > 0 ? totalWeight / totalCount : 0;
    const size = abw > 0 ? 1000 / abw : 0;

    let estimatedBiomass = 0;
    const netArea = Number(netAreaSqM) || 0;
    const pondArea = pond?.areaSize || 0;

    if (netArea > 0 && totalCount > 0 && pondArea > 0) {
      const density = totalCount / (5 * netArea);
      const totalShrimp = Math.round(density * pondArea);
      estimatedBiomass = (totalShrimp * abw) / 1000;
    }

    return {
      totalCount,
      totalWeight,
      abw,
      size,
      estimatedBiomass,
    };
  }, [casts, netAreaSqM, pond?.areaSize]);

  const handleCastChange = (index: number, field: 'count' | 'weightGram', value: number) => {
    const updated = [...casts];
    updated[index] = { ...updated[index], [field]: value };
    setCasts(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pond?.id) return;
    const hasInvalidCast = casts.some(c => !c.count || !c.weightGram || c.count <= 0 || c.weightGram <= 0);
    if (hasInvalidCast) {
      setError('Vui lòng nhập đầy đủ số lượng và khối lượng (> 0) cho cả 5 lần chài.');
      return;
    }
    try {
      setIsSubmitting(true);
      setError(null);
      await shrimpSizeService.createSample(pond.id, {
        casts,
        netAreaSqM: Number(netAreaSqM) || 0,
        notes: notes || undefined,
      });
      setCasts([
        { count: 0, weightGram: 0 },
        { count: 0, weightGram: 0 },
        { count: 0, weightGram: 0 },
        { count: 0, weightGram: 0 },
        { count: 0, weightGram: 0 },
      ]);
      setNotes('');
      setSuccessMessage('Ghi nhận mẫu kích cỡ & sinh khối thành công!');
      setTimeout(() => setSuccessMessage(null), 4000);
      await fetchSamples();
    } catch (err: any) {
      setError(err.message || 'Lỗi khi lưu dữ liệu mẫu');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (sampleId: string) => {
    if (!pond?.id) return;
    if (!window.confirm('Bạn có chắc chắn muốn xóa bản ghi này? Hành động này sẽ tính toán lại ADG.')) return;
    try {
      await shrimpSizeService.deleteSample(pond.id, sampleId);
      setSuccessMessage('Đã xóa mẫu đo đạc.');
      setTimeout(() => setSuccessMessage(null), 3000);
      await fetchSamples();
    } catch (err: any) {
      setError(err.message || 'Lỗi khi xóa mẫu');
    }
  };

  // Prepare data an toàn
  const safeSamples = Array.isArray(samples) ? samples : [];
  const latestSample = safeSamples.length > 0 ? safeSamples[safeSamples.length - 1] : null;

  const chartData = useMemo(() => {
    return safeSamples.map(s => ({
      date: safeFormatDate(s.samplingDate, 'dd/MM'),
      abw: Number(s.abwGram) || 0,
      adg: s.adgGramPerDay ? Number(s.adgGramPerDay) : 0,
      doc: s.doc || 0,
    }));
  }, [safeSamples]);

  // Phân loại kích cỡ thương phẩm
  const getSizeClassification = (size: number) => {
    if (!size || size <= 0) return { label: 'Chưa xác định', color: 'text-slate-500 bg-slate-100' };
    if (size <= 30) return { label: 'Size Đặc Biệt (< 30 con/kg)', color: 'text-emerald-700 bg-emerald-100/70 border-emerald-300' };
    if (size <= 50) return { label: 'Size Lớn (30 - 50 con/kg)', color: 'text-blue-700 bg-blue-100/70 border-blue-300' };
    if (size <= 80) return { label: 'Size Trung Bình (50 - 80 con/kg)', color: 'text-indigo-700 bg-indigo-100/70 border-indigo-300' };
    if (size <= 120) return { label: 'Size Nhỏ (80 - 120 con/kg)', color: 'text-amber-700 bg-amber-100/70 border-amber-300' };
    return { label: 'Giai đoạn Ương (> 120 con/kg)', color: 'text-teal-700 bg-teal-100/70 border-teal-300' };
  };

  const currentSizeClass = latestSample ? getSizeClassification(Number(latestSample.sizePerKg)) : null;

  return (
    <div className="space-y-6 animate-in fade-in duration-300 max-w-7xl pb-12">
      {/* Top Navigation */}
      <GrowthHeaderTabs
        activeTab="Theo dõi kích cỡ"
        onTabChange={onNavigateTab}
        title={`Theo Dõi Kích Cỡ & Trọng Lượng - ${pond?.name || 'Ao Nuôi'}`}
        subtitle={`Giám sát chi tiết tốc độ tăng trọng, trọng lượng trung bình và các mẻ chài của ao ${pond?.name || ''}`}
      />

      {/* Back button & Pond breadcrumb */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white px-6 py-4 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-semibold text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Quay lại danh sách ao</span>
          </button>
          <span className="text-slate-300">|</span>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Ao Nuôi:</span>
            <span className="text-sm font-extrabold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-lg">
              {pond?.name || '--'}
            </span>
          </div>
        </div>

        {activeCrop ? (
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200/60 px-3 py-1.5 rounded-xl">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              Đang nuôi vụ từ {safeFormatDate(activeCrop.startDate, 'dd/MM/yyyy')}
            </span>
            <span className="text-emerald-900 font-black">
              ({safeFormatNumber(activeCrop.initialShrimpCount)} tôm giống)
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200/60 px-3 py-1.5 rounded-xl">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>Ao hiện chưa có vụ nuôi nào đang hoạt động</span>
          </div>
        )}
      </div>

      {/* Notifications */}
      {error && (
        <div className="p-4 bg-red-50 text-red-700 rounded-2xl flex items-center gap-3 border border-red-100">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <p className="text-sm font-semibold">{error}</p>
        </div>
      )}

      {successMessage && (
        <div className="p-4 bg-emerald-50 text-emerald-800 rounded-2xl flex items-center gap-3 border border-emerald-100 shadow-xs">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <p className="text-sm font-semibold">{successMessage}</p>
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: ABW */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Trọng Lượng TB (ABW)</span>
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Scale className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-black text-slate-800 tracking-tight">
                {latestSample ? safeFormatNumber(latestSample.abwGram, 2) : '--'}
              </span>
              <span className="text-sm font-bold text-slate-500">g/con</span>
            </div>
            <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              {latestSample ? `Mẫu ngày ${safeFormatDate(latestSample.samplingDate, 'dd/MM/yyyy')}` : 'Chưa có mẫu'}
            </p>
          </div>
        </div>

        {/* Card 2: Size con/kg */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Kích Cỡ Tôm (Size)</span>
            <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Waves className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-black text-indigo-700 tracking-tight">
                {latestSample ? safeFormatNumber(latestSample.sizePerKg, 1) : '--'}
              </span>
              <span className="text-sm font-bold text-indigo-500">con/kg</span>
            </div>
            {currentSizeClass && (
              <span className={`inline-block text-[11px] font-bold px-2 py-0.5 rounded-md border mt-1.5 ${currentSizeClass.color}`}>
                {currentSizeClass.label}
              </span>
            )}
          </div>
        </div>

        {/* Card 3: ADG */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Tốc Độ Tăng Trưởng (ADG)</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-black text-emerald-700 tracking-tight">
                {latestSample && latestSample.adgGramPerDay !== null ? safeFormatNumber(latestSample.adgGramPerDay, 2) : '--'}
              </span>
              <span className="text-sm font-bold text-emerald-600">g/ngày</span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              {latestSample && Number(latestSample.adgGramPerDay) >= 0.25 
                ? '🟢 Tăng trưởng nhanh, vượt trội'
                : latestSample && Number(latestSample.adgGramPerDay) >= 0.15
                ? '🟡 Tăng trưởng ổn định'
                : 'Đang theo dõi chu kỳ'}
            </p>
          </div>
        </div>

        {/* Card 4: DOC & Mẫu chài */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Ngày Nuôi (DOC)</span>
            <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-black text-teal-700 tracking-tight">
                {latestSample?.doc ? `DOC ${latestSample.doc}` : activeCrop ? 'Đang nuôi' : '--'}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              {safeSamples.length} đợt kiểm tra kích cỡ
            </p>
          </div>
        </div>
      </div>

      {/* Chart Section */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-100">
          <div>
            <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <Scale className="w-4 h-4 text-blue-600" />
              Biểu Đồ Xu Hướng Tăng Trưởng (ABW & ADG)
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Theo dõi sự phát triển của tôm qua các mốc kiểm tra thực tế
            </p>
          </div>

          <div className="flex items-center gap-4 text-xs font-bold">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-blue-600 inline-block"></span>
              <span className="text-slate-600">Trọng lượng TB (g/con)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-1.5 bg-emerald-500 inline-block rounded-xs"></span>
              <span className="text-slate-600">ADG (g/ngày)</span>
            </div>
          </div>
        </div>

        <div className="h-72 w-full">
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 10, bottom: 10, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis yAxisId="left" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis yAxisId="right" orientation="right" stroke="#10b981" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ 
                    borderRadius: '16px', 
                    border: '1px solid #e2e8f0', 
                    boxShadow: '0 10px 15px -3px rgba(0,0,0,0.08)',
                    padding: '12px 16px'
                  }}
                  labelStyle={{ fontWeight: 'bold', color: '#1e293b', marginBottom: '4px' }}
                />
                <Legend wrapperStyle={{ display: 'none' }} />
                <Line
                  yAxisId="left"
                  type="monotone"
                  name="ABW (g/con)"
                  dataKey="abw"
                  stroke="#2563eb"
                  strokeWidth={3}
                  dot={{ r: 4, strokeWidth: 2, fill: '#fff' }}
                  activeDot={{ r: 6, strokeWidth: 0, fill: '#2563eb' }}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  name="ADG (g/ngày)"
                  dataKey="adg"
                  stroke="#10b981"
                  strokeWidth={2.5}
                  strokeDasharray="4 4"
                  dot={{ r: 3, strokeWidth: 2, fill: '#fff' }}
                  activeDot={{ r: 5, strokeWidth: 0, fill: '#10b981' }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-slate-400">
              <TrendingUp className="w-10 h-10 mb-2 opacity-40 text-slate-400" />
              <p className="text-sm font-semibold">Chưa có đủ dữ liệu để vẽ biểu đồ tăng trưởng</p>
              <p className="text-xs text-slate-400 mt-0.5">Dữ liệu sẽ xuất hiện sau khi ghi nhận các lần lấy mẫu</p>
            </div>
          )}
        </div>
      </div>

      {/* Smart Form Section: Chỉ hiển thị cho Tech/Manager */}
      {canEdit && activeCrop && (
        <div className="bg-white p-6 md:p-8 rounded-3xl border border-blue-200/80 shadow-sm relative">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100">
            <div>
              <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
                <Plus className="w-5 h-5 text-blue-600" />
                Ghi Nhận Mẫu Kích Cỡ Mới (Quy Trình 5 Mẻ Chài)
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Nhập chính xác số lượng và trọng lượng từ 5 mẻ chài để hệ thống tính toán ABW, Size và Sinh khối tức thời.
              </p>
            </div>
            <div className="flex items-center gap-2 bg-blue-50 px-3 py-1.5 rounded-xl border border-blue-100 text-blue-700 text-xs font-bold">
              <Calculator className="w-4 h-4" />
              <span>Tự Động Tính Toán Trực Tiếp (Live Preview)</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="mt-6 space-y-6">
            {/* Net Area & Live Preview Banner */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Diện tích miệng chài (S_chài - m²) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="Ví dụ: 6.28 m²"
                  value={netAreaSqM}
                  onChange={(e) => setNetAreaSqM(e.target.value ? Number(e.target.value) : '')}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-bold text-slate-800 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Dùng để tính mật độ chài D_mẫu và Sinh khối ao (Biomass)
                </p>
              </div>

              {/* Live Preview Cards */}
              <div className="md:col-span-2 bg-gradient-to-r from-blue-50 to-indigo-50/60 p-4 rounded-2xl border border-blue-200/60 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <span className="text-xs font-bold text-blue-600 uppercase tracking-wider flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5" /> Kết quả tính nhẩm tức thì (Live)
                  </span>
                  <div className="flex items-center gap-6 mt-2">
                    <div>
                      <p className="text-[11px] font-semibold text-slate-500">Tổng mẫu 5 mẻ</p>
                      <p className="text-base font-black text-slate-800">
                        {liveTotals.totalCount} con / {liveTotals.totalWeight} g
                      </p>
                    </div>
                    <div className="border-l border-blue-200 pl-4">
                      <p className="text-[11px] font-semibold text-slate-500">ABW Dự tính</p>
                      <p className="text-base font-black text-blue-700">
                        {liveTotals.abw > 0 ? `${liveTotals.abw.toFixed(2)} g/con` : '--'}
                      </p>
                    </div>
                    <div className="border-l border-blue-200 pl-4">
                      <p className="text-[11px] font-semibold text-slate-500">Size Dự tính</p>
                      <p className="text-base font-black text-indigo-700">
                        {liveTotals.size > 0 ? `${liveTotals.size.toFixed(1)} con/kg` : '--'}
                      </p>
                    </div>
                    {liveTotals.estimatedBiomass > 0 && (
                      <div className="border-l border-blue-200 pl-4">
                        <p className="text-[11px] font-semibold text-slate-500">Sinh khối ước tính</p>
                        <p className="text-base font-black text-emerald-700">
                          {Math.round(liveTotals.estimatedBiomass).toLocaleString()} kg
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* 5 Casts Input Grid */}
            <div>
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-3">
                Thông số 5 mẻ chài thực tế (Bắt buộc đủ 5 mẻ)
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
                {casts.map((cast, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-2.5 focus-within:border-blue-400 focus-within:bg-blue-50/20 transition-all"
                  >
                    <div className="flex items-center justify-between pb-1.5 border-b border-slate-200">
                      <span className="text-xs font-black text-blue-700">Mẻ #{idx + 1}</span>
                      <span className="text-[10px] font-bold text-slate-400">
                        {cast.count > 0 && cast.weightGram > 0 
                          ? `${(cast.weightGram / cast.count).toFixed(1)} g/con` 
                          : 'Đang chờ'}
                      </span>
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-slate-600 block mb-1">Số lượng tôm (con)</label>
                      <input
                        type="number"
                        min="1"
                        required
                        placeholder="Số con"
                        value={cast.count || ''}
                        onChange={(e) => handleCastChange(idx, 'count', Number(e.target.value))}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-sm font-bold text-slate-800 text-center outline-none focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-slate-600 block mb-1">Khối lượng (gram)</label>
                      <input
                        type="number"
                        step="0.1"
                        min="1"
                        required
                        placeholder="Gram"
                        value={cast.weightGram || ''}
                        onChange={(e) => handleCastChange(idx, 'weightGram', Number(e.target.value))}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-sm font-bold text-slate-800 text-center outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Notes & Submit */}
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <input
                type="text"
                placeholder="Ghi chú thêm (vd: tôm khỏe, vỏ bóng đẹp, không đóng rong...)"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full sm:w-auto px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl shadow-sm hover:shadow transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <Activity className="w-4 h-4 animate-spin" />
                    <span>Đang lưu...</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    <span>Lưu Mẫu Kích Cỡ & Sinh Khối</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* History Table Section */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-800">Lịch Sử Lấy Mẫu Kích Cỡ & Trọng Lượng</h3>
            <p className="text-xs text-slate-400 mt-0.5">Chi tiết các lần đo đạc định kỳ theo ngày nuôi (DOC)</p>
          </div>
          <span className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
            {safeSamples.length} bản ghi
          </span>
        </div>

        {safeSamples.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <Info className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm font-semibold">Chưa có lịch sử lấy mẫu nào cho ao này</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3.5">Ngày đo</th>
                  <th className="px-6 py-3.5">DOC</th>
                  <th className="px-6 py-3.5">Số mẫu (5 mẻ)</th>
                  <th className="px-6 py-3.5 text-blue-700">ABW (g/con)</th>
                  <th className="px-6 py-3.5 text-indigo-700">Kích cỡ (con/kg)</th>
                  <th className="px-6 py-3.5 text-emerald-700">ADG (g/ngày)</th>
                  <th className="px-6 py-3.5">Ghi chú</th>
                  {canEdit && <th className="px-6 py-3.5 text-right">Thao tác</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {safeSamples.slice().reverse().map((sample) => (
                  <tr key={sample.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-6 py-4 font-bold text-slate-800">
                      {safeFormatDate(sample.samplingDate, 'dd/MM/yyyy')}
                    </td>
                    <td className="px-6 py-4">
                      {sample.doc ? (
                        <span className="font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-md text-xs">
                          DOC {sample.doc}
                        </span>
                      ) : '--'}
                    </td>
                    <td className="px-6 py-4">
                      {sample.sampleCount} con / {sample.sampleWeightGram} g
                    </td>
                    <td className="px-6 py-4 font-black text-blue-700">
                      {safeFormatNumber(sample.abwGram, 2)}
                    </td>
                    <td className="px-6 py-4 font-black text-indigo-700">
                      {safeFormatNumber(sample.sizePerKg, 1)}
                    </td>
                    <td className="px-6 py-4 font-bold text-emerald-700">
                      {sample.adgGramPerDay !== null ? `+${safeFormatNumber(sample.adgGramPerDay, 2)}` : '--'}
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-500 max-w-xs truncate">
                      {sample.notes || '--'}
                    </td>
                    {canEdit && (
                      <td className="px-6 py-4 text-right">
                        <button
                          type="button"
                          onClick={() => handleDelete(sample.id)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                          title="Xóa bản ghi này"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
