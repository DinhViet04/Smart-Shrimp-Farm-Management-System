import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Waves, Droplets, ShieldAlert, CheckCircle2,
  AlertTriangle, RefreshCw, Loader2, Calendar,
  Search, SlidersHorizontal, Scale, Fish,
  Building2, X, Clock, PlusCircle,
} from 'lucide-react';
import { farmService } from '../../services/farm.service';
import { pondService } from '../../services/pond.service';
import { cropService, type Crop } from '../../services/crop.service';
import { incidentService, type Incident } from '../../services/incident.service';
import { waterQualityService } from '../../services/water-quality.service';
import { shrimpSizeService } from '../../services/shrimpSizeService';

interface Farm {
  id: string;
  name: string;
}

interface Pond {
  id: string;
  name: string;
  farmId: string;
  areaSize?: number;
  status?: string;
  farm?: {
    id: string;
    name: string;
  };
}

interface WaterQualityRecord {
  id: string;
  pondName: string;
  recordTime: string;
  temperature: number;
  ph: number;
  dissolvedOxygen: number;
  salinity: number;
  alkalinity?: number;
  nh3?: number;
  h2s?: number;
  overallStatus: 'Optimal' | 'Warning' | 'Danger';
}

interface ShrimpSampleRecord {
  abwGram?: number;
  sizePerKg?: number;
  adgGramPerDay?: number | null;
  estimatedBiomassKg?: number;
  estimatedTotalShrimp?: number;
  doc?: number;
  samplingDate?: string;
}

interface ManagerDashboardHomeProps {
  onNavigateTab?: (tab: string) => void;
}

type HealthStatus = 'DANGER' | 'WARNING' | 'OPTIMAL' | 'IDLE';

interface PondCardData {
  pond: Pond;
  crop: Crop | null;
  doc: number | null;
  latestWq: WaterQualityRecord | null;
  latestSample: ShrimpSampleRecord | null;
  openIncidents: Incident[];
  health: {
    status: HealthStatus;
    label: string;
    score: number;
    reason: string;
  };
}

const getDOC = (startDate: string) => Math.max(0, Math.floor((Date.now() - new Date(startDate).getTime()) / 86400000));
const fmtDate = (iso: string) => { try { return new Date(iso).toLocaleDateString('vi-VN'); } catch { return iso; } };
const fmtTimeAgo = (iso: string) => {
  try {
    const diffMin = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
    if (diffMin < 60) return `${diffMin} phút trước`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `${diffH} giờ trước`;
    return new Date(iso).toLocaleDateString('vi-VN');
  } catch {
    return iso;
  }
};

const getStageLabel = (doc: number) => {
  if (doc <= 30) return { label: 'Giai đoạn đầu', color: 'text-blue-700 bg-blue-50 border-blue-200' };
  if (doc <= 60) return { label: 'Giai đoạn thúc', color: 'text-indigo-700 bg-indigo-50 border-indigo-200' };
  return { label: 'Giai đoạn về đích', color: 'text-emerald-700 bg-emerald-50 border-emerald-200' };
};

