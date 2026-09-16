import { useState, useEffect, useCallback } from 'react';
import { 
  ArrowLeft, Activity, 
  TrendingUp, AlertCircle, Loader2, PieChart 
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { format } from 'date-fns';
import { shrimpSizeService } from '../../services/shrimpSizeService';

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
}

export default function PondBiomassDetail({ pond, onBack }: PondBiomassDetailProps) {
  const [samples, setSamples] = useState<ShrimpSizeSample[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchSamples = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await shrimpSizeService.getSamplesByPond(pond.id);
      setSamples(data);
    } catch (err: any) {
      setError(err.message || 'Lỗi tải dữ liệu sinh khối');
    } finally {
      setIsLoading(false);
    }
  }, [pond.id]);

  useEffect(() => {
    fetchSamples();
  }, [fetchSamples]);

  // Lọc ra các mẫu có đo sinh khối (có netAreaSqM)
  const biomassSamples = samples.filter(s => s.netAreaSqM && s.estimatedTotalShrimp !== null && s.estimatedBiomassKg !== null);
  const latestSample = biomassSamples.length > 0 ? biomassSamples[biomassSamples.length - 1] : null;

  const chartData = biomassSamples.map(s => ({
    date: format(new Date(s.samplingDate), 'MMM dd'),
    biomass: Number(s.estimatedBiomassKg),
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
          <h2 className="text-xl font-black text-slate-800">Sinh khối ao nuôi</h2>
          <p className="text-sm font-medium text-slate-500 flex items-center gap-2">
            Ao nuôi: <span className="text-emerald-600 font-bold">{pond.name}</span>
          </p>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-700 rounded-2xl flex items-center gap-3 border border-red-100">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center p-12">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column */}
          <div className="space-y-6">
            {/* Card: Chỉ số gần nhất */}
            <div className="bg-slate-50/50 p-6 rounded-3xl border border-slate-200/60 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                <Activity className="w-32 h-32" />
              </div>
              <h3 className="text-sm font-bold text-slate-600 mb-6 flex items-center gap-2 uppercase tracking-wider">
                <Activity className="w-4 h-4 text-emerald-500" />
                Chỉ số sinh khối gần nhất
              </h3>

              <div className="space-y-3 relative z-10">
                <div className="flex justify-between items-center p-4 bg-white rounded-2xl border border-slate-100 shadow-sm">
                  <span className="text-sm font-medium text-slate-600">Tổng lượng tôm ước tính hiện tại (Con)</span>
                  <span className="text-lg font-black text-slate-800">
                    {latestSample ? Number(latestSample.estimatedTotalShrimp).toLocaleString() : '-'}
                  </span>
                </div>
                
                <div className="flex justify-between items-center p-4 bg-emerald-50 rounded-2xl border border-emerald-100 shadow-sm">
                  <span className="text-sm font-medium text-emerald-700">Sinh khối hiện tại (Kg)</span>
                  <span className="text-lg font-black text-emerald-700">
                    {latestSample ? Number(latestSample.estimatedBiomassKg).toLocaleString() : '-'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column */}
          <div className="lg:col-span-2 space-y-6">
            {/* Chart */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
              <h3 className="text-sm font-bold text-emerald-700 mb-6 flex items-center gap-2 uppercase tracking-wider border-b border-emerald-50 pb-4">
                <TrendingUp className="w-4 h-4" />
                Biểu đồ Sinh khối (Kg)
              </h3>
              
              <div className="h-64">
                {chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis 
                        dataKey="date" 
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#64748b', fontSize: 12, fontWeight: 600 }}
                        dy={10}
                      />
                      <YAxis 
                        yAxisId="left"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#64748b', fontSize: 12, fontWeight: 600 }}
                        dx={-10}
                      />
                      <Tooltip 
                        contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        itemStyle={{ fontWeight: 600 }}
                      />
                      <Legend 
                        iconType="circle"
                        wrapperStyle={{ paddingTop: '20px', fontSize: '12px', fontWeight: 600 }}
                      />
                      <Line 
                        yAxisId="left"
                        type="monotone" 
                        dataKey="biomass" 
                        name="Sinh khối (Kg)" 
                        stroke="#10b981" 
                        strokeWidth={3}
                        dot={{ fill: '#10b981', strokeWidth: 2, r: 4 }}
                        activeDot={{ r: 6, strokeWidth: 0 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-slate-400 text-sm font-medium">
                    Chưa có dữ liệu sinh khối
                  </div>
                )}
              </div>
            </div>

            {/* History Table */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
              <h3 className="text-sm font-bold text-rose-600 mb-6 flex items-center gap-2 uppercase tracking-wider border-b border-rose-50 pb-4">
                <PieChart className="w-4 h-4" />
                Lịch sử lấy mẫu
              </h3>
              
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-500 font-bold uppercase text-[10px] tracking-wider">
                      <th className="pb-3 px-4">Thời gian</th>
                      <th className="pb-3 px-4 text-right">Số lượng tôm hiện tại (con)</th>
                      <th className="pb-3 px-4 text-right">Sinh khối (kg)</th>
                      <th className="pb-3 px-4 text-right">S_chài (m2)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {biomassSamples.map((sample) => (
                      <tr key={sample.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors group">
                        <td className="py-4 px-4 font-medium text-slate-700">
                          {format(new Date(sample.samplingDate), 'dd/MM/yyyy HH:mm')}
                        </td>
                        <td className="py-4 px-4 text-right font-bold text-slate-700">
                          {Number(sample.estimatedTotalShrimp).toLocaleString()}
                        </td>
                        <td className="py-4 px-4 text-right font-black text-emerald-600">
                          {Number(sample.estimatedBiomassKg).toLocaleString()}
                        </td>
                        <td className="py-4 px-4 text-right text-slate-500 font-medium">
                          {sample.netAreaSqM}
                        </td>
                      </tr>
                    ))}
                    {biomassSamples.length === 0 && (
                      <tr>
                        <td colSpan={4} className="py-8 text-center text-slate-500 font-medium text-sm bg-slate-50/50 rounded-xl">
                          Chưa có ghi nhận sinh khối nào.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
