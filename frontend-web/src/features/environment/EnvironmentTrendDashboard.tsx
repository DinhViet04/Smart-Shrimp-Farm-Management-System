import { useState, useEffect, useMemo } from 'react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, 
  ResponsiveContainer, ReferenceArea
} from 'recharts';
import { subDays, subHours, format } from 'date-fns';
import { Activity, ArrowDownRight, ArrowUpRight, ChevronDown, Droplets, Loader2, Minus } from 'lucide-react';
import { farmService } from '../../services/farm.service';
import { pondService } from '../../services/pond.service';
import { waterQualityService } from '../../services/water-quality.service';

type TimeRange = '24h' | '7d' | '30d';
type WQStatus = 'Optimal' | 'Warning' | 'Danger';

interface Farm { id: string; name: string; }
interface Pond { id: string; name: string; farmId: string; }
interface TrendData {
  id: string;
  recordTime: string;
  temperature: number;
  ph: number;
  dissolvedOxygen: number;
  salinity: number;
  alkalinity: number;
  nh3: number;
  no2: number;
  transparency: number;
  overallStatus: WQStatus;
}

const PARAM_CONFIG = {
  temperature: { name: 'Nhiệt độ', unit: '°C', color: '#f43f5e', optimal: [28, 32], warningHigh: [32, 34], warningLow: [25, 28], domain: [25, 45] },
  ph: { name: 'pH', unit: '', color: '#8b5cf6', optimal: [7.5, 8.5], warningHigh: [8.5, 9.0], warningLow: [7.0, 7.5], domain: [4.0, 12.0] },
  dissolvedOxygen: { name: 'DO (Oxy)', unit: 'mg/L', color: '#0ea5e9', optimal: [5, 10], warningLow: [4, 5], domain: [0, 10] },
  salinity: { name: 'Độ mặn', unit: 'ppt', color: '#10b981', optimal: [10, 25], warningHigh: [25, 30], warningLow: [5, 10], domain: [0, 40] },
  alkalinity: { name: 'Độ kiềm', unit: 'mg/L', color: '#f59e0b', optimal: [80, 200], warningHigh: [200, 250], warningLow: [60, 80], domain: [50, 250] },
  nh3: { name: 'NH3', unit: 'mg/L', color: '#d946ef', optimal: [0, 0.10], warningHigh: [0.10, 0.30], domain: [0, 1.0] },
  no2: { name: 'NO2', unit: 'mg/L', color: '#f97316', optimal: [0, 0.30], warningHigh: [0.30, 1.00], domain: [0, 2.0] },
  transparency: { name: 'Độ trong', unit: 'cm', color: '#06b6d4', optimal: [30, 40], warningHigh: [40, 50], warningLow: [20, 30], domain: [0, 70] },
};

type ParamKey = keyof typeof PARAM_CONFIG;