export default function ManagerDashboardHome({ onNavigateTab }: ManagerDashboardHomeProps) {
  const [farms, setFarms] = useState<Farm[]>([]);
  const [ponds, setPonds] = useState<Pond[]>([]);
  const [crops, setCrops] = useState<Crop[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [waterQualities, setWaterQualities] = useState<WaterQualityRecord[]>([]);
  const [samplesMap, setSamplesMap] = useState<Record<string, ShrimpSampleRecord>>({});
  const [selectedFarmId, setSelectedFarmId] = useState('ALL');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Filters & Search
  const [statusFilter, setStatusFilter] = useState<'ALL' | HealthStatus>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'risk' | 'doc' | 'name'>('risk');

  // Modal inspection
  const [inspectingPond, setInspectingPond] = useState<PondCardData | null>(null);

  // Fetch all base data
  const fetchAll = useCallback(async (refresh = false) => {
    if (refresh) setIsRefreshing(true); else setIsLoading(true);
    try {
      const [f, p, c, inc] = await Promise.all([
        farmService.getMy().catch(() => farmService.getAll().catch(() => [])),
        pondService.getAll().catch(() => []),
        cropService.getAll().catch(() => []),
        incidentService.getAll({}).catch(() => ({ content: [] })),
      ]);
      setFarms(f);
      setPonds(p);
      setCrops(c);
      setIncidents((inc as any).content ?? []);

      // Load water quality history (all accessible farms or filtered by selected farm)
      const wqParams: { farmId?: string; size: number } = { size: 100 };
      if (selectedFarmId && selectedFarmId !== 'ALL') {
        wqParams.farmId = selectedFarmId;
      }
      const wqRes = await waterQualityService.getHistory(wqParams).catch(() => ({ content: [] }));
      setWaterQualities((wqRes.content || []) as WaterQualityRecord[]);

      // Load latest shrimp size samples for active ponds
      const targetPonds = (!selectedFarmId || selectedFarmId === 'ALL')
        ? p
        : p.filter((pond: Pond) => pond.farmId === selectedFarmId);

      const samplePromises = targetPonds.map(async (pond: Pond) => {
        try {
          const s = await shrimpSizeService.getLatestSample(pond.id);
          return { pondId: pond.id, sample: s };
        } catch {
          return { pondId: pond.id, sample: null };
        }
      });
      const samplesResults = await Promise.all(samplePromises);
      const sMap: Record<string, ShrimpSampleRecord> = {};
      samplesResults.forEach(res => {
        if (res.sample) sMap[res.pondId] = res.sample;
      });
      setSamplesMap(sMap);
    } catch (e) {
      console.error('Lỗi khi nạp dữ liệu điều hành manager:', e);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [selectedFarmId]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Farm-filtered ponds
  const farmPonds = useMemo(() => {
    if (!selectedFarmId || selectedFarmId === 'ALL') return ponds;
    return ponds.filter(p => p.farmId === selectedFarmId);
  }, [ponds, selectedFarmId]);

  // Combine data into Pond Matrix cards
  const matrixData: PondCardData[] = useMemo(() => {
    return farmPonds.map(pond => {
      // Find active crop for this pond:
      // Match by either pondId or nested pond.id, and prioritize ACTIVE status over HARVESTED
      const pondCrops = crops.filter(c => {
        const pId = c.pondId || (c.pond as any)?.id;
        return String(pId) === String(pond.id);
      });

      const crop = pondCrops.find(c => (c.status || '').toUpperCase() === 'ACTIVE')
        || pondCrops.find(c => {
          const s = (c.status || '').toUpperCase();
          return s !== 'HARVESTED' && s !== 'FAILED';
        })
        || null;

      const doc = crop ? getDOC(crop.startDate) : null;

      // Find latest water quality for this pond (first match by pondName)
      const latestWq = waterQualities.find(wq => wq.pondName === pond.name) ?? null;

      // Latest size sample
      const latestSample = samplesMap[pond.id] ?? null;

      // Open incidents for this pond
      const openInc = incidents.filter(i => {
        const pondMatches = i.crop?.pond?.id === pond.id || (crop && i.crop?.id === crop.id);
        return pondMatches && (i.status === 'OPEN' || i.status === 'TREATING');
      });

      // Compute health status
      let healthStatus: HealthStatus = 'OPTIMAL';
      let label = 'Ổn định';
      let score = 4;
      let reason = 'Môi trường & Sinh trưởng đạt chuẩn';

      if (!crop) {
        healthStatus = 'IDLE';
        label = 'Ao trống';
        score = 0;
        reason = 'Chưa có vụ nuôi';
      } else if (openInc.length > 0) {
        healthStatus = 'DANGER';
        label = 'Cần xử lý';
        score = 1;
        reason = `Có ${openInc.length} sự cố đang mở`;
      } else if (latestWq) {
        const doVal = Number(latestWq.dissolvedOxygen);
        const phVal = Number(latestWq.ph);

        if (latestWq.overallStatus === 'Danger' || (doVal > 0 && doVal < 4.0) || (phVal > 0 && (phVal < 7.0 || phVal > 9.0))) {
          healthStatus = 'DANGER';
          label = 'Nguy hiểm';
          score = 1;
          reason = doVal < 4.0 ? `Oxy hòa tan rất thấp (${doVal} mg/L)` : 'Thông số môi trường nguy hại';
        } else if (latestWq.overallStatus === 'Warning' || (doVal > 0 && doVal < 5.0) || (phVal > 0 && (phVal < 7.5 || phVal > 8.5))) {
          healthStatus = 'WARNING';
          label = 'Cần chú ý';
          score = 2;
          reason = doVal < 5.0 ? `Oxy tiệm cận ngưỡng (${doVal} mg/L)` : 'pH biến động ngoài khoảng tối ưu';
        }
      }

      return {
        pond,
        crop,
        doc,
        latestWq,
        latestSample,
        openIncidents: openInc,
        health: {
          status: healthStatus,
          label,
          score,
          reason,
        },
      };
    });
  }, [farmPonds, crops, waterQualities, samplesMap, incidents]);

  // Summary counts
  const summaryCounts = useMemo(() => {
    const total = matrixData.length;
    const danger = matrixData.filter(d => d.health.status === 'DANGER').length;
    const warning = matrixData.filter(d => d.health.status === 'WARNING').length;
    const optimal = matrixData.filter(d => d.health.status === 'OPTIMAL').length;
    const idle = matrixData.filter(d => d.health.status === 'IDLE').length;
    const activeCropsCount = matrixData.filter(d => d.crop !== null).length;
    const totalShrimp = matrixData.reduce((acc, d) => acc + (d.crop?.initialShrimpCount || 0), 0);
    const totalEstimatedBiomassKg = matrixData.reduce((acc, d) => {
      const b = d.latestSample?.estimatedBiomassKg;
      return acc + (b ? Number(b) : 0);
    }, 0);

    return {
      total,
      danger,
      warning,
      optimal,
      idle,
      activeCropsCount,
      totalShrimp,
      totalEstimatedBiomassKg,
    };
  }, [matrixData]);

  // Filtered & Sorted items
  const displayItems = useMemo(() => {
    let result = [...matrixData];

    // Filter by status tab
    if (statusFilter !== 'ALL') {
      result = result.filter(d => d.health.status === statusFilter);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(d => d.pond.name.toLowerCase().includes(q));
    }

    // Sorting
    result.sort((a, b) => {
      if (sortBy === 'risk') {
        // Danger (1) -> Warning (2) -> Optimal (4) -> Idle (0)
        const getRiskOrder = (score: number) => {
          if (score === 1) return 0; // danger first
          if (score === 2) return 1; // warning second
          if (score === 4) return 2; // optimal third
          return 3; // idle last
        };
        return getRiskOrder(a.health.score) - getRiskOrder(b.health.score);
      }
      if (sortBy === 'doc') {
        return (b.doc || 0) - (a.doc || 0);
      }
      return a.pond.name.localeCompare(b.pond.name, 'vi-VN');
    });

    return result;
  }, [matrixData, statusFilter, searchQuery, sortBy]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <div className="relative">
          <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
          <Waves className="w-5 h-5 text-blue-400 absolute inset-0 m-auto" />
        </div>
        <p className="text-slate-600 font-bold text-sm tracking-wide">Đang nạp dữ liệu ma trận ao nuôi...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-20 animate-in fade-in duration-300">

      {/* 1. HEADER & FARM SELECTOR */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Trung tâm Điều hành Trang Trại
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Ma Trận Sức Khỏe &amp; Môi Trường Ao Nuôi
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1">
            Giám sát thời gian thực toàn bộ các ao nuôi trên 1 màn hình duy nhất • Không cần chuyển đổi riêng lẻ
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {farms.length > 0 && (
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200/80 rounded-2xl px-4 py-2.5">
              <Building2 className="w-4 h-4 text-slate-400 shrink-0" />
              <select
                value={selectedFarmId}
                onChange={e => setSelectedFarmId(e.target.value)}
                className="bg-transparent text-sm font-bold text-slate-800 outline-none cursor-pointer pr-2"
              >
                <option value="ALL">Toàn bộ trang trại ({farms.length})</option>
                {farms.map(f => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
            </div>
          )}

          <button
            onClick={() => fetchAll(true)}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white rounded-2xl text-sm font-bold transition-all disabled:opacity-50 shadow-md shadow-blue-500/20 cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>{isRefreshing ? 'Đang đồng bộ...' : 'Đồng bộ lại'}</span>
          </button>
        </div>
      </div>

      {/* 2. MACRO METRICS BAR */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {/* Metric 1 */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Waves className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Ao đang nuôi</p>
            <p className="text-xl sm:text-2xl font-black text-slate-800">
              {summaryCounts.activeCropsCount} <span className="text-xs text-slate-400 font-semibold">/ {summaryCounts.total} ao</span>
            </p>
          </div>
        </div>

        {/* Metric 2 */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <Fish className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Tổng con giống</p>
            <p className="text-xl sm:text-2xl font-black text-slate-800">
              {summaryCounts.totalShrimp.toLocaleString('vi-VN')} <span className="text-xs text-slate-400 font-semibold">con</span>
            </p>
          </div>
        </div>

        {/* Metric 3 */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
            <Scale className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Sinh khối ước tính</p>
            <p className="text-xl sm:text-2xl font-black text-slate-800">
              {summaryCounts.totalEstimatedBiomassKg > 0 ? (summaryCounts.totalEstimatedBiomassKg / 1000).toFixed(1) : '--'}
              <span className="text-xs text-slate-400 font-semibold"> tấn</span>
            </p>
          </div>
        </div>

        {/* Metric 4 */}
        <div className={`rounded-2xl p-4 border shadow-xs flex items-center gap-3.5 ${
          summaryCounts.danger > 0 ? 'bg-rose-50/70 border-rose-200' : 'bg-white border-slate-200/80'
        }`}>
          <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
            summaryCounts.danger > 0 ? 'bg-rose-100 text-rose-600 animate-pulse' : 'bg-emerald-50 text-emerald-600'
          }`}>
            {summaryCounts.danger > 0 ? <ShieldAlert className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}
          </div>
          <div>
            <p className={`text-[11px] font-bold uppercase tracking-wider ${summaryCounts.danger > 0 ? 'text-rose-500' : 'text-slate-400'}`}>
              Cần can thiệp
            </p>
            <p className={`text-xl sm:text-2xl font-black ${summaryCounts.danger > 0 ? 'text-rose-700' : 'text-slate-800'}`}>
              {summaryCounts.danger + summaryCounts.warning} <span className="text-xs font-semibold text-slate-400">ao có lưu ý</span>
            </p>
          </div>
        </div>
      </div>

      {/* 3. MATRIX CONTROLS: FILTER PILLS + SEARCH + SORT */}
      <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">

          {/* Status Filter Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 custom-scrollbar">
            <button
              onClick={() => setStatusFilter('ALL')}
              className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer shrink-0 ${
                statusFilter === 'ALL'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Tất cả ao ({summaryCounts.total})
            </button>

            <button
              onClick={() => setStatusFilter('DANGER')}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer shrink-0 ${
                statusFilter === 'DANGER'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-rose-500" />
              Nguy cơ cao ({summaryCounts.danger})
            </button>

            <button
              onClick={() => setStatusFilter('WARNING')}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer shrink-0 ${
                statusFilter === 'WARNING'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              Cần chú ý ({summaryCounts.warning})
            </button>

            <button
              onClick={() => setStatusFilter('OPTIMAL')}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer shrink-0 ${
                statusFilter === 'OPTIMAL'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              Ổn định ({summaryCounts.optimal})
            </button>

            <button
              onClick={() => setStatusFilter('IDLE')}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer shrink-0 ${
                statusFilter === 'IDLE'
                  ? 'bg-slate-700 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Ao trống ({summaryCounts.idle})
            </button>
          </div>

          {/* Search & Sort */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1 sm:w-56">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Tìm tên ao..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 placeholder-slate-400 outline-none focus:border-blue-500"
              />
            </div>

            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 shrink-0">
              <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value as any)}
                className="bg-transparent text-xs font-bold text-slate-700 outline-none cursor-pointer"
              >
                <option value="risk">Ưu tiên rủi ro cao</option>
                <option value="doc">Theo ngày nuôi (DOC)</option>
                <option value="name">Theo tên ao</option>
              </select>
            </div>
          </div>

        </div>
      </div>

      {/* 4. THE POND HEALTH MATRIX (GRID OF COMMAND CARDS) */}
      {displayItems.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-200/80 p-16 flex flex-col items-center justify-center text-slate-300 gap-3">
          <Waves className="w-12 h-12 text-slate-300" />
          <p className="text-base font-bold text-slate-600">Không tìm thấy ao nuôi nào phù hợp bộ lọc</p>
          <button
            onClick={() => { setStatusFilter('ALL'); setSearchQuery(''); }}
            className="text-xs font-bold text-blue-600 hover:underline cursor-pointer"
          >
            Xóa bộ lọc
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-5">
          {displayItems.map(item => {
            const { pond, crop, doc, latestWq, latestSample, openIncidents, health } = item;
            const isIdle = health.status === 'IDLE';
            const isDanger = health.status === 'DANGER';
            const isWarning = health.status === 'WARNING';
            const stage = doc !== null ? getStageLabel(doc) : null;

            // Border & Card Accent
            const cardBorder = isDanger
              ? 'border-rose-300 bg-rose-50/20 hover:border-rose-500 shadow-rose-100/50'
              : isWarning
              ? 'border-amber-300 bg-amber-50/20 hover:border-amber-500 shadow-amber-100/50'
              : isIdle
              ? 'border-dashed border-slate-300 bg-slate-50/50 hover:border-slate-400'
              : 'border-slate-200/80 bg-white hover:border-blue-400 shadow-slate-100/50';

            const accentBar = isDanger
              ? 'bg-rose-500'
              : isWarning
              ? 'bg-amber-500'
              : isIdle
              ? 'bg-slate-300'
              : 'bg-emerald-500';

            const statusBadge = isDanger
              ? 'bg-rose-100 text-rose-700 border-rose-200'
              : isWarning
              ? 'bg-amber-100 text-amber-800 border-amber-200'
              : isIdle
              ? 'bg-slate-100 text-slate-500 border-slate-200'
              : 'bg-emerald-50 text-emerald-700 border-emerald-200';

            return (
              <div
                key={pond.id}
                className={`rounded-3xl border p-5 shadow-xs relative overflow-hidden flex flex-col justify-between transition-all duration-200 hover:-translate-y-1 hover:shadow-lg ${cardBorder}`}
              >
                {/* Left accent bar */}
                <div className={`absolute left-0 inset-y-0 w-1.5 ${accentBar}`} />

                {/* Top Section */}
                <div>
                  {/* Card Header: Name + Status Badge */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-base font-black text-slate-900 tracking-tight">{pond.name}</span>
                        {pond.areaSize && (
                          <span className="text-[11px] text-slate-400 font-semibold">({pond.areaSize} m²)</span>
                        )}
                        {selectedFarmId === 'ALL' && (pond.farm?.name || farms.find(f => f.id === pond.farmId)?.name) && (
                          <span className="text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-md">
                            {pond.farm?.name || farms.find(f => f.id === pond.farmId)?.name}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400 font-medium">
                        {isIdle ? 'Sẵn sàng thả giống' : crop?.stage ? `Mô hình: ${crop.stage}` : 'Vụ nuôi công nghiệp'}
                      </p>
                    </div>

                    <span className={`text-[10px] font-black px-2.5 py-1 rounded-full border shrink-0 uppercase tracking-wide flex items-center gap-1 ${statusBadge}`}>
                      {!isIdle && <span className={`w-1.5 h-1.5 rounded-full ${isDanger ? 'bg-rose-600 animate-pulse' : isWarning ? 'bg-amber-600' : 'bg-emerald-600'}`} />}
                      {health.label}
                    </span>
                  </div>

                  {/* IDLE POND VIEW */}
                  {isIdle ? (
                    <div className="py-8 flex flex-col items-center justify-center text-center gap-2">
                      <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mb-1">
                        <Waves className="w-6 h-6" />
                      </div>
                      <p className="text-xs font-bold text-slate-600">Ao hiện chưa thả giống</p>
                      <p className="text-[11px] text-slate-400 max-w-[200px]">
                        Diện tích {pond.areaSize || 0} m², chất lượng nước sẵn sàng để thả giống vụ mới.
                      </p>
                      <button
                        onClick={() => onNavigateTab?.('Quản lý Ao/Vụ')}
                        className="mt-3 flex items-center gap-1 px-3.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-extrabold rounded-xl transition-all cursor-pointer"
                      >
                        <PlusCircle className="w-3.5 h-3.5" />
                        Tạo vụ nuôi mới
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3.5">

                      {/* DOC & PROGRESS */}
                      <div className="bg-white/80 backdrop-blur-xs p-3 rounded-2xl border border-slate-100 shadow-2xs space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-black text-slate-900 flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5 text-blue-600" />
                            DOC {doc}
                          </span>
                          {stage && (
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${stage.color}`}>
                              {stage.label}
                            </span>
                          )}
                        </div>

                        {/* DOC Progress Bar (0 to 90 days) */}
                        <div className="space-y-1">
                          <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                            <div
                              className="bg-gradient-to-r from-blue-500 to-indigo-600 h-1.5 rounded-full transition-all duration-500"
                              style={{ width: `${Math.min(100, ((doc || 0) / 90) * 100)}%` }}
                            />
                          </div>
                          <div className="flex justify-between text-[9px] font-bold text-slate-400">
                            <span>DOC 1</span>
                            <span>30d</span>
                            <span>60d</span>
                            <span>90d (Thu hoạch)</span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-[11px] text-slate-600 pt-1 border-t border-slate-50">
                          <span>Thả: <b>{(crop?.initialShrimpCount || 0).toLocaleString('vi-VN')} con</b></span>
                          {crop?.expectedHarvestDate && (
                            <span className="text-slate-400">Thu: {fmtDate(crop.expectedHarvestDate)}</span>
                          )}
                        </div>
                      </div>

                      {/* REAL-TIME WATER QUALITY METRICS */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-extrabold text-slate-700 flex items-center gap-1">
                            <Droplets className="w-3.5 h-3.5 text-cyan-600" />
                            Môi trường nước
                          </span>
                          <span className="text-[10px] text-slate-400 flex items-center gap-1">
                            <Clock className="w-2.5 h-2.5" />
                            {latestWq ? fmtTimeAgo(latestWq.recordTime) : 'Chưa đo'}
                          </span>
                        </div>

                        {latestWq ? (
                          <div className="grid grid-cols-4 gap-1.5 text-center">
                            {/* DO */}
                            <div className="bg-white p-2 rounded-xl border border-slate-100 shadow-2xs">
                              <p className="text-[9px] text-slate-400 font-bold uppercase">Oxy (DO)</p>
                              <p className={`text-xs font-black ${
                                latestWq.dissolvedOxygen < 4.0 ? 'text-rose-600' : latestWq.dissolvedOxygen < 5.0 ? 'text-amber-600' : 'text-slate-800'
                              }`}>
                                {latestWq.dissolvedOxygen}
                              </p>
                              <span className="text-[8px] text-slate-400 font-medium">mg/L</span>
                            </div>

                            {/* pH */}
                            <div className="bg-white p-2 rounded-xl border border-slate-100 shadow-2xs">
                              <p className="text-[9px] text-slate-400 font-bold uppercase">pH</p>
                              <p className={`text-xs font-black ${
                                (latestWq.ph < 7.5 || latestWq.ph > 8.5) ? 'text-amber-600' : 'text-slate-800'
                              }`}>
                                {latestWq.ph}
                              </p>
                              <span className="text-[8px] text-slate-400 font-medium">7.5-8.5</span>
                            </div>

                            {/* Temp */}
                            <div className="bg-white p-2 rounded-xl border border-slate-100 shadow-2xs">
                              <p className="text-[9px] text-slate-400 font-bold uppercase">Nhiệt độ</p>
                              <p className="text-xs font-black text-slate-800">
                                {latestWq.temperature}°
                              </p>
                              <span className="text-[8px] text-slate-400 font-medium">°C</span>
                            </div>

                            {/* Salinity */}
                            <div className="bg-white p-2 rounded-xl border border-slate-100 shadow-2xs">
                              <p className="text-[9px] text-slate-400 font-bold uppercase">Độ mặn</p>
                              <p className="text-xs font-black text-slate-800">
                                {latestWq.salinity}
                              </p>
                              <span className="text-[8px] text-slate-400 font-medium">‰</span>
                            </div>
                          </div>
                        ) : (
                          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-center">
                            <span className="text-[11px] text-slate-400 font-semibold">Chưa có kết quả quan trắc</span>
                          </div>
                        )}
                      </div>

                      {/* SHRIMP GROWTH SAMPLE */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-extrabold text-slate-700 flex items-center gap-1">
                            <Fish className="w-3.5 h-3.5 text-indigo-600" />
                            Sinh trưởng tôm
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {latestSample?.samplingDate ? fmtTimeAgo(latestSample.samplingDate) : ''}
                          </span>
                        </div>

                        {latestSample ? (
                          <div className="grid grid-cols-3 gap-1.5 text-center">
                            <div className="bg-white p-2 rounded-xl border border-slate-100 shadow-2xs">
                              <p className="text-[9px] text-slate-400 font-bold uppercase">Trọng lượng (ABW)</p>
                              <p className="text-xs font-black text-indigo-700">
                                {latestSample.abwGram ? `${Number(latestSample.abwGram).toFixed(1)}g` : '--'}
                              </p>
                              <span className="text-[8px] text-slate-400 font-medium">
                                {latestSample.sizePerKg ? `~${Math.round(latestSample.sizePerKg)} c/kg` : ''}
                              </span>
                            </div>

                            <div className="bg-white p-2 rounded-xl border border-slate-100 shadow-2xs">
                              <p className="text-[9px] text-slate-400 font-bold uppercase">Tốc độ lớn</p>
                              <p className={`text-xs font-black ${
                                (latestSample.adgGramPerDay && latestSample.adgGramPerDay < 0) ? 'text-rose-600' : 'text-emerald-700'
                              }`}>
                                {latestSample.adgGramPerDay !== null && latestSample.adgGramPerDay !== undefined
                                  ? `+${Number(latestSample.adgGramPerDay).toFixed(2)}`
                                  : '--'}
                              </p>
                              <span className="text-[8px] text-slate-400 font-medium">g/ngày</span>
                            </div>

                            <div className="bg-white p-2 rounded-xl border border-slate-100 shadow-2xs">
                              <p className="text-[9px] text-slate-400 font-bold uppercase">Sinh khối ước</p>
                              <p className="text-xs font-black text-purple-700">
                                {latestSample.estimatedBiomassKg
                                  ? `${Math.round(Number(latestSample.estimatedBiomassKg)).toLocaleString('vi-VN')}`
                                  : '--'}
                              </p>
                              <span className="text-[8px] text-slate-400 font-medium">kg</span>
                            </div>
                          </div>
                        ) : (
                          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-center">
                            <span className="text-[11px] text-slate-400 font-semibold">Chưa có mẫu chài gần nhất</span>
                          </div>
                        )}
                      </div>

                      {/* OPEN INCIDENTS ALERT BANNER */}
                      {openIncidents.length > 0 && (
                        <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 flex items-start gap-2 text-xs">
                          <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
                          <div className="min-w-0">
                            <p className="font-extrabold truncate">{openIncidents[0].title}</p>
                            <p className="text-[10px] text-rose-500 font-medium">
                              {openIncidents.length > 1 ? `+ ${openIncidents.length - 1} sự cố khác • ` : ''}
                              {openIncidents[0].assignedTo ? `KTV: ${openIncidents[0].assignedTo.fullName}` : 'Chưa phân công'}
                            </p>
                          </div>
                        </div>
                      )}

                    </div>
                  )}
                </div>

                {/* Card Footer: Quick Actions */}
                <div className="pt-3.5 mt-3 border-t border-slate-100/80 flex items-center justify-between gap-2">
                  {!isIdle ? (
                    <>
                      <button
                        onClick={() => setInspectingPond(item)}
                        className="flex-1 py-1.5 px-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all text-center cursor-pointer shadow-xs"
                      >
                        Soi chi tiết ao
                      </button>

                      <button
                        onClick={() => onNavigateTab?.('Môi trường nước')}
                        title="Xem lịch sử môi trường"
                        className="p-1.5 rounded-xl bg-slate-100 hover:bg-cyan-50 hover:text-cyan-600 text-slate-600 transition-colors cursor-pointer"
                      >
                        <Droplets className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => onNavigateTab?.('Quản lý Ao/Vụ')}
                        title="Quản lý vụ nuôi"
                        className="p-1.5 rounded-xl bg-slate-100 hover:bg-blue-50 hover:text-blue-600 text-slate-600 transition-colors cursor-pointer"
                      >
                        <Waves className="w-4 h-4" />
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => onNavigateTab?.('Quản lý Ao/Vụ')}
                      className="w-full py-1.5 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all text-center cursor-pointer"
                    >
                      Bắt đầu vụ nuôi mới →
                    </button>
                  )}
                </div>

              </div>
            );
          })}
        </div>
      )}

      {/* 5. MODAL: QUICK POND INSPECTION (SOI SÂU AO NUÔI) */}
      {inspectingPond && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-slate-200 shadow-2xl p-6 sm:p-8 space-y-6 relative">

            {/* Modal Header */}
            <div className="flex items-start justify-between pb-4 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xl sm:text-2xl font-black text-slate-900">{inspectingPond.pond.name}</span>
                  {inspectingPond.pond.areaSize && (
                    <span className="text-xs text-slate-400 font-semibold">({inspectingPond.pond.areaSize} m²)</span>
                  )}
                  {(inspectingPond.pond.farm?.name || farms.find(f => f.id === inspectingPond.pond.farmId)?.name) && (
                    <span className="text-xs font-bold text-blue-700 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-md">
                      {inspectingPond.pond.farm?.name || farms.find(f => f.id === inspectingPond.pond.farmId)?.name}
                    </span>
                  )}
                  <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${
                    inspectingPond.health.status === 'DANGER'
                      ? 'bg-rose-50 text-rose-700 border-rose-200'
                      : inspectingPond.health.status === 'WARNING'
                      ? 'bg-amber-50 text-amber-700 border-amber-200'
                      : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  }`}>
                    {inspectingPond.health.label}
                  </span>
                </div>
                <p className="text-xs text-slate-400 font-medium mt-0.5">
                  Đánh giá: <span className="font-bold text-slate-700">{inspectingPond.health.reason}</span>
                </p>
              </div>

              <button
                onClick={() => setInspectingPond(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Crop Info */}
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 space-y-3">
              <h3 className="text-xs font-extrabold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-blue-600" />
                Thông tin Vụ nuôi hiện tại
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <p className="text-slate-400">Ngày tuổi (DOC)</p>
                  <p className="font-black text-slate-900 text-sm">DOC {inspectingPond.doc}</p>
                </div>
                <div>
                  <p className="text-slate-400">Số lượng giống</p>
                  <p className="font-black text-slate-900 text-sm">{(inspectingPond.crop?.initialShrimpCount || 0).toLocaleString('vi-VN')} con</p>
                </div>
                <div>
                  <p className="text-slate-400">Ngày bắt đầu</p>
                  <p className="font-bold text-slate-700">{fmtDate(inspectingPond.crop?.startDate || '')}</p>
                </div>
                <div>
                  <p className="text-slate-400">Dự kiến thu hoạch</p>
                  <p className="font-bold text-slate-700">{inspectingPond.crop?.expectedHarvestDate ? fmtDate(inspectingPond.crop.expectedHarvestDate) : 'Chưa định'}</p>
                </div>
              </div>
            </div>

            {/* Environmental Quality Details */}
            <div className="space-y-3">
              <h3 className="text-xs font-extrabold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <Droplets className="w-4 h-4 text-cyan-600" />
                Chỉ số Môi trường Nước gần nhất
              </h3>
              {inspectingPond.latestWq ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 bg-white border border-slate-200 rounded-2xl">
                    <p className="text-[10px] text-slate-400 font-bold uppercase">Oxy hòa tan (DO)</p>
                    <p className={`text-base font-black ${inspectingPond.latestWq.dissolvedOxygen < 4 ? 'text-rose-600' : 'text-slate-900'}`}>
                      {inspectingPond.latestWq.dissolvedOxygen} <span className="text-xs font-normal text-slate-400">mg/L</span>
                    </p>
                    <span className="text-[10px] text-slate-400">Chuẩn ≥ 5.0</span>
                  </div>

                  <div className="p-3 bg-white border border-slate-200 rounded-2xl">
                    <p className="text-[10px] text-slate-400 font-bold uppercase">Độ pH</p>
                    <p className={`text-base font-black ${(inspectingPond.latestWq.ph < 7.5 || inspectingPond.latestWq.ph > 8.5) ? 'text-amber-600' : 'text-slate-900'}`}>
                      {inspectingPond.latestWq.ph}
                    </p>
                    <span className="text-[10px] text-slate-400">Chuẩn 7.5 - 8.5</span>
                  </div>

                  <div className="p-3 bg-white border border-slate-200 rounded-2xl">
                    <p className="text-[10px] text-slate-400 font-bold uppercase">Nhiệt độ nước</p>
                    <p className="text-base font-black text-slate-900">
                      {inspectingPond.latestWq.temperature}°<span className="text-xs font-normal text-slate-400">C</span>
                    </p>
                    <span className="text-[10px] text-slate-400">Chuẩn 28 - 32°C</span>
                  </div>

                  <div className="p-3 bg-white border border-slate-200 rounded-2xl">
                    <p className="text-[10px] text-slate-400 font-bold uppercase">Độ mặn</p>
                    <p className="text-base font-black text-slate-900">
                      {inspectingPond.latestWq.salinity} <span className="text-xs font-normal text-slate-400">‰</span>
                    </p>
                    <span className="text-[10px] text-slate-400">Chuẩn 10 - 25‰</span>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic">Chưa có bản ghi đo đạc môi trường nào cho ao này.</p>
              )}
            </div>

            {/* Growth Sample Details */}
            <div className="space-y-3">
              <h3 className="text-xs font-extrabold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <Fish className="w-4 h-4 text-indigo-600" />
                Mẫu chài Tăng trưởng gần nhất
              </h3>
              {inspectingPond.latestSample ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 bg-white border border-slate-200 rounded-2xl">
                    <p className="text-[10px] text-slate-400 font-bold uppercase">Trọng lượng (ABW)</p>
                    <p className="text-base font-black text-indigo-700">
                      {inspectingPond.latestSample.abwGram ? `${Number(inspectingPond.latestSample.abwGram).toFixed(2)}g` : '--'}
                    </p>
                    <span className="text-[10px] text-slate-400">{inspectingPond.latestSample.sizePerKg ? `~${Math.round(inspectingPond.latestSample.sizePerKg)} con/kg` : ''}</span>
                  </div>

                  <div className="p-3 bg-white border border-slate-200 rounded-2xl">
                    <p className="text-[10px] text-slate-400 font-bold uppercase">Tốc độ lớn (ADG)</p>
                    <p className="text-base font-black text-emerald-700">
                      {inspectingPond.latestSample.adgGramPerDay !== null && inspectingPond.latestSample.adgGramPerDay !== undefined
                        ? `+${Number(inspectingPond.latestSample.adgGramPerDay).toFixed(2)} g/d`
                        : '--'}
                    </p>
                    <span className="text-[10px] text-slate-400">Chuẩn &gt; 0.2g/ngày</span>
                  </div>

                  <div className="p-3 bg-white border border-slate-200 rounded-2xl">
                    <p className="text-[10px] text-slate-400 font-bold uppercase">Sinh khối ước tính</p>
                    <p className="text-base font-black text-purple-700">
                      {inspectingPond.latestSample.estimatedBiomassKg
                        ? `${Math.round(Number(inspectingPond.latestSample.estimatedBiomassKg)).toLocaleString('vi-VN')} kg`
                        : '--'}
                    </p>
                    <span className="text-[10px] text-slate-400">Tại DOC {inspectingPond.latestSample.doc || inspectingPond.doc}</span>
                  </div>

                  <div className="p-3 bg-white border border-slate-200 rounded-2xl">
                    <p className="text-[10px] text-slate-400 font-bold uppercase">Tổng tôm ước lượng</p>
                    <p className="text-base font-black text-slate-900">
                      {inspectingPond.latestSample.estimatedTotalShrimp
                        ? `${Math.round(Number(inspectingPond.latestSample.estimatedTotalShrimp)).toLocaleString('vi-VN')}`
                        : '--'}
                    </p>
                    <span className="text-[10px] text-slate-400">con sống</span>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic">Chưa có kết quả chài mẫu nào gần đây.</p>
              )}
            </div>

            {/* Incidents List */}
            {inspectingPond.openIncidents.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-xs font-extrabold text-rose-600 uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4" />
                  Sự cố đang xảy ra tại ao ({inspectingPond.openIncidents.length})
                </h3>
                <div className="space-y-2">
                  {inspectingPond.openIncidents.map(inc => (
                    <div key={inc.id} className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-xs flex items-center justify-between">
                      <div>
                        <p className="font-extrabold text-slate-900">{inc.title}</p>
                        <p className="text-slate-500 mt-0.5">Ngày tạo: {fmtDate(inc.createdAt)} • KTV: {inc.assignedTo?.fullName || 'Chưa phân công'}</p>
                      </div>
                      <span className="px-2 py-0.5 bg-rose-200 text-rose-800 font-bold rounded-lg text-[10px]">
                        {inc.status === 'OPEN' ? 'Chưa xử lý' : 'Đang điều trị'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actions in Modal */}
            <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
              <button
                onClick={() => setInspectingPond(null)}
                className="px-4 py-2.5 rounded-2xl border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-50 cursor-pointer"
              >
                Đóng
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setInspectingPond(null);
                    onNavigateTab?.('Theo dõi tăng trưởng');
                  }}
                  className="px-4 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-2xl text-xs font-bold transition-all cursor-pointer"
                >
                  Xem quỹ đạo 5T
                </button>

                <button
                  onClick={() => {
                    setInspectingPond(null);
                    onNavigateTab?.('Quản lý Ao/Vụ');
                  }}
                  className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-xs font-bold transition-all cursor-pointer shadow-md shadow-blue-500/20"
                >
                  Quản lý vụ nuôi ao này →
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
