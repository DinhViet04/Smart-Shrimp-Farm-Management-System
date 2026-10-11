import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Calendar,
  RotateCcw,
  Eye,
  AlertCircle,
  AlertTriangle,
  FileText,
  Filter,
  RefreshCw,
  Clock,
  Building2,
  Waves,
  Layers,
  ChevronDown,
  CheckCircle2,
  Stethoscope,
  Search,
  Package,
  History,
  X,
  Bot,
} from 'lucide-react';
import { incidentService, type Incident, type IncidentStatus, type IncidentUpdate } from '../../services/incident.service';
import { pondService } from '../../services/pond.service';
import { cropService, type Crop } from '../../services/crop.service';
import LoadingMotion from '../../components/LoadingMotion';

interface Farm {
  id: string;
  name: string;
}

interface Pond {
  id: string;
  name: string;
  farmId: string;
}

interface IncidentTreatmentHistoryProps {
  initialFarmId?: string;
  initialPondId?: string;
  currentUserRole?: string;
  currentUserId?: string;
  onOpenWorkspace?: (incident: Incident) => void;
}

const STATUS_LABELS: Record<IncidentStatus, string> = {
  OPEN: 'Chờ xử lý',
  TREATING: 'Đang điều trị',
  RESOLVED: 'Đã xử lý xong',
};

