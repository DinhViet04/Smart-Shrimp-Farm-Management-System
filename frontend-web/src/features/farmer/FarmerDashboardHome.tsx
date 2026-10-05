import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Waves,
  Droplets,
  ClipboardList,
  AlertTriangle,
  RefreshCw,
  Loader2,
  Calendar,
  CheckCircle2,
  Building2,
  Clock,
  ArrowRight,
  TrendingUp,
  Package,
  HeartPulse,
} from 'lucide-react';
import { pondService, type OverviewFarm, type OverviewPond } from '../../services/pond.service';
import { farmService } from '../../services/farm.service';
import { cropService, type Crop } from '../../services/crop.service';
import { waterQualityService, type WaterQualityRecord } from '../../services/water-quality.service';
import { feedingLogService, type DailyFeedingGroup } from '../../services/feeding-log.service';
import { incidentService, type Incident } from '../../services/incident.service';
import { shrimpHealthService, type ShrimpHealthHistoryRecord } from '../../services/shrimp-health.service';

interface FarmerDashboardHomeProps {
  onNavigateTab: (tab: string, config?: any) => void;
  currentUser?: any;
}

const getDOC = (startDate: string) => {
  return Math.max(0, Math.floor((Date.now() - new Date(startDate).getTime()) / 86400000));
};

const fmtTimeAgo = (iso: string) => {
  try {
    const diffMin = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
    if (diffMin < 1) return 'Vừa đo';
    if (diffMin < 60) return `${diffMin} phút trước`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `${diffH} giờ trước`;
    return new Date(iso).toLocaleDateString('vi-VN');
  } catch {
    return iso;
  }
};

