import { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  ArrowLeft, Activity, 
  TrendingUp, AlertCircle, Loader2, PieChart, Scale,
  Calendar, Layers, Info
} from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer 
} from 'recharts';
import { format, isValid } from 'date-fns';
import { shrimpSizeService } from '../../services/shrimpSizeService';
import { cropService, type Crop } from '../../services/crop.service';
import GrowthHeaderTabs, { type GrowthTabType } from '../growth/GrowthHeaderTabs';

interface Pond {
  id: string;
  name: string;
  areaSize?: number;
}

interface ShrimpSizeSample {
  id: string;
  samplingDate: string;
  doc: number | null;
  sampleCount: number;
  sampleWeightGram: number;
  abwGram: number;
  sizePerKg: number;
  adgGramPerDay: number | null;
  netAreaSqM: number | null;
  estimatedTotalShrimp: number | null;
  estimatedBiomassKg: number | null;
}

interface PondBiomassDetailProps {
  pond: Pond;
  onBack: () => void;
  onNavigateTab?: (tab: GrowthTabType) => void;
}

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

export default function PondBiomassDetail({ 
  pond, 
  onBack,
  onNavigateTab
}: PondBiomassDetailProps) {
  const [samples, setSamples] = useState<ShrimpSizeSample[]>([]);
  const [activeCrop, setActiveCrop] = useState<Crop | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchSamples = useCallback(async () => {
    if (!pond?.id) return;
    try {
      setIsLoading(true);
      setError(null);
      const [data, crops] = await Promise.all([
        shrimpSizeService.getSamplesByPond(pond.id),
        cropService.getAll({ pondId: pond.id, status: 'ACTIVE' }).catch(() => []),
      ]);
      setSamples(Array.isArray(data) ? data : []);
      if (crops && crops.length > 0) {
        setActiveCrop(crops[0]);
      } else {
        setActiveCrop(null);
      }
    } catch (err: any) {
      setError(err.message || 'Lỗi tải dữ liệu sinh khối');
      setSamples([]);
    } finally {
      setIsLoading(false);
    }
  }, [pond?.id]);

  useEffect(() => {
    fetchSamples();
  }, [fetchSamples]);

  // Lọc ra các mẫu có đo sinh khối (có netAreaSqM)
  const safeSamples = Array.isArray(samples) ? samples : [];
  const biomassSamples = safeSamples.filter(
    (s) => s.netAreaSqM && s.estimatedTotalShrimp !== null && s.estimatedBiomassKg !== null
  );

  const latestSample = biomassSamples.length > 0 ? biomassSamples[biomassSamples.length - 1] : null;
  const previousSample = biomassSamples.length > 1 ? biomassSamples[biomassSamples.length - 2] : null;

  // Tính tỷ lệ sống ước tính = (estimatedTotalShrimp / initialShrimpCount) * 100
  const estimatedSurvivalRate = useMemo(() => {
    if (!latestSample || !latestSample.estimatedTotalShrimp || !activeCrop || !activeCrop.initialShrimpCount) {
      return null;
    }
    const rate = (Number(latestSample.estimatedTotalShrimp) / activeCrop.initialShrimpCount) * 100;
    return Math.min(100, Math.max(0, Number(rate.toFixed(1))));
  }, [latestSample, activeCrop]);

  // Tính chênh lệch sinh khối so với lần trước
  const biomassDiff = latestSample && previousSample 
    ? Number(latestSample.estimatedBiomassKg) - Number(previousSample.estimatedBiomassKg)
    : null;

  // Mật độ ao nuôi (con/m2 ao)
  const pondDensity = latestSample && pond?.areaSize && pond.areaSize > 0
    ? Math.round(Number(latestSample.estimatedTotalShrimp) / pond.areaSize)
    : null;

  const chartData = biomassSamples.map((s) => ({
    date: safeFormatDate(s.samplingDate, 'dd/MM'),
    biomass: Number(s.estimatedBiomassKg) || 0,
    totalShrimp: Number(s.estimatedTotalShrimp) || 0,
    doc: s.doc || 0,
  }));

  return (
    <div className="space-y-6 animate-in fade-in duration-300 max-w-7xl pb-12">
      {/* Top Navigation */}
      <GrowthHeaderTabs
        activeTab="Sinh khối ao"
        onTabChange={onNavigateTab}
        title={`Theo Dõi Sinh Khối & Mật Độ - ${pond.name}`}
        subtitle={`Ước tính tổng sản lượng tôm và mật độ phân bổ cá thể qua từng đợt lấy mẫu chài của ao ${pond.name}`}
      />

      {/* Pond Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white px-6 py-4 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-semibold text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-xl transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Quay lại danh sách ao</span>
          </button>
          <span className="text-slate-300">|</span>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Ao Nuôi:</span>
            <span className="text-sm font-extrabold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-lg">
              {pond.name}
            </span>
          </div>
        </div>

        <div className="text-xs font-semibold text-slate-500 flex items-center gap-2">
          <span>Diện tích mặt nước:</span>
          <span className="font-bold text-slate-800 bg-slate-100 px-2.5 py-1 rounded-lg">
            {pond.areaSize ? `${pond.areaSize.toLocaleString()} m²` : 'Chưa cấu hình'}
          </span>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-700 rounded-2xl flex items-center gap-3 border border-red-100">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center p-16 bg-white rounded-3xl border border-slate-200/80">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
        </div>
      ) : (
        <>
          {/* KPI Metrics Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: Tổng sinh khối */}
            <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Sinh Khối Hiện Tại</span>
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <PieChart className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-3xl font-black text-emerald-700 tracking-tight">
                    {latestSample && latestSample.estimatedBiomassKg !== null
                      ? Number(latestSample.estimatedBiomassKg).toLocaleString()
                      : '--'}
                  </span>
                  <span className="text-sm font-bold text-emerald-600">kg</span>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  {latestSample?.estimatedBiomassKg && Number(latestSample.estimatedBiomassKg) >= 1000
                    ? `≈ ${(Number(latestSample.estimatedBiomassKg) / 1000).toFixed(2)} tấn tôm thịt`
                    : 'Tổng khối lượng tôm trong ao'}
                </p>
              </div>
            </div>

            {/* Card 2: Ước tính số lượng tôm */}
            <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Ước Tính Số Lượng Tôm</span>
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Layers className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-3xl font-black text-blue-700 tracking-tight">
                    {latestSample && latestSample.estimatedTotalShrimp !== null
                      ? Number(latestSample.estimatedTotalShrimp).toLocaleString()
                      : '--'}
                  </span>
                  <span className="text-sm font-bold text-blue-600">con</span>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  {estimatedSurvivalRate !== null 
                    ? `Tỷ lệ sống ước tính: ~${estimatedSurvivalRate}%`
                    : 'Ước tính qua phương pháp chài lưới'}
                </p>
              </div>
            </div>

            {/* Card 3: Mật độ ao */}
            <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Mật Độ Ao Nuôi</span>
                <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center">
                  <Activity className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-3xl font-black text-teal-700 tracking-tight">
                    {pondDensity !== null ? pondDensity : '--'}
                  </span>
                  <span className="text-sm font-bold text-teal-600">con/m²</span>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Mật độ cá thể phân bổ trong ao
                </p>
              </div>
            </div>

            {/* Card 4: Tăng trưởng sinh khối */}
            <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Tăng Trọng Đợt Này</span>
                <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <TrendingUp className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-3xl font-black text-indigo-700 tracking-tight">
                    {biomassDiff !== null ? (biomassDiff >= 0 ? `+${Math.round(biomassDiff).toLocaleString()}` : `${Math.round(biomassDiff).toLocaleString()}`) : '--'}
                  </span>
                  <span className="text-sm font-bold text-indigo-600">kg</span>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  {biomassDiff !== null && biomassDiff >= 0 ? '🟢 Tăng sinh khối so với lần trước' : 'Đang theo dõi chu kỳ'}
                </p>
              </div>
            </div>
          </div>

          {/* Area Chart Section */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                  <PieChart className="w-4 h-4 text-emerald-600" />
                  Biểu Đồ Tích Lũy Sinh Khối (Biomass - kg)
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Diễn biến tổng lượng tôm thịt trong ao qua các mốc kiểm tra
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-100">
                <Calendar className="w-3.5 h-3.5" />
                <span>{biomassSamples.length} đợt chài đo sinh khối</span>
              </div>
            </div>

            <div className="h-72 w-full">
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 10, right: 10, bottom: 10, left: -10 }}>
                    <defs>
                      <linearGradient id="biomassGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                    <Tooltip
                      contentStyle={{
                        borderRadius: '16px',
                        border: '1px solid #e2e8f0',
                        boxShadow: '0 10px 15px -3px rgba(0,0,0,0.08)',
                        padding: '12px 16px',
                      }}
                      labelStyle={{ fontWeight: 'bold', color: '#1e293b', marginBottom: '4px' }}
                      formatter={(val: any) => [`${Number(val).toLocaleString()} kg`, 'Sinh khối']}
                    />
                    <Area
                      type="monotone"
                      dataKey="biomass"
                      stroke="#10b981"
                      strokeWidth={3}
                      fillOpacity={1}
                      fill="url(#biomassGradient)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-400">
                  <Scale className="w-10 h-10 mb-2 opacity-40" />
                  <p className="text-sm font-semibold">Chưa có mẫu nào đo sinh khối (chài lưới có diện tích chài)</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Hãy vào mục "Kích cỡ & Trọng lượng" để ghi nhận mẫu 5 mẻ chài kèm diện tích chài
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Biomass Sampling History Table */}
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-800">Lịch Sử Ước Tính Sinh Khối Qua Các Mẻ Chài</h3>
                <p className="text-xs text-slate-400 mt-0.5">Số liệu cụ thể theo diện tích chài và mật độ ao</p>
              </div>
              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100">
                {biomassSamples.length} bản ghi
              </span>
            </div>

            {biomassSamples.length === 0 ? (
              <div className="p-12 text-center text-slate-400">
                <Info className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm font-semibold">Chưa có bản ghi sinh khối nào</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-3.5">Ngày đo</th>
                      <th className="px-6 py-3.5">DOC</th>
                      <th className="px-6 py-3.5">Diện tích chài (m²)</th>
                      <th className="px-6 py-3.5">Số con 5 mẻ</th>
                      <th className="px-6 py-3.5">Trọng lượng TB (g/con)</th>
                      <th className="px-6 py-3.5 text-blue-700">Ước tính số tôm</th>
                      <th className="px-6 py-3.5 text-emerald-700">Sinh khối (kg)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                    {biomassSamples.slice().reverse().map((sample) => (
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
                        <td className="px-6 py-4">{sample.netAreaSqM} m²</td>
                        <td className="px-6 py-4">{sample.sampleCount} con</td>
                        <td className="px-6 py-4 font-bold">{Number(sample.abwGram).toFixed(2)} g</td>
                        <td className="px-6 py-4 font-black text-blue-700">
                          {sample.estimatedTotalShrimp ? sample.estimatedTotalShrimp.toLocaleString() : '--'} con
                        </td>
                        <td className="px-6 py-4 font-black text-emerald-700">
                          {sample.estimatedBiomassKg ? Number(sample.estimatedBiomassKg).toLocaleString() : '--'} kg
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
