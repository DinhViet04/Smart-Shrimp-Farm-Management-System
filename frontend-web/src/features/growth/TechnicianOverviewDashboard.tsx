import { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  ResponsiveContainer, ComposedChart, XAxis, YAxis, 
  CartesianGrid, Tooltip, Area, Line, AreaChart, ReferenceArea
} from 'recharts';
import { 
  Activity, AlertCircle, Loader2, RefreshCw, ShieldCheck,
  Droplets, Thermometer, FlaskConical, Wind, Waves
} from 'lucide-react';
import { subDays, subHours, format } from 'date-fns';
import { farmService } from '../../services/farm.service';
import { pondService } from '../../services/pond.service';
import { cropService } from '../../services/crop.service';
import { growthService, type TrajectoryPoint } from '../../services/growthService';
import { waterQualityService } from '../../services/water-quality.service';

interface Farm {
  id: string;
  name: string;
}

interface Pond {
  id: string;
  name: string;
  farmId: string;
}

interface CropItem {
  id: string;
  pondId: string;
  startDate: string;
  status: string;
  stage?: string | null;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: any[];
  label?: string | number;
}

const CustomTooltip = ({ active, payload }: CustomTooltipProps) => {
  if (!active || !payload || payload.length === 0) return null;

  const item: TrajectoryPoint = payload[0]?.payload;
  if (!item) return null;

  const sizeText = item.size ? `${item.size} con/kg` : 'Chưa thu hoạch';
  const fcrText = item.fcr_raw !== null && item.fcr_raw !== undefined 
    ? `${Number(item.fcr_raw).toFixed(2)}` 
    : 'Chưa tính (DOC < 10)';

  return (
    <div className="bg-white/95 backdrop-blur-md p-4 rounded-2xl shadow-xl border border-slate-200 text-xs font-sans min-w-[270px] z-50">
      <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-2.5">
        <span className="font-extrabold text-slate-800 text-sm">
          Ngày nuôi: <strong className="text-indigo-600">DOC {item.doc}</strong>
        </span>
        <span className="text-[11px] font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
          Thang chuẩn 0 - 100
        </span>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-slate-600 font-medium">
            <span className="w-2.5 h-2.5 rounded-full bg-[#2e7d32]"></span>
            Tỉ lệ sống (SR):
          </span>
          <span className="font-bold text-[#2e7d32]">{Number(item.sr).toFixed(1)}%</span>
        </div>

        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-slate-600 font-medium">
            <span className="w-2.5 h-2.5 rounded-full bg-[#757575]"></span>
            Tỉ lệ hao hụt:
          </span>
          <span className="font-bold text-slate-700">{Number(item.loss).toFixed(1)}%</span>
        </div>

        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-slate-600 font-medium">
            <span className="w-2.5 h-2.5 rounded-full bg-[#1976d2]"></span>
            Trọng lượng (ABW):
          </span>
          <span className="font-bold text-[#1976d2]">
            {Number(item.abw).toFixed(2)} g{' '}
            <span className="text-slate-400 font-normal">({sizeText}) → Y {Number(item.abw_y ?? item.abw * 2).toFixed(0)}</span>
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-slate-600 font-medium">
            <span className="w-2.5 h-2.5 rounded-full bg-[#7b1fa2]"></span>
            Sinh khối ao:
          </span>
          <span className="font-bold text-[#7b1fa2]">
            {Number(item.biomass_kg).toLocaleString('vi-VN')} kg{' '}
            <span className="text-slate-400 font-normal">({Number(item.biomass_pct).toFixed(1)}% KH)</span>
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-slate-600 font-medium">
            <span className="w-2.5 h-2.5 rounded-full bg-[#d32f2f]"></span>
            FCR lũy kế:
          </span>
          <span className="font-bold text-[#d32f2f]">{fcrText}</span>
        </div>
      </div>
    </div>
  );
};

interface TechnicianOverviewDashboardProps {
  initialFarmId?: string;
  initialPondId?: string;
  initialCropId?: string;
}