const STATUS_STYLES: Record<IncidentStatus, string> = {
  OPEN: 'bg-amber-50 text-amber-700 border-amber-200',
  TREATING: 'bg-blue-50 text-blue-700 border-blue-200',
  RESOLVED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

const STATUS_CONFIG: Record<
  IncidentStatus,
  {
    label: string;
    badgeStyle: string;
    headerBg: string;
    headerText: string;
    headerBorder: string;
    icon: typeof AlertTriangle;
    emptyText: string;
  }
> = {
  OPEN: {
    label: 'Chờ xử lý',
    badgeStyle: 'bg-amber-50 text-amber-700 border-amber-200',
    headerBg: 'bg-amber-500/10 border-amber-200/80 text-amber-900',
    headerText: 'text-amber-600',
    headerBorder: 'border-amber-200',
    icon: AlertTriangle,
    emptyText: 'Không có sự cố chờ xử lý',
  },
  TREATING: {
    label: 'Đang điều trị',
    badgeStyle: 'bg-blue-50 text-blue-700 border-blue-200',
    headerBg: 'bg-blue-500/10 border-blue-200/80 text-blue-900',
    headerText: 'text-blue-600',
    headerBorder: 'border-blue-200',
    icon: Stethoscope,
    emptyText: 'Không có sự cố đang điều trị',
  },
  RESOLVED: {
    label: 'Đã xử lý xong',
    badgeStyle: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    headerBg: 'bg-emerald-500/10 border-emerald-200/80 text-emerald-900',
    headerText: 'text-emerald-600',
    headerBorder: 'border-emerald-200',
    icon: CheckCircle2,
    emptyText: 'Không có sự cố đã xử lý xong',
  },
};

const ALL_STATUSES: IncidentStatus[] = ['OPEN', 'TREATING', 'RESOLVED'];

export default function IncidentTreatmentHistory({
  initialFarmId,
  initialPondId,
  currentUserRole,
  currentUserId: _currentUserId,
  onOpenWorkspace,
}: IncidentTreatmentHistoryProps) {
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      try {
        setCurrentUser(JSON.parse(userStr));
      } catch (e) {
        console.error(e);
      }
    }
  }, []);

  const isFarmer = currentUser?.role === 'FARMER' || currentUserRole === 'FARMER';

  const themeTextGradientHeader = isFarmer
    ? 'from-teal-700 to-emerald-500'
    : 'from-indigo-900 via-indigo-800 to-purple-600';
  const themeGradientHeader = isFarmer
    ? 'from-teal-500 to-emerald-400'
    : 'from-indigo-600 to-purple-500';
  const themeShadowHeader = isFarmer ? 'shadow-teal-500/30' : 'shadow-indigo-500/30';
  const themeFocusRing = isFarmer
    ? 'focus:border-teal-500 focus:ring-teal-500/10'
    : 'focus:border-indigo-500 focus:ring-indigo-500/10';
  const themeText500 = isFarmer ? 'text-teal-600' : 'text-indigo-600';

  // Master options state
  const [farms, setFarms] = useState<Farm[]>([]);
  const [ponds, setPonds] = useState<Pond[]>([]);
  const [crops, setCrops] = useState<Crop[]>([]);

  // Filter states (Identical to Water Quality History)
  const [selectedFarmId, setSelectedFarmId] = useState(initialFarmId || '');
  const [selectedPondId, setSelectedPondId] = useState(initialPondId || '');
  const [selectedCropId, setSelectedCropId] = useState('');

  const currentYearStr = new Date().getFullYear().toString();
  const [selectedYear, setSelectedYear] = useState('ALL');

  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | IncidentStatus>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Data & Pagination state
  const [rawIncidents, setRawIncidents] = useState<Incident[]>([]);
  const [page, setPage] = useState(0);
  const size = 9;
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Selected incident detail dialog state
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Filtered ponds based on farm selection
  const filteredPonds = useMemo(() => {
    return selectedFarmId ? ponds.filter((p) => p.farmId === selectedFarmId) : ponds;
  }, [ponds, selectedFarmId]);

  // Available years based on crops
  const availableYears = useMemo(() => {
    const yearsSet = new Set<string>();
    yearsSet.add(currentYearStr);
    crops.forEach((c) => {
      if (c.startDate) {
        const y = new Date(c.startDate).getFullYear();
        if (!isNaN(y)) yearsSet.add(y.toString());
      }
    });
    const curY = new Date().getFullYear();
    yearsSet.add((curY - 1).toString());
    yearsSet.add((curY - 2).toString());
    return Array.from(yearsSet).sort((a, b) => b.localeCompare(a));
  }, [crops, currentYearStr]);

  // Available crops based on farm, pond, and year
  const availableCrops = useMemo(() => {
    let list = crops;
    if (selectedFarmId) {
      list = list.filter((c) => {
        const pFarmId = c.pond?.farmId || ponds.find((p) => p.id === c.pondId)?.farmId;
        return pFarmId === selectedFarmId;
      });
    }
    if (selectedPondId) {
      list = list.filter((c) => c.pondId === selectedPondId);
    }
    if (selectedYear !== 'ALL') {
      const yrNum = parseInt(selectedYear, 10);
      list = list.filter((c) => {
        if (!c.startDate) return false;
        const startY = new Date(c.startDate).getFullYear();
        const endY = c.actualHarvestDate ? new Date(c.actualHarvestDate).getFullYear() : startY;
        return yrNum >= startY && yrNum <= endY;
      });
    }
    return list;
  }, [crops, selectedFarmId, selectedPondId, selectedYear, ponds]);

  // Load farms, ponds and crops overview
  useEffect(() => {
    (async () => {
      try {
        const [{ farms: farmsData, ponds: pondsData }, cropsData] = await Promise.all([
          pondService.getOverview(),
          cropService.getAll().catch(() => [] as Crop[]),
        ]);
        setFarms(farmsData || []);
        setPonds(pondsData || []);
        setCrops(cropsData || []);

        if (initialPondId) {
          const found = (pondsData || []).find((p: any) => p.id === initialPondId);
          if (found) {
            setSelectedFarmId(found.farmId);
            setSelectedPondId(initialPondId);
            return;
          }
        }
        if (initialFarmId) {
          setSelectedFarmId(initialFarmId);
        }
      } catch {
        setErrorMsg('Không thể tải thông tin trang trại và ao nuôi');
      }
    })();
  }, [initialFarmId, initialPondId]);

  // Match crop detail helper
  const getCropDetail = useCallback(
    (inc: Incident) => {
      if (!inc.crop) return null;
      const matched = crops.find((c) => c.id === inc.crop.id);
      return {
        id: inc.crop.id,
        startDate: matched?.startDate || inc.crop.startDate,
        stage: matched?.stage || inc.crop.stage || 'COMMERCIAL',
        status: matched?.status || inc.crop.status || 'ACTIVE',
        actualHarvestDate: matched?.actualHarvestDate || inc.crop.actualHarvestDate,
        pondName: inc.crop.pond?.name || 'Ao nuôi',
        farmName: inc.crop.pond?.farm?.name || 'Trang trại',
      };
    },
    [crops]
  );

  // Fetch Incidents History safely
  const fetchIncidentsHistory = useCallback(async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const res = await incidentService.getAll();
      setRawIncidents(res.content || []);
    } catch (err: any) {
      setErrorMsg(err.message || 'Lỗi khi tải lịch sử điều trị sự cố');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchIncidentsHistory();
  }, [fetchIncidentsHistory]);

  // Filter incidents client-side for 100% resilience and instant responsiveness
  const filteredIncidents = useMemo(() => {
    let list = rawIncidents;
    if (selectedFarmId) {
      list = list.filter(
        (inc) =>
          inc.crop?.pond?.farm?.id === selectedFarmId ||
          inc.crop?.pond?.farm?.name === farms.find((f) => f.id === selectedFarmId)?.name
      );
    }
    if (selectedPondId) {
      list = list.filter((inc) => inc.crop?.pond?.id === selectedPondId);
    }
    if (selectedCropId) {
      list = list.filter((inc) => inc.crop?.id === selectedCropId);
    }
    if (statusFilter !== 'ALL') {
      list = list.filter((inc) => inc.status === statusFilter);
    }
    if (selectedYear !== 'ALL') {
      const yNum = parseInt(selectedYear, 10);
      list = list.filter((inc) => {
        const incDate = new Date(inc.createdAt);
        return incDate.getFullYear() === yNum;
      });
    }
    if (fromDate) {
      const fTime = new Date(fromDate).getTime();
      list = list.filter((inc) => new Date(inc.createdAt).getTime() >= fTime);
    }
    if (toDate) {
      const tTime = new Date(toDate).getTime() + 86400000;
      list = list.filter((inc) => new Date(inc.createdAt).getTime() <= tTime);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(
        (inc) =>
          inc.title?.toLowerCase().includes(q) ||
          inc.description?.toLowerCase().includes(q) ||
          inc.treatment?.toLowerCase().includes(q) ||
          inc.assignedTo?.fullName?.toLowerCase().includes(q) ||
          inc.reporter?.fullName?.toLowerCase().includes(q) ||
          inc.updates?.some((u) => u.treatment?.toLowerCase().includes(q))
      );
    }
    return list;
  }, [
    rawIncidents,
    selectedFarmId,
    selectedPondId,
    selectedCropId,
    statusFilter,
    selectedYear,
    fromDate,
    toDate,
    searchQuery,
    farms,
  ]);

  const totalElements = filteredIncidents.length;

  const handleResetFilters = () => {
    setSelectedFarmId('');
    setSelectedYear('ALL');
    setSelectedPondId('');
    setSelectedCropId('');
    setFromDate('');
    setToDate('');
    setStatusFilter('ALL');
    setSearchQuery('');
    setPage(0);
  };

  // Open full details dialog
  const handleOpenIncidentDetail = async (inc: Incident) => {
    setSelectedIncident(inc);
    setLoadingDetail(true);
    try {
      const fullDetail = await incidentService.getById(inc.id);
      setSelectedIncident(fullDetail);
    } catch {
      // Keep existing data if detail fetch fails
    } finally {
      setLoadingDetail(false);
    }
  };

  // Quick statistics calculation
  const stats = useMemo(() => {
    const total = filteredIncidents.length;
    const resolved = filteredIncidents.filter((i) => i.status === 'RESOLVED').length;
    const treating = filteredIncidents.filter((i) => i.status === 'TREATING').length;
    const open = filteredIncidents.filter((i) => i.status === 'OPEN').length;
    const totalUpdates = filteredIncidents.reduce((acc, curr) => acc + (curr._count?.updates || curr.updates?.length || 0), 0);
    return { total, resolved, treating, open, totalUpdates };
  }, [filteredIncidents]);

  const formatDate = (iso: string) => {
    if (!iso) return '-';
    try {
      const d = new Date(iso);
      return d.toLocaleString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return iso;
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Header Banner ──────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/80 backdrop-blur-xl p-6 rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100">
        <div className="flex items-center gap-4">
          <div
            className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${themeGradientHeader} flex items-center justify-center text-white shadow-lg ${themeShadowHeader}`}
          >
            <History className="w-6 h-6" />
          </div>
          <div>
            <h2 className={`text-xl font-bold bg-gradient-to-r ${themeTextGradientHeader} bg-clip-text text-transparent`}>
              Lịch Sử Điều Trị Sự Cố
            </h2>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Theo dõi toàn bộ nhật ký xử lý, thuốc & hóa chất xuất kho, tiến trình phục hồi theo trang trại, ao và từng vụ nuôi
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchIncidentsHistory}
            className="flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition-all cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 text-slate-500 ${isLoading ? 'animate-spin' : ''}`} /> Làm mới dữ liệu
          </button>
        </div>
      </div>

      {/* ── Quick KPI Stat Chips ───────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
            <Stethoscope className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Tổng sự cố</span>
            <span className="text-lg font-black text-slate-800">{stats.total}</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Đang điều trị</span>
            <span className="text-lg font-black text-amber-700">{stats.treating}</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Đã xử lý xong</span>
            <span className="text-lg font-black text-emerald-700">{stats.resolved}</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
            <Package className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Lần ghi nhận</span>
            <span className="text-lg font-black text-purple-700">{stats.totalUpdates}</span>
          </div>
        </div>
      </div>

      {/* ── Bộ Lọc Tìm Kiếm (Tương tự như phần môi trường nước) ───────────────── */}
      <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-500" /> Bộ Lọc Tìm Kiếm Chi Tiết
          </span>
          {(selectedFarmId ||
            selectedYear !== 'ALL' ||
            selectedPondId ||
            selectedCropId ||
            fromDate ||
            toDate ||
            statusFilter !== 'ALL' ||
            searchQuery) && (
            <button
              onClick={handleResetFilters}
              className="text-xs font-semibold text-rose-600 hover:text-rose-700 flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Đặt lại bộ lọc
            </button>
          )}
        </div>

        {/* Grid 6 columns identical to WaterQualityHistory */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
          {/* 1. Lọc theo Năm */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-bold text-slate-600 mb-1">
              <Calendar className="w-3.5 h-3.5 text-blue-600" />
              Năm
            </label>
            <div className="relative">
              <select
                value={selectedYear}
                onChange={(e) => {
                  const yr = e.target.value;
                  setSelectedYear(yr);
                  if (selectedCropId) {
                    const c = crops.find((item) => item.id === selectedCropId);
                    if (c && yr !== 'ALL') {
                      const cYr = new Date(c.startDate).getFullYear().toString();
                      if (cYr !== yr) setSelectedCropId('');
                    }
                  }
                  setPage(0);
                }}
                className={`w-full px-3 py-2 text-xs font-bold rounded-xl border border-slate-200 bg-slate-50 text-slate-800 outline-none appearance-none pr-8 cursor-pointer ${themeFocusRing}`}
              >
                <option value="ALL">Tất cả các năm</option>
                {availableYears.map((yr) => (
                  <option key={yr} value={yr}>
                    {yr === currentYearStr ? `Năm ${yr} (Hiện tại)` : `Năm ${yr}`}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* 2. Lọc theo Trang trại */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-bold text-slate-600 mb-1">
              <Building2 className="w-3.5 h-3.5 text-emerald-600" />
              Trang trại
            </label>
            <div className="relative">
              <select
                value={selectedFarmId}
                onChange={(e) => {
                  setSelectedFarmId(e.target.value);
                  setSelectedPondId('');
                  setSelectedCropId('');
                  setPage(0);
                }}
                className={`w-full px-3 py-2 text-xs font-bold rounded-xl border border-slate-200 bg-slate-50 text-slate-800 outline-none appearance-none pr-8 cursor-pointer ${themeFocusRing}`}
              >
                <option value="">Tất cả trang trại</option>
                {farms.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* 3. Lọc theo Ao nuôi */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-bold text-slate-600 mb-1">
              <Waves className="w-3.5 h-3.5 text-cyan-600" />
              Ao nuôi
            </label>
            <div className="relative">
              <select
                value={selectedPondId}
                onChange={(e) => {
                  const pId = e.target.value;
                  setSelectedPondId(pId);
                  if (selectedCropId) {
                    const c = crops.find((item) => item.id === selectedCropId);
                    if (c && pId && c.pondId !== pId) setSelectedCropId('');
                  }
                  setPage(0);
                }}
                className={`w-full px-3 py-2 text-xs font-bold rounded-xl border border-slate-200 bg-slate-50 text-slate-800 outline-none appearance-none pr-8 cursor-pointer ${themeFocusRing}`}
              >
                <option value="">Tất cả ao</option>
                {filteredPonds.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* 4. Lọc theo Vụ nuôi */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-bold text-slate-600 mb-1">
              <Layers className="w-3.5 h-3.5 text-indigo-600" />
              Vụ nuôi
            </label>
            <div className="relative">
              <select
                value={selectedCropId}
                onChange={(e) => {
                  const cId = e.target.value;
                  setSelectedCropId(cId);
                  if (cId) {
                    const c = crops.find((item) => item.id === cId);
                    if (c) {
                      if (c.pondId) setSelectedPondId(c.pondId);
                      const fId = c.pond?.farmId || ponds.find((p) => p.id === c.pondId)?.farmId;
                      if (fId) setSelectedFarmId(fId);
                    }
                  }
                  setPage(0);
                }}
                className={`w-full px-3 py-2 text-xs font-bold rounded-xl border border-slate-200 bg-slate-50 text-slate-800 outline-none appearance-none pr-8 cursor-pointer ${themeFocusRing}`}
              >
                <option value="">Tất cả vụ nuôi</option>
                {availableCrops.map((c, idx) => {
                  const pName = c.pond?.name || ponds.find((p) => p.id === c.pondId)?.name || 'Ao';
                  const stage = c.stage === 'NURSERY' ? 'Ương' : 'Thương phẩm';
                  const dStr = c.startDate ? new Date(c.startDate).toLocaleDateString('vi-VN') : '';
                  const statusLabel = c.status === 'ACTIVE' ? '🟢 Đang nuôi' : '⚪ Đã thu';
                  return (
                    <option key={c.id} value={c.id}>
                      {pName} - Vụ {idx + 1} ({stage}) [{statusLabel}] - {dStr}
                    </option>
                  );
                })}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* 5. Từ ngày */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-bold text-slate-600 mb-1">
              <Calendar className="w-3.5 h-3.5 text-slate-500" />
              Từ ngày
            </label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => {
                setFromDate(e.target.value);
                setPage(0);
              }}
              className={`w-full px-3 py-2 text-xs font-bold rounded-xl border border-slate-200 bg-slate-50 text-slate-800 outline-none cursor-pointer ${themeFocusRing}`}
            />
          </div>

          {/* 6. Đến ngày */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-bold text-slate-600 mb-1">
              <Calendar className="w-3.5 h-3.5 text-slate-500" />
              Đến ngày
            </label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => {
                setToDate(e.target.value);
                setPage(0);
              }}
              className={`w-full px-3 py-2 text-xs font-bold rounded-xl border border-slate-200 bg-slate-50 text-slate-800 outline-none cursor-pointer ${themeFocusRing}`}
            />
          </div>
        </div>

        {/* Extra row: Search input & Status dropdown */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 pt-1 border-t border-slate-100/80">
          <div className="relative md:col-span-2">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(0);
              }}
              placeholder="Tìm theo tiêu đề sự cố, triệu chứng, người phụ trách hoặc tên thuốc..."
              className={`w-full pl-10 pr-4 py-2.5 text-xs font-semibold rounded-xl border border-slate-200 bg-slate-50 text-slate-800 outline-none ${themeFocusRing}`}
            />
          </div>

          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as any);
                setPage(0);
              }}
              className={`w-full px-3.5 py-2.5 text-xs font-bold rounded-xl border border-slate-200 bg-slate-50 text-slate-800 outline-none appearance-none pr-8 cursor-pointer ${themeFocusRing}`}
            >
              <option value="ALL">Tất cả trạng thái điều trị</option>
              <option value="OPEN">Chờ xử lý</option>
              <option value="TREATING">Đang điều trị</option>
              <option value="RESOLVED">Đã xử lý xong</option>
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* ── Main Content: Cards Grid ───────────────────────────────────────── */}
      {isLoading ? (
        <LoadingMotion
          mode="card"
          title="Đang tải lịch sử điều trị sự cố..."
          subtitle="Đang tổng hợp các đợt điều trị, nhật ký xuất kho và cập nhật tiến trình từ các trang trại..."
          icon={<History className="w-10 h-10 text-indigo-600 animate-spin-slow" />}
          color="indigo"
        />
      ) : errorMsg ? (
        <div className="bg-red-50 p-6 rounded-3xl border border-red-200 text-red-700 text-center space-y-2">
          <AlertCircle className="w-8 h-8 mx-auto text-red-500" />
          <p className="text-sm font-bold">{errorMsg}</p>
        </div>
      ) : filteredIncidents.length === 0 ? (
        <div className="bg-white p-12 rounded-3xl shadow-sm border border-slate-100 text-center space-y-3">
          <FileText className="w-12 h-12 mx-auto text-slate-300" />
          <h3 className="text-base font-bold text-slate-700">Chưa tìm thấy dữ liệu điều trị sự cố</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Không có sự cố nào khớp với bộ lọc hiện tại. Bạn hãy thử chọn lại năm, trang trại hoặc khoảng thời gian khác.
          </p>
        </div>
      ) : (
        (() => {
          const visibleStatuses: IncidentStatus[] =
            statusFilter !== 'ALL' ? [statusFilter] : ALL_STATUSES;

          return (
            <div
              className={`grid gap-6 ${
                visibleStatuses.length === 1
                  ? 'grid-cols-1 max-w-2xl mx-auto'
                  : 'grid-cols-1 lg:grid-cols-3'
              }`}
            >
              {visibleStatuses.map((statusKey) => {
                const config = STATUS_CONFIG[statusKey];
                const StatusIcon = config.icon;
                const statusItems = filteredIncidents.filter((inc) => inc.status === statusKey);

                return (
                  <div
                    key={statusKey}
                    className="flex flex-col rounded-3xl border border-slate-200/80 bg-slate-50/60 p-4 sm:p-5 shadow-sm backdrop-blur-xl min-h-[500px]"
                  >
                    {/* Header Cột / Thẻ Dọc Trạng Thái */}
                    <div
                      className={`flex items-center justify-between rounded-2xl border ${config.headerBorder} ${config.headerBg} p-3.5 mb-4 shadow-xs`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`flex h-9 w-9 items-center justify-center rounded-xl bg-white shadow-xs ${config.headerText}`}
                        >
                          <StatusIcon className="h-5 w-5" />
                        </div>
                        <div>
                          <h3 className="font-extrabold text-slate-800 text-base leading-tight">
                            {config.label}
                          </h3>
                          <span className="text-xs font-medium text-slate-500">
                            {statusItems.length} sự cố
                          </span>
                        </div>
                      </div>
                      <span
                        className={`rounded-full border px-3 py-1 text-xs font-bold ${config.badgeStyle}`}
                      >
                        {statusItems.length}
                      </span>
                    </div>

                    {/* Danh Sách Thẻ Sự Cố Theo Trạng Thái */}
                    <div className="flex-1 space-y-4">
                      {statusItems.length === 0 ? (
                        <div className="flex h-52 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white/70 p-6 text-center">
                          <StatusIcon className="mb-2.5 h-8 w-8 text-slate-300" />
                          <p className="text-sm font-bold text-slate-400">{config.emptyText}</p>
                        </div>
                      ) : (
                        statusItems.map((inc) => {
                          const cropInfo = getCropDetail(inc);
                          const latestUpdate = inc.updates?.[0];

                          return (
                            <div
                              key={inc.id}
                              onClick={() => handleOpenIncidentDetail(inc)}
                              className={`w-full group rounded-2xl border border-white/80 bg-white p-4 sm:p-5 text-left shadow-sm shadow-slate-200/60 backdrop-blur-lg transition-all duration-300 hover:-translate-y-1 hover:shadow-lg ${
                                isFarmer
                                  ? 'hover:border-teal-300 hover:shadow-teal-500/10'
                                  : 'hover:border-indigo-300 hover:shadow-indigo-500/10'
                              } cursor-pointer space-y-3.5`}
                            >
                              {/* Top Header: Date/Time & Status */}
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-400">
                                  <Calendar className={`w-3.5 h-3.5 ${themeText500}`} />
                                  <span>{formatDate(inc.createdAt)}</span>
                                </div>
                                <span
                                  className={`px-2.5 py-0.5 text-[11px] font-bold rounded-full border ${STATUS_STYLES[inc.status]}`}
                                >
                                  {STATUS_LABELS[inc.status]}
                                </span>
                              </div>

                              {/* Title & Description */}
                              <div>
                                <h4
                                  className={`text-base font-extrabold text-slate-800 ${
                                    isFarmer ? 'group-hover:text-teal-600' : 'group-hover:text-indigo-600'
                                  } transition-colors line-clamp-2 leading-snug`}
                                >
                                  {inc.title}
                                </h4>
                                <p className="mt-1 text-xs font-medium text-slate-500 line-clamp-2 leading-relaxed">
                                  {inc.description}
                                </p>
                              </div>

                              {/* RÕ THÔNG TIN TRANG TRẠI - AO - VỤ NUÔI */}
                              <div className="bg-slate-50/80 p-3 rounded-2xl border border-slate-100 space-y-2">
                                <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-bold">
                                  {/* Trang trại */}
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-emerald-50 text-emerald-800 rounded-lg border border-emerald-200">
                                    <Building2 className="w-3 h-3 text-emerald-600" />
                                    <span>
                                      Trang trại: <strong>{inc.crop?.pond?.farm?.name || 'Trang trại'}</strong>
                                    </span>
                                  </span>

                                  {/* Ao nuôi */}
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-cyan-50 text-cyan-800 rounded-lg border border-cyan-200">
                                    <Waves className="w-3 h-3 text-cyan-600" />
                                    <span>
                                      Ao: <strong>{inc.crop?.pond?.name || 'Ao nuôi'}</strong>
                                    </span>
                                  </span>
                                </div>

                                {/* Vụ nuôi */}
                                {cropInfo && (
                                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-indigo-700 bg-indigo-50/70 px-2.5 py-1 rounded-lg border border-indigo-100">
                                    <Layers className="w-3 h-3 text-indigo-500 shrink-0" />
                                    <span className="truncate">
                                      Vụ: {cropInfo.stage === 'NURSERY' ? 'Ương' : 'Thương phẩm'}{' '}
                                      {cropInfo.status === 'ACTIVE' ? '(Đang nuôi)' : '(Đã thu)'} • Bắt đầu:{' '}
                                      {new Date(cropInfo.startDate).toLocaleDateString('vi-VN')}
                                    </span>
                                  </div>
                                )}
                              </div>

                              {/* Người phụ trách & Cập nhật gần nhất */}
                              <div className="space-y-1.5 text-xs border-t border-slate-100 pt-2.5">
                                <div className="flex items-center justify-between text-slate-500">
                                  <span>Phụ trách:</span>
                                  <strong className="text-slate-700">
                                    {inc.assignedTo?.fullName || 'Chưa phân công'}
                                  </strong>
                                </div>

                                {(latestUpdate || inc.treatment) && (
                                  <div className="rounded-xl bg-indigo-50/50 p-2 border border-indigo-100/60">
                                    <span className="text-[10px] font-bold text-indigo-800 uppercase tracking-wide block mb-0.5">
                                      Điều trị gần nhất:
                                    </span>
                                    <p className="text-[11px] font-semibold text-slate-700 line-clamp-1">
                                      {latestUpdate?.treatment || inc.treatment}
                                    </p>
                                  </div>
                                )}
                              </div>

                              {/* Card Footer: View Detail */}
                              <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[11px]">
                                <span className="font-bold text-slate-400">
                                  {inc._count?.updates ?? inc.updates?.length ?? 0} nhật ký cập nhật
                                </span>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenIncidentDetail(inc);
                                  }}
                                  className={`font-bold ${
                                    isFarmer ? 'text-teal-600 hover:text-teal-700' : 'text-indigo-600 hover:text-indigo-700'
                                  } flex items-center gap-1 group-hover:translate-x-0.5 transition-transform cursor-pointer`}
                                >
                                  <Eye className="w-3.5 h-3.5" /> Xem chi tiết
                                </button>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })()
      )}

      {/* ── Dialog Xem Chi Tiết Sự Cố & Lịch Sử Điều Trị Đầy Đủ ─────────────── */}
      {selectedIncident && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/60 p-4 sm:p-6 backdrop-blur-md animate-in fade-in duration-200">
          <div className="flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-white/60 bg-white shadow-2xl backdrop-blur-xl animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex shrink-0 items-start justify-between border-b border-slate-100 bg-slate-50/90 px-6 py-4">
              <div>
                <div className="flex items-center gap-3">
                  <h3 className="text-xl font-black text-slate-800">{selectedIncident.title}</h3>
                  <span
                    className={`rounded-full border px-3 py-1 text-xs font-bold ${
                      STATUS_STYLES[selectedIncident.status]
                    }`}
                  >
                    {STATUS_LABELS[selectedIncident.status]}
                  </span>
                </div>

                {/* THỂ HIỆN RÕ TRANG TRẠI - AO - VỤ NUÔI NGAY Ở HEADER MODAL */}
                <div className="mt-2.5 flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold shadow-2xs">
                    <Building2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>
                      Trang trại: <strong>{selectedIncident.crop?.pond?.farm?.name || 'Trang trại'}</strong>
                    </span>
                  </span>

                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-cyan-50 text-cyan-800 border border-cyan-200 text-xs font-bold shadow-2xs">
                    <Waves className="w-3.5 h-3.5 text-cyan-600" />
                    <span>
                      Ao nuôi: <strong>{selectedIncident.crop?.pond?.name || 'Ao nuôi'}</strong>
                    </span>
                  </span>

                  {(() => {
                    const cInfo = getCropDetail(selectedIncident);
                    if (!cInfo) return null;
                    return (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-indigo-50 text-indigo-800 border border-indigo-200 text-xs font-bold shadow-2xs">
                        <Layers className="w-3.5 h-3.5 text-indigo-600" />
                        <span>
                          Vụ nuôi:{' '}
                          <strong>{cInfo.stage === 'NURSERY' ? 'Vụ Ương' : 'Vụ Thương phẩm'}</strong> (
                          {cInfo.status === 'ACTIVE' ? 'Đang nuôi' : 'Đã thu'}) • Bắt đầu:{' '}
                          {new Date(cInfo.startDate).toLocaleDateString('vi-VN')}
                        </span>
                      </span>
                    );
                  })()}
                </div>
              </div>

              <button
                onClick={() => setSelectedIncident(null)}
                className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto space-y-6 p-6">
              {/* Card 1: Thông tin mô tả & Nhân sự */}
              <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600 space-y-3 border border-slate-100">
                <div>
                  <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider block">
                    Mô tả sự cố ban đầu
                  </span>
                  <p className="mt-1 text-slate-800 font-semibold leading-relaxed">
                    {selectedIncident.description}
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-200/70 text-xs">
                  <div>
                    <span className="text-slate-400">Người báo cáo:</span>
                    <p className="mt-0.5 font-bold text-slate-700">
                      {selectedIncident.reporter?.fullName || 'Nông dân/Kỹ thuật viên'}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-400">Phụ trách điều trị:</span>
                    <p className="mt-0.5 font-bold text-indigo-600">
                      {selectedIncident.assignedTo?.fullName || 'Chưa phân công'}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-400">Thời điểm phát hiện:</span>
                    <p className="mt-0.5 font-bold text-slate-700">
                      {formatDate(selectedIncident.createdAt)}
                    </p>
                  </div>
                  {selectedIncident.resolvedAt && (
                    <div>
                      <span className="text-slate-400">Thời điểm xử lý xong:</span>
                      <p className="mt-0.5 font-bold text-emerald-600">
                        {formatDate(selectedIncident.resolvedAt)}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Card 2: Dòng thời gian tiến trình điều trị */}
              <div>
                <h4 className="mb-3 flex items-center gap-2 font-black text-slate-800 text-sm">
                  <Clock className="h-4 w-4 text-indigo-500" /> Toàn bộ tiến trình điều trị & Xuất kho (
                  {selectedIncident.updates?.length || 0})
                </h4>

                {loadingDetail ? (
                  <div className="flex items-center gap-2 rounded-2xl bg-slate-50 p-4 text-sm font-semibold text-slate-500">
                    <RefreshCw className="h-4 w-4 animate-spin text-indigo-500" /> Đang tải chi tiết tiến trình...
                  </div>
                ) : selectedIncident.updates && selectedIncident.updates.length > 0 ? (
                  <div className="space-y-3 border-l-2 border-indigo-100 pl-5">
                    {selectedIncident.updates.map((upd: IncidentUpdate) => (
                      <div key={upd.id} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-xs">
                        <div className="flex justify-between gap-3 text-xs">
                          <strong className="text-slate-800 font-bold">
                            {upd.author?.fullName || 'Kỹ thuật viên'}
                          </strong>
                          <span className="text-slate-400">{formatDate(upd.createdAt)}</span>
                        </div>
                        <p className="mt-2 text-sm text-slate-700 font-medium leading-relaxed">
                          <strong>
                            {upd.eventType === 'TREATMENT' || upd.eventType === 'RESOLVED'
                              ? 'Điều trị'
                              : 'Sự kiện'}
                            :
                          </strong>{' '}
                          {upd.treatment}
                        </p>
                        {upd.observation && (
                          <p className="mt-1 text-xs text-slate-500 italic">
                            <strong>Quan sát:</strong> {upd.observation}
                          </p>
                        )}
                        {upd.result && (
                          <p className="mt-1 text-xs text-emerald-600 font-semibold">
                            <strong>Kết quả:</strong> {upd.result}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">Chưa có cập nhật điều trị nào được ghi nhận.</p>
                )}
              </div>

              {/* Action: Open AI Treatment Workspace */}
              {onOpenWorkspace && (
                <div className="pt-2">
                  <button
                    onClick={() => {
                      const inc = selectedIncident;
                      setSelectedIncident(null);
                      onOpenWorkspace(inc);
                    }}
                    className="w-full flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-600 to-blue-600 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-500/25 hover:from-indigo-700 hover:to-blue-700 transition-all cursor-pointer"
                  >
                    <Bot className="h-4 w-4 text-cyan-300" /> Mở trang điều trị & Phân tích AI (Kho vật tư)
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
