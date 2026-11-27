import { useState, useEffect, useCallback, useMemo, useRef, type ReactNode } from 'react';
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
  HeartPulse,
  Thermometer,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { pondService, invalidatePondOverviewCache, type OverviewFarm, type OverviewPond } from '../../services/pond.service';
import { farmService } from '../../services/farm.service';
import { cropService, type Crop } from '../../services/crop.service';
import { waterQualityService, type WaterQualityRecord } from '../../services/water-quality.service';
import { feedingLogService, type DailyFeedingGroup } from '../../services/feeding-log.service';
import { incidentService, type Incident } from '../../services/incident.service';
import { shrimpHealthService, type ShrimpHealthHistoryRecord } from '../../services/shrimp-health.service';
import { useRealtimeRefresh } from '../../hooks/useRealtimeRefresh';

interface FarmerDashboardHomeProps {
  onNavigateTab: (tab: string, config?: any) => void;
  /** Trang đích có đang hiển thị trong menu không (mục đã ẩn thì không hiện nút dẫn tới) */
  canNavigateTo?: (tab: string) => boolean;
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

// ─── Mức độ & cảnh báo cho từng ao ───────────────────────────────────────────

type PondLevel = 'danger' | 'warning' | 'ok' | 'idle';

interface Issue {
  level: 'danger' | 'warning' | 'info';
  text: string;
  tab?: string;
  actionLabel?: string;
}

const LEVEL_ORDER: Record<PondLevel, number> = { danger: 0, warning: 1, ok: 2, idle: 3 };

const HEALTH_LABELS: Record<string, string> = {
  NORMAL: 'Khỏe mạnh',
  LETHARGIC: 'Lờ đờ',
  EDGE_GATHERING: 'Tấp mé bờ',
  LOSS_OF_APPETITE: 'Bỏ ăn',
};

const LEVEL_STYLES: Record<PondLevel, { card: string; badge: string; badgeIcon: ReactNode; label: string; issueBox: string }> = {
  danger: {
    card: 'bg-white border-rose-300',
    badge: 'bg-rose-600 text-white',
    badgeIcon: <AlertTriangle className="w-4 h-4" />,
    label: 'Nguy hiểm',
    issueBox: 'bg-rose-50 text-rose-800',
  },
  warning: {
    card: 'bg-white border-amber-300',
    badge: 'bg-amber-100 text-amber-800',
    badgeIcon: <AlertTriangle className="w-4 h-4" />,
    label: 'Cần chú ý',
    issueBox: 'bg-amber-50 text-amber-900',
  },
  ok: {
    card: 'bg-white border-teal-100',
    badge: 'bg-teal-100 text-teal-800',
    badgeIcon: <CheckCircle2 className="w-4 h-4" />,
    label: 'Ổn định',
    issueBox: '',
  },
  idle: {
    card: 'bg-stone-50 border-dashed border-stone-200',
    badge: 'bg-stone-200 text-stone-600',
    badgeIcon: null,
    label: 'Ao trống',
    issueBox: '',
  },
};

const PONDS_PER_PAGE = 6;

const LEVEL_ORDER_LIST: PondLevel[] = ['danger', 'warning', 'ok', 'idle'];

// Màu cho thanh tổng quan tình trạng ao
const STATUS_OVERVIEW: Record<PondLevel, { label: string; bar: string; hex: string; chip: string; activeChip: string }> = {
  danger: {
    label: 'Nguy hiểm',
    bar: 'bg-rose-600',
    hex: '#e11d48',
    chip: 'bg-rose-50 border-rose-200 hover:border-rose-400',
    activeChip: 'bg-rose-100 border-rose-500 ring-2 ring-rose-200',
  },
  warning: {
    label: 'Cần chú ý',
    bar: 'bg-amber-500',
    hex: '#f59e0b',
    chip: 'bg-amber-50 border-amber-200 hover:border-amber-400',
    activeChip: 'bg-amber-100 border-amber-500 ring-2 ring-amber-200',
  },
  ok: {
    label: 'Ổn định',
    bar: 'bg-teal-600',
    hex: '#0d9488',
    chip: 'bg-teal-50 border-teal-200 hover:border-teal-400',
    activeChip: 'bg-teal-100 border-teal-500 ring-2 ring-teal-200',
  },
  idle: {
    label: 'Ao trống',
    bar: 'bg-stone-300',
    hex: '#d6d3d1',
    chip: 'bg-stone-50 border-stone-200 hover:border-stone-400',
    activeChip: 'bg-stone-100 border-stone-500 ring-2 ring-stone-200',
  },
};


export default function FarmerDashboardHome({ onNavigateTab, canNavigateTo = () => true, currentUser }: FarmerDashboardHomeProps) {
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
  const [statusFilter, setStatusFilter] = useState<PondLevel | 'ALL'>('ALL');
  const [page, setPage] = useState(1);
  const pondListRef = useRef<HTMLElement>(null);

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

  // Ngày hôm nay theo giờ máy (không dùng toISOString vì đó là giờ UTC:
  // từ 0h–7h sáng ở Việt Nam sẽ ra ngày hôm qua → sai số cữ ăn hôm nay)
  const todayIsoDateOnly = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }, []);

  // Chỉ nhận kết quả của lần tải mới nhất (tránh dữ liệu cũ ghi đè khi đổi trang trại nhanh)
  const requestIdRef = useRef(0);
  const hasLoadedRef = useRef(false);

  // Tải toàn bộ dữ liệu cho dashboard — các API chạy SONG SONG
  const fetchAllData = useCallback(async (refresh = false) => {
    const requestId = ++requestIdRef.current;
    // Chỉ hiện màn hình chờ toàn trang ở lần tải đầu; các lần sau giữ nguyên giao diện
    if (refresh || hasLoadedRef.current) setIsRefreshing(true);
    else setIsLoading(true);

    // Bấm "Tải lại" / có sự kiện realtime → bỏ cache 15s của overview để lấy số liệu mới
    if (refresh) invalidatePondOverviewCache();

    const farmId = selectedFarmId !== 'ALL' ? selectedFarmId : undefined;

    try {
      const [overview, wqRes, feedingRes, incRes, healthRes] = await Promise.all([
        // 1. Trang trại, ao, vụ nuôi
        pondService.getOverview().catch(async () => {
          const [f, p, c] = await Promise.all([
            farmService.getMy().catch(() => farmService.getAll().catch(() => [])),
            pondService.getAll().catch(() => []),
            cropService.getAll().catch(() => []),
          ]);
          return { farms: f, ponds: p, crops: c };
        }),
        // 2. Đo nước gần nhất
        waterQualityService.getHistory({ farmId, size: 100 }).catch(() => ({ content: [] })),
        // 3. Nhật ký cho ăn (mới nhất trước, lọc lấy hôm nay ở dưới)
        feedingLogService
          .getAllGrouped({ farmId, size: 50 })
          .catch(() => ({ data: [] as DailyFeedingGroup[] })),
        // 4. Chỉ lấy sự cố đang mở / đang xử lý
        incidentService.getAll({ activeOnly: true, farmId }).catch(() => ({ content: [] })),
        // 5. Quan sát sức khỏe tôm gần nhất
        shrimpHealthService.getHistory({ farmId, size: 50 }).catch(() => ({ content: [] })),
      ]);

      if (requestId !== requestIdRef.current) return; // đã có lần tải mới hơn

      setFarms(overview.farms || []);
      setPonds(overview.ponds || []);
      setCrops(overview.crops || []);
      setWaterQualities((wqRes.content || []) as WaterQualityRecord[]);

      const allFeeding: DailyFeedingGroup[] = (feedingRes as any).data || (feedingRes as any).content || [];
      setTodayFeedingGroups(
        allFeeding.filter(g => String(g.feedingDate || '').split('T')[0] === todayIsoDateOnly),
      );

      setIncidents((incRes.content || []) as Incident[]);
      setHealthRecords((healthRes.content || []) as ShrimpHealthHistoryRecord[]);
    } catch (err) {
      console.error('Lỗi khi tải dữ liệu Farmer Dashboard:', err);
    } finally {
      if (requestId === requestIdRef.current) {
        hasLoadedRef.current = true;
        setIsLoading(false);
        setIsRefreshing(false);
      }
    }
  }, [selectedFarmId, todayIsoDateOnly]);

  // Realtime: tự tải lại khi dữ liệu liên quan thay đổi trên server
  // (chỉ nghe những loại dữ liệu dashboard thực sự hiển thị)
  useRealtimeRefresh(['farms', 'ponds', 'crops', 'feeding-logs', 'water-quality', 'environment', 'incidents', 'shrimp-health', 'farm-staffs'], () => {
    void fetchAllData(true);
  });

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
      const farmName = pond.farm?.name || farms.find(f => f.id === pond.farmId)?.name;
      const samePond = (r: { pondName: string; farmName: string }) =>
        r.pondName === pond.name && (!farmName || !r.farmName || r.farmName === farmName);
      const latestWq = waterQualities.find(samePond) || null;

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
      const latestHealth = healthRecords.find(h => (activeCrop && h.cropId === activeCrop.id) || samePond(h));

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
  }, [visiblePonds, farms, crops, waterQualities, todayFeedingGroups, incidents, healthRecords]);

  // Xếp hạng ao theo mức độ cần chú ý + danh sách việc cần làm
  const rankedCards = useMemo(() => {
    return pondCards
      .map(card => {
        const { crop, latestWq, isDoLow, isDoWarning, isPhAlert, completedSessions, pondIncidents, latestHealth } = card;
        const isIdle = crop === null;
        const issues: Issue[] = [];

        if (!isIdle) {
          if (isDoLow) {
            issues.push({
              level: 'danger',
              text: `Oxy trong nước thấp (${latestWq?.dissolvedOxygen} mg/L). Kiểm tra quạt nước ngay.`,
              tab: 'Báo cáo sự cố',
              actionLabel: 'Báo sự cố',
            });
          }
          if (pondIncidents.length > 0) {
            issues.push({
              level: 'danger',
              text: `Sự cố chưa xử lý: ${pondIncidents[0].title}${pondIncidents.length > 1 ? ` (+${pondIncidents.length - 1} sự cố khác)` : ''}`,
              tab: 'Báo cáo sự cố',
              actionLabel: 'Xem sự cố',
            });
          }
          if (isDoWarning) {
            issues.push({
              level: 'warning',
              text: `Oxy hơi thấp (${latestWq?.dissolvedOxygen} mg/L). Nên theo dõi thêm.`,
            });
          }
          if (isPhAlert) {
            issues.push({
              level: 'warning',
              text: `Độ pH chưa đạt (${latestWq?.ph}). Mức tốt: 7.5 – 8.5.`,
            });
          }
          if (latestHealth && latestHealth.healthStatus !== 'NORMAL') {
            issues.push({
              level: 'warning',
              text: `Tôm có dấu hiệu: ${HEALTH_LABELS[latestHealth.healthStatus] || latestHealth.healthStatus}.`,
              tab: 'Báo cáo sự cố',
              actionLabel: 'Báo sự cố',
            });
          }
          if (completedSessions === 0) {
            issues.push({
              level: 'info',
              text: 'Chưa ghi cữ ăn nào hôm nay.',
              tab: 'Nhật ký cho ăn',
              actionLabel: 'Ghi cữ ăn',
            });
          }
        }

        const level: PondLevel = isIdle
          ? 'idle'
          : issues.some(i => i.level === 'danger')
          ? 'danger'
          : issues.some(i => i.level === 'warning') || isDoWarning
          ? 'warning'
          : 'ok';

        return { ...card, isIdle, issues, level };
      })
      .sort((a, b) => LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level]);
  }, [pondCards]);

  // Tổng quan
  const kpis = useMemo(() => {
    const totalPonds = rankedCards.length;
    const activeCards = rankedCards.filter(p => !p.isIdle);
    const activePonds = activeCards.length;
    const idlePonds = totalPonds - activePonds;
    const fedPonds = activeCards.filter(p => p.completedSessions > 0).length;
    const measuredPonds = activeCards.filter(p => p.latestWq).length;
    const waterAlertPonds = activeCards.filter(p => p.isDoLow || p.isDoWarning || p.isPhAlert).length;
    const totalFeedKg = rankedCards.reduce((acc, p) => acc + p.totalFeedTodayKg, 0);
    const totalSessions = rankedCards.reduce((acc, p) => acc + p.completedSessions, 0);
    const openIncidentsCount = rankedCards.reduce((acc, p) => acc + p.pondIncidents.length, 0);
    const incidentPonds = rankedCards.filter(p => p.pondIncidents.length > 0).length;
    const byLevel: Record<PondLevel, number> = { danger: 0, warning: 0, ok: 0, idle: 0 };
    rankedCards.forEach(p => { byLevel[p.level] += 1; });

    return {
      totalPonds,
      activePonds,
      idlePonds,
      fedPonds,
      measuredPonds,
      waterAlertPonds,
      totalFeedKg: Math.round(totalFeedKg * 10) / 10,
      totalSessions,
      openIncidentsCount,
      incidentPonds,
      byLevel,
    };
  }, [rankedCards]);

  const visibleCards = useMemo(
    () => (statusFilter === 'ALL' ? rankedCards : rankedCards.filter(c => c.level === statusFilter)),
    [rankedCards, statusFilter],
  );

  // Phân trang danh sách ao
  const totalPages = Math.max(1, Math.ceil(visibleCards.length / PONDS_PER_PAGE));
  const currentPage = Math.min(page, totalPages);
  const pagedCards = visibleCards.slice((currentPage - 1) * PONDS_PER_PAGE, currentPage * PONDS_PER_PAGE);
  const goToPage = (p: number) => {
    setPage(Math.min(Math.max(1, p), totalPages));
    pondListRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4 animate-in fade-in duration-300">
        <div className="relative">
          <Loader2 className="w-12 h-12 animate-spin text-teal-600" />
          <Waves className="w-6 h-6 text-teal-400 absolute inset-0 m-auto" />
        </div>
        <p className="text-stone-700 font-bold text-base">Đang tải thông tin ao nuôi...</p>
      </div>
    );
  }

  const urgentCount = kpis.byLevel.danger + kpis.byLevel.warning;
  const pct = (n: number, total: number) => (total > 0 ? Math.round((n / total) * 100) : 0);

  return (
    <div className="space-y-7 max-w-7xl mx-auto pb-16 animate-in fade-in duration-300 relative">

      {/* ── 1. LỜI CHÀO & CHỌN TRANG TRẠI ── */}
      <div className="bg-white rounded-3xl p-6 sm:p-7 border border-teal-100 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-5">
        <div>
          <p className="flex items-center gap-2 text-base font-bold text-teal-700">
            <Calendar className="w-5 h-5" />
            {todayStrVN}
          </p>
          <h1 className="text-2xl sm:text-3xl font-black text-stone-900 tracking-tight mt-1.5">
            Xin chào, {currentUser?.fullName || 'bà con'}!
          </h1>
          <p className="text-base text-stone-600 mt-1.5">
            {kpis.totalPonds === 0
              ? 'Bạn chưa được giao ao nào.'
              : urgentCount > 0
              ? <>Hôm nay có <b className="text-rose-600">{urgentCount} ao cần chú ý</b> trong {kpis.totalPonds} ao của bạn.</>
              : <>Các ao của bạn đang <b className="text-teal-600">ổn định</b>.</>}
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {farms.length > 1 && (
            <label className="flex items-center gap-2 bg-stone-50 border-2 border-teal-100 rounded-2xl px-4 py-3">
              <Building2 className="w-5 h-5 text-teal-600 shrink-0" />
              <span className="sr-only">Chọn trang trại</span>
              <select
                value={selectedFarmId}
                onChange={e => { setSelectedFarmId(e.target.value); setPage(1); }}
                className="bg-transparent text-base font-bold text-stone-800 outline-none cursor-pointer pr-2"
              >
                <option value="ALL">Tất cả trang trại ({farms.length})</option>
                {farms.map(f => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
            </label>
          )}

          <button
            onClick={() => fetchAllData(true)}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-5 py-3 bg-teal-600 hover:bg-teal-700 active:scale-95 text-white rounded-2xl text-base font-bold transition-all disabled:opacity-60 shadow-md shadow-teal-600/20 cursor-pointer"
          >
            <RefreshCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>{isRefreshing ? 'Đang tải...' : 'Tải lại'}</span>
          </button>
        </div>
      </div>

      {/* ── 2. TỔNG QUAN HÔM NAY ── */}
      {kpis.totalPonds > 0 && (
        <section className="bg-white rounded-3xl border border-teal-100 shadow-sm p-6 space-y-6">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-2">
            <h2 className="text-xl font-black text-stone-900">Tổng quan hôm nay</h2>
            <p className="text-sm text-stone-500">Bấm vào từng trạng thái để lọc danh sách ao bên dưới</p>
          </div>

          {/* Tình trạng các ao: biểu đồ tròn */}
          <div className="grid grid-cols-1 lg:grid-cols-[auto_1fr] gap-6 items-center">
            <PondStatusDonut
              counts={kpis.byLevel}
              total={kpis.totalPonds}
              selected={statusFilter}
              onSelect={lv => { setStatusFilter(statusFilter === lv ? 'ALL' : lv); setPage(1); }}
            />

            {/* Chú thích: tên + số ao + tỉ lệ, bấm để lọc */}
            <div className="grid grid-cols-2 gap-3">
              {LEVEL_ORDER_LIST.map(lv => {
                const s = STATUS_OVERVIEW[lv];
                const active = statusFilter === lv;
                const count = kpis.byLevel[lv];
                return (
                  <button
                    key={lv}
                    type="button"
                    onClick={() => { setStatusFilter(active ? 'ALL' : lv); setPage(1); }}
                    aria-pressed={active}
                    disabled={count === 0}
                    className={`flex items-center gap-3 rounded-2xl border-2 px-4 py-3 text-left transition-all ${
                      active ? s.activeChip : count > 0 ? `${s.chip} cursor-pointer` : 'bg-stone-50 border-stone-100 opacity-60 cursor-default'
                    }`}
                  >
                    <span className={`w-4 h-4 rounded-full shrink-0 ${s.bar}`} />
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-stone-700">{s.label}</p>
                      <p className="text-2xl font-black leading-tight text-stone-900">
                        {count} <span className="text-base font-semibold text-stone-500">ao · {pct(count, kpis.totalPonds)}%</span>
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Chỉ số chính */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <SummaryCard
              icon={<ClipboardList className="w-7 h-7" />}
              tone={kpis.activePonds > 0 && kpis.fedPonds < kpis.activePonds ? 'amber' : 'teal'}
              label="Cho ăn hôm nay"
              value={`${kpis.fedPonds}/${kpis.activePonds}`}
              unit="ao"
              note={kpis.totalSessions > 0 ? `${kpis.totalSessions} cữ · tổng ${kpis.totalFeedKg} kg thức ăn` : 'Chưa có cữ ăn nào'}
              progress={pct(kpis.fedPonds, kpis.activePonds)}
              onClick={canNavigateTo('Nhật ký cho ăn') ? () => onNavigateTab('Nhật ký cho ăn') : undefined}
            />
            <SummaryCard
              icon={<Droplets className="w-7 h-7" />}
              tone={kpis.waterAlertPonds > 0 ? 'amber' : 'teal'}
              label="Nước ao đạt chuẩn"
              value={`${kpis.measuredPonds - kpis.waterAlertPonds}/${kpis.activePonds}`}
              unit="ao"
              note={
                kpis.waterAlertPonds > 0
                  ? `${kpis.waterAlertPonds} ao oxy hoặc pH chưa đạt`
                  : kpis.measuredPonds < kpis.activePonds
                  ? `${kpis.activePonds - kpis.measuredPonds} ao chưa có số liệu đo`
                  : 'Các ao đều ổn định'
              }
              progress={pct(kpis.measuredPonds - kpis.waterAlertPonds, kpis.activePonds)}
            />
            <SummaryCard
              icon={<AlertTriangle className="w-7 h-7" />}
              tone={kpis.openIncidentsCount > 0 ? 'rose' : 'teal'}
              label="Sự cố chưa xử lý"
              value={`${kpis.openIncidentsCount}`}
              unit="sự cố"
              note={kpis.openIncidentsCount > 0 ? `Ở ${kpis.incidentPonds} ao · bấm để xem` : 'Không có sự cố nào'}
              onClick={canNavigateTo('Báo cáo sự cố') ? () => onNavigateTab('Báo cáo sự cố') : undefined}
            />
          </div>
        </section>
      )}

      {/* ── 3. DANH SÁCH AO ── */}
      <section ref={pondListRef} className="scroll-mt-4">
        <div className="flex items-center justify-between mb-4 gap-3">
          <h2 className="flex items-center gap-2 text-xl font-black text-stone-900">
            <Waves className="w-6 h-6 text-teal-600" />
            {statusFilter === 'ALL'
              ? `Ao của tôi (${rankedCards.length})`
              : `Ao ${STATUS_OVERVIEW[statusFilter].label.toLowerCase()} (${visibleCards.length})`}
          </h2>
          {statusFilter !== 'ALL' ? (
            <button
              onClick={() => { setStatusFilter('ALL'); setPage(1); }}
              className="text-base font-bold text-teal-700 hover:text-teal-900 cursor-pointer hover:underline"
            >
              Hiện tất cả ao
            </button>
          ) : canNavigateTo('Quản lý Ao của tôi') && (
            <button
              onClick={() => onNavigateTab('Quản lý Ao của tôi')}
              className="text-base font-bold text-teal-700 hover:text-teal-900 flex items-center gap-1 cursor-pointer hover:underline"
            >
              Xem tất cả <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>

        {rankedCards.length === 0 ? (
          <div className="bg-white rounded-3xl border border-teal-100 p-12 text-center">
            <Waves className="w-14 h-14 mx-auto mb-3 text-stone-300" />
            <p className="font-bold text-lg text-stone-700">Chưa có ao nuôi nào được giao cho bạn</p>
            <p className="text-base text-stone-500 mt-1">Hãy liên hệ Quản lý trang trại để được giao ao.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {pagedCards.map(item => {
              const { pond, crop, doc, latestWq, isDoLow, isDoWarning, isPhAlert, completedSessions, totalFeedTodayKg, latestHealth, issues, level, isIdle } = item;
              const style = LEVEL_STYLES[level];
              const farmName = selectedFarmId === 'ALL' ? (pond.farm?.name || farms.find(f => f.id === pond.farmId)?.name) : undefined;
              const cardIssues = issues.filter(i => i.level !== 'info');

              return (
                <div
                  key={pond.id}
                  className={`rounded-3xl border-2 p-5 shadow-sm flex flex-col transition-shadow hover:shadow-md ${style.card}`}
                >
                  {/* Tên ao & trạng thái */}
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="min-w-0">
                      <h3 className="text-xl font-black text-stone-900 truncate">{pond.name}</h3>
                      <p className="text-sm text-stone-500 mt-0.5">
                        {[
                          farmName,
                          pond.areaSize ? `${pond.areaSize} m²` : null,
                          isIdle ? null : crop?.stage === 'NURSERY' ? 'Ương giống' : 'Nuôi thương phẩm',
                        ].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                    <span className={`shrink-0 inline-flex items-center gap-1.5 text-sm font-bold px-3 py-1.5 rounded-full ${style.badge}`}>
                      {style.badgeIcon}
                      {style.label}
                    </span>
                  </div>

                  {isIdle ? (
                    <div className="flex-1 py-6 flex flex-col items-center justify-center text-center gap-2">
                      <Waves className="w-10 h-10 text-stone-300" />
                      <p className="text-base font-bold text-stone-600">Ao chưa thả tôm</p>
                      <p className="text-sm text-stone-500">Đang chờ chuẩn bị cho vụ mới.</p>
                    </div>
                  ) : (
                    <div className="flex-1 space-y-3">
                      {/* Cảnh báo của ao */}
                      {cardIssues.length > 0 && (
                        <ul className={`rounded-2xl p-3 space-y-1.5 ${style.issueBox}`}>
                          {cardIssues.map((issue, idx) => (
                            <li key={idx} className="flex items-start gap-2 text-sm font-semibold">
                              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                              <span>{issue.text}</span>
                            </li>
                          ))}
                        </ul>
                      )}

                      {/* Ngày nuôi */}
                      <div className="flex items-center justify-between rounded-2xl bg-stone-50 border border-stone-100 px-4 py-3">
                        <div>
                          <p className="text-sm text-stone-500">Ngày nuôi</p>
                          <p className="text-2xl font-black text-stone-900">Ngày {doc}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-stone-500">Số tôm thả</p>
                          <p className="text-base font-bold text-stone-800">
                            {(crop?.initialShrimpCount || 0).toLocaleString('vi-VN')} con
                          </p>
                        </div>
                      </div>

                      {/* Nước ao */}
                      <div className="rounded-2xl border border-stone-100 p-3">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-base font-bold text-stone-800 flex items-center gap-1.5">
                            <Droplets className="w-5 h-5 text-teal-600" />
                            Nước ao
                          </p>
                          <p className="text-sm text-stone-500 flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            {latestWq ? `Đo ${fmtTimeAgo(latestWq.recordTime).toLowerCase()}` : 'Chưa đo'}
                          </p>
                        </div>

                        {latestWq ? (
                          <div className="grid grid-cols-2 gap-2">
                            <WaterParam
                              label="Oxy"
                              value={latestWq.dissolvedOxygen}
                              unit="mg/L"
                              status={isDoLow ? 'bad' : isDoWarning ? 'warn' : 'good'}
                              statusText={isDoLow ? 'Thấp' : isDoWarning ? 'Hơi thấp' : 'Tốt'}
                            />
                            <WaterParam
                              label="pH"
                              value={latestWq.ph}
                              status={isPhAlert ? 'warn' : 'good'}
                              statusText={isPhAlert ? 'Chưa đạt' : 'Tốt'}
                            />
                            <WaterParam
                              label="Nhiệt độ"
                              icon={<Thermometer className="w-3.5 h-3.5" />}
                              value={latestWq.temperature}
                              unit="°C"
                            />
                            <WaterParam label="Độ mặn" value={latestWq.salinity} unit="‰" />
                          </div>
                        ) : (
                          <p className="text-sm text-stone-500 text-center py-2">Chưa có số liệu đo nước.</p>
                        )}
                      </div>

                      {/* Cho ăn hôm nay */}
                      <div className={`flex items-center gap-3 rounded-2xl px-4 py-3 border ${
                        completedSessions > 0 ? 'bg-teal-50 border-teal-100' : 'bg-amber-50 border-amber-200'
                      }`}>
                        {completedSessions > 0 ? (
                          <CheckCircle2 className="w-6 h-6 text-teal-600 shrink-0" />
                        ) : (
                          <ClipboardList className="w-6 h-6 text-amber-600 shrink-0" />
                        )}
                        <div>
                          <p className="text-sm text-stone-600">Cho ăn hôm nay</p>
                          <p className={`text-base font-bold ${completedSessions > 0 ? 'text-teal-800' : 'text-amber-800'}`}>
                            {completedSessions > 0
                              ? `${completedSessions} cữ · ${totalFeedTodayKg} kg`
                              : 'Chưa cho ăn'}
                          </p>
                        </div>
                      </div>

                      {/* Sức khỏe tôm */}
                      {latestHealth && (
                        <div className="flex items-center justify-between text-sm text-stone-600 px-1">
                          <span className="flex items-center gap-1.5">
                            <HeartPulse className="w-4 h-4 text-rose-500" />
                            Sức khỏe tôm:{' '}
                            <b className={latestHealth.healthStatus === 'NORMAL' ? 'text-teal-700' : 'text-amber-700'}>
                              {latestHealth.healthStatus === 'NORMAL'
                                ? 'Khỏe mạnh'
                                : HEALTH_LABELS[latestHealth.healthStatus] || latestHealth.healthStatus}
                            </b>
                          </span>
                          <span className="text-stone-400">{fmtTimeAgo(latestHealth.recordTime)}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Nút thao tác */}
                  <div className="pt-4 mt-4 border-t border-stone-100 flex items-center gap-2">
                    {!isIdle ? (
                      <>
                        {canNavigateTo('Nhật ký cho ăn') && (
                          <button
                            onClick={() => onNavigateTab('Nhật ký cho ăn')}
                            className="flex-1 flex items-center justify-center gap-1.5 py-3 px-3 bg-teal-600 hover:bg-teal-700 active:scale-95 text-white rounded-xl text-base font-bold transition-all cursor-pointer shadow-sm"
                          >
                            <ClipboardList className="w-5 h-5" />
                            Ghi cữ ăn
                          </button>
                        )}
                        {canNavigateTo('Báo cáo sự cố') && (
                          <button
                            onClick={() => onNavigateTab('Báo cáo sự cố')}
                            className="flex-1 flex items-center justify-center gap-1.5 py-3 px-3 bg-white border-2 border-rose-200 hover:bg-rose-50 text-rose-700 rounded-xl text-base font-bold transition-colors cursor-pointer"
                          >
                            <AlertTriangle className="w-5 h-5" />
                            Báo sự cố
                          </button>
                        )}
                      </>
                    ) : (
                      canNavigateTo('Quản lý Ao của tôi') && (
                        <button
                          onClick={() => onNavigateTab('Quản lý Ao của tôi')}
                          className="w-full py-3 px-3 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-base font-bold transition-colors cursor-pointer"
                        >
                          Xem thông tin ao
                        </button>
                      )
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {visibleCards.length > PONDS_PER_PAGE && (
          <Pagination
            page={currentPage}
            totalPages={totalPages}
            from={(currentPage - 1) * PONDS_PER_PAGE + 1}
            to={Math.min(currentPage * PONDS_PER_PAGE, visibleCards.length)}
            total={visibleCards.length}
            onChange={goToPage}
          />
        )}
      </section>
    </div>
  );
}

// ─── Thành phần phụ ──────────────────────────────────────────────────────────

type Tone = 'teal' | 'amber' | 'rose' | 'stone';

const TONE_STYLES: Record<Tone, { card: string; icon: string; note: string; bar: string }> = {
  teal: { card: 'bg-white border-teal-100', icon: 'bg-teal-50 text-teal-600', note: 'text-teal-700', bar: 'bg-teal-500' },
  amber: { card: 'bg-amber-50 border-amber-200', icon: 'bg-amber-100 text-amber-700', note: 'text-amber-800', bar: 'bg-amber-500' },
  rose: { card: 'bg-rose-50 border-rose-200', icon: 'bg-rose-100 text-rose-600', note: 'text-rose-700', bar: 'bg-rose-500' },
  stone: { card: 'bg-white border-stone-200', icon: 'bg-stone-100 text-stone-500', note: 'text-stone-500', bar: 'bg-stone-400' },
};

function SummaryCard({
  icon, tone, label, value, unit, note, progress, onClick,
}: {
  icon: ReactNode;
  tone: Tone;
  label: string;
  value: string;
  unit?: string;
  note: string;
  /** 0–100: hiển thị thanh tiến độ */
  progress?: number;
  onClick?: () => void;
}) {
  const s = TONE_STYLES[tone];
  const Wrapper = onClick ? 'button' : 'div';
  return (
    <Wrapper
      onClick={onClick}
      className={`rounded-3xl p-5 border-2 shadow-sm flex flex-col gap-3 text-left ${s.card} ${
        onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''
      }`}
    >
      <div className="flex items-center gap-3">
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${s.icon}`}>{icon}</div>
        <p className="text-base font-bold text-stone-700">{label}</p>
      </div>
      <div>
        <p className="text-3xl font-black text-stone-900 leading-none">
          {value}
          {unit && <span className="text-base font-semibold text-stone-500 ml-1.5">{unit}</span>}
        </p>
        {progress !== undefined && (
          <div className="mt-3 h-2.5 w-full rounded-full bg-stone-200/70 overflow-hidden">
            <div className={`h-full rounded-full ${s.bar}`} style={{ width: `${Math.min(100, Math.max(0, progress))}%` }} />
          </div>
        )}
        <p className={`text-sm font-semibold mt-2 ${s.note}`}>{note}</p>
      </div>
    </Wrapper>
  );
}

function WaterParam({
  label, value, unit, status, statusText, icon,
}: {
  label: string;
  value: number | string | null | undefined;
  unit?: string;
  status?: 'good' | 'warn' | 'bad';
  statusText?: string;
  icon?: ReactNode;
}) {
  const hasValue = value !== null && value !== undefined && value !== '';
  const color =
    status === 'bad' ? 'text-rose-600' : status === 'warn' ? 'text-amber-600' : 'text-stone-900';
  const chip =
    status === 'bad'
      ? 'bg-rose-100 text-rose-700'
      : status === 'warn'
      ? 'bg-amber-100 text-amber-800'
      : 'bg-teal-100 text-teal-700';
  const box =
    status === 'bad' ? 'bg-rose-50 border-rose-200' : status === 'warn' ? 'bg-amber-50 border-amber-200' : 'bg-stone-50 border-stone-100';

  return (
    <div className={`rounded-xl border px-3 py-2 ${box}`}>
      <div className="flex items-center justify-between gap-1">
        <p className="text-sm text-stone-600 flex items-center gap-1">{icon}{label}</p>
        {status && hasValue && (
          <span className={`text-xs font-bold px-1.5 py-0.5 rounded-md ${chip}`}>{statusText}</span>
        )}
      </div>
      <p className={`text-xl font-black ${color}`}>
        {hasValue ? value : '--'}
        {hasValue && unit && <span className="text-sm font-semibold text-stone-500 ml-1">{unit}</span>}
      </p>
    </div>
  );
}

/** Danh sách số trang rút gọn: 1 … 4 5 6 … 12 */
function getPageNumbers(page: number, totalPages: number): (number | '…')[] {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
  const pages: (number | '…')[] = [1];
  const start = Math.max(2, page - 1);
  const end = Math.min(totalPages - 1, page + 1);
  if (start > 2) pages.push('…');
  for (let i = start; i <= end; i++) pages.push(i);
  if (end < totalPages - 1) pages.push('…');
  pages.push(totalPages);
  return pages;
}

function Pagination({
  page, totalPages, from, to, total, onChange,
}: {
  page: number;
  totalPages: number;
  from: number;
  to: number;
  total: number;
  onChange: (page: number) => void;
}) {
  const navBtn =
    'flex items-center gap-1 h-11 px-4 rounded-xl border-2 border-stone-200 bg-white text-base font-bold text-stone-700 transition-colors hover:border-teal-400 hover:text-teal-700 disabled:opacity-40 disabled:hover:border-stone-200 disabled:hover:text-stone-700 disabled:cursor-not-allowed cursor-pointer';

  return (
    <nav
      aria-label="Phân trang danh sách ao"
      className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4 bg-white rounded-2xl border border-teal-100 px-5 py-4 shadow-sm"
    >
      <p className="text-base text-stone-600">
        Đang xem ao <b className="text-stone-900">{from}–{to}</b> trong tổng <b className="text-stone-900">{total}</b> ao
      </p>

      <div className="flex items-center gap-2 flex-wrap justify-center">
        <button type="button" onClick={() => onChange(page - 1)} disabled={page <= 1} className={navBtn}>
          <ChevronLeft className="w-5 h-5" />
          <span className="hidden sm:inline">Trước</span>
        </button>

        {getPageNumbers(page, totalPages).map((p, idx) =>
          p === '…' ? (
            <span key={`gap-${idx}`} className="w-8 text-center text-stone-400 font-bold">…</span>
          ) : (
            <button
              key={p}
              type="button"
              onClick={() => onChange(p)}
              aria-current={p === page ? 'page' : undefined}
              className={`h-11 min-w-11 px-3 rounded-xl text-base font-bold transition-colors cursor-pointer ${
                p === page
                  ? 'bg-teal-600 text-white shadow-md shadow-teal-600/20'
                  : 'border-2 border-stone-200 bg-white text-stone-700 hover:border-teal-400 hover:text-teal-700'
              }`}
            >
              {p}
            </button>
          ),
        )}

        <button type="button" onClick={() => onChange(page + 1)} disabled={page >= totalPages} className={navBtn}>
          <span className="hidden sm:inline">Sau</span>
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </nav>
  );
}

/** Biểu đồ tròn (donut) thể hiện tỉ lệ ao theo trạng thái. Bấm vào lát để lọc. */
function PondStatusDonut({
  counts, total, selected, onSelect,
}: {
  counts: Record<PondLevel, number>;
  total: number;
  selected: PondLevel | 'ALL';
  onSelect: (level: PondLevel) => void;
}) {
  const [hovered, setHovered] = useState<PondLevel | null>(null);
  const size = 220;
  const stroke = 34;
  const r = (size - stroke) / 2 - 6;
  const c = 2 * Math.PI * r;
  const levels = LEVEL_ORDER_LIST.filter(lv => counts[lv] > 0);
  const gap = levels.length > 1 ? 3 : 0; // khe hở giữa các lát

  const lengths = levels.map(lv => (counts[lv] / total) * c);
  const slices = levels.map((lv, i) => ({
    lv,
    dash: Math.max(0, lengths[i] - gap),
    offset: lengths.slice(0, i).reduce((a, b) => a + b, 0),
  }));

  // Ở giữa: lát đang trỏ chuột > lát đang lọc > tổng số ao
  const focus = hovered ?? (selected !== 'ALL' ? selected : null);

  return (
    <div className="relative mx-auto" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
        role="img"
        aria-label={`Tình trạng ${total} ao: ${LEVEL_ORDER_LIST.map(lv => `${STATUS_OVERVIEW[lv].label} ${counts[lv]}`).join(', ')}`}
      >
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#f5f5f4" strokeWidth={stroke} />
        {slices.map(({ lv, dash, offset: off }) => {
          const dimmed = focus !== null && focus !== lv;
          return (
            <circle
              key={lv}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={STATUS_OVERVIEW[lv].hex}
              strokeWidth={focus === lv ? stroke + 6 : stroke}
              strokeDasharray={`${dash} ${c - dash}`}
              strokeDashoffset={-off}
              className="cursor-pointer transition-all duration-200"
              style={{ opacity: dimmed ? 0.35 : 1 }}
              onMouseEnter={() => setHovered(lv)}
              onMouseLeave={() => setHovered(null)}
              onClick={() => onSelect(lv)}
            >
              <title>{`${STATUS_OVERVIEW[lv].label}: ${counts[lv]} ao (${Math.round((counts[lv] / total) * 100)}%)`}</title>
            </circle>
          );
        })}
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
        {focus ? (
          <>
            <p className="text-4xl font-black text-stone-900 leading-none">{counts[focus]}</p>
            <p className="text-base font-bold text-stone-700 mt-1">{STATUS_OVERVIEW[focus].label}</p>
            <p className="text-sm text-stone-500">{Math.round((counts[focus] / total) * 100)}% số ao</p>
          </>
        ) : (
          <>
            <p className="text-4xl font-black text-stone-900 leading-none">{total}</p>
            <p className="text-base font-bold text-stone-600 mt-1">ao của bạn</p>
          </>
        )}
      </div>
    </div>
  );
}
