import { useState, useEffect, useCallback } from 'react';
import { 
  ArrowLeft, Activity, Plus, FileText, 
  Trash2, TrendingUp, AlertCircle, Loader2, Scale, Save
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { format } from 'date-fns';
import { shrimpSizeService } from '../../services/shrimpSizeService';
import type { CastDto } from '../../services/shrimpSizeService';
import { cropService } from '../../services/crop.service';
import type { Crop } from '../../services/crop.service';

interface Pond {
  id: string;
  name: string;
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
}

export default function PondSizeDetail({ pond, viewOnly = false, onBack }: PondSizeDetailProps) {
  const [samples, setSamples] = useState<ShrimpSizeSample[]>([]);
  const [error, setError] = useState<string | null>(null);
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

  const fetchSamples = useCallback(async () => {
    try {
      setError(null);
      const data = await shrimpSizeService.getSamplesByPond(pond.id);
      setSamples(data);
      
      const crops = await cropService.getAll({ pondId: pond.id, status: 'ACTIVE' });
      if (crops.length > 0) {
        setActiveCrop(crops[0]);
      } else {
        setActiveCrop(null);
      }
    } catch (err: any) {
      setError(err.message || 'Lỗi tải dữ liệu');
    }
  }, [pond.id]);

  useEffect(() => {
    fetchSamples();
  }, [fetchSamples]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const hasInvalidCast = casts.some(c => !c.count || !c.weightGram || c.count <= 0 || c.weightGram <= 0);
    if (hasInvalidCast) {
      setError('Vui lòng nhập đầy đủ số lượng và khối lượng (>0) cho cả 5 lần chài.');
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
      await fetchSamples();
    } catch (err: any) {
      setError(err.message || 'Lỗi khi lưu dữ liệu');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (sampleId: string) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa bản ghi này?')) return;
    try {
      await shrimpSizeService.deleteSample(pond.id, sampleId);
      await fetchSamples();
    } catch (err: any) {
      setError(err.message || 'Lỗi khi xóa mẫu');
    }
  };

  // Prepare data
  const latestSample = samples.length > 0 ? samples[samples.length - 1] : null;
  const chartData = samples.map(s => ({
    date: format(new Date(s.samplingDate), 'MMM dd'),
    abw: Number(s.abwGram),
    adg: s.adgGramPerDay ? Number(s.adgGramPerDay) : 0,
  }));

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex items-center gap-4 border-b border-slate-200 pb-4">
        <button 
          onClick={onBack}
          className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
        <div>
          <h2 className="text-xl font-black text-slate-800">Theo dõi Kích cỡ & Trọng lượng</h2>
          <p className="text-sm font-medium text-slate-500 flex items-center gap-2">
            Ao nuôi: <span className="text-indigo-600 font-bold">{pond.name}</span>
          </p>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-700 rounded-2xl flex items-center gap-3 border border-red-100">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column */}
        <div className="space-y-6">
          {/* Card: Chỉ số gần nhất */}
          <div className="bg-slate-50/50 p-6 rounded-3xl border border-slate-200/60 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
              <Activity className="w-32 h-32" />
            </div>
            <h3 className="text-sm font-bold text-slate-600 mb-6 flex items-center gap-2 uppercase tracking-wider">
              <Activity className="w-4 h-4 text-indigo-500" />
              Chỉ số gần nhất
            </h3>

            <div className="space-y-3 relative z-10">
              <div className="flex justify-between items-center p-4 bg-white rounded-2xl border border-slate-100 shadow-sm">
                <span className="text-sm font-medium text-slate-600">Trọng lượng TB (g/con)</span>
                <span className="text-lg font-black text-slate-800">
                  {latestSample ? Number(latestSample.abwGram).toFixed(2) : '-'}
                </span>
              </div>
              
              <div className="flex justify-between items-center p-4 bg-indigo-50 rounded-2xl border border-indigo-100 shadow-sm">
                <span className="text-sm font-medium text-indigo-700">Kích cỡ (con/kg)</span>
                <span className="text-lg font-black text-indigo-700">
                  {latestSample ? Number(latestSample.sizePerKg).toFixed(1) : '-'}
                </span>
              </div>

              <div className="flex justify-between items-center p-4 bg-emerald-50 rounded-2xl border border-emerald-100 shadow-sm">
                <span className="text-sm font-medium text-emerald-700">Tốc độ tăng trưởng (g/ngày)</span>
                <span className="text-lg font-black text-emerald-700">
                  {latestSample && latestSample.adgGramPerDay !== null 
                    ? Number(latestSample.adgGramPerDay).toFixed(2) 
                    : '-'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Chart */}
          <div className="bg-slate-50/30 p-6 rounded-3xl border border-slate-200 shadow-sm">
            <h3 className="text-sm font-bold text-indigo-700 mb-6 flex items-center gap-2 uppercase tracking-wider">
              <Scale className="w-4 h-4" />
              Biểu đồ tăng trưởng (ABW & ADG)
            </h3>
            
            <div className="h-[300px] w-full bg-white rounded-2xl border border-slate-100 p-4">
              {samples.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 10, right: 10, bottom: 10, left: -20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis yAxisId="left" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis yAxisId="right" orientation="right" stroke="#10b981" fontSize={12} tickLine={false} axisLine={false} />
                    <Tooltip 
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      labelStyle={{ fontWeight: 'bold', color: '#1e293b', marginBottom: '4px' }}
                    />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                    <Line 
                      yAxisId="left"
                      type="monotone" 
                      name="ABW (g/con)"
                      dataKey="abw" 
                      stroke="#4f46e5" 
                      strokeWidth={3}
                      dot={{ r: 4, strokeWidth: 2, fill: '#fff' }}
                      activeDot={{ r: 6, strokeWidth: 0 }}
                    />
                    <Line 
                      yAxisId="right"
                      type="monotone" 
                      name="ADG (g/ngày)"
                      dataKey="adg" 
                      stroke="#10b981" 
                      strokeWidth={3}
                      strokeDasharray="5 5"
                      dot={{ r: 4, strokeWidth: 2, fill: '#fff' }}
                      activeDot={{ r: 6, strokeWidth: 0 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-400">
                  <TrendingUp className="w-8 h-8 mb-2 opacity-50" />
                  <p className="text-sm font-medium">Chưa có dữ liệu sinh trưởng</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Add new sample form */}
      {!viewOnly && (
        activeCrop ? (
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                <h3 className="text-sm font-bold text-indigo-700 mb-6 flex items-center gap-2 uppercase tracking-wider border-b border-indigo-50 pb-4">
                  <Plus className="w-4 h-4" />
                  Ghi nhận mẫu mới
                </h3>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-1.5 pb-4 border-b border-slate-100">
                    <label className="text-xs font-bold text-slate-600">
                      Diện tích miệng chài (S_chài - m²)
                    </label>
                    <input
                      type="number"
                      min="0.1"
                      step="0.1"
                      value={netAreaSqM}
                      onChange={(e) => setNetAreaSqM(Number(e.target.value) || '')}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 text-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-sm font-medium transition-all"
                      placeholder="VD: 10.18"
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                    {casts.map((cast, index) => (
                      <div key={index} className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                        <h4 className="text-xs font-bold text-slate-500 text-center">Mẻ #{index + 1}</h4>
                        <div className="space-y-2">
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-600 uppercase block text-center">Số lượng (con)</label>
                            <input
                              type="number"
                              min="1"
                              value={cast.count || ''}
                              onChange={(e) => {
                                const newCasts = [...casts];
                                newCasts[index].count = Number(e.target.value);
                                setCasts(newCasts);
                              }}
                              className="w-full px-2 py-1.5 bg-white border border-slate-200 text-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-sm font-medium transition-all text-center"
                              placeholder="0"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-600 uppercase block text-center">Khối lượng (g)</label>
                            <input
                              type="number"
                              min="0.1"
                              step="0.1"
                              value={cast.weightGram || ''}
                              onChange={(e) => {
                                const newCasts = [...casts];
                                newCasts[index].weightGram = Number(e.target.value);
                                setCasts(newCasts);
                              }}
                              className="w-full px-2 py-1.5 bg-white border border-slate-200 text-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-sm font-medium transition-all text-center"
                              placeholder="0"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-1.5 pt-2">
                    <label className="text-xs font-bold text-slate-600">
                      Ghi chú chung
                    </label>
                    <input
                      type="text"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 text-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-sm font-medium transition-all"
                      placeholder="Nhập ghi chú cho đợt lấy mẫu này..."
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full mt-2 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-all shadow-sm disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
                  >
                    {isSubmitting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Save className="w-4 h-4" />
                        Lưu kết quả
                      </>
                    )}
                  </button>
                </form>
              </div>
            ) : (
              <div className="bg-amber-50 rounded-xl shadow-sm border border-amber-200 p-6 flex flex-col items-center justify-center text-center">
                <AlertCircle className="w-10 h-10 text-amber-500 mb-3" />
                <h3 className="text-lg font-semibold text-amber-800 mb-1">Ao này hiện không có vụ nuôi nào đang hoạt động</h3>
                <p className="text-amber-700">Bạn không thể ghi nhận mẫu kích cỡ cho ao không có tôm.</p>
              </div>
            )
      )}

      {/* Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
            <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
              <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2 uppercase tracking-wider">
                <FileText className="w-4 h-4 text-rose-500" />
                Lịch sử lấy mẫu
              </h3>
            </div>
            
            <div className="overflow-x-auto flex-1 max-h-[400px]">
              <table className="w-full text-xs text-left">
                <thead className="bg-white text-slate-500 font-bold uppercase tracking-wider sticky top-0 border-b border-slate-100 z-10">
                  <tr>
                    <th className="px-4 py-3 whitespace-nowrap">Thời gian</th>
                    <th className="px-4 py-3 text-right">Số lượng</th>
                    <th className="px-4 py-3 text-right">Khối lượng (g)</th>
                    <th className="px-4 py-3 text-indigo-600 text-right">Kích cỡ</th>
                    <th className="px-4 py-3 text-emerald-600 text-right">ABW</th>
                    <th className="px-4 py-3 text-emerald-600 text-right">ADG</th>
                    <th className="px-4 py-3">Ghi chú</th>
                    {!viewOnly && <th className="px-4 py-3 text-center">Thao tác</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {samples.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-slate-400 font-medium">
                        Không có dữ liệu
                      </td>
                    </tr>
                  ) : (
                    samples.map((sample) => (
                      <tr key={sample.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 font-medium text-slate-700 whitespace-nowrap">
                          {format(new Date(sample.samplingDate), 'dd/MM/yyyy HH:mm')}
                        </td>
                        <td className="px-4 py-3 text-slate-600 text-right font-medium">
                          {sample.sampleCount}
                        </td>
                        <td className="px-4 py-3 text-slate-600 text-right font-medium">
                          {sample.sampleWeightGram}
                        </td>
                        <td className="px-4 py-3 font-bold text-indigo-600 text-right">
                          {Number(sample.sizePerKg).toFixed(1)}
                        </td>
                        <td className="px-4 py-3 font-bold text-emerald-600 text-right">
                          {Number(sample.abwGram).toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {sample.adgGramPerDay !== null ? (
                            <span className="font-medium text-emerald-600">
                              {Number(sample.adgGramPerDay).toFixed(2)}
                            </span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-500 max-w-[150px] truncate" title={sample.notes || ''}>
                          {sample.notes || '-'}
                        </td>
                        {!viewOnly && (
                          <td className="px-4 py-3 text-center">
                            <button
                              onClick={() => handleDelete(sample.id)}
                              className="text-slate-400 hover:text-red-500 transition-colors"
                              title="Xóa mẫu"
                            >
                              <Trash2 className="w-4 h-4 mx-auto" />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
    </div>
  );
}
