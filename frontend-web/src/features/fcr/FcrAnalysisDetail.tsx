import { useState, useEffect, useCallback } from 'react';
import { 
  ArrowLeft, Download, AlertCircle, Loader2, Target,
  TrendingDown, TrendingUp, Minus
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { shrimpSizeService } from '../../services/shrimpSizeService';

interface Pond {
  id: string;
  name: string;
}

interface FCRHistory {
  id: string;
  periodName: string;
  date: string;
  feedAmount: number;
  biomassGain: number;
  periodFCR: number | null;
  status: 'TỐT' | 'BÌNH THƯỜNG' | 'CẢNH BÁO';
}

interface FCRAnalysisData {
  currentFCR: number | null;
  fcrDiff: number | null;
  totalFeedUsed: number;
  totalBiomassGain: number;
  avgWeight: number;
  fcrTarget: number;
  targetTotalFeedKg?: number | null;
  history: FCRHistory[];
}

interface FcrAnalysisDetailProps {
  pond: Pond;
  onBack: () => void;
}

export default function FcrAnalysisDetail({ pond, onBack }: FcrAnalysisDetailProps) {
  const [data, setData] = useState<FCRAnalysisData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchFCR = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const fcr = await shrimpSizeService.getFCRAnalysis(pond.id);
      setData(fcr);
    } catch (err: any) {
      setError(err.message || 'Lỗi tải dữ liệu FCR');
    } finally {
      setIsLoading(false);
    }
  }, [pond.id]);

  useEffect(() => {
    fetchFCR();
  }, [fetchFCR]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12 h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6 animate-in fade-in duration-300">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h2 className="text-xl font-black text-slate-800">Phân tích FCR</h2>
        </div>
        <div className="p-4 bg-red-50 text-red-700 rounded-2xl flex items-center gap-3 border border-red-100">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <p className="text-sm font-medium">{error}</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  // Chart needs history in chronological order
  const chartData = [...data.history].reverse().map(h => ({
    name: h.periodName,
    fcr: h.periodFCR,
  }));

  const renderFcrDiffBadge = () => {
    if (data.fcrDiff === null) return null;
    
    // FCR went down = good
    if (data.fcrDiff < 0) {
      return (
        <div className="flex items-center gap-1 bg-emerald-100 text-emerald-700 px-2 py-1 rounded-md text-[10px] font-bold">
          <TrendingDown className="w-3 h-3" />
          {Math.abs(data.fcrDiff)}
        </div>
      );
    }
    // FCR went up = bad
    if (data.fcrDiff > 0) {
      return (
        <div className="flex items-center gap-1 bg-rose-100 text-rose-700 px-2 py-1 rounded-md text-[10px] font-bold">
          <TrendingUp className="w-3 h-3" />
          {data.fcrDiff}
        </div>
      );
    }
    // No change
    return (
      <div className="flex items-center gap-1 bg-slate-100 text-slate-600 px-2 py-1 rounded-md text-[10px] font-bold">
        <Minus className="w-3 h-3" />
        0.00
      </div>
    );
  };

  const getStatusBadgeClass = (status: string) => {
    switch(status) {
      case 'TỐT': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'BÌNH THƯỜNG': return 'bg-slate-100 text-slate-600 border-slate-200';
      case 'CẢNH BÁO': return 'bg-rose-100 text-rose-700 border-rose-200';
      default: return 'bg-slate-100 text-slate-500 border-slate-200';
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300 pb-10">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack}
            className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div>
            <h2 className="text-2xl font-black text-slate-800">Phân tích FCR (Hệ số chuyển đổi thức ăn)</h2>
            <p className="text-sm font-medium text-slate-500 mt-1">Ao nuôi: <span className="text-indigo-600 font-bold">{pond.name}</span></p>
          </div>
        </div>
        <div className="flex gap-3">
          <button disabled className="px-4 py-2.5 bg-indigo-600 text-white font-bold text-sm rounded-xl hover:bg-indigo-700 transition-colors shadow-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
            <Download className="w-4 h-4" />
            Xuất báo cáo
          </button>
        </div>
      </div>

      {data.history.length === 0 ? (
        <div className="p-12 text-center bg-white border border-slate-100 rounded-3xl shadow-sm">
          <Target className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-500 font-medium">Chưa có dữ liệu sinh khối để phân tích FCR.</p>
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Card 1: FCR Hiện tại */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm relative">
              <div className="flex justify-between items-start mb-4">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">FCR Hiện tại</span>
                <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-500">
                  <Target className="w-5 h-5" />
                </div>
              </div>
              <div className="flex items-baseline gap-2 mb-3">
                <span className="text-4xl font-black text-indigo-700">{data.currentFCR !== null ? data.currentFCR : '-'}</span>
                <span className="text-xs font-medium text-slate-500">kg cám/kg tôm</span>
              </div>
              <div className="flex items-center gap-2 mt-auto">
                {renderFcrDiffBadge()}
                <span className="text-[11px] text-slate-500 font-medium">so với lần đo trước</span>
              </div>
            </div>

            {/* Card 2: Tổng thức ăn đã dùng */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm relative flex flex-col justify-between">
              <div className="flex justify-between items-start mb-4">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Tổng thức ăn đã dùng</span>
                <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-500">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 12H3"/><path d="M7 12v10"/><path d="M7 3v9"/><path d="M13 12v10"/><path d="M19 12v10"/><path d="M19 3v9"/><path d="M19 3l-3 4"/><path d="M19 3l3 4"/><path d="M13 3l-3 4"/><path d="M13 3l3 4"/></svg>
                </div>
              </div>
              <div className="flex items-baseline gap-2 mb-5">
                <span className="text-3xl font-black text-slate-800">{data.totalFeedUsed.toLocaleString()}</span>
                <span className="text-xs font-medium text-slate-500">kg</span>
              </div>
              {data.targetTotalFeedKg ? (
                (() => {
                  const percentage = Math.min((data.totalFeedUsed / data.targetTotalFeedKg) * 100, 100).toFixed(1);
                  const isOverLimit = data.totalFeedUsed > data.targetTotalFeedKg;
                  return (
                    <div className="space-y-2">
                      <div className="flex justify-between text-[10px] text-slate-400 font-medium mb-1">
                        <span>Định mức: {data.targetTotalFeedKg.toLocaleString()} kg</span>
                        <span className={isOverLimit ? 'text-red-500 font-bold' : ''}>
                          {((data.totalFeedUsed / data.targetTotalFeedKg) * 100).toFixed(1)}%
                        </span>
                      </div>
                      <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full ${isOverLimit ? 'bg-red-500' : 'bg-amber-700'}`} 
                          style={{ width: `${percentage}%` }}
                        ></div>
                      </div>
                    </div>
                  );
                })()
              ) : (
                <div className="text-right text-[10px] text-slate-400 font-medium italic">
                  Chưa có định mức dự kiến
                </div>
              )}
            </div>

            {/* Card 3: Tổng sinh khối tăng thêm */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm relative flex flex-col justify-between">
              <div className="flex justify-between items-start mb-4">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Tổng sinh khối tăng thêm</span>
                <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-500">
                  <TrendingUp className="w-5 h-5" />
                </div>
              </div>
              <div className="flex items-baseline gap-2 mb-5">
                <span className="text-3xl font-black text-slate-800">{data.totalBiomassGain.toLocaleString()}</span>
                <span className="text-xs font-medium text-slate-500">kg</span>
              </div>
              <div className="mt-auto pl-3 border-l-2 border-emerald-500">
                <div className="text-[10px] text-slate-400 font-medium">Trọng lượng TB</div>
                <div className="text-xs font-bold text-slate-700">{data.avgWeight} g/con</div>
              </div>
            </div>
          </div>

          {/* Chart */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Biểu đồ so sánh FCR Thực tế vs Mục tiêu</h3>
              <div className="flex items-center gap-4 text-[11px] font-bold text-slate-500">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-indigo-500 border-2 border-indigo-200"></div>
                  FCR Thực tế
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-4 border-b-2 border-dashed border-slate-400"></div>
                  FCR Mục tiêu ({data.fcrTarget.toFixed(2)})
                </div>
              </div>
            </div>
            
            <div className="h-72 mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="name" 
                    axisLine={{ stroke: '#e2e8f0' }}
                    tickLine={false}
                    tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 600 }}
                    dy={15}
                  />
                  <YAxis 
                    domain={[1.0, 1.8]} 
                    tickCount={5}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 600 }}
                    dx={-10}
                  />
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    itemStyle={{ fontWeight: 600 }}
                    formatter={(value: any) => [value, 'FCR']}
                  />
                  <ReferenceLine y={data.fcrTarget} stroke="#94a3b8" strokeDasharray="5 5" strokeWidth={2} />
                  <Line 
                    type="linear" 
                    dataKey="fcr" 
                    stroke="transparent" 
                    dot={(props: any) => {
                      const { cx, cy, key, payload } = props;
                      if (payload.fcr === null) return <circle key={key} />;
                      return (
                        <circle key={key} cx={cx} cy={cy} r={4} stroke="#4f46e5" strokeWidth={2} fill="white" />
                      );
                    }}
                    activeDot={{ r: 6, fill: '#4f46e5', strokeWidth: 0 }}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* History Table */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Chi tiết Thức ăn & Sinh khối theo Giai đoạn</h3>
              <button className="text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors">Xem tất cả</button>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="bg-white border-b border-slate-100 text-slate-500 font-bold text-[11px] uppercase tracking-wider">
                    <th className="py-4 px-6 whitespace-nowrap">Giai đoạn</th>
                    <th className="py-4 px-6 text-right whitespace-nowrap">Lượng thức ăn (kg)</th>
                    <th className="py-4 px-6 text-right whitespace-nowrap">Sinh khối tăng (kg)</th>
                    <th className="py-4 px-6 text-center whitespace-nowrap">FCR Giai đoạn</th>
                    <th className="py-4 px-6 text-center whitespace-nowrap">Trạng thái</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {data.history.map((h, index) => (
                    <tr key={h.id || index} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-4 px-6 font-semibold text-slate-700">
                        {h.periodName} {index === 0 && <span className="text-xs text-slate-400 font-medium ml-1">(Hiện tại)</span>}
                      </td>
                      <td className="py-4 px-6 text-right font-medium text-slate-600">
                        {h.feedAmount.toLocaleString()}
                      </td>
                      <td className="py-4 px-6 text-right font-medium text-slate-600">
                        {h.biomassGain.toLocaleString()}
                      </td>
                      <td className="py-4 px-6 text-center font-bold text-indigo-700">
                        {h.periodFCR !== null ? h.periodFCR.toFixed(2) : '-'}
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex justify-center">
                          <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase border ${getStatusBadgeClass(h.status)}`}>
                            {h.status}
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-50 border-t border-slate-200">
                  <tr>
                    <td className="py-4 px-6 font-black text-slate-800">TỔNG CỘNG</td>
                    <td className="py-4 px-6 text-right font-black text-indigo-700">{data.totalFeedUsed.toLocaleString()}</td>
                    <td className="py-4 px-6 text-right font-black text-emerald-600">{data.totalBiomassGain.toLocaleString()}</td>
                    <td className="py-4 px-6 text-center font-black text-slate-800">{data.currentFCR !== null ? data.currentFCR.toFixed(2) : '-'} (TB)</td>
                    <td className="py-4 px-6"></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
