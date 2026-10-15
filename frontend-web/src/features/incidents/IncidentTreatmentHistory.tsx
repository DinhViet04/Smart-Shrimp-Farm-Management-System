import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Calendar,
  RotateCcw,
  Eye,
  AlertCircle,
  FileText,
  Filter,
  RefreshCw,
  Clock,
  Building2,
  Waves,
  Layers,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Search,
  Package,
  History,
  X,
  Bot,
} from 'lucide-react';
import { incidentService, type Incident, type IncidentStatus, type IncidentUpdate } from '../../services/incident.service';
import { pondService } from '../../services/pond.service';
import { cropService, type Crop } from '../../services/crop.service';
import {
  groupCropsIntoSeasons,
  findSeasonByCropId,
} from '../../utils/cropGrouping';
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
  TREATING: 'Chờ xử lý',
  RESOLVED: 'Đã xử lý',
};

const STATUS_STYLES: Record<IncidentStatus, string> = {
  OPEN: 'bg-amber-50 text-amber-700 border-amber-200',
  TREATING: 'bg-amber-50 text-amber-700 border-amber-200',
  RESOLVED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

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

  // Filter states
  const [selectedFarmId, setSelectedFarmId] = useState(initialFarmId || '');
  const [selectedPondId, setSelectedPondId] = useState(initialPondId || '');
  const [selectedCropId, setSelectedCropId] = useState('');

  const currentYearStr = new Date().getFullYear().toString();
  const [selectedYear, setSelectedYear] = useState('ALL');

  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Data & Pagination state
  const [rawIncidents, setRawIncidents] = useState<Incident[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 9;
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

  // Danh sách toàn bộ Vụ nuôi được gom nhóm chuẩn (Vụ 1 = 2025, Vụ 2, Vụ 3, Vụ 4 = 2026)
  const allSeasons = useMemo(() => {
    return groupCropsIntoSeasons(crops, { sortOrder: 'asc' });
  }, [crops]);

  // Available seasons based on farm, pond, and year
  const availableSeasons = useMemo(() => {
    return groupCropsIntoSeasons(crops, {
      sortOrder: 'asc',
      farmId: selectedFarmId || undefined,
      pondId: selectedPondId || undefined,
      year: selectedYear !== 'ALL' ? selectedYear : undefined,
    });
  }, [crops, selectedFarmId, selectedPondId, selectedYear]);

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
      const matchedSeason = allSeasons.find((s) => s.cropIds.includes(inc.crop.id));
      return {
        id: inc.crop.id,
        seasonName: matchedSeason?.seasonName,
        startDate: matched?.startDate || inc.crop.startDate,
        stage: matched?.stage || inc.crop.stage || 'COMMERCIAL',
        status: matched?.status || inc.crop.status || 'ACTIVE',
        actualHarvestDate: matched?.actualHarvestDate || inc.crop.actualHarvestDate,
        pondName: inc.crop.pond?.name || 'Ao nuôi',
        farmName: inc.crop.pond?.farm?.name || 'Trang trại',
      };
    },
    [crops, allSeasons]
  );

  // Fetch Incidents History safely
  // Fetch Incidents History safely (chỉ lấy các sự cố ĐÃ XỬ LÝ)
  const fetchIncidentsHistory = useCallback(async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const res = await incidentService.getAll();
      const allIncidents: Incident[] = res.content || [];
      const resolvedOnly = allIncidents.filter((inc) => inc.status === 'RESOLVED');
      setRawIncidents(resolvedOnly);
    } catch (err: any) {
      setErrorMsg(err.message || 'Lỗi khi tải lịch sử điều trị sự cố');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchIncidentsHistory();
  }, [fetchIncidentsHistory]);

  // Filter incidents client-side (toàn bộ là sự cố ĐÃ XỬ LÝ)
  const filteredIncidents = useMemo(() => {
    let list = rawIncidents.filter((inc) => inc.status === 'RESOLVED');
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
    if (selectedYear !== 'ALL') {
      const yNum = parseInt(selectedYear, 10);
      list = list.filter((inc) => {
        const dateToCheck = inc.resolvedAt || inc.createdAt;
        const incDate = new Date(dateToCheck);
        return incDate.getFullYear() === yNum;
      });
    }
    if (fromDate) {
      const fTime = new Date(fromDate).getTime();
      list = list.filter((inc) => new Date(inc.resolvedAt || inc.createdAt).getTime() >= fTime);
    }
    if (toDate) {
      const tTime = new Date(toDate).getTime() + 86400000;
      list = list.filter((inc) => new Date(inc.resolvedAt || inc.createdAt).getTime() <= tTime);
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
    selectedYear,
    fromDate,
    toDate,
    searchQuery,
    farms,
  ]);

  const handleResetFilters = () => {
    setSelectedFarmId('');
    setSelectedYear('ALL');
    setSelectedPondId('');
    setSelectedCropId('');
    setFromDate('');
    setToDate('');
    setSearchQuery('');
    setCurrentPage(1);
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

  // Quick statistics calculation for completed history
  const stats = useMemo(() => {
    const total = filteredIncidents.length;
    const pondSet = new Set<string>();
    const cropSet = new Set<string>();
    filteredIncidents.forEach((i) => {
      if (i.crop?.pond?.id) pondSet.add(i.crop.pond.id);
      if (i.crop?.id) cropSet.add(i.crop.id);
    });
    const totalUpdates = filteredIncidents.reduce(
      (acc, curr) => acc + (curr._count?.updates || curr.updates?.length || 0),
      0
    );
    return {
      total,
      uniquePonds: pondSet.size,
      uniqueCrops: cropSet.size,
      totalUpdates,
    };
  }, [filteredIncidents]);

  const totalPages = Math.max(1, Math.ceil(filteredIncidents.length / PAGE_SIZE));
  const paginatedIncidents = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredIncidents.slice(start, start + PAGE_SIZE);
  }, [filteredIncidents, currentPage, PAGE_SIZE]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(1);
    }
  }, [totalPages, currentPage]);

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

      {/* ── Quick KPI Stat Chips (Lịch sử đã xử lý) ───────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Sự cố đã xử lý</span>
            <span className="text-lg font-black text-emerald-700">{stats.total}</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-50 text-cyan-600 flex items-center justify-center font-bold">
            <Waves className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Ao nuôi khắc phục</span>
            <span className="text-lg font-black text-cyan-700">{stats.uniquePonds}</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Vụ nuôi liên quan</span>
            <span className="text-lg font-black text-indigo-700">{stats.uniqueCrops}</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
            <Package className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Nhật ký điều trị</span>
            <span className="text-lg font-black text-purple-700">{stats.totalUpdates}</span>
          </div>
        </div>
      </div>

      {/* ── Bộ Lọc Tìm Kiếm Chi Tiết ────────────────────────────────────────── */}
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
            searchQuery) && (
            <button
              onClick={handleResetFilters}
              className="text-xs font-semibold text-rose-600 hover:text-rose-700 flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Đặt lại bộ lọc
            </button>
          )}
        </div>

        {/* Grid 6 columns */}
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
                  setCurrentPage(1);
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
                  setCurrentPage(1);
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
                    const season = findSeasonByCropId(allSeasons, selectedCropId);
                    if (season && pId && !season.pondIds.includes(pId)) setSelectedCropId('');
                  }
                  setCurrentPage(1);
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
                    const season = findSeasonByCropId(allSeasons, cId);
                    if (season) {
                      if (season.farmId) setSelectedFarmId(season.farmId);
                      if (selectedPondId && !season.pondIds.includes(selectedPondId)) {
                        setSelectedPondId('');
                      }
                    }
                  }
                  setCurrentPage(1);
                }}
                className={`w-full px-3 py-2 text-xs font-bold rounded-xl border border-slate-200 bg-slate-50 text-slate-800 outline-none appearance-none pr-8 cursor-pointer ${themeFocusRing}`}
              >
                <option value="">Tất cả vụ nuôi</option>
                {availableSeasons.map((season) => (
                  <option key={season.rootCropId} value={season.rootCropId}>
                    {season.displayLabel}
                  </option>
                ))}
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
                setCurrentPage(1);
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
                setCurrentPage(1);
              }}
              className={`w-full px-3 py-2 text-xs font-bold rounded-xl border border-slate-200 bg-slate-50 text-slate-800 outline-none cursor-pointer ${themeFocusRing}`}
            />
          </div>
        </div>

        {/* Extra row: Search input full width (Đã bỏ filter trạng thái) */}
        <div className="pt-1 border-t border-slate-100/80">
          <div className="relative w-full">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Tìm kiếm sự cố đã xử lý theo tiêu đề, triệu chứng, người phụ trách, thuốc hoặc phác đồ..."
              className={`w-full pl-10 pr-4 py-2.5 text-xs font-semibold rounded-xl border border-slate-200 bg-slate-50 text-slate-800 outline-none ${themeFocusRing}`}
            />
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
        <div className="space-y-6">
          {/* Grid 3 cột các thẻ sự cố đã xử lý */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {paginatedIncidents.map((inc) => {
              const cropInfo = getCropDetail(inc);
              const latestUpdate = inc.updates?.[0];
              const resolvedDate = inc.resolvedAt || inc.updatedAt || inc.createdAt;

              return (
                <div
                  key={inc.id}
                  onClick={() => handleOpenIncidentDetail(inc)}
                  className={`w-full group rounded-3xl border border-slate-100 bg-white p-5 text-left shadow-sm shadow-slate-200/50 backdrop-blur-lg transition-all duration-300 hover:-translate-y-1 hover:shadow-xl ${
                    isFarmer
                      ? 'hover:border-teal-300 hover:shadow-teal-500/10'
                      : 'hover:border-indigo-300 hover:shadow-indigo-500/10'
                  } cursor-pointer flex flex-col justify-between space-y-4`}
                >
                  <div className="space-y-3.5">
                    {/* Header: Ngày hoàn thành & Badge Đã xử lý */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-400">
                        <Calendar className={`w-3.5 h-3.5 ${themeText500}`} />
                        <span>{formatDate(resolvedDate)}</span>
                      </div>
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-[11px] font-bold rounded-full border bg-emerald-50 text-emerald-700 border-emerald-200">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        Đã xử lý
                      </span>
                    </div>

                    {/* Tiêu đề & Mô tả */}
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

                    {/* Thông tin Trang trại - Ao nuôi - Vụ nuôi */}
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
                            {cropInfo.seasonName ? `${cropInfo.seasonName} · ` : ''}
                            {cropInfo.stage === 'NURSERY' ? 'Vụ Ương' : 'Vụ Thương phẩm'}{' '}
                            {cropInfo.status === 'ACTIVE' ? '(Đang nuôi)' : '(Đã thu)'} • Bắt đầu:{' '}
                            {new Date(cropInfo.startDate).toLocaleDateString('vi-VN')}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Người phụ trách & Phác đồ điều trị */}
                    <div className="space-y-1.5 text-xs border-t border-slate-100 pt-2.5">
                      <div className="flex items-center justify-between text-slate-500">
                        <span>Phụ trách:</span>
                        <strong className="text-slate-700">
                          {inc.assignedTo?.fullName || 'Chưa phân công'}
                        </strong>
                      </div>

                      {(latestUpdate || inc.treatment) && (
                        <div className="rounded-xl bg-indigo-50/50 p-2.5 border border-indigo-100/60">
                          <span className="text-[10px] font-bold text-indigo-800 uppercase tracking-wide block mb-0.5">
                            Phác đồ / Cập nhật điều trị:
                          </span>
                          <p className="text-[11px] font-semibold text-slate-700 line-clamp-2">
                            {latestUpdate?.treatment || inc.treatment}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Card Footer: Lần cập nhật & Nút xem chi tiết */}
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
            })}
          </div>

          {/* ── Thanh Phân Trang Đầy Đủ ────────────────────────────────────────── */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 sm:px-6 rounded-2xl border border-slate-100 shadow-xs">
            <div className="text-xs font-semibold text-slate-500">
              Hiển thị <span className="font-bold text-slate-800">{(currentPage - 1) * PAGE_SIZE + 1}</span> -{' '}
              <span className="font-bold text-slate-800">
                {Math.min(currentPage * PAGE_SIZE, filteredIncidents.length)}
              </span>{' '}
              trên tổng số <span className="font-bold text-emerald-600">{filteredIncidents.length}</span> sự cố đã hoàn thành
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer shadow-2xs"
              >
                <ChevronLeft className="w-4 h-4" />
                <span className="hidden sm:inline">Trước</span>
              </button>

              {/* Page Numbers */}
              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((page) => {
                    return (
                      page === 1 ||
                      page === totalPages ||
                      Math.abs(page - currentPage) <= 1
                    );
                  })
                  .map((page, idx, arr) => {
                    const prev = arr[idx - 1];
                    const hasGap = prev && page - prev > 1;
                    return (
                      <span key={page} className="flex items-center">
                        {hasGap && <span className="px-1 text-slate-400 text-xs">...</span>}
                        <button
                          onClick={() => setCurrentPage(page)}
                          className={`w-8 h-8 rounded-xl text-xs font-black transition-all cursor-pointer ${
                            currentPage === page
                              ? isFarmer
                                ? 'bg-teal-600 text-white shadow-md shadow-teal-600/30'
                                : 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                              : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200/80'
                          }`}
                        >
                          {page}
                        </button>
                      </span>
                    );
                  })}
              </div>

              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer shadow-2xs"
              >
                <span className="hidden sm:inline">Sau</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
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
                          <strong>
                            {cInfo.seasonName ? `${cInfo.seasonName} · ` : ''}
                            {cInfo.stage === 'NURSERY' ? 'Vụ Ương' : 'Vụ Thương phẩm'}
                          </strong>{' '}
                          ({cInfo.status === 'ACTIVE' ? 'Đang nuôi' : 'Đã thu'}) • Bắt đầu:{' '}
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