export default function FarmerDashboardHome({ onNavigateTab, currentUser }: FarmerDashboardHomeProps) {
  const [farms, setFarms] = useState<OverviewFarm[]>([]);
  const [ponds, setPonds] = useState<OverviewPond[]>([]);
  const [crops, setCrops] = useState<Crop[]>([]);
  const [waterQualities, setWaterQualities] = useState<WaterQualityRecord[]>([]);
  const [todayFeedingGroups, setTodayFeedingGroups] = useState<DailyFeedingGroup[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [healthRecords, setHealthRecords] = useState<ShrimpHealthHistoryRecord[]>([]);

  const [selectedFarmId, setSelectedFarmId] = useState<string>('ALL');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Format today's date in Vietnamese: ví dụ "Thứ Hai, ngày 05/10/2026"
  const todayStrVN = useMemo(() => {
    try {
      const now = new Date();
      const days = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
      const dayName = days[now.getDay()];
      const d = String(now.getDate()).padStart(2, '0');
      const m = String(now.getMonth() + 1).padStart(2, '0');
      const y = now.getFullYear();
      return `${dayName}, ${d}/${m}/${y}`;
    } catch {
      return '';
    }
  }, []);

  const todayIsoDateOnly = useMemo(() => {
    return new Date().toISOString().split('T')[0];
  }, []);

  // Fetch all live data for Farmer
  const fetchAllData = useCallback(async (refresh = false) => {
    if (refresh) setIsRefreshing(true);
    else setIsLoading(true);

    try {
      // 1. Master data: Ponds, Farms, Crops
      const overview = await pondService.getOverview().catch(async () => {
        const [f, p, c] = await Promise.all([
          farmService.getMy().catch(() => farmService.getAll().catch(() => [])),
          pondService.getAll().catch(() => []),
          cropService.getAll().catch(() => []),
        ]);
        return { farms: f, ponds: p, crops: c };
      });

      setFarms(overview.farms || []);
      setPonds(overview.ponds || []);
      setCrops(overview.crops || []);

      // 2. Water Quality History (latest 100)
      const wqParams: { farmId?: string; size: number } = { size: 100 };
      if (selectedFarmId && selectedFarmId !== 'ALL') {
        wqParams.farmId = selectedFarmId;
      }
      const wqRes = await waterQualityService.getHistory(wqParams).catch(() => ({ content: [] }));
      setWaterQualities((wqRes.content || []) as WaterQualityRecord[]);

      // 3. Feeding Logs for today
      const feedingRes = await feedingLogService.getAllGrouped({
        farmId: selectedFarmId !== 'ALL' ? selectedFarmId : undefined,
        size: 50,
      }).catch(() => ({ data: [] as DailyFeedingGroup[] }));

      const allFeeding: DailyFeedingGroup[] = (feedingRes as any).data || (feedingRes as any).content || [];
      // Filter groups for today
      const todayLogs = allFeeding.filter((g: DailyFeedingGroup) => {
        const gDate = String(g.feedingDate || '').split('T')[0];
        return gDate === todayIsoDateOnly;
      });
      setTodayFeedingGroups(todayLogs);

      // 4. Incidents (Open or Treating)
      const incRes = await incidentService.getAll().catch(() => ({ content: [] }));
      const allIncidents = (incRes.content || []) as Incident[];
      const filteredIncidents = selectedFarmId !== 'ALL'
        ? allIncidents.filter(i => i.crop?.pond?.farm?.id === selectedFarmId)
        : allIncidents;
      setIncidents(filteredIncidents);

      // 5. Shrimp Health Records (latest 50)
      const healthRes = await shrimpHealthService.getHistory({
        farmId: selectedFarmId !== 'ALL' ? selectedFarmId : undefined,
        size: 50,
      }).catch(() => ({ content: [] }));
      setHealthRecords((healthRes.content || []) as ShrimpHealthHistoryRecord[]);

    } catch (err) {
      console.error('Lỗi khi tải dữ liệu Farmer Dashboard:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [selectedFarmId, todayIsoDateOnly]);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  // Ponds filtered by selected farm
  const visiblePonds = useMemo(() => {
    if (!selectedFarmId || selectedFarmId === 'ALL') return ponds;
    return ponds.filter(p => p.farmId === selectedFarmId);
  }, [ponds, selectedFarmId]);

  // Aggregate pond cards with live metrics
  const pondCards = useMemo(() => {
    return visiblePonds.map(pond => {
      // Find active crop for this pond
      const pondCrops = crops.filter(c => {
        const pId = c.pondId || (c.pond as any)?.id;
        return String(pId) === String(pond.id);
      });

      const activeCrop = pondCrops.find(c => (c.status || '').toUpperCase() === 'ACTIVE')
        || pondCrops.find(c => {
          const s = (c.status || '').toUpperCase();
          return s !== 'HARVESTED' && s !== 'FAILED';
        })
        || null;

      const doc = activeCrop ? getDOC(activeCrop.startDate) : null;

      // Latest water quality for this pond
      const latestWq = waterQualities.find(wq => wq.pondName === pond.name) || null;

      // Today's feeding progress for this pond
      const feedingGroup = todayFeedingGroups.find(g => String(g.pondId) === String(pond.id));
      const completedSessions = feedingGroup?.completedSessions || 0;
      const totalFeedTodayKg = feedingGroup?.totalFeedKg || 0;

      // Open incidents for this pond
      const pondIncidents = incidents.filter(i => {
        const pondMatches = i.crop?.pond?.id === pond.id || (activeCrop && i.crop?.id === activeCrop.id);
        return pondMatches && (i.status === 'OPEN' || i.status === 'TREATING');
      });

      // Latest health observation
      const latestHealth = healthRecords.find(h => h.pondName === pond.name || (activeCrop && h.cropId === activeCrop.id));

      // Water condition check
      const doVal = latestWq ? Number(latestWq.dissolvedOxygen) : null;
      const phVal = latestWq ? Number(latestWq.ph) : null;
      const isDoLow = doVal !== null && doVal > 0 && doVal < 4.0;
      const isDoWarning = doVal !== null && doVal >= 4.0 && doVal < 5.0;
      const isPhAlert = phVal !== null && phVal > 0 && (phVal < 7.5 || phVal > 8.5);

      return {
        pond,
        crop: activeCrop,
        doc,
        latestWq,
        isDoLow,
        isDoWarning,
        isPhAlert,
        completedSessions,
        totalFeedTodayKg,
        pondIncidents,
        latestHealth,
      };
    });
  }, [visiblePonds, crops, waterQualities, todayFeedingGroups, incidents, healthRecords]);

  // Overall KPIs
  const kpis = useMemo(() => {
    const totalPonds = pondCards.length;
    const activePonds = pondCards.filter(p => p.crop !== null).length;
    const idlePonds = totalPonds - activePonds;
    const pondsWithAlert = pondCards.filter(p => p.isDoLow || p.isPhAlert || p.pondIncidents.length > 0).length;
    const totalFeedKg = pondCards.reduce((acc, p) => acc + p.totalFeedTodayKg, 0);
    const totalCompletedSessions = pondCards.reduce((acc, p) => acc + p.completedSessions, 0);
    const openIncidentsCount = pondCards.reduce((acc, p) => acc + p.pondIncidents.length, 0);

    return {
      totalPonds,
      activePonds,
      idlePonds,
      pondsWithAlert,
      totalFeedKg: Math.round(totalFeedKg * 10) / 10,
      totalCompletedSessions,
      openIncidentsCount,
    };
  }, [pondCards]);

  // Ponds needing immediate attention
  const urgentAlerts = useMemo(() => {
    return pondCards.filter(p => p.isDoLow || p.pondIncidents.length > 0);
  }, [pondCards]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4 animate-in fade-in duration-300">
        <div className="relative">
          <Loader2 className="w-10 h-10 animate-spin text-teal-600" />
          <Waves className="w-5 h-5 text-teal-400 absolute inset-0 m-auto" />
        </div>
        <p className="text-stone-600 font-bold text-sm tracking-wide">
          Đang nạp dữ liệu hiện trường ao nuôi...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16 animate-in fade-in duration-300">
      
      {/* ── 1. HEADER & FARM SELECTOR ── */}
      <div className="bg-white rounded-3xl p-6 sm:p-7 border border-teal-100 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-5 relative overflow-hidden">
        {/* Subtle decorative glow */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-teal-400/5 rounded-full blur-3xl pointer-events-none -z-0" />

        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-black uppercase tracking-wider text-teal-700/80">
              Nhật trình Thực địa • {todayStrVN}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-stone-900 tracking-tight flex items-center gap-2">
            Chào {currentUser?.fullName || 'Nông Dân'}, chúc một ngày mùa thuận lợi!
          </h1>
          <p className="text-xs sm:text-sm text-stone-500 font-medium mt-1">
            Theo dõi cữ ăn, môi trường nước và sức khỏe tôm thực tế theo từng ao phụ trách
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3 flex-wrap relative z-10">
          {farms.length > 0 && (
            <div className="flex items-center gap-2 bg-stone-50 border border-teal-100/80 rounded-2xl px-4 py-2.5">
              <Building2 className="w-4 h-4 text-teal-600 shrink-0" />
              <select
                value={selectedFarmId}
                onChange={e => setSelectedFarmId(e.target.value)}
                className="bg-transparent text-sm font-bold text-stone-800 outline-none cursor-pointer pr-2"
              >
                <option value="ALL">Tất cả trang trại ({farms.length})</option>
                {farms.map(f => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
            </div>
          )}

          <button
            onClick={() => fetchAllData(true)}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-4 py-2.5 bg-teal-600 hover:bg-teal-700 active:scale-95 text-white rounded-2xl text-sm font-bold transition-all disabled:opacity-50 shadow-md shadow-teal-600/20 cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>{isRefreshing ? 'Đang nạp...' : 'Đồng bộ lại'}</span>
          </button>
        </div>
      </div>

      {/* ── 2. URGENT EMERGENCY BANNER (If any low DO or incidents) ── */}
      {urgentAlerts.length > 0 && (
        <div className="bg-gradient-to-r from-rose-500 to-amber-600 p-5 rounded-3xl text-white shadow-lg shadow-rose-500/15 flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-in slide-in-from-top-3 duration-300">
          <div className="flex items-start gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center shrink-0 border border-white/30">
              <AlertTriangle className="w-6 h-6 text-white animate-bounce" />
            </div>
            <div>
              <p className="font-black text-base tracking-tight">
                Cảnh báo cần kiểm tra hiện trường gấp ({urgentAlerts.length} ao)!
              </p>
              <p className="text-xs text-rose-100 font-medium mt-0.5">
                {urgentAlerts.map(a => `${a.pond.name}${a.isDoLow ? ` (Oxy rất thấp: ${a.latestWq?.dissolvedOxygen} mg/L)` : ''}${a.pondIncidents.length > 0 ? ` (${a.pondIncidents.length} sự cố)` : ''}`).join(' • ')}
              </p>
            </div>
          </div>
          <button
            onClick={() => onNavigateTab('Môi trường nước')}
            className="px-4 py-2.5 bg-white text-rose-700 hover:bg-rose-50 text-xs font-black rounded-xl transition-all shadow-xs shrink-0 cursor-pointer text-center"
          >
            Kiểm tra ngay →
          </button>
        </div>
      )}

      {/* ── 3. LIVE MACRO KPI CARDS ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Ao phụ trách */}
        <div className="bg-white rounded-3xl p-5 border border-teal-100 shadow-xs flex items-center gap-4 hover:shadow-md transition-shadow">
          <div className="w-12 h-12 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center shrink-0 border border-teal-100/60">
            <Waves className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-stone-400 uppercase tracking-wider">Ao đang nuôi</p>
            <p className="text-2xl font-black text-stone-900 mt-0.5">
              {kpis.activePonds} <span className="text-xs font-semibold text-stone-400">/ {kpis.totalPonds} ao</span>
            </p>
            <p className="text-[11px] font-semibold text-teal-600 mt-0.5">
              {kpis.idlePonds > 0 ? `${kpis.idlePonds} ao đang trống` : '100% ao có vụ'}
            </p>
          </div>
        </div>

        {/* KPI 2: Thức ăn & Cữ cho ăn hôm nay */}
        <div className="bg-white rounded-3xl p-5 border border-teal-100 shadow-xs flex items-center gap-4 hover:shadow-md transition-shadow">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100/60">
            <ClipboardList className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-stone-400 uppercase tracking-wider">Đã cho ăn hôm nay</p>
            <p className="text-2xl font-black text-stone-900 mt-0.5">
              {kpis.totalFeedKg > 0 ? `${kpis.totalFeedKg} kg` : '--'}
            </p>
            <p className="text-[11px] font-semibold text-emerald-600 mt-0.5">
              {kpis.totalCompletedSessions > 0 ? `${kpis.totalCompletedSessions} cữ hoàn thành` : 'Chưa có cữ ăn nào'}
            </p>
          </div>
        </div>

        {/* KPI 3: Môi trường nước */}
        <div className={`rounded-3xl p-5 border shadow-xs flex items-center gap-4 transition-all ${
          kpis.pondsWithAlert > 0 ? 'bg-amber-50/50 border-amber-200' : 'bg-white border-teal-100'
        }`}>
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border ${
            kpis.pondsWithAlert > 0 ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-cyan-50 text-cyan-600 border-cyan-100'
          }`}>
            <Droplets className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-stone-400 uppercase tracking-wider">Trạng thái nước</p>
            <p className="text-2xl font-black text-stone-900 mt-0.5">
              {kpis.totalPonds - kpis.pondsWithAlert} <span className="text-xs font-semibold text-stone-400">/ {kpis.totalPonds} ao ổn định</span>
            </p>
            <p className={`text-[11px] font-bold mt-0.5 ${kpis.pondsWithAlert > 0 ? 'text-amber-700' : 'text-emerald-600'}`}>
              {kpis.pondsWithAlert > 0 ? `${kpis.pondsWithAlert} ao cần lưu ý` : 'Thông số đều đạt'}
            </p>
          </div>
        </div>

        {/* KPI 4: Sự cố đang mở */}
        <div className={`rounded-3xl p-5 border shadow-xs flex items-center gap-4 transition-all ${
          kpis.openIncidentsCount > 0 ? 'bg-rose-50/60 border-rose-200' : 'bg-white border-teal-100'
        }`}>
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border ${
            kpis.openIncidentsCount > 0 ? 'bg-rose-100 text-rose-600 border-rose-200' : 'bg-purple-50 text-purple-600 border-purple-100'
          }`}>
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-stone-400 uppercase tracking-wider">Sự cố hiện trường</p>
            <p className="text-2xl font-black text-stone-900 mt-0.5">
              {kpis.openIncidentsCount} <span className="text-xs font-semibold text-stone-400">vấn đề</span>
            </p>
            <p className={`text-[11px] font-bold mt-0.5 ${kpis.openIncidentsCount > 0 ? 'text-rose-600' : 'text-stone-400'}`}>
              {kpis.openIncidentsCount > 0 ? 'Cần xử lý & theo dõi' : 'Không có sự cố mở'}
            </p>
          </div>
        </div>
      </div>

      {/* ── 4. QUICK ACTIONS ROW ── */}
      <div className="bg-white rounded-3xl p-6 border border-teal-100 shadow-xs">
        <h2 className="text-sm font-extrabold text-stone-700 uppercase tracking-wider mb-4 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-teal-600" />
          Tác nghiệp nhanh hàng ngày
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <button
            onClick={() => onNavigateTab('Nhật ký Chăm sóc')}
            className="flex items-center gap-3 p-3.5 bg-emerald-50/70 hover:bg-emerald-100/70 border border-emerald-200/80 rounded-2xl transition-all cursor-pointer group text-left"
          >
            <div className="w-10 h-10 rounded-xl bg-white text-emerald-600 flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform shrink-0">
              <ClipboardList className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-emerald-900">Ghi cữ cho ăn</p>
              <p className="text-[10px] text-emerald-700 font-medium">Cập nhật kg thức ăn</p>
            </div>
          </button>

          <button
            onClick={() => onNavigateTab('Môi trường nước')}
            className="flex items-center gap-3 p-3.5 bg-cyan-50/70 hover:bg-cyan-100/70 border border-cyan-200/80 rounded-2xl transition-all cursor-pointer group text-left"
          >
            <div className="w-10 h-10 rounded-xl bg-white text-cyan-600 flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform shrink-0">
              <Droplets className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-cyan-900">Ghi nhận nước</p>
              <p className="text-[10px] text-cyan-700 font-medium">Oxy, pH, nhiệt độ</p>
            </div>
          </button>

          <button
            onClick={() => onNavigateTab('Báo cáo sự cố')}
            className="flex items-center gap-3 p-3.5 bg-rose-50/70 hover:bg-rose-100/70 border border-rose-200/80 rounded-2xl transition-all cursor-pointer group text-left"
          >
            <div className="w-10 h-10 rounded-xl bg-white text-rose-600 flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-rose-900">Báo cáo sự cố</p>
              <p className="text-[10px] text-rose-700 font-medium">Tôm nổi đầu, hỏng quạt</p>
            </div>
          </button>

          <button
            onClick={() => onNavigateTab('Kho thức ăn')}
            className="flex items-center gap-3 p-3.5 bg-amber-50/70 hover:bg-amber-100/70 border border-amber-200/80 rounded-2xl transition-all cursor-pointer group text-left"
          >
            <div className="w-10 h-10 rounded-xl bg-white text-amber-600 flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform shrink-0">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-amber-900">Kiểm tra kho</p>
              <p className="text-[10px] text-amber-700 font-medium">Bao cám, vôi, khoáng</p>
            </div>
          </button>
        </div>
      </div>

      {/* ── 5. LIVE POND COMMAND CARDS ── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Waves className="w-5 h-5 text-teal-600" />
            <h2 className="text-lg font-black text-stone-900 tracking-tight">
              Danh sách Ao thực địa phụ trách ({pondCards.length} ao)
            </h2>
          </div>
          <button
            onClick={() => onNavigateTab('Quản lý Ao của tôi')}
            className="text-xs font-bold text-teal-700 hover:text-teal-900 flex items-center gap-1 cursor-pointer hover:underline"
          >
            Xem tất cả ao <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {pondCards.length === 0 ? (
          <div className="bg-white rounded-3xl border border-teal-100 p-12 text-center text-stone-400">
            <Waves className="w-12 h-12 mx-auto mb-3 text-stone-300" />
            <p className="font-bold text-base text-stone-700">Chưa có ao nuôi nào được phân công</p>
            <p className="text-xs text-stone-400 mt-1">Liên hệ Quản lý trang trại để được phân công ao phụ trách</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {pondCards.map(item => {
              const { pond, crop, doc, latestWq, isDoLow, isDoWarning, isPhAlert, completedSessions, totalFeedTodayKg, pondIncidents, latestHealth } = item;
              const isIdle = crop === null;
              const hasAlert = isDoLow || isPhAlert || pondIncidents.length > 0;

              // Card styling
              const cardBorder = isDoLow || pondIncidents.length > 0
                ? 'border-rose-300 bg-rose-50/20 shadow-rose-100/50'
                : hasAlert
                ? 'border-amber-300 bg-amber-50/20 shadow-amber-100/50'
                : isIdle
                ? 'border-dashed border-stone-200 bg-stone-50/50'
                : 'border-teal-100 bg-white hover:border-teal-300 shadow-stone-100/50';

              return (
                <div
                  key={pond.id}
                  className={`rounded-3xl border p-5 shadow-xs relative overflow-hidden flex flex-col justify-between transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${cardBorder}`}
                >
                  {/* Top Bar Indicator */}
                  <div className={`absolute top-0 inset-x-0 h-1.5 ${
                    isDoLow || pondIncidents.length > 0
                      ? 'bg-rose-500'
                      : hasAlert
                      ? 'bg-amber-500'
                      : isIdle
                      ? 'bg-stone-300'
                      : 'bg-teal-500'
                  }`} />

                  <div>
                    {/* Header: Pond Name & Status Badge */}
                    <div className="flex items-start justify-between gap-2 mb-3 pt-1">
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-base font-black text-stone-900 tracking-tight">{pond.name}</span>
                          {pond.areaSize && (
                            <span className="text-[11px] text-stone-400 font-semibold">({pond.areaSize} m²)</span>
                          )}
                          {selectedFarmId === 'ALL' && (pond.farm?.name || farms.find(f => f.id === pond.farmId)?.name) && (
                            <span className="text-[10px] font-bold text-teal-700 bg-teal-50 border border-teal-100 px-2 py-0.5 rounded-md">
                              {pond.farm?.name || farms.find(f => f.id === pond.farmId)?.name}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-stone-400 font-medium mt-0.5">
                          {isIdle ? 'Ao hiện chưa thả giống' : crop?.stage === 'NURSERY' ? 'Vụ Ương Dưỡng' : 'Vụ Thương Phẩm'}
                        </p>
                      </div>

                      <span className={`text-[10px] font-black px-2.5 py-1 rounded-full border shrink-0 uppercase tracking-wide flex items-center gap-1 ${
                        isDoLow || pondIncidents.length > 0
                          ? 'bg-rose-100 text-rose-700 border-rose-200'
                          : hasAlert
                          ? 'bg-amber-100 text-amber-800 border-amber-200'
                          : isIdle
                          ? 'bg-stone-100 text-stone-500 border-stone-200'
                          : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      }`}>
                        {!isIdle && (
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            isDoLow || pondIncidents.length > 0 ? 'bg-rose-600 animate-pulse' : hasAlert ? 'bg-amber-600' : 'bg-emerald-600'
                          }`} />
                        )}
                        {isIdle ? 'Ao trống' : hasAlert ? 'Cần chú ý' : 'Bình thường'}
                      </span>
                    </div>

                    {isIdle ? (
                      <div className="py-6 flex flex-col items-center justify-center text-center text-stone-400 gap-1.5">
                        <Waves className="w-8 h-8 text-stone-300" />
                        <p className="text-xs font-bold text-stone-600">Ao hiện đang trống</p>
                        <p className="text-[11px] text-stone-400 max-w-[200px]">
                          Sẵn sàng để chuẩn bị nước và thả giống cho vụ mới.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {/* DOC & Stocking badge */}
                        <div className="bg-stone-50 p-2.5 rounded-2xl border border-stone-100 flex items-center justify-between text-xs">
                          <span className="font-black text-stone-800 flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-teal-600" />
                            DOC {doc} ngày
                          </span>
                          <span className="text-[11px] font-bold text-stone-600">
                            Thả: {(crop?.initialShrimpCount || 0).toLocaleString('vi-VN')} con
                          </span>
                        </div>

                        {/* Real-time Water Quality Strip */}
                        <div className="bg-white p-2.5 rounded-2xl border border-stone-100 space-y-1.5">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="font-extrabold text-stone-700 flex items-center gap-1">
                              <Droplets className="w-3.5 h-3.5 text-cyan-600" />
                              Môi trường nước
                            </span>
                            <span className="text-[10px] text-stone-400 flex items-center gap-1">
                              <Clock className="w-2.5 h-2.5" />
                              {latestWq ? fmtTimeAgo(latestWq.recordTime) : 'Chưa đo'}
                            </span>
                          </div>

                          {latestWq ? (
                            <div className="grid grid-cols-4 gap-1 text-center">
                              {/* Oxy DO */}
                              <div className="bg-stone-50/70 p-1.5 rounded-xl">
                                <p className="text-[9px] text-stone-400 font-bold uppercase">Oxy (DO)</p>
                                <p className={`text-xs font-black ${
                                  isDoLow ? 'text-rose-600' : isDoWarning ? 'text-amber-600' : 'text-stone-800'
                                }`}>
                                  {latestWq.dissolvedOxygen}
                                </p>
                                <span className="text-[8px] text-stone-400">mg/L</span>
                              </div>

                              {/* pH */}
                              <div className="bg-stone-50/70 p-1.5 rounded-xl">
                                <p className="text-[9px] text-stone-400 font-bold uppercase">pH</p>
                                <p className={`text-xs font-black ${isPhAlert ? 'text-amber-600' : 'text-stone-800'}`}>
                                  {latestWq.ph}
                                </p>
                                <span className="text-[8px] text-stone-400">độ pH</span>
                              </div>

                              {/* Temp */}
                              <div className="bg-stone-50/70 p-1.5 rounded-xl">
                                <p className="text-[9px] text-stone-400 font-bold uppercase">Nhiệt độ</p>
                                <p className="text-xs font-black text-stone-800">{latestWq.temperature}°C</p>
                                <span className="text-[8px] text-stone-400">nước</span>
                              </div>

                              {/* Salinity */}
                              <div className="bg-stone-50/70 p-1.5 rounded-xl">
                                <p className="text-[9px] text-stone-400 font-bold uppercase">Độ mặn</p>
                                <p className="text-xs font-black text-stone-800">{latestWq.salinity}</p>
                                <span className="text-[8px] text-stone-400">‰</span>
                              </div>
                            </div>
                          ) : (
                            <p className="text-[11px] text-stone-400 italic text-center py-1">
                              Chưa có dữ liệu đo nước gần đây
                            </p>
                          )}
                        </div>

                        {/* Feeding Progress Today */}
                        <div className="bg-emerald-50/40 p-2.5 rounded-2xl border border-emerald-100 flex items-center justify-between text-xs">
                          <div className="flex items-center gap-1.5">
                            <ClipboardList className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            <span className="font-extrabold text-emerald-950">Hôm nay:</span>
                            <span className="font-bold text-emerald-700">
                              {completedSessions > 0 ? `${completedSessions} cữ ăn (${totalFeedTodayKg} kg)` : 'Chưa có cữ ăn'}
                            </span>
                          </div>
                          {completedSessions > 0 && (
                            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                          )}
                        </div>

                        {/* Shrimp Health Observation */}
                        {latestHealth && (
                          <div className="flex items-center justify-between text-[11px] px-1 text-stone-500">
                            <span className="flex items-center gap-1">
                              <HeartPulse className="w-3 h-3 text-rose-500" />
                              Sức khỏe: <b className="text-stone-700">{latestHealth.healthStatus === 'NORMAL' ? 'Tôm bơi khỏe' : latestHealth.healthStatus}</b>
                            </span>
                            <span className="text-[10px] text-stone-400">{fmtTimeAgo(latestHealth.recordTime)}</span>
                          </div>
                        )}

                        {/* Open Incidents Alert for this pond */}
                        {pondIncidents.length > 0 && (
                          <div className="bg-rose-50 border border-rose-200 text-rose-700 p-2 rounded-xl text-xs flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                            <span className="font-bold truncate">{pondIncidents[0].title}</span>
                          </div>
                        )}

                      </div>
                    )}
                  </div>

                  {/* Card Footer: Practical Action Buttons */}
                  <div className="pt-3 mt-3 border-t border-stone-100 flex items-center gap-2">
                    {!isIdle ? (
                      <>
                        <button
                          onClick={() => onNavigateTab('Nhật ký Chăm sóc')}
                          className="flex-1 py-1.5 px-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-xl text-xs font-bold transition-all text-center cursor-pointer shadow-xs"
                        >
                          + Ghi cữ ăn
                        </button>
                        <button
                          onClick={() => onNavigateTab('Môi trường nước')}
                          title="Xem môi trường nước"
                          className="p-1.5 rounded-xl bg-cyan-50 hover:bg-cyan-100 text-cyan-700 transition-colors cursor-pointer"
                        >
                          <Droplets className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => onNavigateTab('Báo cáo sự cố')}
                          title="Báo cáo sự cố ao này"
                          className="p-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 transition-colors cursor-pointer"
                        >
                          <AlertTriangle className="w-4 h-4" />
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => onNavigateTab('Quản lý Ao của tôi')}
                        className="w-full py-1.5 px-3 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-bold transition-all text-center cursor-pointer"
                      >
                        Xem thông tin ao →
                      </button>
                    )}
                  </div>

                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}