export default function TechnicianOverviewDashboard({
  initialFarmId,
  initialPondId,
  initialCropId,
}: TechnicianOverviewDashboardProps = {}) {
  const [farms, setFarms] = useState<Farm[]>([]);
  const [ponds, setPonds] = useState<Pond[]>([]);
  const [crops, setCrops] = useState<CropItem[]>([]);

  const [selectedFarmId, setSelectedFarmId] = useState<string>(initialFarmId || '');
  const [selectedPondId, setSelectedPondId] = useState<string>(initialPondId || 'ALL');
  const [selectedCropId, setSelectedCropId] = useState<string>(initialCropId || 'CURRENT');
  const [timeRange, setTimeRange] = useState<string>('ALL');

  const currentYearStr = new Date().getFullYear().toString();
  const [selectedYear, setSelectedYear] = useState<string>(currentYearStr);

  const [trajectoryData, setTrajectoryData] = useState<TrajectoryPoint[]>([]);
  const [scopeName, setScopeName] = useState<string>('Toàn Trang Trại (Trung bình các vụ)');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Toggle ẩn/hiện từng đường series theo yêu cầu UI
  const [visibleSeries, setVisibleSeries] = useState({
    sr: true,
    loss: true,
    abw: true,
    biomass: true,
    fcr: true,
  });

  const toggleSeries = (key: keyof typeof visibleSeries) => {
    setVisibleSeries(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // ── Environment / Water Quality state (dùng chung selectedPondId) ──
  type WQTimeRange = '24h' | '7d' | '30d';
  type ParamKey = 'temperature' | 'ph' | 'dissolvedOxygen' | 'salinity' | 'alkalinity' | 'nh3' | 'h2s' | 'transparency';

  const ENV_PARAM_CONFIG: Record<ParamKey, { name: string; unit: string; color: string; icon: React.ReactNode; optimal: number[]; warningHigh?: number[]; warningLow?: number[]; domain: number[] }> = {
    temperature:      { name: 'Nhiệt độ',  unit: '°C',   color: '#f43f5e', icon: <Thermometer className="w-3.5 h-3.5" />, optimal: [25, 30], warningHigh: [30, 33], warningLow: [20, 25], domain: [15, 40] },
    ph:               { name: 'pH',         unit: '',      color: '#8b5cf6', icon: <FlaskConical className="w-3.5 h-3.5" />, optimal: [8.2, 8.5], warningHigh: [8.5, 9.0], warningLow: [7.5, 8.2], domain: [5.0, 10.0] },
    dissolvedOxygen:  { name: 'DO (Oxy)',   unit: 'mg/L',  color: '#0ea5e9', icon: <Wind className="w-3.5 h-3.5" />, optimal: [4, 10], warningLow: [3, 4], domain: [0, 15] },
    salinity:         { name: 'Độ mặn',     unit: '‰',     color: '#10b981', icon: <Waves className="w-3.5 h-3.5" />, optimal: [10, 25], warningHigh: [25, 30], warningLow: [5, 10], domain: [0, 40] },
    alkalinity:       { name: 'Độ kiềm',    unit: 'mg/L',  color: '#f59e0b', icon: <Droplets className="w-3.5 h-3.5" />, optimal: [100, 160], warningHigh: [160, 200], warningLow: [80, 100], domain: [50, 250] },
    nh3:              { name: 'NH3',         unit: 'mg/L',  color: '#d946ef', icon: <FlaskConical className="w-3.5 h-3.5" />, optimal: [0, 0.30], warningHigh: [0.30, 0.50], domain: [0, 1.0] },
    h2s:              { name: 'H2S',         unit: 'mg/L',  color: '#f97316', icon: <FlaskConical className="w-3.5 h-3.5" />, optimal: [0, 0.03], warningHigh: [0.03, 0.05], domain: [0, 0.2] },
    transparency:     { name: 'Độ trong',   unit: 'cm',    color: '#06b6d4', icon: <Droplets className="w-3.5 h-3.5" />, optimal: [25, 40], warningHigh: [40, 50], warningLow: [20, 25], domain: [0, 70] },
  };

  const [envTimeRange, setEnvTimeRange] = useState<WQTimeRange>('7d');
  const [activeEnvParam, setActiveEnvParam] = useState<ParamKey>('temperature');
  const [envData, setEnvData] = useState<any[]>([]);
  const [isEnvLoading, setIsEnvLoading] = useState<boolean>(false);

  // Fetch môi trường khi ao hoặc time range thay đổi
  useEffect(() => {
    const pondId = selectedPondId !== 'ALL' ? selectedPondId : null;
    if (!pondId) {
      setEnvData([]);
      return;
    }
    const fetchEnv = async () => {
      setIsEnvLoading(true);
      try {
        let fromDate = new Date();
        if (envTimeRange === '24h') fromDate = subHours(new Date(), 24);
        if (envTimeRange === '7d')  fromDate = subDays(new Date(), 7);
        if (envTimeRange === '30d') fromDate = subDays(new Date(), 30);
        const data = await waterQualityService.getTrends(pondId, fromDate.toISOString());
        setEnvData(data);
      } catch (err) {
        console.error('Lỗi tải dữ liệu môi trường:', err);
        setEnvData([]);
      } finally {
        setIsEnvLoading(false);
      }
    };
    fetchEnv();
  }, [selectedPondId, envTimeRange]);

  // Stats cho từng thông số môi trường
  const envStats = useMemo(() => {
    if (!envData.length) return null;
    const res: any = {};
    (Object.keys(ENV_PARAM_CONFIG) as ParamKey[]).forEach(k => {
      const values = envData.map((d: any) => Number(d[k]) || 0).filter(v => v > 0);
      if (!values.length) return;
      const min = Math.min(...values);
      const max = Math.max(...values);
      const avg = values.reduce((a, b) => a + b, 0) / values.length;
      const first = values[0];
      const last = values[values.length - 1];
      const trend = last > first ? 'up' : last < first ? 'down' : 'flat';
      res[k] = { min, max, avg, trend };
    });
    return res;
  }, [envData]);

  const formatEnvXAxis = (tickItem: string) => {
    try {
      const date = new Date(tickItem);
      if (envTimeRange === '24h') return format(date, 'HH:mm');
      if (envTimeRange === '7d')  return format(date, 'dd/MM HH:mm');
      return format(date, 'dd/MM');
    } catch { return ''; }
  };

  // 1. Tải danh sách Farm mà Technician là thành viên
  useEffect(() => {
    const loadFarms = async () => {
      try {
        const data = await farmService.getAll();
        setFarms(data);
        if (data.length > 0) {
          if (initialFarmId && data.some((f: Farm) => f.id === initialFarmId)) {
            setSelectedFarmId(initialFarmId);
          } else if (!selectedFarmId || !data.some((f: Farm) => f.id === selectedFarmId)) {
            setSelectedFarmId(data[0].id);
          }
        }
      } catch (err) {
        console.error('Lỗi tải danh sách trang trại của kỹ thuật viên:', err);
      }
    };
    loadFarms();
  }, [initialFarmId]);

  // 2. Tải danh sách Ao và Vụ theo Farm được chọn
  useEffect(() => {
    if (!selectedFarmId) return;

    const loadPondsAndCrops = async () => {
      try {
        const allPonds = await pondService.getAll();
        const farmPonds = allPonds.filter((p: Pond) => p.farmId === selectedFarmId);
        setPonds(farmPonds);

        const allCrops = await cropService.getAll();
        const farmCrops = allCrops.filter((c: any) => c.pond?.farmId === selectedFarmId || farmPonds.some((p: Pond) => p.id === c.pondId));
        setCrops(farmCrops);
      } catch (err) {
        console.error('Lỗi tải danh sách ao/vụ:', err);
      }
    };
    loadPondsAndCrops();
  }, [selectedFarmId]);

  // Danh sách các năm nuôi có trong hệ thống
  const availableYears = useMemo(() => {
    const yearsSet = new Set<string>();
    yearsSet.add(currentYearStr);
    crops.forEach((c) => {
      if (c.startDate) {
        const y = new Date(c.startDate).getFullYear();
        if (!isNaN(y)) yearsSet.add(y.toString());
      }
    });
    const currentYNum = new Date().getFullYear();
    yearsSet.add((currentYNum - 1).toString());
    yearsSet.add((currentYNum - 2).toString());
    return Array.from(yearsSet).sort((a, b) => b.localeCompare(a));
  }, [crops, currentYearStr]);

  // 3. Tải dữ liệu tăng trưởng 90 ngày (gọi API backend có fallback O(1))
  const fetchGrowthData = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) setIsRefreshing(true);
    else setIsLoading(true);

    try {
      const result = await growthService.getGrowthTrajectory({
        farmId: selectedFarmId || undefined,
        pondId: selectedPondId !== 'ALL' ? selectedPondId : undefined,
        cropId: selectedCropId !== 'CURRENT' ? selectedCropId : undefined,
        timeRange: timeRange !== 'ALL' ? timeRange : undefined,
        year: selectedYear !== 'ALL' ? selectedYear : undefined,
      });

      // Chuẩn hóa abw_y tại frontend để chart luôn hoạt động đúng
      // abw_y = min(100, abw × 2) → 50g = Y100, 38.5g = Y77
      const normalized = (result.trajectory || []).map((pt) => ({
        ...pt,
        abw_y: pt.abw_y !== undefined && pt.abw_y !== null
          ? pt.abw_y
          : Math.min(100, Number((pt.abw * 2).toFixed(1))),
      }));

      setTrajectoryData(normalized);
      setScopeName(result.scopeName || 'Toàn Trang Trại');
    } catch (err) {
      console.error('Lỗi nạp dữ liệu tăng trưởng 90 ngày:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [selectedFarmId, selectedPondId, selectedCropId, timeRange, selectedYear]);

  useEffect(() => {
    fetchGrowthData();
  }, [fetchGrowthData]);

  // Lọc danh sách vụ nuôi tương ứng với ao và năm được chọn
  const availableCrops = useMemo(() => {
    let list = crops;
    if (selectedPondId !== 'ALL') {
      list = list.filter(c => c.pondId === selectedPondId);
    }
    if (selectedYear !== 'ALL') {
      const yNum = parseInt(selectedYear, 10);
      list = list.filter(c => {
        if (!c.startDate) return false;
        return new Date(c.startDate).getFullYear() === yNum;
      });
    }
    return list;
  }, [crops, selectedPondId, selectedYear]);

  // Lấy dữ liệu điểm cuối kỳ để hiển thị KPI
  const latestPoint = useMemo(() => {
    if (trajectoryData.length === 0) return null;
    return trajectoryData[trajectoryData.length - 1];
  }, [trajectoryData]);

  return (
    <div className="space-y-6 w-full max-w-[1400px] mx-auto pb-12 animate-in fade-in duration-300">
      
      {/* ── 1. HEADER TOOLBAR & FILTER CONTROLS ─────────────────────────────────── */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs flex flex-wrap items-center justify-between gap-5">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight">
              Giám Sát Tăng Trưởng 90 Ngày Chuẩn Hóa
            </h1>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-50 text-indigo-700 font-bold text-xs rounded-full border border-indigo-100/60 shadow-xs">
              <Activity className="w-3.5 h-3.5 text-indigo-600 animate-pulse" />
              {scopeName}
            </span>
          </div>
          <p className="text-xs font-semibold text-slate-400">
            Không gian chuẩn hóa: Trục X (0 - 90 DOC) • Trục Y độc nhất (0 - 100 điểm) • Tối ưu phân tích đa chỉ số
          </p>
        </div>

        {/* Toolbar Selectors */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Chọn Năm */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Năm</label>
            <select
              value={selectedYear}
              onChange={(e) => {
                setSelectedYear(e.target.value);
                setSelectedCropId('CURRENT');
              }}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 outline-none hover:bg-white focus:border-indigo-500 cursor-pointer shadow-2xs"
            >
              <option value="ALL">Tất cả các năm</option>
              {availableYears.map((yr) => (
                <option key={yr} value={yr}>
                  {yr === currentYearStr ? `Năm ${yr} (Hiện tại)` : `Năm ${yr}`}
                </option>
              ))}
            </select>
          </div>

          {/* Chọn Trang trại */}
          {farms.length > 0 && (
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Trang trại</label>
              <select
                value={selectedFarmId}
                onChange={(e) => {
                  setSelectedFarmId(e.target.value);
                  setSelectedPondId('ALL');
                  setSelectedCropId('CURRENT');
                }}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 outline-none hover:bg-white focus:border-indigo-500 cursor-pointer shadow-2xs"
              >
                {farms.map((f) => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Chọn Ao */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Ao nuôi</label>
            <select
              value={selectedPondId}
              onChange={(e) => {
                setSelectedPondId(e.target.value);
                setSelectedCropId('CURRENT');
              }}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 outline-none hover:bg-white focus:border-indigo-500 cursor-pointer shadow-2xs min-w-[170px]"
            >
              <option value="ALL">🏢 Toàn trại (Trung bình các vụ)</option>
              {ponds.map((p) => {
                const pondCrops = crops.filter(c => c.pondId === p.id);
                const activeCrop = pondCrops.find(c => c.status === 'ACTIVE');
                const label = activeCrop 
                  ? `Ao ${p.name} (🟢 Đang nuôi)` 
                  : pondCrops.length > 0 
                  ? `Ao ${p.name} (⚪ Đã thu hoạch)` 
                  : `Ao ${p.name}`;
                return (
                  <option key={p.id} value={p.id}>{label}</option>
                );
              })}
            </select>
          </div>

          {/* Chọn Vụ nuôi */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Vụ nuôi</label>
            <select
              value={selectedCropId}
              onChange={(e) => setSelectedCropId(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 outline-none hover:bg-white focus:border-indigo-500 cursor-pointer shadow-2xs min-w-[170px]"
            >
              <option value="CURRENT">🟢 Vụ hiện tại (Đang nuôi)</option>
              {availableCrops.map((c) => {
                const stageStr = c.stage === 'NURSERY' ? 'Ương dưỡng' : 'Thương phẩm';
                const dateStr = c.startDate ? new Date(c.startDate).toLocaleDateString('vi-VN') : '';
                const statusStr = c.status === 'ACTIVE' ? 'Đang nuôi' : 'Đã thu';
                return (
                  <option key={c.id} value={c.id}>
                    {stageStr} [{statusStr}] - Thả {dateStr}
                  </option>
                );
              })}
            </select>
          </div>

          {/* Chọn Mốc thời gian */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Mốc thời gian</label>
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 outline-none hover:bg-white focus:border-indigo-500 cursor-pointer shadow-2xs"
            >
              <option value="ALL">Trọn vụ (DOC 0 - 90)</option>
              <option value="30">Giai đoạn đầu (DOC 0 - 30)</option>
              <option value="60">Giai đoạn thúc (DOC 30 - 60)</option>
              <option value="90_END">Giai đoạn về đích (DOC 60 - 90)</option>
            </select>
          </div>

          {/* Nút Refresh */}
          <div className="flex flex-col justify-end">
            <button
              onClick={() => fetchGrowthData(true)}
              disabled={isRefreshing}
              className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition-all cursor-pointer disabled:opacity-50 mt-auto"
              title="Làm mới dữ liệu"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-indigo-600' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* ── 2. MAIN INTERACTIVE CHART CARD ─────────────────────────────────────── */}
      <div className="bg-white rounded-3xl p-6 lg:p-8 border border-slate-200 shadow-xs">
        
        {/* Interactive Legend Guide Bar */}
        <div className="bg-slate-50/80 border border-slate-200/90 rounded-2xl p-4 mb-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-extrabold uppercase tracking-wider text-slate-600">
              QUY ƯỚC QUY ĐỔI THANG ĐO (0 - 100):
            </span>
            <span className="text-[11px] text-slate-400">(Nhấn vào từng thẻ để ẩn/hiện đường đồ thị)</span>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* 1. Tỉ lệ sống SR */}
            <button
              type="button"
              onClick={() => toggleSeries('sr')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer border ${
                visibleSeries.sr
                  ? 'bg-white text-slate-800 border-emerald-300 shadow-2xs'
                  : 'bg-slate-100 text-slate-400 border-slate-200 line-through opacity-50'
              }`}
            >
              <span className="w-3.5 h-1 bg-[#2e7d32] rounded-full"></span>
              Tỉ lệ sống SR (0 - 100%)
            </button>

            {/* 2. Hao hụt */}
            <button
              type="button"
              onClick={() => toggleSeries('loss')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer border ${
                visibleSeries.loss
                  ? 'bg-white text-slate-800 border-slate-400 shadow-2xs'
                  : 'bg-slate-100 text-slate-400 border-slate-200 line-through opacity-50'
              }`}
            >
              <span className="w-3.5 border-t-2 border-dashed border-[#757575]"></span>
              Hao hụt (0 - 100%)
            </button>

            {/* 3. ABW */}
            <button
              type="button"
              onClick={() => toggleSeries('abw')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer border ${
                visibleSeries.abw
                  ? 'bg-white text-slate-800 border-blue-300 shadow-2xs'
                  : 'bg-slate-100 text-slate-400 border-slate-200 line-through opacity-50'
              }`}
            >
              <span className="w-3.5 h-1 bg-[#1976d2] rounded-full"></span>
              ABW (50g = Y 100)
            </button>

            {/* 4. Sinh khối */}
            <button
              type="button"
              onClick={() => toggleSeries('biomass')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer border ${
                visibleSeries.biomass
                  ? 'bg-white text-slate-800 border-purple-300 shadow-2xs'
                  : 'bg-slate-100 text-slate-400 border-slate-200 line-through opacity-50'
              }`}
            >
              <span className="w-3.5 h-1 bg-[#7b1fa2] rounded-full"></span>
              Sinh khối (% mục tiêu)
            </button>

            {/* 5. FCR quy đổi */}
            <button
              type="button"
              onClick={() => toggleSeries('fcr')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer border ${
                visibleSeries.fcr
                  ? 'bg-white text-slate-800 border-red-300 shadow-2xs'
                  : 'bg-slate-100 text-slate-400 border-slate-200 line-through opacity-50'
              }`}
            >
              <span className="w-3.5 border-t-2 border-dashed border-[#d32f2f]"></span>
              FCR quy đổi (Điểm Y ÷ 50)
            </button>
          </div>
        </div>

        {/* Chart View */}
        {isLoading ? (
          <div className="h-[520px] flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
            <p className="text-sm font-bold text-slate-500">Đang chuẩn hóa và tải đồ thị tăng trưởng 90 ngày...</p>
          </div>
        ) : trajectoryData.length === 0 ? (
          <div className="h-[520px] flex flex-col items-center justify-center text-slate-400">
            <AlertCircle className="w-10 h-10 mb-2 text-slate-300" />
            <p className="font-semibold">Chưa có dữ liệu tăng trưởng cho lựa chọn này</p>
          </div>
        ) : (
          <div className="w-full h-[520px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={trajectoryData}
                margin={{ top: 20, right: 30, left: 10, bottom: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                
                {/* Trục X: DOC từ 0 đến 90 ngày */}
                <XAxis 
                  dataKey="doc" 
                  tickFormatter={(val) => `DOC ${val}`}
                  stroke="#cbd5e1"
                  tick={{ fill: '#64748b', fontSize: 12, fontWeight: 600 }}
                  dy={10}
                />

                {/* Trục Y: Duy nhất thang 0 - 100 chuẩn hóa */}
                <YAxis 
                  domain={[0, 100]} 
                  ticks={[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]}
                  stroke="#cbd5e1"
                  tick={{ fill: '#64748b', fontSize: 12, fontWeight: 700 }}
                  dx={-5}
                />

                <Tooltip content={<CustomTooltip />} />

                {/* 4. Sinh khối (% mục tiêu): Diện tích mờ tím nhạt */}
                {visibleSeries.biomass && (
                  <Area
                    type="monotone"
                    dataKey="biomass_pct"
                    name="Sinh khối (%)"
                    stroke="#7b1fa2"
                    strokeWidth={3}
                    fill="#7b1fa2"
                    fillOpacity={0.14}
                    isAnimationActive={true}
                  />
                )}

                {/* 1. Tỉ lệ sống (SR %): Xanh lá liền */}
                {visibleSeries.sr && (
                  <Line
                    type="monotone"
                    dataKey="sr"
                    name="Tỉ lệ sống SR (%)"
                    stroke="#2e7d32"
                    strokeWidth={3}
                    dot={{ r: 3, fill: '#2e7d32' }}
                    activeDot={{ r: 6 }}
                    isAnimationActive={true}
                  />
                )}

                {/* 2. Hao hụt (%): Xám chì nét đứt */}
                {visibleSeries.loss && (
                  <Line
                    type="monotone"
                    dataKey="loss"
                    name="Hao hụt (%)"
                    stroke="#757575"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={{ r: 2.5, fill: '#757575' }}
                    activeDot={{ r: 5 }}
                    isAnimationActive={true}
                  />
                )}

                {/* 3. Trọng lượng ABW: Dùng abw_y = min(100, abw × 2) để chuẩn hóa thang Y. 50g = Y 100 */}
                {visibleSeries.abw && (
                  <Line
                    type="monotone"
                    dataKey="abw_y"
                    name="Trọng lượng ABW (g)"
                    stroke="#1976d2"
                    strokeWidth={3}
                    dot={{ r: 3, fill: '#1976d2' }}
                    activeDot={{ r: 6 }}
                    isAnimationActive={true}
                  />
                )}

                {/* 5. FCR quy đổi: Đỏ cam nét đứt chấm */}
                {visibleSeries.fcr && (
                  <Line
                    type="monotone"
                    dataKey="fcr_y"
                    name="FCR quy đổi (x50)"
                    stroke="#d32f2f"
                    strokeWidth={2.5}
                    strokeDasharray="6 4"
                    connectNulls={false}
                    dot={{ r: 3, fill: '#d32f2f' }}
                    activeDot={{ r: 6 }}
                    isAnimationActive={true}
                  />
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* ── 3. KPI SUMMARY CARDS (ĐÃ ĐƯỢC CHUYỂN XUỐNG DƯỚI BIỂU ĐỒ) ─────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Tỉ lệ sống */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs relative overflow-hidden group hover:border-emerald-300 transition-all">
          <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-[#2e7d32]"></div>
          <p className="text-xs font-semibold text-slate-500 mb-1">Tỉ Lệ Sống (SR)</p>
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-extrabold text-slate-800">
              {latestPoint && latestPoint.sr > 0 ? latestPoint.sr.toFixed(1) : '--'}
            </span>
            <span className="text-sm font-bold text-slate-400">%</span>
          </div>
          <p className="text-[11px] font-semibold text-emerald-600 mt-2 flex items-center gap-1">
            {latestPoint && latestPoint.sr > 0 ? (
              <>
                <ShieldCheck className="w-3.5 h-3.5" /> {latestPoint.sr >= 75 ? 'Đạt chuẩn 5T (≥ 75%)' : 'Dưới chuẩn 5T (< 75%)'}
              </>
            ) : (
              <span className="text-slate-400">Chưa có mẫu đo</span>
            )}
          </p>
        </div>

        {/* Tỉ lệ hao hụt */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs relative overflow-hidden group hover:border-slate-400 transition-all">
          <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-[#757575]"></div>
          <p className="text-xs font-semibold text-slate-500 mb-1">Hao Hụt Lũy Kế</p>
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-extrabold text-slate-800">
              {latestPoint && latestPoint.loss > 0 ? latestPoint.loss.toFixed(1) : (latestPoint && latestPoint.sr > 0 ? '0.0' : '--')}
            </span>
            <span className="text-sm font-bold text-slate-400">%</span>
          </div>
          <p className="text-[11px] font-semibold text-slate-500 mt-2">
            {latestPoint && latestPoint.doc > 0 ? `Bình quân ${(latestPoint.loss / latestPoint.doc).toFixed(2)}%/ngày` : 'Chưa có mẫu đo'}
          </p>
        </div>

        {/* Trọng lượng ABW */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs relative overflow-hidden group hover:border-blue-400 transition-all">
          <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-[#1976d2]"></div>
          <p className="text-xs font-semibold text-slate-500 mb-1">Trọng Lượng (ABW)</p>
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-extrabold text-slate-800">
              {latestPoint && latestPoint.abw > 0 ? latestPoint.abw.toFixed(2) : '--'}
            </span>
            <span className="text-sm font-bold text-slate-400">g/con</span>
          </div>
          <p className="text-[11px] font-semibold text-blue-600 mt-2">
            {latestPoint?.size ? `Size: ${latestPoint.size} con/kg` : (latestPoint?.abw && latestPoint.abw > 0 ? `Size: ${Math.round(1000 / latestPoint.abw)} con/kg` : 'Chưa có mẫu đo')}
          </p>
        </div>

        {/* Sinh khối ao */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs relative overflow-hidden group hover:border-purple-400 transition-all">
          <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-[#7b1fa2]"></div>
          <p className="text-xs font-semibold text-slate-500 mb-1">Sinh Khối Ước Tính</p>
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-extrabold text-slate-800">
              {latestPoint && latestPoint.biomass_kg > 0 ? Number(latestPoint.biomass_kg).toLocaleString('vi-VN') : '--'}
            </span>
            <span className="text-sm font-bold text-slate-400">kg</span>
          </div>
          <p className="text-[11px] font-semibold text-purple-600 mt-2">
            {latestPoint && latestPoint.biomass_pct > 0 ? `${latestPoint.biomass_pct.toFixed(1)}% mục tiêu` : 'Chưa có mẫu đo'}
          </p>
        </div>

        {/* Hệ số FCR */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs relative overflow-hidden group hover:border-red-400 transition-all">
          <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-[#d32f2f]"></div>
          <p className="text-xs font-semibold text-slate-500 mb-1">Hệ Số Chuyển Đổi FCR</p>
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-extrabold text-slate-800">
              {latestPoint && latestPoint.fcr_raw !== null && latestPoint.fcr_raw !== undefined ? Number(latestPoint.fcr_raw).toFixed(2) : '--'}
            </span>
            <span className="text-sm font-bold text-slate-400"></span>
          </div>
          <p className="text-[11px] font-semibold text-red-600 mt-2">
            {latestPoint && latestPoint.fcr_raw !== null && latestPoint.fcr_raw !== undefined 
              ? `Điểm Y = ${(latestPoint.fcr_raw * 50).toFixed(1)} (FCR × 50)` 
              : 'Chưa có nhật ký cho ăn'}
          </p>
        </div>
      </div>

      {/* ── 4. ENVIRONMENT / WATER QUALITY CHART ───────────────────────────── */}
      <div className="bg-white rounded-3xl p-6 lg:p-8 border border-slate-200 shadow-xs">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-xl bg-indigo-50 flex items-center justify-center">
                <Droplets className="w-4 h-4 text-indigo-600" />
              </div>
              <h2 className="text-lg font-extrabold text-slate-800 tracking-tight">Xu Hướng Môi Trường Nước</h2>
            </div>
            <p className="text-xs text-slate-400 font-semibold ml-10">
              {selectedPondId !== 'ALL'
                ? `Ao: ${ponds.find(p => p.id === selectedPondId)?.name || selectedPondId} • Thay đổi bộ lọc Ao nuôi ở trên để cập nhật`
                : 'Vui lòng chọn một Ao cụ thể ở bộ lọc phía trên để xem biểu đồ môi trường'}
            </p>
          </div>

          {selectedPondId !== 'ALL' && (
            <div className="flex items-center gap-3 flex-wrap">
              {/* Time range toggle */}
              <div className="bg-slate-100 p-1 rounded-xl flex text-xs font-bold">
                {(['24h', '7d', '30d'] as const).map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setEnvTimeRange(val)}
                    className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                      envTimeRange === val ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {val === '24h' ? '24 Giờ' : val === '7d' ? '7 Ngày' : '30 Ngày'}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {selectedPondId === 'ALL' ? (
          <div className="h-48 flex flex-col items-center justify-center text-slate-300 gap-3">
            <Waves className="w-10 h-10" />
            <p className="text-sm font-semibold text-slate-400">Chọn một Ao cụ thể để xem xu hướng chất lượng nước</p>
          </div>
        ) : isEnvLoading ? (
          <div className="h-48 flex items-center justify-center gap-3">
            <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
            <span className="text-sm font-bold text-slate-400">Đang tải dữ liệu môi trường...</span>
          </div>
        ) : envData.length === 0 ? (
          <div className="h-48 flex flex-col items-center justify-center text-slate-300 gap-2">
            <Activity className="w-10 h-10" />
            <p className="text-sm font-semibold text-slate-400">Chưa có dữ liệu đo lường trong khoảng thời gian này</p>
            <p className="text-xs text-slate-300">Thử chọn khoảng thời gian dài hơn</p>
          </div>
        ) : (
          <>
            {/* Parameter tab pills */}
            <div className="flex flex-wrap gap-2 mb-5">
              {(Object.keys(ENV_PARAM_CONFIG) as ParamKey[]).map(key => {
                const cfg = ENV_PARAM_CONFIG[key];
                const isActive = activeEnvParam === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setActiveEnvParam(key)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      isActive
                        ? 'bg-white shadow-sm'
                        : 'bg-slate-50/50 border-slate-200 text-slate-400 hover:bg-white hover:text-slate-600'
                    }`}
                    style={{
                      borderColor: isActive ? cfg.color : undefined,
                      color: isActive ? cfg.color : undefined,
                    }}
                  >
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: isActive ? cfg.color : '#cbd5e1' }} />
                    {cfg.name}
                    {envStats?.[key] && (
                      <span className="font-bold" style={{ color: isActive ? cfg.color : '#94a3b8' }}>
                        {envStats[key].avg.toFixed(1)}{cfg.unit}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Area Chart */}
            <div className="h-[320px] w-full">
              {(() => {
                const cfg = ENV_PARAM_CONFIG[activeEnvParam];
                return (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={envData} margin={{ top: 16, right: 16, left: -20, bottom: 20 }}>
                      <defs>
                        <linearGradient id={`envGrad_${activeEnvParam}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={cfg.color} stopOpacity={0.3} />
                          <stop offset="95%" stopColor={cfg.color} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#f1f5f9" />

                      {/* Optimal zone */}
                      <ReferenceArea y1={cfg.optimal[0]} y2={cfg.optimal[1]} fill="#10b981" fillOpacity={0.07} strokeOpacity={0} />
                      {/* Warning zones */}
                      {cfg.warningLow && <ReferenceArea y1={cfg.warningLow[0]} y2={cfg.warningLow[1]} fill="#f59e0b" fillOpacity={0.06} strokeOpacity={0} />}
                      {cfg.warningHigh && <ReferenceArea y1={cfg.warningHigh[0]} y2={cfg.warningHigh[1]} fill="#f59e0b" fillOpacity={0.06} strokeOpacity={0} />}

                      <XAxis
                        dataKey="recordTime"
                        tickFormatter={formatEnvXAxis}
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#64748b', fontSize: 11, fontWeight: 600 }}
                        dy={12}
                        minTickGap={40}
                      />
                      <YAxis
                        domain={cfg.domain}
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#64748b', fontSize: 11, fontWeight: 600 }}
                        dx={-8}
                        tickFormatter={(v: number) => Number.isInteger(v) ? v.toString() : v.toFixed(2)}
                      />
                      <Tooltip
                        content={({ active, payload, label }: any) => {
                          if (!active || !payload?.length) return null;
                          const data = payload[0].payload;
                          const statusColor = data.overallStatus === 'Optimal' ? '#10b981' : data.overallStatus === 'Warning' ? '#f59e0b' : '#f43f5e';
                          const statusText  = data.overallStatus === 'Optimal' ? 'Tối ưu' : data.overallStatus === 'Warning' ? 'Cảnh báo' : 'Nguy hiểm';
                          return (
                            <div className="bg-white/95 backdrop-blur-md p-3 rounded-xl border border-slate-200 shadow-xl min-w-[180px] text-xs font-sans">
                              <p className="font-bold text-slate-700 mb-1.5 border-b border-slate-100 pb-1.5">
                                {(() => { try { return format(new Date(label), 'dd/MM/yyyy HH:mm'); } catch { return label; } })()}
                              </p>
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-slate-400">Đánh giá:</span>
                                <span className="font-bold px-2 py-0.5 rounded-full text-white text-[11px]" style={{ backgroundColor: statusColor }}>
                                  {statusText}
                                </span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span style={{ color: cfg.color }} className="font-semibold">{cfg.name}:</span>
                                <span className="font-bold text-slate-800">{Number(payload[0].value).toFixed(2)} {cfg.unit}</span>
                              </div>
                            </div>
                          );
                        }}
                        cursor={{ stroke: cfg.color, strokeWidth: 1.5, strokeDasharray: '4 4' }}
                      />
                      <Area
                        type="monotone"
                        dataKey={activeEnvParam}
                        name={cfg.name}
                        stroke={cfg.color}
                        strokeWidth={2.5}
                        fillOpacity={1}
                        fill={`url(#envGrad_${activeEnvParam})`}
                        dot={{ r: 3.5, strokeWidth: 2, fill: '#fff', stroke: cfg.color }}
                        activeDot={{ r: 6, strokeWidth: 0, fill: cfg.color }}
                        animationDuration={600}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                );
              })()}
            </div>

            {/* Quick stats grid */}
            {envStats && (
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 mt-5">
                {(Object.keys(ENV_PARAM_CONFIG) as ParamKey[]).map(key => {
                  const cfg = ENV_PARAM_CONFIG[key];
                  const st = envStats[key];
                  if (!st) return null;
                  const isActive = activeEnvParam === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setActiveEnvParam(key)}
                      className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                        isActive ? 'border-opacity-60 shadow-sm' : 'bg-white border-slate-100 hover:border-slate-200'
                      }`}
                      style={isActive ? { borderColor: cfg.color, backgroundColor: `${cfg.color}08` } : {}}
                    >
                      <div className="flex items-center gap-1 mb-2" style={{ color: cfg.color }}>
                        {cfg.icon}
                        <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: isActive ? cfg.color : '#94a3b8' }}>
                          {cfg.name}
                        </span>
                      </div>
                      <div className="text-lg font-black text-slate-800">
                        {st.avg.toFixed(1)}
                        <span className="text-xs font-bold text-slate-400 ml-0.5">{cfg.unit}</span>
                      </div>
                      <div className="flex justify-between text-[10px] font-semibold text-slate-400 mt-1">
                        <span>↓{st.min.toFixed(1)}</span>
                        <span>↑{st.max.toFixed(1)}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

    </div>
  );
}
