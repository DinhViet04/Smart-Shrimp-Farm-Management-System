import { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Plus, 
  Waves, 
  Edit2, 
  Trash2, 
  Search, 
  AlertCircle, 
  CheckCircle2, 
  Maximize, 
  Building2, 
  MapPin, 
  Cpu,
  Calendar,
  ArrowRight,
  Eye,
  AlertTriangle,
  Loader2,
  X,
  LayoutGrid,
  Table as TableIcon,
  Scale,
  Filter
} from 'lucide-react';
import PondDetailPanel from './PondDetailPanel';
import LoadingMotion from './LoadingMotion';
import { type Crop } from '../services/crop.service';
import { pondService } from '../services/pond.service';

interface PondManagementProps {
  initialFarmId?: string;
  onEditCrop?: (crop: any) => void;
  onNavigateToCreateCrop?: (config: { farmId: string; pondId: string }) => void;
}

export default function PondManagement({ 
  initialFarmId,
  onEditCrop,
  onNavigateToCreateCrop 
}: PondManagementProps = {}) {
  const [ponds, setPonds] = useState<any[]>([]);
  const [farms, setFarms] = useState<any[]>([]);
  const [crops, setCrops] = useState<Crop[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingPond, setEditingPond] = useState<string | null>(null);
  const [viewingPond, setViewingPond] = useState<any | null>(null);
  const [pondToDelete, setPondToDelete] = useState<{ id: string; name: string; farmName?: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    areaSize: '',
    depth: '',
    farmId: '',
  });
  const [search, setSearch] = useState('');
  const [filterFarmId, setFilterFarmId] = useState<string>(initialFarmId || 'ALL');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'ACTIVE' | 'EMPTY'>('ALL');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [currentUserRole, setCurrentUserRole] = useState<string>(() => {
    try {
      const raw = localStorage.getItem('user');
      return raw ? (JSON.parse(raw)?.role || '') : '';
    } catch {
      return '';
    }
  });

  useEffect(() => {
    try {
      const raw = localStorage.getItem('user');
      if (raw) setCurrentUserRole(JSON.parse(raw)?.role || '');
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (initialFarmId) {
      setFilterFarmId(initialFarmId);
    }
  }, [initialFarmId]);

  const canManagePond = currentUserRole === 'FARM_MANAGER';
  const canCreateCrop = currentUserRole === 'FARM_MANAGER' || currentUserRole === 'FARMER';
  const [toast, setToast] = useState<{ 
    message: string; 
    type: 'success' | 'error';
    createdPond?: { farmId: string; pondId: string; pondName: string };
  } | null>(null);

  const showToast = (
    message: string, 
    type: 'success' | 'error',
    createdPond?: { farmId: string; pondId: string; pondName: string }
  ) => {
    setToast({ message, type, createdPond });
    setTimeout(() => setToast(null), createdPond ? 7000 : 3000);
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const overview = await pondService.getOverview();
      setFarms(overview.farms);
      setPonds(overview.ponds);
      setCrops(overview.crops);
      if (overview.farms.length > 0) {
        setFormData((prev) =>
          prev.farmId ? prev : { ...prev, farmId: overview.farms[0].id },
        );
      }
    } catch (error) {
      console.error('Lỗi khi tải dữ liệu:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Initial remote data synchronization for the screen.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData();
  }, [fetchData]);

  const cropByPond = useMemo(() => {
    const active = new Map<string, Crop>();
    const latest = new Map<string, Crop>();
    const all = new Map<string, Crop[]>();

    for (const crop of crops) {
      if (!latest.has(crop.pondId)) latest.set(crop.pondId, crop);
      if (crop.status === 'ACTIVE' && !active.has(crop.pondId)) {
        active.set(crop.pondId, crop);
      }
      const pondCrops = all.get(crop.pondId) || [];
      pondCrops.push(crop);
      all.set(crop.pondId, pondCrops);
    }

    return { active, latest, all };
  }, [crops]);

  const getPondCropInfo = (pondId: string, latestSizeSample?: any) => {
    const activeCrop = cropByPond.active.get(pondId);
    if (activeCrop) {
      const startMs = new Date(activeCrop.startDate).getTime();
      const computedDoc = !Number.isNaN(startMs)
        ? Math.max(1, Math.floor((Date.now() - startMs) / (1000 * 60 * 60 * 24)))
        : (latestSizeSample?.doc ?? null);
      return {
        hasActiveCrop: true,
        crop: activeCrop,
        label: 'Đang nuôi',
        docDays: computedDoc,
      };
    }
    const latestCrop = cropByPond.latest.get(pondId);
    return { 
      hasActiveCrop: false, 
      crop: latestCrop || null, 
      label: latestCrop ? (latestCrop.status === 'HARVESTED' ? 'Đã thu hoạch' : 'Thất thu') : 'Chưa thả giống',
      docDays: null,
    };
  };

  const openAddModal = (defaultFarmId?: string) => {
    setEditingPond(null);
    const chosenFarmId = defaultFarmId || (farms.length > 0 ? farms[0].id : '');
    setFormData({ 
      name: '', 
      areaSize: '', 
      depth: '', 
      farmId: chosenFarmId 
    });
    setShowModal(true);
  };

  const openEditModal = (pond: any) => {
    setEditingPond(pond.id);
    setFormData({
      name: pond.name,
      areaSize: pond.areaSize.toString(),
      depth: pond.depth.toString(),
      farmId: pond.farmId,
    });
    setShowModal(true);
  };

  const handleDelete = (e: React.MouseEvent, pond: any) => {
    e.stopPropagation();
    const farm = farms.find(f => f.id === pond.farmId);
    setPondToDelete({
      id: pond.id,
      name: pond.name,
      farmName: farm?.name || '',
    });
  };

  const confirmDeletePond = async () => {
    if (!pondToDelete) return;
    try {
      setIsDeleting(true);
      await pondService.remove(pondToDelete.id);
      showToast(`Xóa ao nuôi "${pondToDelete.name}" thành công!`, 'success');
      setPondToDelete(null);
      fetchData();
    } catch (error: any) {
      showToast(error.message || 'Lỗi khi xóa ao nuôi', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const data = {
        name: formData.name,
        areaSize: Number(formData.areaSize),
        depth: Number(formData.depth),
        farmId: formData.farmId,
      };

      if (editingPond) {
        await pondService.update(editingPond, data);
        showToast('Cập nhật ao nuôi thành công!', 'success');
      } else {
        const created = await pondService.create(data);
        showToast(
          'Thêm ao nuôi mới thành công!', 
          'success', 
          created ? { farmId: data.farmId, pondId: created.id, pondName: data.name } : undefined
        );
      }
      
      setShowModal(false);
      fetchData(); // Reload list
    } catch (error: any) {
      showToast(error.message || 'Không thể lưu ao', 'error');
    }
  };

  const pondSummaryStats = useMemo(() => {
    let activeCount = 0;
    for (const p of ponds) {
      if (cropByPond.active.has(p.id)) activeCount += 1;
    }
    return {
      activeCount,
      emptyCount: Math.max(0, ponds.length - activeCount),
    };
  }, [ponds, cropByPond]);

  // Group ponds by farm with natural sorting & accurate farm-level metrics
  const groupedFarms = useMemo(() => {
    const searchLower = search.trim().toLowerCase();
    const hasActiveFilter = Boolean(searchLower) || filterStatus !== 'ALL';

    return farms
      .filter((farm) => filterFarmId === 'ALL' || farm.id === filterFarmId)
      .map((farm) => {
        const allFarmPonds = ponds
          .filter((p) => p.farmId === farm.id)
          .sort((a, b) =>
            String(a.name || '').localeCompare(String(b.name || ''), 'vi', {
              numeric: true,
              sensitivity: 'base',
            }),
          );

        const totalPondArea = allFarmPonds.reduce(
          (acc, p) => acc + (Number(p.areaSize) || 0),
          0,
        );
        const farmArea = Number(farm.area) || 0;
        const usagePercentage =
          farmArea > 0
            ? Math.min(100, Math.round((totalPondArea / farmArea) * 100))
            : 0;

        const farmPonds = allFarmPonds.filter((p) => {
          const matchesSearch =
            !searchLower ||
            p.name.toLowerCase().includes(searchLower) ||
            farm.name.toLowerCase().includes(searchLower);
          const isPondActive = cropByPond.active.has(p.id);
          const matchesStatus =
            filterStatus === 'ALL' ||
            (filterStatus === 'ACTIVE' && isPondActive) ||
            (filterStatus === 'EMPTY' && !isPondActive);
          return matchesSearch && matchesStatus;
        });

        return {
          ...farm,
          ponds: farmPonds,
          totalPondCount: allFarmPonds.length,
          totalPondArea,
          farmArea,
          usagePercentage,
        };
      })
      .filter((group) => !hasActiveFilter || group.ponds.length > 0);
  }, [farms, ponds, search, filterFarmId, filterStatus, cropByPond]);

  if (loading && farms.length === 0) {
    return (
      <LoadingMotion
        title="Đang tải dữ liệu Ao nuôi..."
        subtitle="Hệ thống đang đồng bộ danh sách ao nuôi phân chia theo từng trang trại..."
        icon={<Waves className="w-11 h-11 text-blue-600 animate-pulse" />}
        headerTitle="Quản Lý Ao Nuôi"
        headerSubtitle="Theo dõi và quản lý danh sách ao nuôi phân chia theo từng trang trại"
        headerIcon={<Waves className="w-7 h-7 text-blue-600" />}
        color="blue"
      />
    );
  }

  return (
    <div className="relative z-10 max-w-7xl mx-auto space-y-6">
      {/* Custom Toast */}
      {toast && (
        <div className={`fixed top-6 right-6 z-[100] px-5 py-4 rounded-2xl shadow-xl border flex items-center gap-3.5 animate-in slide-in-from-right-8 fade-in duration-300 ${
          toast.type === 'success' ? 'bg-emerald-50/95 border-emerald-200 text-emerald-800' : 'bg-red-50/95 border-red-200 text-red-700'
        }`}>
          {toast.type === 'success' ? <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" /> : <AlertCircle className="w-5 h-5 flex-shrink-0" />}
          <div className="flex items-center gap-3">
            <p className="text-sm font-semibold">{toast.message}</p>
            {toast.createdPond && onNavigateToCreateCrop && canCreateCrop && (
              <button
                onClick={() => {
                  onNavigateToCreateCrop({ farmId: toast.createdPond!.farmId, pondId: toast.createdPond!.pondId });
                  setToast(null);
                }}
                className="ml-2 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-md shadow-emerald-600/30 transition-all hover:scale-105 whitespace-nowrap cursor-pointer"
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>Khởi tạo Vụ nuôi ngay</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Header Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/80 backdrop-blur-xl p-4 sm:p-6 rounded-3xl shadow-xl shadow-blue-900/5 border border-white/60">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-gradient-to-br from-blue-50 to-cyan-50 text-blue-600 rounded-2xl flex items-center justify-center shadow-inner border border-blue-100/50">
            <Waves className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-2xl font-black bg-clip-text text-transparent bg-gradient-to-r from-blue-700 to-cyan-500 tracking-tight">Quản Lý Ao Nuôi</h2>
            <p className="text-sm text-slate-500 font-medium">Theo dõi và quản lý danh sách ao nuôi phân chia theo từng trang trại</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-60 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm tên ao hoặc trang trại..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-8 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl text-sm font-medium focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all shadow-inner"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                title="Xóa tìm kiếm"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {farms.length > 1 && (
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
              <select
                value={filterFarmId}
                onChange={(e) => setFilterFarmId(e.target.value)}
                className="pl-8 pr-7 py-2.5 bg-slate-50/70 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:bg-white focus:border-blue-500 outline-none transition-all cursor-pointer"
              >
                <option value="ALL">Tất cả trang trại ({farms.length})</option>
                {farms.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="inline-flex items-center bg-slate-100/80 p-1 rounded-xl border border-slate-200/70">
            {(
              [
                { id: 'ALL', label: `Tất cả (${ponds.length})` },
                { id: 'ACTIVE', label: `Đang nuôi (${pondSummaryStats.activeCount})` },
                { id: 'EMPTY', label: `Ao trống (${pondSummaryStats.emptyCount})` },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilterStatus(tab.id)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  filterStatus === tab.id
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="inline-flex items-center bg-slate-100/80 p-1 rounded-xl border border-slate-200/70" title="Chế độ hiển thị">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                viewMode === 'grid'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-slate-400 hover:text-slate-700'
              }`}
              title="Xem dạng thẻ"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                viewMode === 'table'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-slate-400 hover:text-slate-700'
              }`}
              title="Xem dạng bảng gọn"
            >
              <TableIcon className="w-4 h-4" />
            </button>
          </div>

          {canManagePond && (
            <button
              onClick={() => openAddModal(filterFarmId !== 'ALL' ? filterFarmId : undefined)}
              className="px-4 py-2.5 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 text-white text-sm font-bold rounded-xl flex items-center gap-2 transition-all duration-300 shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50 hover:-translate-y-0.5 whitespace-nowrap cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Thêm mới
            </button>
          )}
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white/80 backdrop-blur-xl p-4 sm:p-5 rounded-3xl border border-white/60 shadow-lg shadow-blue-900/5 flex items-center gap-4 transition-all hover:-translate-y-0.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 flex items-center justify-center text-blue-600 shadow-inner">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Tổng Trang Trại</p>
            <p className="text-2xl font-black text-slate-800">{farms.length} <span className="text-xs font-bold text-slate-400 font-normal">trại</span></p>
          </div>
        </div>

        <div className="bg-white/80 backdrop-blur-xl p-4 sm:p-5 rounded-3xl border border-white/60 shadow-lg shadow-blue-900/5 flex items-center gap-4 transition-all hover:-translate-y-0.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-50 to-blue-50 border border-cyan-100 flex items-center justify-center text-cyan-600 shadow-inner">
            <Waves className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Tổng Số Ao Nuôi</p>
            <div className="flex items-baseline gap-2">
              <p className="text-2xl font-black text-slate-800">{ponds.length} <span className="text-xs font-bold text-slate-400 font-normal">ao</span></p>
              <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/70">
                {pondSummaryStats.activeCount} đang nuôi
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white/80 backdrop-blur-xl p-4 sm:p-5 rounded-3xl border border-white/60 shadow-lg shadow-blue-900/5 flex items-center gap-4 transition-all hover:-translate-y-0.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shadow-inner">
            <Maximize className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Tổng Diện Tích Mặt Nước</p>
            <p className="text-2xl font-black text-slate-800">
              {ponds.reduce((sum, p) => sum + (Number(p.areaSize) || 0), 0).toLocaleString()} <span className="text-xs font-bold text-slate-400 font-normal">m²</span>
            </p>
          </div>
        </div>
      </div>

      {/* Loading state */}
      {loading ? (
        <LoadingMotion
          mode="card"
          title="Đang tải danh sách ao nuôi..."
          subtitle="Đang đồng bộ dữ liệu diện tích và tình trạng vụ mùa của các ao..."
          icon={<Waves className="w-10 h-10 text-blue-600 animate-pulse" />}
          color="blue"
        />
      ) : farms.length === 0 ? (
        /* No Farms State */
        <div className="flex flex-col items-center justify-center h-64 bg-white/90 backdrop-blur-xl rounded-3xl border border-slate-200/80 shadow-sm text-center px-6">
          <div className="w-16 h-16 bg-blue-50 text-blue-500 rounded-2xl flex items-center justify-center mb-4 shadow-inner border border-blue-100/50">
            <Building2 className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-slate-800 mb-1">Bạn chưa tạo Trang Trại nào</h3>
          <p className="text-slate-500 text-sm mb-4">Vui lòng tạo trang trại trước khi bắt đầu tạo các ao nuôi.</p>
        </div>
      ) : groupedFarms.length === 0 || (groupedFarms.every(g => g.ponds.length === 0) && (search || filterStatus !== 'ALL')) ? (
        /* No Search / Filter Results */
        <div className="flex flex-col items-center justify-center h-64 bg-white/80 backdrop-blur-xl rounded-3xl border border-white/60 shadow-sm text-center px-6">
          <div className="w-16 h-16 bg-slate-100 text-slate-400 rounded-2xl flex items-center justify-center mb-4">
            <Search className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-slate-700 mb-1">Không tìm thấy ao nuôi phù hợp</h3>
          <p className="text-slate-500 text-sm mb-4">
            {search
              ? `Không có kết quả nào khớp với từ khóa "${search}".`
              : 'Không có ao nuôi nào khớp với bộ lọc hiện tại.'}
          </p>
          <button
            type="button"
            onClick={() => {
              setSearch('');
              setFilterStatus('ALL');
              setFilterFarmId('ALL');
            }}
            className="px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-600 text-xs font-bold rounded-xl transition-colors cursor-pointer"
          >
            Đặt lại bộ lọc
          </button>
        </div>
      ) : (
        /* Grouped By Farm Sections */
        <div className="space-y-8">
          {groupedFarms.map(farmGroup => {
            const isSelected = Boolean(initialFarmId && farmGroup.id === initialFarmId);
            return (
            <div 
              key={farmGroup.id}
              className={`bg-white/80 backdrop-blur-xl rounded-3xl border shadow-xl shadow-blue-900/5 overflow-hidden transition-all duration-300 ${
                isSelected ? 'border-blue-400 ring-4 ring-blue-500/10' : 'border-white/80'
              }`}
            >
              {/* Farm Section Header Banner */}
              <div className="h-1.5 bg-gradient-to-r from-blue-600 via-cyan-500 to-emerald-400"></div>

              <div className="p-5 sm:p-6 space-y-5">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                  <div className="space-y-2.5">
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-50 to-cyan-50 text-blue-600 flex items-center justify-center border border-blue-100 shadow-inner">
                        <Building2 className="w-5 h-5" />
                      </div>
                      <h3 className="text-xl font-black text-slate-800 tracking-tight">
                        {farmGroup.name}
                      </h3>

                      {isSelected && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-bold rounded-full border bg-blue-50 text-blue-600 border-blue-200">
                          ★ Trang trại vừa chọn
                        </span>
                      )}

                      {/* Status badge */}
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-bold rounded-full border ${
                        farmGroup.status === 'ACTIVE'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200/80'
                          : 'bg-rose-50 text-rose-700 border-rose-200/80'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          farmGroup.status === 'ACTIVE' ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
                        }`} />
                        {farmGroup.status === 'ACTIVE' ? 'Hoạt động' : 'Tạm ngưng'}
                      </span>

                      {/* Farming Model Badge */}
                      <span className={`inline-flex items-center gap-1.5 px-3 py-0.5 text-xs font-bold rounded-full border ${
                        farmGroup.farmingModel === 'TRADITIONAL'
                          ? 'bg-amber-50 text-amber-700 border-amber-200/80'
                          : 'bg-blue-50 text-blue-700 border-blue-200/80'
                      }`}>
                        <Cpu className="w-3.5 h-3.5" />
                        {farmGroup.farmingModel === 'TRADITIONAL' ? 'Mô hình truyền thống' : 'Mô hình công nghệ cao'}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs font-medium text-slate-500 pl-0 sm:pl-13">
                      <span className="inline-flex items-center gap-1 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-100">
                        <MapPin className="w-3.5 h-3.5 text-blue-500" />
                        {farmGroup.address}
                      </span>
                      <span>•</span>
                      <span>
                        Diện tích trại: <strong className="text-slate-700 font-bold">{farmGroup.farmArea?.toLocaleString() || 0} m²</strong>
                      </span>
                      <span>•</span>
                      <span>
                        Mặt nước ao: <strong className="text-blue-600 font-bold">{farmGroup.totalPondArea?.toLocaleString() || 0} m²</strong> ({farmGroup.usagePercentage}% quỹ đất)
                      </span>
                    </div>
                  </div>

                  {/* Right side controls */}
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-slate-600 bg-slate-50 px-3.5 py-2 rounded-xl border border-slate-200/60 shadow-inner">
                      🏊{' '}
                      <strong>
                        {farmGroup.ponds.length === farmGroup.totalPondCount
                          ? farmGroup.totalPondCount
                          : `${farmGroup.ponds.length}/${farmGroup.totalPondCount}`}
                      </strong>{' '}
                      ao nuôi
                    </span>
                    {canManagePond && (
                      <button
                        onClick={() => openAddModal(farmGroup.id)}
                        className="px-4 py-2 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all shadow-md shadow-blue-500/20 hover:shadow-blue-500/40 hover:-translate-y-0.5 whitespace-nowrap cursor-pointer"
                      >
                        <Plus className="w-4 h-4" /> Thêm ao vào trại này
                      </button>
                    )}
                  </div>
                </div>

                {/* Ponds Grid or Table for this farm */}
                {farmGroup.ponds.length === 0 ? (
                  <div className="bg-slate-50/50 rounded-2xl border-2 border-dashed border-slate-200/80 p-8 text-center">
                    <div className="w-12 h-12 bg-white text-slate-400 rounded-2xl flex items-center justify-center mx-auto mb-2 border border-slate-100 shadow-sm">
                      <Waves className="w-6 h-6 text-blue-400" />
                    </div>
                    <p className="text-sm font-bold text-slate-700 mb-1">Trang trại này chưa có ao nuôi nào</p>
                    <p className="text-xs text-slate-400 mb-4">Thêm ao nuôi để quản lý môi trường nước, mùa vụ và nhật ký chăm sóc.</p>
                    {canManagePond && (
                      <button
                        onClick={() => openAddModal(farmGroup.id)}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl inline-flex items-center gap-1.5 shadow-sm transition-all hover:-translate-y-0.5 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" /> Tạo ao đầu tiên
                      </button>
                    )}
                  </div>
                ) : viewMode === 'table' ? (
                  <div className="overflow-x-auto rounded-2xl border border-slate-200/80 bg-white">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50/90 border-b border-slate-200/80 text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">
                          <th className="py-3.5 px-4">Tên Ao</th>
                          <th className="py-3.5 px-4">Trạng Thái Vụ</th>
                          <th className="py-3.5 px-4">Ngày Nuôi / Giống Thả</th>
                          <th className="py-3.5 px-4">Cỡ Tôm Gần Nhất</th>
                          <th className="py-3.5 px-4 text-right">Diện Tích</th>
                          <th className="py-3.5 px-4 text-right">Độ Sâu</th>
                          <th className="py-3.5 px-4 text-right">Thao Tác</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-sm">
                        {farmGroup.ponds.map((pond: any) => {
                          const cropInfo = getPondCropInfo(pond.id, pond.latestSizeSample);
                          const sample = pond.latestSizeSample;
                          return (
                            <tr
                              key={pond.id}
                              onClick={() => setViewingPond(pond)}
                              className="hover:bg-blue-50/40 transition-colors cursor-pointer"
                            >
                              <td className="py-3.5 px-4 font-black text-slate-800 whitespace-nowrap">
                                <div className="flex items-center gap-2.5">
                                  <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100 shrink-0">
                                    <Waves className="w-4 h-4" />
                                  </div>
                                  <span>{pond.name}</span>
                                </div>
                              </td>
                              <td className="py-3.5 px-4 whitespace-nowrap">
                                {cropInfo.hasActiveCrop ? (
                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200/80 rounded-xl text-xs font-bold">
                                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                    Đang nuôi
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 text-slate-600 border border-slate-200/80 rounded-xl text-xs font-semibold">
                                    <span className="w-2 h-2 rounded-full bg-slate-400" />
                                    {cropInfo.crop ? `Trống (${cropInfo.label})` : 'Ao trống'}
                                  </span>
                                )}
                              </td>
                              <td className="py-3.5 px-4 whitespace-nowrap text-xs font-semibold text-slate-600">
                                {cropInfo.hasActiveCrop ? (
                                  <div className="flex items-center gap-2">
                                    {cropInfo.docDays && (
                                      <span className="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200/70 rounded-md font-bold">
                                        DOC {cropInfo.docDays} ngày
                                      </span>
                                    )}
                                    <span>
                                      {cropInfo.crop?.initialShrimpCount
                                        ? `${cropInfo.crop.initialShrimpCount.toLocaleString('vi-VN')} con`
                                        : '—'}
                                    </span>
                                  </div>
                                ) : (
                                  <span className="text-slate-400">—</span>
                                )}
                              </td>
                              <td className="py-3.5 px-4 whitespace-nowrap text-xs font-semibold">
                                {cropInfo.hasActiveCrop && sample?.sizePerKg ? (
                                  <span className="inline-flex items-center gap-1 text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-100 font-bold">
                                    <Scale className="w-3.5 h-3.5" />
                                    ~{Math.round(sample.sizePerKg)} con/kg ({sample.abwGram}g)
                                  </span>
                                ) : (
                                  <span className="text-slate-400">Chưa có mẫu đo</span>
                                )}
                              </td>
                              <td className="py-3.5 px-4 text-right font-bold text-slate-800 whitespace-nowrap">
                                {Number(pond.areaSize)?.toLocaleString('vi-VN') || 0} <span className="text-xs text-slate-400">m²</span>
                              </td>
                              <td className="py-3.5 px-4 text-right font-bold text-slate-800 whitespace-nowrap">
                                {pond.depth} <span className="text-xs text-slate-400">m</span>
                              </td>
                              <td className="py-3.5 px-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                                <div className="inline-flex items-center justify-end gap-1.5">
                                  {cropInfo.hasActiveCrop ? (
                                    <button
                                      onClick={() => onEditCrop && cropInfo.crop && onEditCrop(cropInfo.crop)}
                                      className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
                                    >
                                      Xem Vụ
                                    </button>
                                  ) : canCreateCrop ? (
                                    <button
                                      onClick={() =>
                                        onNavigateToCreateCrop &&
                                        onNavigateToCreateCrop({ farmId: pond.farmId, pondId: pond.id })
                                      }
                                      className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
                                    >
                                      + Tạo Vụ
                                    </button>
                                  ) : null}
                                  <button
                                    onClick={() => setViewingPond(pond)}
                                    className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                                    title="Xem chi tiết"
                                  >
                                    <Eye className="w-4 h-4" />
                                  </button>
                                  {canManagePond && (
                                    <>
                                      <button
                                        onClick={() => openEditModal(pond)}
                                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                                        title="Chỉnh sửa"
                                      >
                                        <Edit2 className="w-4 h-4" />
                                      </button>
                                      <button
                                        onClick={(e) => handleDelete(e, pond)}
                                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                        title="Xóa ao"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    </>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {farmGroup.ponds.map((pond: any) => {
                      const cropInfo = getPondCropInfo(pond.id, pond.latestSizeSample);
                      const sample = pond.latestSizeSample;
                      return (
                      <div 
                        key={pond.id} 
                        onClick={() => setViewingPond(pond)} 
                        className="bg-white rounded-3xl border border-slate-100 shadow-md shadow-slate-200/50 hover:shadow-2xl hover:shadow-blue-500/10 transition-all hover:-translate-y-1.5 duration-300 group flex flex-col cursor-pointer overflow-hidden relative"
                      >
                        {/* Card Gradient Top Cover */}
                        <div className="h-20 bg-gradient-to-br from-blue-600 via-blue-500 to-cyan-400 relative overflow-hidden">
                          <div className="absolute inset-0 bg-white/20 backdrop-blur-md pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                          <div className="absolute -bottom-6 -right-6 w-24 h-24 bg-white/10 rounded-full blur-xl"></div>
                        </div>

                        <div className="p-5 relative flex-1 flex flex-col">
                          {/* Floating Icon */}
                          <div className="w-12 h-12 bg-white border border-white/80 rounded-2xl flex items-center justify-center absolute -top-8 shadow-xl shadow-blue-900/10 group-hover:scale-110 transition-all duration-300 z-20">
                            <Waves className="w-6 h-6 text-blue-600" />
                          </div>

                          <div className="mt-4 flex-1 flex flex-col justify-between">
                            <div>
                              <div className="flex items-center justify-between mb-2">
                                <h4 className="text-lg font-black text-slate-800 tracking-tight group-hover:text-blue-600 transition-colors">
                                  {pond.name}
                                </h4>
                                {farmGroup.status === 'INACTIVE' && (
                                  <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-rose-50 text-rose-600 border border-rose-200 rounded-md">
                                    Trại ngưng
                                  </span>
                                )}
                              </div>

                              {/* Crop Status Indicator */}
                              {cropInfo.hasActiveCrop ? (
                                <div className="space-y-2 mb-3">
                                  <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200/80 rounded-xl text-xs font-semibold">
                                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                                    <span className="truncate">Vụ đang nuôi</span>
                                    <div className="flex items-center gap-1 ml-auto">
                                      {cropInfo.docDays && (
                                        <span className="text-[10px] text-blue-700 bg-blue-100/80 px-1.5 py-0.5 rounded-md font-bold">
                                          DOC {cropInfo.docDays}d
                                        </span>
                                      )}
                                      <span className="text-[10px] text-emerald-700 bg-emerald-100/80 px-1.5 py-0.5 rounded-md font-bold">
                                        {cropInfo.crop?.initialShrimpCount ? `${(cropInfo.crop.initialShrimpCount / 1000).toLocaleString()}k giống` : 'Đang nuôi'}
                                      </span>
                                    </div>
                                  </div>
                                  {sample?.sizePerKg && (
                                    <div className="flex items-center justify-between px-2.5 py-1 bg-indigo-50/70 text-indigo-700 border border-indigo-100 rounded-xl text-[11px] font-semibold">
                                      <span className="inline-flex items-center gap-1">
                                        <Scale className="w-3 h-3" /> Cỡ mẫu gần nhất
                                      </span>
                                      <span className="font-bold">
                                        ~{Math.round(sample.sizePerKg)} con/kg ({sample.abwGram}g)
                                      </span>
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <div className="flex items-center gap-1.5 mb-3 px-2.5 py-1 bg-slate-50 text-slate-500 border border-slate-200/60 rounded-xl text-xs font-medium">
                                  <span className="w-2 h-2 rounded-full bg-slate-300"></span>
                                  <span>{cropInfo.crop ? `Vụ trước: ${cropInfo.label} (Đang trống)` : 'Ao trống (Chưa có vụ)'}</span>
                                </div>
                              )}

                              {/* Metrics 2-column pills */}
                              <div className="grid grid-cols-2 gap-2.5 mb-4">
                                <div className="bg-blue-50/60 p-3 rounded-2xl border border-blue-100/60 flex flex-col gap-0.5 transition-colors group-hover:bg-blue-50">
                                  <div className="flex items-center gap-1 text-blue-600 text-[11px] font-bold uppercase tracking-wider">
                                    <Maximize className="w-3.5 h-3.5" />
                                    Diện tích
                                  </div>
                                  <p className="text-lg font-black text-slate-800">
                                    {Number(pond.areaSize)?.toLocaleString() || 0} <span className="text-xs font-bold text-slate-400">m²</span>
                                  </p>
                                </div>

                                <div className="bg-cyan-50/60 p-3 rounded-2xl border border-cyan-100/60 flex flex-col gap-0.5 transition-colors group-hover:bg-cyan-50">
                                  <div className="flex items-center gap-1 text-cyan-600 text-[11px] font-bold uppercase tracking-wider">
                                    <Waves className="w-3.5 h-3.5" />
                                    Độ sâu
                                  </div>
                                  <p className="text-lg font-black text-slate-800">
                                    {pond.depth} <span className="text-xs font-bold text-slate-400">m</span>
                                  </p>
                                </div>
                              </div>
                            </div>

                            {/* Card Footer Actions */}
                            <div className="pt-3 border-t border-slate-100/80 flex items-center justify-between gap-2">
                              {cropInfo.hasActiveCrop ? (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (onEditCrop && cropInfo.crop) {
                                      onEditCrop(cropInfo.crop);
                                    }
                                  }}
                                  className="px-3 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-700 hover:to-teal-600 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-sm shadow-emerald-500/20 hover:shadow-emerald-500/35 hover:-translate-y-0.5 transition-all whitespace-nowrap cursor-pointer"
                                  title="Xem chi tiết vụ nuôi đang hoạt động của ao này"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                  <span>Xem Vụ nuôi</span>
                                  <ArrowRight className="w-3 h-3" />
                                </button>
                              ) : canCreateCrop ? (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (onNavigateToCreateCrop) {
                                      onNavigateToCreateCrop({ farmId: pond.farmId, pondId: pond.id });
                                    }
                                  }}
                                  className="px-3 py-1.5 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-sm shadow-blue-500/20 hover:shadow-blue-500/40 hover:-translate-y-0.5 transition-all whitespace-nowrap cursor-pointer"
                                  title="Khởi tạo Vụ nuôi mới cho ao này"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                  <span>Khởi tạo Vụ</span>
                                  <ArrowRight className="w-3 h-3" />
                                </button>
                              ) : (
                                <span className="text-[11px] font-semibold text-slate-400">
                                  Chế độ xem giám sát
                                </span>
                              )}

                              <div className="flex items-center gap-1">
                                <button 
                                  onClick={(e) => { e.stopPropagation(); setViewingPond(pond); }}
                                  className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors"
                                  title="Xem chi tiết"
                                >
                                  <Eye className="w-4 h-4" />
                                </button>
                                {canManagePond && (
                                  <>
                                    <button 
                                      onClick={(e) => { e.stopPropagation(); openEditModal(pond); }} 
                                      className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors" 
                                      title="Chỉnh sửa"
                                    >
                                      <Edit2 className="w-4 h-4" />
                                    </button>
                                    <button 
                                      onClick={(e) => handleDelete(e, pond)} 
                                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer" 
                                      title="Xóa ao"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        </div>
      )}

      {/* Modal Thêm Ao */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-800">{editingPond ? 'Cập nhật Ao Nuôi' : 'Thêm Ao Nuôi Mới'}</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5">Chọn Trang trại <span className="text-red-500">*</span></label>
                <select 
                  required
                  value={formData.farmId}
                  onChange={e => setFormData({...formData, farmId: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all font-medium"
                >
                  <option value="" disabled>-- Chọn trang trại --</option>
                  {farms.map(f => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
                {farms.length === 0 && (
                  <p className="text-xs text-amber-600 mt-1 font-medium">Bạn chưa có trang trại nào, vui lòng tạo trang trại trước.</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5">Tên ao <span className="text-red-500">*</span></label>
                <input 
                  type="text" 
                  required
                  placeholder="VD: Ao số 1"
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1.5">Diện tích (m²) <span className="text-red-500">*</span></label>
                  <input 
                    type="number" 
                    step="0.01"
                    min="1"
                    required
                    placeholder="VD: 1500"
                    value={formData.areaSize}
                    onChange={e => setFormData({...formData, areaSize: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all font-medium"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1.5">Độ sâu (m) <span className="text-red-500">*</span></label>
                  <input 
                    type="number" 
                    step="0.1"
                    min="0.1"
                    required
                    placeholder="VD: 1.5"
                    value={formData.depth}
                    onChange={e => setFormData({...formData, depth: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all font-medium"
                  />
                </div>
              </div>

              <div className="pt-4 flex gap-3">
                <button 
                  type="button" 
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition-colors"
                >
                  Hủy
                </button>
                <button 
                  type="submit" 
                  disabled={!formData.farmId}
                  className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed text-white rounded-xl font-bold shadow-sm transition-colors"
                >
                  {editingPond ? 'Lưu Thay Đổi' : 'Lưu Ao Nuôi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <PondDetailPanel 
        pond={viewingPond} 
        isOpen={!!viewingPond} 
        initialCrops={viewingPond ? cropByPond.all.get(viewingPond.id) || [] : []}
        onClose={() => setViewingPond(null)} 
        onEditCrop={onEditCrop}
      />

      {/* Cửa sổ xác nhận xóa ao nuôi (thay thế hộp thoại localhost của trình duyệt) */}
      {pondToDelete && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => !isDeleting && setPondToDelete(null)}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden border border-slate-100 animate-in zoom-in-95 duration-200"
          >
            {/* Top Danger Accent Gradient Bar */}
            <div className="h-1.5 bg-gradient-to-r from-rose-500 via-red-500 to-amber-500"></div>

            <div className="p-6">
              {/* Header with Danger Icon & Close Button */}
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 shadow-inner">
                  <AlertTriangle className="w-6 h-6 animate-pulse" />
                </div>
                <button
                  type="button"
                  onClick={() => !isDeleting && setPondToDelete(null)}
                  disabled={isDeleting}
                  className="w-8 h-8 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center transition-colors disabled:opacity-50 cursor-pointer"
                  title="Đóng"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Title & Subtitle */}
              <h3 className="text-xl font-black text-slate-800 tracking-tight">
                Xác nhận xóa ao nuôi?
              </h3>
              <p className="text-sm text-slate-500 mt-1">
                Ao nuôi sẽ bị xóa hoàn toàn khỏi cơ sở dữ liệu hệ thống.
              </p>

              {/* Target Pond Badge */}
              <div className="mt-4 p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100 shrink-0">
                  <Waves className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-slate-400">Ao nuôi chuẩn bị xóa:</p>
                  <p className="text-base font-black text-slate-800 truncate">
                    {pondToDelete.name}
                  </p>
                  {pondToDelete.farmName && (
                    <p className="text-xs font-medium text-slate-500 truncate">
                      Thuộc trang trại: {pondToDelete.farmName}
                    </p>
                  )}
                </div>
              </div>

              {/* Detailed Warning Box */}
              <div className="mt-4 p-4 rounded-2xl bg-rose-50/80 border border-rose-200/70 text-left space-y-2">
                <div className="flex items-center gap-2 text-rose-800 font-bold text-xs uppercase tracking-wider">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  Cảnh báo dữ liệu quan trọng
                </div>
                <p className="text-xs text-rose-900 leading-relaxed font-medium">
                  Việc xoá ao nuôi sẽ làm <strong className="font-black text-rose-700 underline">MẤT TOÀN BỘ dữ liệu liên quan</strong> và không thể khôi phục:
                </p>
                <ul className="text-xs text-rose-800/90 list-disc list-inside space-y-1 font-medium pl-1">
                  <li>Tất cả các vụ nuôi gắn với ao này (đang nuôi & lịch sử)</li>
                  <li>Nhật ký chăm sóc hàng ngày & lịch cho ăn</li>
                  <li>Dữ liệu đo đạc chỉ số môi trường (pH, DO, kiềm...)</li>
                  <li>Lịch sử đo kích thước và biểu đồ tăng trưởng tôm</li>
                </ul>
                <p className="text-[11px] font-bold text-rose-600 pt-1 border-t border-rose-200/60">
                  ⚠️ Thao tác này không thể hoàn tác sau khi xác nhận!
                </p>
              </div>

              {/* Action Buttons */}
              <div className="mt-6 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setPondToDelete(null)}
                  disabled={isDeleting}
                  className="flex-1 px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm rounded-xl transition-colors cursor-pointer disabled:opacity-50"
                >
                  Hủy bỏ
                </button>
                <button
                  type="button"
                  onClick={confirmDeletePond}
                  disabled={isDeleting}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 text-white font-bold text-sm rounded-xl shadow-lg shadow-rose-500/25 hover:shadow-rose-500/40 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                >
                  {isDeleting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Đang xóa...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      <span>Xác nhận xóa</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