export default function EnvironmentTrendDashboard() {
  const [farms, setFarms] = useState<Farm[]>([]);
  const [ponds, setPonds] = useState<Pond[]>([]);
  const [selectedFarm, setSelectedFarm] = useState('');
  const [selectedPond, setSelectedPond] = useState('');
  const [timeRange, setTimeRange] = useState<TimeRange>('7d');
  const [loading, setLoading] = useState(false);
  const [trendData, setTrendData] = useState<TrendData[]>([]);
  const [activeParam, setActiveParam] = useState<ParamKey>('temperature');

  // Load farms & ponds
  useEffect(() => {
    Promise.all([farmService.getAll(), pondService.getAll()]).then(([f, p]) => {
      setFarms(f);
      setPonds(p);
      if (f.length > 0) setSelectedFarm(f[0].id);
    });
  }, []);

  // Fetch trend data when pond or time range changes
  useEffect(() => {
    if (!selectedPond) {
      setTrendData([]);
      return;
    }
    const fetchData = async () => {
      setLoading(true);
      try {
        let fromDate = new Date();
        if (timeRange === '24h') fromDate = subHours(new Date(), 24);
        if (timeRange === '7d') fromDate = subDays(new Date(), 7);
        if (timeRange === '30d') fromDate = subDays(new Date(), 30);
        
        const data = await waterQualityService.getTrends(selectedPond, fromDate.toISOString());
        setTrendData(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [selectedPond, timeRange]);

  const filteredPonds = ponds.filter(p => p.farmId === selectedFarm);

  // Derived stats
  const stats = useMemo(() => {
    if (!trendData.length) return null;
    const res: any = {};
    Object.keys(PARAM_CONFIG).forEach(k => {
      const key = k as ParamKey;
      const values = trendData.map(d => d[key]);
      const min = Math.min(...values);
      const max = Math.max(...values);
      const avg = values.reduce((a, b) => a + b, 0) / values.length;
      const first = values[0];
      const last = values[values.length - 1];
      const trend = last > first ? 'up' : last < first ? 'down' : 'flat';
      res[key] = { min, max, avg, trend };
    });
    return res;
  }, [trendData]);

  const getStatusColor = (status: WQStatus) => {
    if (status === 'Optimal') return 'text-emerald-500 bg-emerald-50';
    if (status === 'Warning') return 'text-amber-500 bg-amber-50';
    return 'text-red-500 bg-red-50';
  };

  const getStatusText = (status: WQStatus) => {
    if (status === 'Optimal') return 'Tối ưu';
    if (status === 'Warning') return 'Cảnh báo';
    return 'Nguy hiểm';
  };

  const formatXAxis = (tickItem: string) => {
    const date = new Date(tickItem);
    if (timeRange === '24h') return format(date, 'HH:mm');
    if (timeRange === '7d') return format(date, 'dd/MM HH:mm');
    return format(date, 'dd/MM');
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload as TrendData;
      return (
        <div className="bg-white/95 backdrop-blur-md p-4 rounded-xl border shadow-xl shadow-indigo-900/10 z-50">
          <p className="text-sm font-bold text-slate-700 mb-2 border-b pb-2">
            {format(new Date(label), 'dd/MM/yyyy HH:mm')}
          </p>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs text-slate-500">Đánh giá chung:</span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${getStatusColor(data.overallStatus)}`}>
              {getStatusText(data.overallStatus)}
            </span>
          </div>
          <div className="space-y-1.5">
            {payload.map((p: any) => (
              <div key={p.dataKey} className="flex items-center justify-between gap-4 text-sm">
                <span style={{ color: p.color }} className="font-semibold">{p.name}:</span>
                <span className="font-bold text-slate-800">{p.value.toFixed(2)} {PARAM_CONFIG[p.dataKey as ParamKey].unit}</span>
              </div>
            ))}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="h-full flex flex-col space-y-6 animate-in fade-in duration-300">
      {/* ── Top Bar ── */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-white/80 backdrop-blur-md p-4 rounded-2xl shadow-sm border border-indigo-100">
        <div className="flex items-center gap-4 w-full md:w-auto">
          <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-500 text-white rounded-xl flex items-center justify-center shadow-md">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-indigo-900">Xu hướng Môi trường</h2>
            <p className="text-xs font-medium text-slate-500 mt-0.5">Phân tích dữ liệu lịch sử đo lường tự động</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3 w-full md:w-auto flex-wrap">
          <div className="relative">
            <select
              value={selectedFarm}
              onChange={(e) => { setSelectedFarm(e.target.value); setSelectedPond(''); }}
              className="pl-4 pr-10 py-2.5 rounded-xl border border-indigo-100 bg-indigo-50/50 text-sm font-bold text-indigo-900 outline-none focus:ring-2 focus:ring-indigo-500/20 appearance-none min-w-[160px] cursor-pointer hover:bg-indigo-100/50 transition-colors"
            >
              <option value="">-- Chọn trang trại --</option>
              {farms.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
            <ChevronDown className="w-4 h-4 text-indigo-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          <div className="bg-slate-100 p-1 rounded-xl flex text-sm font-bold">
            {([['24h', '24 Giờ'], ['7d', '7 Ngày'], ['30d', '30 Ngày']] as const).map(([val, label]) => (
              <button
                key={val}
                onClick={() => setTimeRange(val)}
                className={`px-4 py-2 rounded-lg transition-all ${timeRange === val ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Content ── */}
      {!selectedPond ? (
        // Pond Grid View
        <div className="flex-1 overflow-y-auto pb-8">
          {selectedFarm && (
            <>
              <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4 px-2">Vui lòng chọn Ao nuôi để xem biểu đồ</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredPonds.map(pond => (
                  <div 
                    key={pond.id} 
                    onClick={() => setSelectedPond(pond.id)}
                    className="bg-white/80 backdrop-blur-sm border border-indigo-100 rounded-2xl p-5 hover:border-indigo-400 hover:shadow-lg hover:shadow-indigo-900/5 transition-all cursor-pointer group hover:-translate-y-1"
                  >
                    <div className="flex justify-between items-start mb-5">
                      <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:bg-gradient-to-br group-hover:from-indigo-500 group-hover:to-purple-500 group-hover:text-white group-hover:shadow-md transition-all">
                        <Droplets className="w-5 h-5" />
                      </div>
                      <span className="text-[10px] font-bold text-indigo-600/70 bg-indigo-50 border border-indigo-100 px-2 py-1 rounded-md uppercase tracking-wider">Ao nuôi</span>
                    </div>
                    <h4 className="text-xl font-bold text-indigo-900 mb-1">{pond.name}</h4>
                    <p className="text-sm font-semibold text-slate-400 group-hover:text-indigo-500 flex items-center gap-1 transition-colors mt-4">
                      Xem biểu đồ chi tiết <ArrowUpRight className="w-4 h-4" />
                    </p>
                  </div>
                ))}
                {filteredPonds.length === 0 && (
                  <div className="col-span-full py-12 text-center text-slate-500 font-medium bg-white/50 rounded-2xl border border-dashed border-slate-200">
                    Trang trại này hiện chưa có ao nuôi nào.
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      ) : (
        // Chart Detail View
        <div className="flex flex-col gap-6 pb-8">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setSelectedPond('')}
              className="text-sm font-bold text-indigo-600 bg-white border border-indigo-100 px-4 py-2 rounded-xl hover:bg-indigo-50 transition-colors flex items-center gap-2 shadow-sm"
            >
              &larr; Trở lại danh sách
            </button>
            <h3 className="text-xl font-black text-slate-800 tracking-tight">
              Ao: <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600">{ponds.find(p => p.id === selectedPond)?.name}</span>
            </h3>
          </div>

          {loading ? (
            <div className="h-[450px] flex items-center justify-center bg-white/80 backdrop-blur-md rounded-3xl border border-slate-100 shadow-sm">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
                <span className="text-sm font-bold text-slate-500">Đang tải dữ liệu biểu đồ...</span>
              </div>
            </div>
          ) : trendData.length === 0 ? (
            <div className="h-[450px] flex flex-col items-center justify-center bg-white/80 backdrop-blur-md rounded-3xl border border-slate-100 shadow-sm">
              <Activity className="w-12 h-12 text-slate-200 mb-4" />
              <p className="text-slate-500 font-bold">Không có dữ liệu đo lường trong khoảng thời gian này</p>
              <p className="text-sm text-slate-400 mt-1">Hãy thử chọn khoảng thời gian khác rộng hơn.</p>
            </div>
          ) : (
            <>
              {/* Parameter Toggles */}
              <div className="flex flex-wrap gap-2 bg-white/80 backdrop-blur-md p-3 rounded-2xl border border-slate-100 shadow-sm">
                {(Object.keys(PARAM_CONFIG) as ParamKey[]).map(key => {
                  const cfg = PARAM_CONFIG[key];
                  const isActive = activeParam === key;
                  return (
                    <button
                      key={key}
                      onClick={() => setActiveParam(key)}
                      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold border transition-all ${
                        isActive 
                          ? 'bg-white shadow-sm ring-2 ring-offset-1 ring-opacity-20' 
                          : 'bg-slate-50/50 border-slate-200 text-slate-400 hover:bg-white hover:text-slate-600'
                      }`}
                      style={{ 
                        borderColor: isActive ? cfg.color : undefined,
                        color: isActive ? cfg.color : undefined,
                        '--tw-ring-color': cfg.color
                      } as any}
                    >
                      <div className="w-2.5 h-2.5 rounded-full shadow-sm" style={{ backgroundColor: isActive ? cfg.color : '#cbd5e1' }} />
                      {cfg.name}
                    </button>
                  );
                })}
              </div>

              {/* Chart */}
              <div className="bg-white p-6 md:p-8 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 h-[450px]">
                {(() => {
                  const cfg = PARAM_CONFIG[activeParam] as {
                    optimal: number[];
                    warningLow?: number[];
                    warningHigh?: number[];
                    domain: number[];
                    color: string;
                    name: string;
                  };
                  const { optimal, warningLow, warningHigh, domain, color, name } = cfg;
                  return (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={trendData} margin={{ top: 20, right: 10, left: -20, bottom: 25 }}>
                        <defs>
                          <linearGradient id="colorGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={color} stopOpacity={0.35}/>
                            <stop offset="95%" stopColor={color} stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#f1f5f9" />
                        
                        {/* Optimal Zone - Green */}
                        <ReferenceArea 
                          y1={optimal[0]} 
                          y2={optimal[1]} 
                          fill="#10b981" fillOpacity={0.08} strokeOpacity={0} 
                        />
                        
                        {/* Warning Zones - Yellow/Orange */}
                        {warningLow && (
                          <ReferenceArea 
                            y1={warningLow[0]} 
                            y2={warningLow[1]} 
                            fill="#f59e0b" fillOpacity={0.06} strokeOpacity={0} 
                          />
                        )}
                        {warningHigh && (
                          <ReferenceArea 
                            y1={warningHigh[0]} 
                            y2={warningHigh[1]} 
                            fill="#f59e0b" fillOpacity={0.06} strokeOpacity={0} 
                          />
                        )}
                        
                        {/* Danger Zones - Red */}
                        {warningLow && domain[0] < warningLow[0] && (
                          <ReferenceArea 
                            y1={domain[0]} 
                            y2={warningLow[0]} 
                            fill="#f43f5e" fillOpacity={0.04} strokeOpacity={0} 
                          />
                        )}
                        {warningHigh && domain[1] > warningHigh[1] && (
                          <ReferenceArea 
                            y1={warningHigh[1]} 
                            y2={domain[1]} 
                            fill="#f43f5e" fillOpacity={0.04} strokeOpacity={0} 
                          />
                        )}

                    <XAxis 
                      dataKey="recordTime" 
                      tickFormatter={formatXAxis} 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: '#64748b', fontSize: 12, fontWeight: 600 }}
                      dy={15}
                      minTickGap={30}
                    />
                    <YAxis 
                      domain={domain}
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: '#64748b', fontSize: 12, fontWeight: 600 }} 
                      dx={-10}
                      tickFormatter={(val: number) => Number.isInteger(val) ? val.toString() : val.toFixed(2)}
                    />
                    <RechartsTooltip content={<CustomTooltip />} cursor={{ stroke: color, strokeWidth: 1.5, strokeDasharray: '4 4' }} />
                    
                    <Area
                      type="monotone"
                      dataKey={activeParam}
                      name={name}
                      stroke={color}
                      strokeWidth={3}
                      fillOpacity={1}
                      fill="url(#colorGradient)"
                      dot={{ r: 4, strokeWidth: 2, fill: '#fff', stroke: color }}
                      activeDot={{ r: 7, strokeWidth: 0, fill: color }}
                      animationDuration={800}
                      animationEasing="ease-out"
                    />
                  </AreaChart>
                </ResponsiveContainer>
                  );
                })()}
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {(Object.keys(PARAM_CONFIG) as ParamKey[]).map(key => {
                  const cfg = PARAM_CONFIG[key];
                  const st = stats?.[key];
                  if (!st) return null;
                  
                  return (
                    <div 
                      key={key} 
                      onClick={() => setActiveParam(key)}
                      className={`p-5 rounded-2xl border shadow-sm flex flex-col group transition-colors cursor-pointer ${
                        activeParam === key 
                          ? 'bg-indigo-50/30 border-indigo-200' 
                          : 'bg-white border-slate-100 hover:border-indigo-100'
                      }`}
                    >
                      <div className="flex justify-between items-center mb-4">
                        <span className={`text-sm font-bold ${activeParam === key ? 'text-indigo-700' : 'text-slate-500 group-hover:text-slate-700'} transition-colors`}>{cfg.name}</span>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${st.trend === 'up' ? 'bg-red-50 text-red-500' : st.trend === 'down' ? 'bg-emerald-50 text-emerald-500' : 'bg-slate-50 text-slate-400'}`}>
                          {st.trend === 'up' ? <ArrowUpRight className="w-4 h-4" /> : st.trend === 'down' ? <ArrowDownRight className="w-4 h-4" /> : <Minus className="w-4 h-4" />}
                        </div>
                      </div>
                      <div className="flex items-baseline gap-1.5 mb-5">
                        <span className="text-3xl font-black text-slate-800">{st.avg.toFixed(1)}</span>
                        <span className="text-sm font-bold text-slate-400">{cfg.unit}</span>
                      </div>
                      <div className="mt-auto flex items-center justify-between text-xs font-bold border-t pt-3 border-slate-50">
                        <span className="text-slate-400">Min: <span className="text-slate-700">{st.min.toFixed(1)}</span></span>
                        <span className="text-slate-400">Max: <span className="text-slate-700">{st.max.toFixed(1)}</span></span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
