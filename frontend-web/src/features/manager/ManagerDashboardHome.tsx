import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity, AlertTriangle, ArrowRight, Building2, CheckCircle2, CircleAlert,
  Clock3, DollarSign, Droplets, Fish, Gauge, Loader2, RefreshCw, Scale, Search,
  ShieldAlert, TrendingUp, Waves,
} from 'lucide-react';
import {
  Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ReferenceArea,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { pondService, type OverviewFarm, type OverviewPond } from '../../services/pond.service';
import { cropService, type Crop, type ManagerHarvestSummary } from '../../services/crop.service';
import { incidentService, type Incident } from '../../services/incident.service';
import { waterQualityService, type ManagerWaterTrendsResponse } from '../../services/water-quality.service';

type ShrimpSample = NonNullable<OverviewPond['latestSizeSample']>;

type DashboardWaterRecord = ManagerWaterTrendsResponse['latestByPond'][number];

interface Props {
  onNavigateTab?: (tab: string) => void;
  onOpenCropHistory?: (farmId?: string, pondId?: string, year?: number, quarter?: number | null) => void;
}

type HealthStatus = 'DANGER' | 'WARNING' | 'OPTIMAL' | 'IDLE';

interface PondRow {
  pond: OverviewPond;
  crop: Crop | null;
  doc: number | null;
  latestWq: DashboardWaterRecord | null;
  sample: ShrimpSample | null;
  openIncidents: Incident[];
  health: { status: HealthStatus; label: string; reason: string };
}

interface ActionItem {
  id: string;
  severity: 'DANGER' | 'WARNING';
  title: string;
  detail: string;
  tab: string;
}

const DAY_MS = 86_400_000;
const getDoc = (startDate: string, snapshotTime: number) => Math.max(0, Math.floor((snapshotTime - new Date(startDate).getTime()) / DAY_MS));
const farmNameOf = (pond: OverviewPond, farms: OverviewFarm[]) =>
  pond.farm?.name || farms.find((farm) => farm.id === pond.farmId)?.name || 'Trang trại';
const shortDate = (value: string) => new Date(value).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
const formatMoney = (value: number) => new Intl.NumberFormat('vi-VN', { notation: 'compact', maximumFractionDigits: 1 }).format(value) + ' đ';
const comparisonText = (value: number | null, quarter: number | null) => value === null
  ? 'Chưa có dữ liệu kỳ trước'
  : `${value >= 0 ? '↑' : '↓'} ${Math.abs(value)}% ${quarter ? 'so với cùng kỳ năm trước' : 'so với năm trước'}`;

export default function ManagerDashboardHome({ onNavigateTab, onOpenCropHistory }: Props) {
  const [farms, setFarms] = useState<OverviewFarm[]>([]);
  const [ponds, setPonds] = useState<OverviewPond[]>([]);
  const [crops, setCrops] = useState<Crop[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [waterOverview, setWaterOverview] = useState<ManagerWaterTrendsResponse | null>(null);
  const [waterLoading, setWaterLoading] = useState(true);
  const [waterError, setWaterError] = useState(false);
  const [farmId, setFarmId] = useState('ALL');
  const [status, setStatus] = useState<'ALL' | HealthStatus>('ALL');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [snapshotTime, setSnapshotTime] = useState(() => Date.now());
  const [financeYear, setFinanceYear] = useState(() => new Date().getFullYear());
  const [financeQuarter, setFinanceQuarter] = useState<number | null>(null);
  const [finance, setFinance] = useState<ManagerHarvestSummary | null>(null);
  const [financeError, setFinanceError] = useState(false);
  const [financeLoading, setFinanceLoading] = useState(true);
  const [operationalRefreshKey, setOperationalRefreshKey] = useState(0);
  const [financeRefreshKey, setFinanceRefreshKey] = useState(0);

  const loadDashboard = useCallback(async (refresh = false, background = false) => {
    if (refresh) setRefreshing(true);
    else if (!background) setLoading(true);
    setError(null);
    try {
      const [overview, incidentPage] = await Promise.all([
        pondService.getOverview(),
        incidentService.getAll({ activeOnly: true }).catch(() => ({ content: [], totalElements: 0 })),
      ]);

      setFarms(overview.farms || []);
      setPonds(overview.ponds || []);
      setCrops(overview.crops || []);
      setIncidents(incidentPage.content || []);

      setUpdatedAt(new Date());
      setSnapshotTime(Date.now());
    } catch (loadError) {
      console.error('Không thể tải dashboard quản lý:', loadError);
      setError('Không thể tải dữ liệu tổng quan. Vui lòng thử lại.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    // Initial data synchronization is the purpose of this effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      void loadDashboard(false, true);
      setOperationalRefreshKey((key) => key + 1);
    }, 60_000);
    return () => window.clearInterval(timer);
  }, [loadDashboard]);

  useEffect(() => {
    let active = true;
    cropService.getManagerSummary({
      farmId: farmId === 'ALL' ? undefined : farmId,
      year: financeYear,
      quarter: financeQuarter || undefined,
    }).then((result) => {
      if (!active) return;
      setFinance(result);
      setFinanceError(false);
    }).catch((financeLoadError) => {
      console.error('Không thể tải tổng kết tài chính:', financeLoadError);
      if (!active) return;
      setFinance(null);
      setFinanceError(true);
    }).finally(() => {
      if (active) setFinanceLoading(false);
    });
    return () => { active = false; };
  }, [farmId, financeQuarter, financeRefreshKey, financeYear]);

  useEffect(() => {
    let active = true;
    waterQualityService.getManagerTrends({
      farmId: farmId === 'ALL' ? undefined : farmId,
      days: 7,
    }).then((result) => {
      if (!active) return;
      setWaterOverview((previous) => {
        if (!previous) return result;
        const latestByPond = new Map(previous.latestByPond.map((record) => [record.pondId, record]));
        result.latestByPond.forEach((record) => latestByPond.set(record.pondId, record));
        return { ...result, latestByPond: [...latestByPond.values()] };
      });
      setWaterError(false);
    }).catch((waterLoadError) => {
      console.error('Không thể tải tổng hợp môi trường nước:', waterLoadError);
      if (active) setWaterError(true);
    }).finally(() => {
      if (active) setWaterLoading(false);
    });
    return () => { active = false; };
  }, [farmId, operationalRefreshKey]);

  const selectedFarm = useMemo(() => farms.find((farm) => farm.id === farmId), [farmId, farms]);

  const activeCropByPond = useMemo(() => new Map(
    crops.filter((crop) => crop.status === 'ACTIVE').map((crop) => [crop.pondId, crop]),
  ), [crops]);

  const latestWaterByPond = useMemo(() => new Map(
    (waterOverview?.latestByPond || []).map((record) => [record.pondId, record]),
  ), [waterOverview]);

  const incidentsByPond = useMemo(() => {
    const grouped = new Map<string, Incident[]>();
    incidents.forEach((incident) => {
      if (incident.status !== 'OPEN' && incident.status !== 'TREATING') return;
      const pondId = incident.crop?.pond?.id;
      if (!pondId) return;
      const existing = grouped.get(pondId);
      if (existing) existing.push(incident);
      else grouped.set(pondId, [incident]);
    });
    return grouped;
  }, [incidents]);

  const rows = useMemo<PondRow[]>(() => {
    const visiblePonds = farmId === 'ALL' ? ponds : ponds.filter((pond) => pond.farmId === farmId);
    return visiblePonds.map((pond) => {
      const crop = activeCropByPond.get(pond.id) || null;
      const latestWq = latestWaterByPond.get(pond.id) || null;
      const openIncidents = incidentsByPond.get(pond.id) || [];

      if (!crop) return {
        pond, crop, doc: null, latestWq, sample: pond.latestSizeSample || null, openIncidents,
        health: { status: 'IDLE', label: 'Ao trống', reason: 'Chưa có vụ nuôi hoạt động' },
      };

      const dissolvedOxygen = Number(latestWq?.dissolvedOxygen);
      const ph = Number(latestWq?.ph);
      const measurementAge = latestWq ? snapshotTime - new Date(latestWq.recordTime).getTime() : Infinity;
      const dangerWater = !!latestWq && (latestWq.overallStatus === 'Danger' || (dissolvedOxygen > 0 && dissolvedOxygen < 4) || (ph > 0 && (ph < 7 || ph > 9)));
      const warningWater = !!latestWq && (latestWq.overallStatus === 'Warning' || (dissolvedOxygen > 0 && dissolvedOxygen < 5) || (ph > 0 && (ph < 7.5 || ph > 8.5)));
      let health: PondRow['health'] = { status: 'OPTIMAL', label: 'Ổn định', reason: 'Không có cảnh báo đang mở' };

      if (openIncidents.length || dangerWater) {
        health = {
          status: 'DANGER', label: 'Cần xử lý',
          reason: openIncidents.length ? `${openIncidents.length} sự cố đang mở` : 'Môi trường ở mức nguy hiểm',
        };
      } else if (!latestWq || measurementAge > DAY_MS || warningWater) {
        health = {
          status: 'WARNING', label: 'Cần chú ý',
          reason: !latestWq ? 'Chưa có dữ liệu môi trường' : measurementAge > DAY_MS ? 'Dữ liệu môi trường đã quá 24 giờ' : 'Môi trường ngoài ngưỡng tối ưu',
        };
      }
      return { pond, crop, doc: getDoc(crop.startDate, snapshotTime), latestWq, sample: pond.latestSizeSample || null, openIncidents, health };
    });
  }, [activeCropByPond, farmId, incidentsByPond, latestWaterByPond, ponds, snapshotTime]);

  const summary = useMemo(() => ({
    total: rows.length,
    active: rows.filter((row) => row.crop).length,
    danger: rows.filter((row) => row.health.status === 'DANGER').length,
    warning: rows.filter((row) => row.health.status === 'WARNING').length,
    optimal: rows.filter((row) => row.health.status === 'OPTIMAL').length,
    idle: rows.filter((row) => row.health.status === 'IDLE').length,
    incidents: rows.reduce((sum, row) => sum + row.openIncidents.length, 0),
    biomass: rows.reduce((sum, row) => sum + Number(row.sample?.estimatedBiomassKg || 0), 0),
    measured: rows.filter((row) => row.crop && row.latestWq).length,
    sampled: rows.filter((row) => row.crop && row.sample).length,
  }), [rows]);

  const actions = useMemo<ActionItem[]>(() => {
    const result: ActionItem[] = [];
    rows.forEach((row) => {
      row.openIncidents.forEach((incident) => result.push({
        id: `incident-${incident.id}`, severity: 'DANGER', title: incident.title,
        detail: `${row.pond.name} · ${incident.assignedTo?.fullName || 'Chưa phân công'}`, tab: 'Sự cố & Điều trị',
      }));
      if (row.health.status === 'DANGER' && !row.openIncidents.length) result.push({
        id: `danger-${row.pond.id}`, severity: 'DANGER', title: `${row.pond.name}: môi trường nguy hiểm`,
        detail: row.health.reason, tab: 'Môi trường nước',
      });
      if (row.health.status === 'WARNING') result.push({
        id: `warning-${row.pond.id}`, severity: 'WARNING', title: `${row.pond.name}: cần kiểm tra`,
        detail: row.health.reason, tab: 'Môi trường nước',
      });
    });
    return result.sort((a, b) => a.severity === b.severity ? 0 : a.severity === 'DANGER' ? -1 : 1).slice(0, 6);
  }, [rows]);

  const waterTrend = useMemo(() => (waterOverview?.series || []).map((day) => ({
    date: shortDate(day.date),
    do: day.averageDo,
    ph: day.averagePh,
    samples: day.sampleCount,
  })), [waterOverview]);

  const growth = useMemo(() => rows.filter((row) => row.crop && row.sample?.abwGram).slice(0, 10).map((row) => {
    const milestones = row.crop?.growthMilestones || [];
    const nearest = milestones.length ? [...milestones].sort((a, b) => Math.abs(a.day - (row.doc || 0)) - Math.abs(b.day - (row.doc || 0)))[0] : null;
    return { pond: row.pond.name, actual: Number(Number(row.sample?.abwGram).toFixed(2)), target: nearest?.weight };
  }), [rows]);

  const farmRows = useMemo(() => (farmId === 'ALL' ? farms : farms.filter((farm) => farm.id === farmId)).map((farm) => {
    const items = rows.filter((row) => row.pond.farmId === farm.id);
    return {
      id: farm.id, name: farm.name, total: items.length, active: items.filter((row) => row.crop).length,
      alerts: items.filter((row) => row.health.status === 'DANGER' || row.health.status === 'WARNING').length,
      incidents: items.reduce((sum, row) => sum + row.openIncidents.length, 0),
      biomass: items.reduce((sum, row) => sum + Number(row.sample?.estimatedBiomassKg || 0), 0),
    };
  }), [farmId, farms, rows]);

  const visibleRows = useMemo(() => rows
    .filter((row) => status === 'ALL' || row.health.status === status)
    .filter((row) => row.pond.name.toLowerCase().includes(search.trim().toLowerCase()))
    .sort((a, b) => ({ DANGER: 0, WARNING: 1, OPTIMAL: 2, IDLE: 3 })[a.health.status] - ({ DANGER: 0, WARNING: 1, OPTIMAL: 2, IDLE: 3 })[b.health.status]),
  [rows, search, status]);

  const handleFarmChange = (nextFarmId: string) => {
    if (nextFarmId === farmId) return;
    setFinanceLoading(true);
    setWaterLoading(true);
    setFarmId(nextFarmId);
  };

  const handleYearChange = (nextYear: number) => {
    if (nextYear === financeYear) return;
    setFinanceLoading(true);
    setFinanceYear(nextYear);
  };

  const handleQuarterChange = (nextQuarter: number | null) => {
    if (nextQuarter === financeQuarter) return;
    setFinanceLoading(true);
    setFinanceQuarter(nextQuarter);
  };

  const handleRefresh = () => {
    setFinanceLoading(true);
    setWaterLoading(true);
    void loadDashboard(true);
    setOperationalRefreshKey((key) => key + 1);
    setFinanceRefreshKey((key) => key + 1);
  };

  if (loading || (waterLoading && !waterOverview)) return <LoadingState />;

  const isSyncing = refreshing || financeLoading || waterLoading;

  const kpis = [
    { label: 'Ao đang nuôi', value: `${summary.active}/${summary.total}`, note: `${summary.idle} ao trống`, icon: Waves, tone: 'blue' },
    { label: 'Ao cần chú ý', value: summary.danger + summary.warning, note: `${summary.danger} ao nguy hiểm`, icon: ShieldAlert, tone: summary.danger ? 'rose' : 'amber' },
    { label: 'Sự cố đang mở', value: summary.incidents, note: summary.incidents ? 'Cần theo dõi xử lý' : 'Không có sự cố', icon: AlertTriangle, tone: summary.incidents ? 'rose' : 'emerald' },
    { label: 'Sinh khối ước tính', value: summary.biomass ? `${(summary.biomass / 1000).toFixed(1)} t` : '--', note: `${summary.sampled}/${summary.active} ao có mẫu`, icon: Scale, tone: 'violet' },
    { label: 'Dữ liệu môi trường', value: `${summary.measured}/${summary.active}`, note: 'Ao đã có số đo', icon: Gauge, tone: summary.measured < summary.active ? 'amber' : 'emerald' },
  ];
  const financial = finance?.totals;
  const financialKpis = [
    { label: 'Doanh thu', value: financial ? formatMoney(financial.revenue) : '--', note: comparisonText(finance?.comparison.revenuePercent ?? null, financeQuarter), icon: DollarSign, tone: 'emerald' },
    { label: 'Tổng chi phí', value: financial ? formatMoney(financial.cost) : '--', note: `${financial?.harvestedCrops || 0} vụ đã thu hoạch`, icon: Scale, tone: 'amber' },
    { label: 'Lợi nhuận ròng', value: financial ? formatMoney(financial.profit) : '--', note: comparisonText(finance?.comparison.profitPercent ?? null, financeQuarter), icon: TrendingUp, tone: financial && financial.profit < 0 ? 'rose' : 'blue' },
    { label: 'Sản lượng', value: financial ? `${(financial.harvestKg / 1000).toFixed(1)} t` : '--', note: comparisonText(finance?.comparison.harvestKgPercent ?? null, financeQuarter), icon: Fish, tone: 'violet' },
    { label: 'Biên lợi nhuận', value: financial ? `${financial.profitMargin}%` : '--', note: `${financial?.targetMet || 0}/${financial?.harvestedCrops || 0} vụ đạt mục tiêu`, icon: Gauge, tone: financial && financial.profitMargin < 0 ? 'rose' : 'emerald' },
  ];

  return (
    <div className="mx-auto max-w-[1600px] space-y-5 pb-16">
      <header className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-5 p-5 lg:flex-row lg:items-center lg:justify-between lg:p-6">
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[.18em] text-blue-600"><span className="h-2 w-2 rounded-full bg-emerald-500" />Tổng quan</div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">Hoạt động trang trại</h1>
            <p className="mt-1.5 text-sm text-slate-500">Theo dõi vận hành, cảnh báo và hiệu quả các vụ nuôi.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <label className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-2.5">
              <Building2 className="h-4 w-4 text-slate-400" />
              <select value={farmId} onChange={(event) => handleFarmChange(event.target.value)} className="max-w-52 bg-transparent text-sm font-bold text-slate-700 outline-none" aria-label="Chọn trang trại">
                <option value="ALL">Tất cả trang trại</option>
                {farms.map((farm) => <option key={farm.id} value={farm.id}>{farm.name}</option>)}
              </select>
            </label>
            <select value={financeYear} onChange={(event) => handleYearChange(Number(event.target.value))} className="rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm font-bold text-slate-700 outline-none" aria-label="Chọn năm tổng kết">
              {[0, 1, 2].map((offset) => {
                const year = new Date().getFullYear() - offset;
                return <option key={year} value={year}>Năm {year}</option>;
              })}
            </select>
            <select value={financeQuarter ?? 'ALL'} onChange={(event) => handleQuarterChange(event.target.value === 'ALL' ? null : Number(event.target.value))} className="rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm font-bold text-slate-700 outline-none" aria-label="Chọn kỳ tổng kết">
              <option value="ALL">Cả năm</option>
              {[1, 2, 3, 4].map((quarter) => <option key={quarter} value={quarter}>Quý {quarter}</option>)}
            </select>
            <button type="button" onClick={handleRefresh} disabled={isSyncing} className="flex items-center gap-2 rounded-2xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-60">
              <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />{isSyncing ? 'Đang đồng bộ' : 'Đồng bộ'}
            </button>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 bg-slate-50/80 px-5 py-3 text-xs text-slate-500 lg:px-6">
          <span className="flex items-center gap-1.5"><Clock3 className="h-3.5 w-3.5" />Cập nhật: {updatedAt?.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) || '--:--'}</span>
          <span>{selectedFarm?.name || `${farms.length} trang trại`} · {summary.total} ao</span>
        </div>
      </header>

      {error && <div className="flex items-center justify-between rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700"><span className="flex items-center gap-2"><CircleAlert className="h-4 w-4" />{error}</span><button type="button" onClick={handleRefresh} className="underline">Thử lại</button></div>}
      {waterError && <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700">Chưa thể cập nhật dữ liệu môi trường. Dashboard đang giữ kết quả gần nhất.</div>}

      <section>
        <div className="mb-3 flex items-end justify-between gap-3">
          <div><h2 className="text-lg font-black text-slate-900">Kết quả kinh doanh {financeQuarter ? `quý ${financeQuarter}/${financeYear}` : `năm ${financeYear}`}</h2><p className="mt-0.5 text-xs text-slate-500">Tổng kết các vụ theo ngày thu hoạch trong phạm vi đang chọn</p></div>
          {financeLoading ? <span className="flex items-center gap-1.5 text-xs font-bold text-blue-600"><Loader2 className="h-3.5 w-3.5 animate-spin" />Đang cập nhật</span> : financeError && <span className="text-xs font-bold text-rose-600">Không tải được dữ liệu tài chính</span>}
        </div>
        {financeLoading && !finance
          ? <KpiSkeleton count={5} />
          : <div className={`grid grid-cols-2 gap-3 transition-opacity lg:grid-cols-5 ${financeLoading ? 'opacity-50' : ''}`}>{financialKpis.map((kpi) => <KpiCard key={kpi.label} {...kpi} />)}</div>}
      </section>

      <Panel title="Các vụ vừa kết thúc" subtitle="Kết quả gần nhất để quản lý đánh giá và đi sâu khi cần">
        {financeLoading && !finance ? <TableSkeleton /> : finance?.recentHarvests.length ? (
          <div className={`overflow-x-auto transition-opacity ${financeLoading ? 'opacity-50' : ''}`}>
            <table className="w-full min-w-[760px] text-left">
              <thead><tr className="border-b border-slate-100 text-[11px] uppercase tracking-wider text-slate-400"><th className="pb-3">Ao/Vụ</th><th className="pb-3">Thu hoạch</th><th className="pb-3">Sản lượng</th><th className="pb-3">Doanh thu</th><th className="pb-3">Lợi nhuận</th><th className="pb-3">Kết quả</th></tr></thead>
              <tbody>{finance.recentHarvests.map((crop) => (
                <tr key={crop.id} className="border-b border-slate-50 text-sm last:border-0">
                  <td className="py-3.5"><p className="font-bold text-slate-800">{crop.pondName}</p><p className="text-xs text-slate-400">{crop.farmName}</p></td>
                  <td className="py-3.5 text-slate-600">{new Date(crop.actualHarvestDate).toLocaleDateString('vi-VN')}</td>
                  <td className="py-3.5 font-semibold text-slate-700">{crop.actualHarvestKg.toLocaleString('vi-VN')} kg</td>
                  <td className="py-3.5 font-semibold text-slate-700">{formatMoney(crop.actualHarvestRevenue)}</td>
                  <td className={`py-3.5 font-black ${crop.actualHarvestProfit < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{formatMoney(crop.actualHarvestProfit)}</td>
                  <td className="py-3.5"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${crop.targetMet === false ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>{crop.targetMet === null ? 'Chưa có mục tiêu' : crop.targetMet ? 'Đạt mục tiêu' : 'Chưa đạt'}</span></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        ) : <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 py-8 text-center text-sm text-slate-500">Chưa có vụ thu hoạch trong {financeQuarter ? `quý ${financeQuarter}/${financeYear}` : `năm ${financeYear}`}.</div>}
        <div className="mt-4 flex justify-end"><button type="button" onClick={() => onOpenCropHistory ? onOpenCropHistory(farmId === 'ALL' ? undefined : farmId, undefined, financeYear, financeQuarter) : onNavigateTab?.('Quản lý Ao/Vụ')} className="flex items-center gap-1 text-xs font-bold text-blue-600">Xem lịch sử vụ nuôi <ArrowRight className="h-3.5 w-3.5" /></button></div>
      </Panel>

      <Panel title="Tổng kết theo trang trại và ao" subtitle="Đối chiếu hiệu quả các vụ đã thu hoạch trong kỳ đang chọn">
        {financeLoading && !finance ? <TableSkeleton /> : finance?.farmSummaries.length ? (
          <div className={`overflow-x-auto transition-opacity ${financeLoading ? 'opacity-50' : ''}`}>
            <table className="w-full min-w-[860px] text-left">
              <thead><tr className="border-b border-slate-100 text-[11px] uppercase tracking-wider text-slate-400"><th className="pb-3">Phạm vi</th><th className="pb-3">Số vụ</th><th className="pb-3">Sản lượng</th><th className="pb-3">Doanh thu</th><th className="pb-3">Lợi nhuận</th><th className="pb-3">FCR TB</th><th className="pb-3">Tỷ lệ sống TB</th></tr></thead>
              <tbody>{finance.farmSummaries.flatMap((farm) => [
                <SummaryRow key={farm.farmId} label={farm.farmName} totals={farm.totals} level="farm" onOpen={onOpenCropHistory ? () => onOpenCropHistory(farm.farmId, undefined, financeYear, financeQuarter) : undefined} />,
                ...farm.ponds.map((pond) => <SummaryRow key={pond.pondId} label={pond.pondName} totals={pond.totals} level="pond" onOpen={onOpenCropHistory ? () => onOpenCropHistory(farm.farmId, pond.pondId, financeYear, financeQuarter) : undefined} />),
              ])}</tbody>
            </table>
          </div>
        ) : <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 py-8 text-center text-sm text-slate-500">Chưa có dữ liệu để tổng kết theo trang trại và ao.</div>}
      </Panel>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {kpis.map((kpi) => <KpiCard key={kpi.label} {...kpi} />)}
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.15fr_.85fr]">
        <Panel title="Việc cần xử lý ngay" subtitle="Ưu tiên theo mức độ ảnh hưởng đến vụ nuôi" icon={<CircleAlert className="h-5 w-5 text-rose-500" />} badge={`${actions.length} việc`}>
          {actions.length ? <div className="space-y-2">{actions.map((action) => (
            <button key={action.id} type="button" onClick={() => onNavigateTab?.(action.tab)} className="group flex w-full items-center gap-3 rounded-2xl border border-slate-100 p-3 text-left hover:border-blue-200 hover:bg-blue-50/40">
              <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${action.severity === 'DANGER' ? 'bg-rose-500' : 'bg-amber-500'}`} />
              <span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold text-slate-800">{action.title}</span><span className="mt-0.5 block truncate text-xs text-slate-500">{action.detail}</span></span>
              <ArrowRight className="h-4 w-4 text-slate-300 group-hover:text-blue-500" />
            </button>
          ))}</div> : <div className="flex min-h-56 flex-col items-center justify-center rounded-2xl border border-dashed border-emerald-200 bg-emerald-50/50 text-center"><CheckCircle2 className="mb-3 h-9 w-9 text-emerald-500" /><p className="font-bold text-emerald-800">Chưa có vấn đề cần can thiệp</p><p className="mt-1 text-xs text-emerald-600">Các ao đang trong trạng thái kiểm soát</p></div>}
        </Panel>

        <Panel title="Sức khỏe toàn trang trại" subtitle={`Phân bổ trạng thái của ${summary.total} ao`}>
          <HealthOverview summary={summary} onSelect={setStatus} />
        </Panel>
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <ChartPanel title="Môi trường nước 7 ngày" subtitle="DO và pH trung bình của các ao đang hiển thị" icon={<Droplets className="h-5 w-5 text-cyan-500" />} onOpen={() => onNavigateTab?.('Môi trường nước')}>
          <div className="relative h-full">
          {waterTrend.filter((day) => day.samples > 0).length > 1 ? <ResponsiveContainer width="100%" height="100%"><LineChart data={waterTrend} margin={{ top: 12, right: 5, left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} /><XAxis dataKey="date" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis yAxisId="do" domain={[0, 10]} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} /><YAxis yAxisId="ph" orientation="right" domain={[6, 10]} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
            <ReferenceArea yAxisId="do" y1={5} y2={8} fill="#dcfce7" fillOpacity={0.45} /><Tooltip /><Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
            <Line yAxisId="do" type="monotone" dataKey="do" name="DO (mg/L)" stroke="#0891b2" strokeWidth={3} dot={{ r: 3 }} /><Line yAxisId="ph" type="monotone" dataKey="ph" name="pH" stroke="#8b5cf6" strokeWidth={3} dot={{ r: 3 }} />
          </LineChart></ResponsiveContainer> : <EmptyChart message="Cần ít nhất hai ngày đo để hiển thị xu hướng." />}
          {waterLoading && <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-white/75 backdrop-blur-[1px]"><span className="flex items-center gap-2 text-xs font-bold text-cyan-700"><Loader2 className="h-4 w-4 animate-spin" />Đang cập nhật môi trường</span></div>}
          </div>
        </ChartPanel>

        <ChartPanel title="Tăng trưởng gần nhất" subtitle="ABW thực tế và mục tiêu gần DOC hiện tại" icon={<Fish className="h-5 w-5 text-indigo-500" />} onOpen={() => onNavigateTab?.('Theo dõi tăng trưởng')}>
          {growth.length ? <ResponsiveContainer width="100%" height="100%"><BarChart data={growth} margin={{ top: 12, right: 5, left: -18 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} /><XAxis dataKey="pond" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} /><YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} unit="g" /><Tooltip /><Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="actual" name="Thực tế (g)" fill="#4f46e5" radius={[6, 6, 0, 0]} /><Bar dataKey="target" name="Mục tiêu (g)" fill="#cbd5e1" radius={[6, 6, 0, 0]} />
          </BarChart></ResponsiveContainer> : <EmptyChart message="Chưa có mẫu kích cỡ để tổng hợp tăng trưởng." />}
        </ChartPanel>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.2fr_.8fr]">
        <Panel title="Tổng quan theo trang trại" subtitle="So sánh nhanh quy mô và rủi ro vận hành">
          <div className="overflow-x-auto"><table className="w-full min-w-[620px] text-left"><thead><tr className="border-b border-slate-100 text-[11px] uppercase tracking-wider text-slate-400"><th className="pb-3">Trang trại</th><th className="pb-3">Ao hoạt động</th><th className="pb-3">Cảnh báo</th><th className="pb-3">Sự cố</th><th className="pb-3">Sinh khối</th><th /></tr></thead><tbody>
            {farmRows.map((farm) => <tr key={farm.id} className="border-b border-slate-50 text-sm last:border-0"><td className="py-3.5 font-bold text-slate-800">{farm.name}</td><td className="py-3.5 text-slate-600">{farm.active}/{farm.total} ao</td><td className="py-3.5"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${farm.alerts ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>{farm.alerts}</span></td><td className={`py-3.5 font-bold ${farm.incidents ? 'text-rose-600' : 'text-slate-500'}`}>{farm.incidents}</td><td className="py-3.5 font-semibold text-slate-600">{farm.biomass ? `${(farm.biomass / 1000).toFixed(1)} t` : '--'}</td><td className="py-3.5 text-right"><button type="button" onClick={() => handleFarmChange(farm.id)} className="text-xs font-bold text-blue-600">Xem</button></td></tr>)}
          </tbody></table></div>
        </Panel>
        <Panel title="Mức độ sẵn sàng dữ liệu" subtitle="Phát hiện ao chưa được cập nhật kịp thời">
          <div className="space-y-5"><Progress label="Đo môi trường" value={summary.measured} total={summary.active} color="bg-cyan-500" /><Progress label="Lấy mẫu tăng trưởng" value={summary.sampled} total={summary.active} color="bg-indigo-500" /><Progress label="Ao không có cảnh báo" value={summary.optimal} total={summary.active} color="bg-emerald-500" /></div>
          <button type="button" onClick={() => onNavigateTab?.('Môi trường nước')} className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-bold text-white">Kiểm tra dữ liệu còn thiếu <ArrowRight className="h-4 w-4" /></button>
        </Panel>
      </section>

      <Panel title="Tình trạng từng ao" subtitle="Danh sách rút gọn, ưu tiên ao có rủi ro trước">
        <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1">{([['ALL', 'Tất cả'], ['DANGER', 'Nguy hiểm'], ['WARNING', 'Chú ý'], ['OPTIMAL', 'Ổn định'], ['IDLE', 'Ao trống']] as const).map(([value, label]) => <button key={value} type="button" onClick={() => setStatus(value)} className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-bold ${status === value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>{label}</button>)}</div>
          <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2"><Search className="h-4 w-4 text-slate-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm ao..." className="w-40 bg-transparent text-sm outline-none" /></label>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{visibleRows.map((row) => <PondCard key={row.pond.id} row={row} farmName={farmNameOf(row.pond, farms)} onOpen={(tab) => onNavigateTab?.(tab)} />)}</div>
      </Panel>
    </div>
  );
}

function LoadingState() {
  return <div className="mx-auto max-w-[1600px] space-y-5 pb-16" role="status" aria-label="Đang tải tổng quan trang trại">
    <span className="sr-only">Đang tổng hợp tình hình trang trại</span>
    <div className="animate-pulse overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="h-3 w-24 rounded-full bg-blue-100" />
      <div className="mt-4 h-8 w-64 max-w-full rounded-xl bg-slate-200" />
      <div className="mt-3 h-4 w-96 max-w-full rounded-lg bg-slate-100" />
      <div className="mt-6 border-t border-slate-100 pt-4"><div className="h-3 w-36 rounded-full bg-slate-100" /></div>
    </div>
    <section className="space-y-3">
      <div className="animate-pulse"><div className="h-5 w-52 rounded-lg bg-slate-200" /><div className="mt-2 h-3 w-72 max-w-full rounded bg-slate-100" /></div>
      <KpiSkeleton count={5} />
    </section>
    <div className="grid gap-5 xl:grid-cols-2">
      {[0, 1].map((item) => <div key={item} className="animate-pulse rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><div className="h-5 w-44 rounded-lg bg-slate-200" /><div className="mt-2 h-3 w-56 rounded bg-slate-100" /><div className="mt-6 h-56 rounded-2xl bg-slate-100" /></div>)}
    </div>
  </div>;
}

function KpiSkeleton({ count }: { count: number }) {
  return <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">{Array.from({ length: count }, (_, index) => <div key={index} className="animate-pulse rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="h-10 w-10 rounded-xl bg-slate-100" /><div className="mt-3 h-3 w-20 rounded bg-slate-100" /><div className="mt-3 h-7 w-24 rounded-lg bg-slate-200" /><div className="mt-2 h-3 w-28 max-w-full rounded bg-slate-100" /></div>)}</div>;
}

function TableSkeleton() {
  return <div className="animate-pulse space-y-3">{[0, 1, 2].map((row) => <div key={row} className="grid grid-cols-4 gap-4 border-b border-slate-100 py-3"><div className="h-4 rounded bg-slate-200" /><div className="h-4 rounded bg-slate-100" /><div className="h-4 rounded bg-slate-100" /><div className="h-4 rounded bg-slate-100" /></div>)}</div>;
}

function SummaryRow({ label, totals, level, onOpen }: { label: string; totals: ManagerHarvestSummary['totals']; level: 'farm' | 'pond'; onOpen?: () => void }) {
  return <tr className={`border-b border-slate-50 text-sm last:border-0 ${level === 'farm' ? 'bg-slate-50/70' : ''}`}>
    <td className={`py-3.5 ${level === 'farm' ? 'font-black text-slate-900' : 'pl-7 font-semibold text-slate-700'}`}><button type="button" onClick={onOpen} disabled={!onOpen} className="text-left hover:text-blue-600 disabled:cursor-default disabled:hover:text-inherit">{level === 'pond' && <span className="mr-2 text-slate-300">└</span>}{label}{onOpen && <span className="ml-2 text-[10px] font-bold text-blue-500">Xem lịch sử →</span>}</button></td>
    <td className="py-3.5 font-semibold text-slate-600">{totals.harvestedCrops}</td>
    <td className="py-3.5 font-semibold text-slate-700">{totals.harvestKg.toLocaleString('vi-VN')} kg</td>
    <td className="py-3.5 text-slate-700">{formatMoney(totals.revenue)}</td>
    <td className={`py-3.5 font-black ${totals.profit < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{formatMoney(totals.profit)}</td>
    <td className="py-3.5 text-slate-600">{totals.averageFcr ?? '--'}</td>
    <td className="py-3.5 text-slate-600">{totals.averageSurvivalRate !== null ? `${totals.averageSurvivalRate}%` : '--'}</td>
  </tr>;
}

function Panel({ title, subtitle, icon, badge, children }: { title: string; subtitle: string; icon?: React.ReactNode; badge?: string; children: React.ReactNode }) {
  return <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><div className="mb-5 flex items-start justify-between gap-4"><div><h2 className="flex items-center gap-2 text-lg font-black text-slate-900">{icon}{title}</h2><p className="mt-1 text-xs text-slate-500">{subtitle}</p></div>{badge && <span className="rounded-full bg-rose-50 px-3 py-1 text-xs font-bold text-rose-600">{badge}</span>}</div>{children}</article>;
}

function ChartPanel({ title, subtitle, icon, onOpen, children }: { title: string; subtitle: string; icon: React.ReactNode; onOpen: () => void; children: React.ReactNode }) {
  return <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><div className="mb-4 flex items-start justify-between"><div><h2 className="flex items-center gap-2 text-lg font-black text-slate-900">{icon}{title}</h2><p className="mt-1 text-xs text-slate-500">{subtitle}</p></div><button type="button" onClick={onOpen} className="text-xs font-bold text-blue-600">Xem chi tiết</button></div><div className="h-72">{children}</div></article>;
}

function KpiCard({ label, value, note, icon: Icon, tone }: { label: string; value: string | number; note: string; icon: typeof Waves; tone: string }) {
  const colors: Record<string, string> = { blue: 'bg-blue-50 text-blue-600', rose: 'bg-rose-50 text-rose-600', amber: 'bg-amber-50 text-amber-600', emerald: 'bg-emerald-50 text-emerald-600', violet: 'bg-violet-50 text-violet-600' };
  return <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl ${colors[tone]}`}><Icon className="h-5 w-5" /></div><p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{label}</p><p className="mt-1 text-2xl font-black text-slate-900">{value}</p><p className="mt-1 text-xs text-slate-500">{note}</p></article>;
}

function HealthOverview({ summary, onSelect }: { summary: { total: number; danger: number; warning: number; optimal: number; idle: number }; onSelect: (status: HealthStatus) => void }) {
  const items = [{ status: 'OPTIMAL' as const, label: 'Ổn định', count: summary.optimal, color: 'bg-emerald-500', text: 'text-emerald-700' }, { status: 'WARNING' as const, label: 'Cần chú ý', count: summary.warning, color: 'bg-amber-400', text: 'text-amber-700' }, { status: 'DANGER' as const, label: 'Nguy hiểm', count: summary.danger, color: 'bg-rose-500', text: 'text-rose-700' }, { status: 'IDLE' as const, label: 'Ao trống', count: summary.idle, color: 'bg-slate-300', text: 'text-slate-600' }];
  return <><div className="mb-6 flex h-4 overflow-hidden rounded-full bg-slate-100">{summary.total > 0 && items.map((item) => item.count > 0 && <button key={item.status} type="button" onClick={() => onSelect(item.status)} className={item.color} style={{ width: `${item.count / summary.total * 100}%` }} title={`${item.count} ao`} />)}</div><div className="grid grid-cols-2 gap-3">{items.map((item) => <button key={item.status} type="button" onClick={() => onSelect(item.status)} className="rounded-2xl bg-slate-50 p-3 text-left hover:bg-slate-100"><span className="flex items-center gap-2 text-xs font-bold text-slate-500"><span className={`h-2 w-2 rounded-full ${item.color}`} />{item.label}</span><span className={`mt-1 block text-2xl font-black ${item.text}`}>{item.count}</span></button>)}</div></>;
}

function EmptyChart({ message }: { message: string }) {
  return <div className="flex h-full flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 text-center"><Activity className="mb-3 h-8 w-8 text-slate-300" /><p className="max-w-xs text-xs font-semibold text-slate-500">{message}</p></div>;
}

function Progress({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const percent = total ? Math.min(100, Math.round(value / total * 100)) : 0;
  return <div><div className="mb-2 flex justify-between text-sm"><span className="font-bold text-slate-700">{label}</span><span className="text-xs font-semibold text-slate-500">{value}/{total} · {percent}%</span></div><div className="h-2.5 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${color}`} style={{ width: `${percent}%` }} /></div></div>;
}

function PondCard({ row, farmName, onOpen }: { row: PondRow; farmName: string; onOpen: (tab: string) => void }) {
  const styles: Record<HealthStatus, string> = { DANGER: 'border-rose-200 bg-rose-50/40 text-rose-700', WARNING: 'border-amber-200 bg-amber-50/40 text-amber-700', OPTIMAL: 'border-emerald-200 bg-emerald-50/30 text-emerald-700', IDLE: 'border-slate-200 bg-slate-50 text-slate-600' };
  const tab = row.openIncidents.length ? 'Sự cố & Điều trị' : row.latestWq ? 'Môi trường nước' : 'Quản lý Ao/Vụ';
  return <button type="button" onClick={() => onOpen(tab)} className={`rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md ${styles[row.health.status]}`}><div className="flex items-start justify-between gap-3"><div><p className="font-black text-slate-900">{row.pond.name}</p><p className="mt-0.5 text-xs text-slate-500">{farmName}{row.doc !== null ? ` · DOC ${row.doc}` : ''}</p></div><span className="rounded-full bg-white/80 px-2.5 py-1 text-[10px] font-black uppercase">{row.health.label}</span></div><p className="mt-3 text-xs font-semibold">{row.health.reason}</p><div className="mt-4 flex items-center justify-between border-t border-current/10 pt-3 text-xs text-slate-500"><span>{row.latestWq ? `DO ${row.latestWq.dissolvedOxygen} · pH ${row.latestWq.ph}` : 'Chưa đo môi trường'}</span><span className="font-bold text-blue-600">Xem →</span></div></button>;
}
