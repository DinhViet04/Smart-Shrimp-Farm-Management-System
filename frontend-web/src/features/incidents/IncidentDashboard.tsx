import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Bot,
  Building2,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Filter,
  History,
  Layers,
  Plus,
  RefreshCw,
  RotateCcw,
  Stethoscope,
  Waves,
  X,
} from 'lucide-react';
import { incidentService, type Incident, type IncidentStatus, type IncidentTechnician } from '../../services/incident.service';
import { cropService, type Crop } from '../../services/crop.service';
import { pondService, type OverviewPond } from '../../services/pond.service';
import LoadingMotion from '../../components/LoadingMotion';
import TreatmentWorkspace from './TreatmentWorkspace';
import IncidentTreatmentHistory from './IncidentTreatmentHistory';

const STATUS_LABELS: Record<IncidentStatus, string> = {
  OPEN: 'Sự cố mới (Chờ xử lý)',
  TREATING: 'Đang điều trị',
  RESOLVED: 'Đã hoàn tất điều trị',
};

const STATUS_STYLES: Record<IncidentStatus, string> = {
  OPEN: 'bg-amber-50 text-amber-700 border-amber-200',
  TREATING: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  RESOLVED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

export type IncidentSubTab = 'incident' | 'treatment' | 'history';

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Đã xảy ra lỗi';
}

type IncidentRole = 'ADMIN' | 'FARM_MANAGER' | 'TECHNICIAN' | 'FARMER';
type CreateIncidentErrors = Partial<Record<'cropId' | 'title' | 'description', string>>;

export default function IncidentDashboard({
  role,
  initialSubTab = 'incident',
  initialIncidentId,
  onClearInitialIncidentId,
}: {
  role: IncidentRole;
  initialSubTab?: 'incident' | 'treatment' | 'history' | 'board';
  initialIncidentId?: string;
  onClearInitialIncidentId?: () => void;
}) {
  const adminView = role === 'ADMIN';
  const canCreate = role !== 'ADMIN';
  const canAssign = role === 'FARM_MANAGER';
  const isFarmer = role === 'FARMER';
  const [currentUserId] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('user') || '{}').id as string | undefined;
    } catch {
      return undefined;
    }
  });
  const [subTab, setSubTab] = useState<IncidentSubTab>(() => {
    if (initialSubTab === 'history') return 'history';
    if (initialSubTab === 'treatment') return 'treatment';
    return 'incident';
  });

  useEffect(() => {
    if (initialSubTab) {
      if (initialSubTab === 'history') setSubTab('history');
      else if (initialSubTab === 'treatment') setSubTab('treatment');
      else setSubTab('incident');
    }
  }, [initialSubTab]);

  // Tự động mở ca điều trị nếu được truyền initialIncidentId (từ luồng kiểm tra sức khỏe)
  useEffect(() => {
    if (initialIncidentId) {
      let isMounted = true;
      (async () => {
        try {
          const inc = await incidentService.getById(initialIncidentId);
          if (isMounted && inc) {
            setActiveWorkspaceIncident(inc);
            setSubTab(inc.status === 'RESOLVED' ? 'history' : 'treatment');
            if (onClearInitialIncidentId) {
              onClearInitialIncidentId();
            }
          }
        } catch (err) {
          console.error('Failed to auto open initialIncidentId:', err);
        }
      })();
      return () => {
        isMounted = false;
      };
    }
  }, [initialIncidentId, onClearInitialIncidentId]);

  const primaryButtonClass = isFarmer
    ? 'from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 shadow-teal-500/30'
    : 'from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 shadow-indigo-500/30';
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [selected, setSelected] = useState<Incident | null>(null);

  // Filter states: Ao nuôi và Vụ nuôi
  const [ponds, setPonds] = useState<OverviewPond[]>([]);
  const [allCrops, setAllCrops] = useState<Crop[]>([]);
  const [selectedPondId, setSelectedPondId] = useState('');
  const [selectedCropId, setSelectedCropId] = useState('');

  const [categoryPage, setCategoryPage] = useState(1);

  const [loading, setLoading] = useState(true);
  const [loadingCrops, setLoadingCrops] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [loadingTechnicians, setLoadingTechnicians] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [treatment, setTreatment] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [activeCrops, setActiveCrops] = useState<Crop[]>([]);
  const [createForm, setCreateForm] = useState({ cropId: '', title: '', description: '' });
  const [createErrors, setCreateErrors] = useState<CreateIncidentErrors>({});
  const [technicians, setTechnicians] = useState<IncidentTechnician[]>([]);
  const [activeWorkspaceIncident, setActiveWorkspaceIncident] = useState<Incident | null>(null);

  // Load danh sách ao nuôi và vụ nuôi cho bộ lọc
  useEffect(() => {
    let isMounted = true;
    async function loadFilterMetadata() {
      try {
        const [overview, cropsData] = await Promise.allSettled([
          pondService.getOverview(),
          cropService.getAll(),
        ]);
        if (!isMounted) return;
        if (overview.status === 'fulfilled') {
          setPonds(overview.value.ponds || []);
          if (cropsData.status === 'fulfilled' && cropsData.value.length > 0) {
            setAllCrops(cropsData.value);
          } else {
            setAllCrops(overview.value.crops || []);
          }
        } else if (cropsData.status === 'fulfilled') {
          setAllCrops(cropsData.value);
        }
      } catch (err) {
        console.error('Failed to load ponds/crops metadata:', err);
      }
    }
    loadFilterMetadata();
    return () => {
      isMounted = false;
    };
  }, []);

  // Vụ nuôi được lọc theo Ao nuôi đã chọn
  const filteredCrops = useMemo(() => {
    if (!selectedPondId) return allCrops;
    return allCrops.filter(
      (crop) => crop.pondId === selectedPondId || crop.pond?.id === selectedPondId
    );
  }, [allCrops, selectedPondId]);

  const handlePondChange = (pondId: string) => {
    setSelectedPondId(pondId);
    if (selectedCropId) {
      const crop = allCrops.find((c) => c.id === selectedCropId);
      if (crop && pondId && crop.pondId !== pondId && crop.pond?.id !== pondId) {
        setSelectedCropId('');
      }
    }
  };

  const loadIncidents = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await incidentService.getAll({
        pondId: selectedPondId || undefined,
        cropId: selectedCropId || undefined,
        size: 300,
      });
      setIncidents(response.content);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }, [selectedCropId, selectedPondId]);

  useEffect(() => {
    const timeout = window.setTimeout(loadIncidents, 250);
    return () => window.clearTimeout(timeout);
  }, [loadIncidents]);

  // Danh sách sự cố sau khi qua bộ lọc Ao và Vụ nuôi
  const filteredIncidents = useMemo(() => {
    return incidents.filter((item) => {
      if (selectedPondId && item.crop?.pond?.id !== selectedPondId) return false;
      if (selectedCropId && item.crop?.id !== selectedCropId) return false;
      return true;
    });
  }, [incidents, selectedPondId, selectedCropId]);

  // 1. Sự cố mới phát sinh (Chờ can thiệp / chưa bắt đầu điều trị)
  const openIncidents = useMemo(() => {
    return filteredIncidents.filter((item) => item.status === 'OPEN' && !item.startedAt);
  }, [filteredIncidents]);

  // 2. Quá trình điều trị (Đang can thiệp / có thể điều trị nhiều đợt)
  const treatingIncidents = useMemo(() => {
    return filteredIncidents.filter(
      (item) => item.status === 'TREATING' || (item.status === 'OPEN' && !!item.startedAt)
    );
  }, [filteredIncidents]);

  // 3. Đã hoàn tất điều trị (Tôm đã khỏi bệnh)
  const resolvedIncidents = useMemo(() => {
    return filteredIncidents.filter((item) => item.status === 'RESOLVED');
  }, [filteredIncidents]);

  const activeFilterCount = [
    Boolean(selectedPondId),
    Boolean(selectedCropId),
  ].filter(Boolean).length;

  const handleResetFilters = () => {
    setSelectedPondId('');
    setSelectedCropId('');
  };

  useEffect(() => {
    setCategoryPage(1);
  }, [selectedPondId, selectedCropId, subTab]);

  const loadActiveCrops = useCallback(async () => {
    if (!canCreate) return;
    setLoadingCrops(true);
    try {
      const overview = await pondService.getOverview();
      const crops = overview.crops.filter((crop) => crop.status === 'ACTIVE');
      setActiveCrops(crops);
      setCreateForm((current) => ({
        ...current,
        cropId: crops.some((crop) => crop.id === current.cropId) ? current.cropId : crops[0]?.id || '',
      }));
    } catch (requestError) {
      setActiveCrops([]);
      setCreateForm((current) => ({ ...current, cropId: '' }));
      setError(getErrorMessage(requestError));
    } finally {
      setLoadingCrops(false);
    }
  }, [canCreate]);

  useEffect(() => {
    if (!error && !notice) return;
    const timeout = window.setTimeout(() => {
      setError('');
      setNotice('');
    }, 3500);
    return () => window.clearTimeout(timeout);
  }, [error, notice]);

  const openIncident = async (incident: Incident) => {
    setError('');
    setSelected(incident);
    setTechnicians([]);
    setLoadingDetail(true);
    setLoadingTechnicians(canAssign);

    const [detailResult, techniciansResult] = await Promise.allSettled([
      incidentService.getById(incident.id),
      canAssign
        ? incidentService.getTechnicians(incident.crop.pond.farm.id)
        : Promise.resolve([]),
    ]);

    if (detailResult.status === 'fulfilled') {
      setSelected((current) => current?.id === incident.id ? detailResult.value : current);
    } else {
      setError(getErrorMessage(detailResult.reason));
    }

    if (techniciansResult.status === 'fulfilled') {
      setTechnicians(techniciansResult.value);
    } else {
      setError(getErrorMessage(techniciansResult.reason));
    }

    setLoadingDetail(false);
    setLoadingTechnicians(false);
  };

  const closeIncident = () => {
    setSelected(null);
    setError('');
    setLoadingDetail(false);
    setLoadingTechnicians(false);
  };

  const createIncident = async () => {
    const validationErrors: CreateIncidentErrors = {};
    if (!createForm.cropId) validationErrors.cropId = 'Vui lòng chọn một vụ nuôi đang hoạt động.';
    if (!createForm.title.trim()) validationErrors.title = 'Vui lòng nhập tiêu đề sự cố.';
    if (!createForm.description.trim()) validationErrors.description = 'Vui lòng mô tả tình trạng sự cố.';
    setCreateErrors(validationErrors);

    if (Object.keys(validationErrors).length > 0) {
      setError('Vui lòng kiểm tra lại các trường được đánh dấu.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await incidentService.create(createForm);
      setShowCreate(false);
      setCreateForm({ cropId: activeCrops[0]?.id || '', title: '', description: '' });
      setCreateErrors({});
      await loadIncidents();
      setNotice('Đã báo cáo sự cố thành công.');
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setSaving(false);
    }
  };

  const openCreateIncident = () => {
    setError('');
    setCreateErrors({});
    setShowCreate(true);
    loadActiveCrops();
  };

  const updateCreateField = (field: keyof typeof createForm, value: string) => {
    setCreateForm((current) => ({ ...current, [field]: value }));
    setCreateErrors((current) => ({ ...current, [field]: undefined }));
  };

  const assignTechnician = async (assignedToId: string) => {
    if (!selected || !assignedToId) return;
    setSaving(true);
    try {
      await incidentService.assign(selected.id, assignedToId);
      await refreshSelected('Đã phân công kỹ thuật viên.');
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setSaving(false);
    }
  };

  const refreshSelected = async (message: string) => {
    if (!selected) return;
    setSelected(await incidentService.getById(selected.id));
    await loadIncidents();
    setTreatment('');
    setNotice(message);
  };

  const openTreatmentWorkspace = (inc: Incident) => {
    setSelected(null);
    setActiveWorkspaceIncident(inc);
  };

  const handleStartTreatmentDirectly = async (incident: Incident) => {
    try {
      setSaving(true);
      setError('');
      let targetInc = incident;
      if (incident.status === 'OPEN') {
        targetInc = await incidentService.startTreatment(incident.id);
      }
      setIncidents((prev) =>
        prev.map((item) => (item.id === targetInc.id ? { ...item, status: 'TREATING' } : item))
      );
      setSubTab('treatment');
      openTreatmentWorkspace(targetInc);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
      setSubTab('treatment');
      openTreatmentWorkspace(incident);
    } finally {
      setSaving(false);
    }
  };

  const reopen = async () => {
    if (!selected || !treatment.trim()) {
      setError('Vui lòng nhập lý do mở lại sự cố.');
      return;
    }
    setSaving(true);
    try {
      await incidentService.reopen(selected.id, treatment);
      await refreshSelected('Đã mở lại sự cố.');
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setSaving(false);
    }
  };

  if (activeWorkspaceIncident) {
    return (
      <TreatmentWorkspace
        incident={activeWorkspaceIncident}
        onBack={() => {
          setActiveWorkspaceIncident(null);
          loadIncidents();
        }}
        currentUserRole={role}
        currentUserId={currentUserId}
      />
    );
  }

  return (
    <div className="relative mx-auto w-full max-w-7xl space-y-6">
      {/* ── Chế độ xem: 1. Sự cố | 2. Quá trình điều trị | 3. Lịch sử (Segmented Control Pill Switcher) ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-1.5 bg-slate-100/90 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="inline-flex items-center p-1 bg-white/90 rounded-xl border border-slate-200/60 shadow-inner flex-wrap gap-1">
          {/* Tab 1: 1. Sự cố */}
          <button
            type="button"
            onClick={() => {
              setSubTab('incident');
              setCategoryPage(1);
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              subTab === 'incident'
                ? isFarmer
                  ? 'bg-amber-600 text-white shadow-sm shadow-amber-600/30'
                  : 'bg-amber-600 text-white shadow-sm shadow-amber-600/30'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/60'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>1. Sự cố</span>
            {openIncidents.length > 0 && (
              <span className={`ml-0.5 rounded-full px-2 py-0.5 text-[10px] font-black ${
                subTab === 'incident' ? 'bg-white text-amber-700' : 'bg-amber-100 text-amber-700'
              }`}>
                {openIncidents.length}
              </span>
            )}
          </button>

          {/* Tab 2: 2. Quá trình điều trị */}
          <button
            type="button"
            onClick={() => {
              setSubTab('treatment');
              setCategoryPage(1);
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              subTab === 'treatment'
                ? isFarmer
                  ? 'bg-teal-600 text-white shadow-sm shadow-teal-600/30'
                  : 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/60'
            }`}
          >
            <Stethoscope className="w-3.5 h-3.5" />
            <span>2. Quá trình điều trị</span>
            {treatingIncidents.length > 0 && (
              <span className={`ml-0.5 rounded-full px-2 py-0.5 text-[10px] font-black ${
                subTab === 'treatment' ? 'bg-white text-indigo-700' : 'bg-indigo-100 text-indigo-700'
              }`}>
                {treatingIncidents.length}
              </span>
            )}
          </button>

          {/* Tab 3: 3. Lịch sử & Nhật ký điều trị */}
          <button
            type="button"
            onClick={() => setSubTab('history')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              subTab === 'history'
                ? isFarmer
                  ? 'bg-teal-600 text-white shadow-sm shadow-teal-600/30'
                  : 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/60'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>3. Lịch sử & Nhật ký điều trị</span>
            {resolvedIncidents.length > 0 && (
              <span className={`ml-0.5 rounded-full px-2 py-0.5 text-[10px] font-black ${
                subTab === 'history' ? 'bg-white text-indigo-700' : 'bg-slate-200 text-slate-700'
              }`}>
                {resolvedIncidents.length}
              </span>
            )}
          </button>
        </div>

        <div className="hidden sm:flex items-center gap-2 pr-3 text-xs text-slate-500 font-medium">
          {subTab === 'incident' ? (
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              Sự cố mới phát sinh tại ao nuôi · Chờ tiếp nhận & phân công
            </span>
          ) : subTab === 'treatment' ? (
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
              Đang trong phác đồ can thiệp · Cập nhật thuốc nhiều lần đến khi khỏi bệnh
            </span>
          ) : (
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              Hồ sơ điều trị hoàn tất khi tôm đã hết bệnh
            </span>
          )}
        </div>
      </div>

      {(notice || error) && (
        <div className={`fixed right-6 top-6 z-[100] flex max-w-[calc(100vw-3rem)] items-center gap-3 rounded-2xl border px-4 py-3 shadow-lg animate-in slide-in-from-right-8 fade-in duration-300 ${
          error
            ? 'border-red-200 bg-red-50 text-red-700'
            : 'border-emerald-200 bg-emerald-50 text-emerald-700'
        }`}>
          {error ? <AlertCircle className="h-5 w-5 shrink-0" /> : <CheckCircle2 className="h-5 w-5 shrink-0" />}
          <p className="text-sm font-semibold">{error || notice}</p>
        </div>
      )}

      {subTab === 'history' ? (
        <IncidentTreatmentHistory
          currentUserRole={role}
          currentUserId={currentUserId}
          onOpenWorkspace={(inc) => {
            setActiveWorkspaceIncident(inc);
          }}
        />
      ) : (
        <>
          <div className={`rounded-3xl border border-white/60 bg-white/80 p-6 shadow-xl backdrop-blur-xl ${isFarmer ? 'shadow-teal-900/5' : 'shadow-indigo-900/5'}`}>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-4">
                <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br shadow-lg ${isFarmer ? 'from-teal-500 to-emerald-600 shadow-teal-500/20' : 'from-indigo-500 to-blue-600 shadow-indigo-500/20'}`}>
                  <Stethoscope className="h-7 w-7 text-white" />
                </div>
                <div>
                  <h2 className={`bg-gradient-to-r bg-clip-text text-2xl font-black tracking-tight text-transparent ${isFarmer ? 'from-teal-700 to-emerald-600' : 'from-indigo-700 to-blue-600'}`}>Sự cố & Điều trị</h2>
                  <p className="mt-1 text-sm font-medium text-slate-500">
                    {adminView
                      ? 'Giám sát sự cố trên toàn hệ thống.'
                      : role === 'FARMER'
                        ? 'Báo cáo và theo dõi tình trạng xử lý sự cố tại ao.'
                        : role === 'FARM_MANAGER'
                          ? 'Báo cáo, phân công và theo dõi xử lý sự cố trong trang trại.'
                          : 'Báo cáo và theo dõi các sự cố cùng tiến trình điều trị.'}
                  </p>
                </div>
              </div>
              <div className="flex w-full flex-wrap gap-2 lg:w-auto">
                {canCreate && (
                  <button onClick={openCreateIncident} className={`flex items-center gap-2 rounded-xl bg-gradient-to-r px-5 py-2.5 text-sm font-bold text-white shadow-lg transition-all hover:-translate-y-0.5 ${primaryButtonClass}`}>
                    <Plus className="h-4 w-4" /> Báo cáo sự cố
                  </button>
                )}
                <button onClick={loadIncidents} disabled={loading} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-700 transition-all hover:bg-slate-200 disabled:opacity-60">
                  <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Làm mới
                </button>
              </div>
            </div>

            {/* ── Bộ lọc sự cố: Tìm kiếm, Ao nuôi, Vụ nuôi, Năm, Từ ngày - Đến ngày ── */}
            <div className="mt-5 pt-4 border-t border-slate-200/70 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
                  <Filter className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Bộ lọc sự cố:</span>
                  {activeFilterCount > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 text-[11px] font-extrabold">
                      {activeFilterCount} điều kiện đang lọc
                    </span>
                  )}
                </div>

                {activeFilterCount > 0 && (
                  <button
                    type="button"
                    onClick={handleResetFilters}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-600 hover:text-rose-700 hover:underline transition-colors cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Đặt lại bộ lọc</span>
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-xl">
                {/* 1. Lọc theo Ao nuôi */}
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-cyan-600 pointer-events-none">
                    <Waves className="w-4 h-4" />
                  </div>
                  <select
                    value={selectedPondId}
                    onChange={(e) => handlePondChange(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-7 text-xs font-bold text-slate-700 outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 appearance-none cursor-pointer"
                  >
                    <option value="">Tất cả ao nuôi</option>
                    {ponds.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} {p.farm?.name ? `(${p.farm.name})` : ''}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>

                {/* 2. Lọc theo Vụ nuôi */}
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-indigo-600 pointer-events-none">
                    <Layers className="w-4 h-4" />
                  </div>
                  <select
                    value={selectedCropId}
                    onChange={(e) => setSelectedCropId(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-7 text-xs font-bold text-slate-700 outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 appearance-none cursor-pointer"
                  >
                    <option value="">Tất cả vụ nuôi</option>
                    {filteredCrops.map((c) => {
                      const pondName = c.pond?.name || ponds.find((p) => p.id === c.pondId)?.name || 'Ao';
                      const stageName = c.stage === 'NURSERY' ? 'Ương' : 'Thương phẩm';
                      const start = c.startDate ? new Date(c.startDate).toLocaleDateString('vi-VN') : '';
                      return (
                        <option key={c.id} value={c.id}>
                          {pondName} · {stageName} ({start})
                        </option>
                      );
                    })}
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>
              </div>
            </div>
          </div>

      {loading && incidents.length === 0 ? (
        <LoadingMotion
          mode="page"
          title="Đang tải dữ liệu Sự cố & Điều trị..."
          subtitle="Hệ thống đang đồng bộ danh sách sự cố, tiến trình điều trị và phân công kỹ thuật từ trang trại..."
          icon={<AlertTriangle className="w-12 h-12 text-rose-500" />}
          color="rose"
        />
      ) : loading ? (
        <LoadingMotion
          mode="card"
          title="Đang làm mới danh sách sự cố..."
          subtitle="Đang cập nhật các trạng thái và tiến trình điều trị mới nhất..."
          icon={<AlertTriangle className="w-10 h-10 text-rose-600 animate-pulse" />}
          color="rose"
        />
      ) : subTab === 'incident' ? (
        /* ══════════════ TAB 1: SỰ CỐ MỚI PHÁT SINH (CHỜ TIẾP NHẬN / CHƯA ĐIỀU TRỊ) ══════════════ */
        (() => {
          const ITEMS_PER_PAGE = 9;
          const totalPages = Math.ceil(openIncidents.length / ITEMS_PER_PAGE);
          const paginatedItems = openIncidents.slice(
            (categoryPage - 1) * ITEMS_PER_PAGE,
            categoryPage * ITEMS_PER_PAGE
          );

          return (
            <div className="w-full space-y-6 animate-in fade-in duration-300">
              {/* Header Box: 1. Sự cố */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-3xl border border-amber-200/80 bg-amber-500/10 p-5 shadow-xs backdrop-blur-xl">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white shadow-xs text-amber-600">
                    <AlertTriangle className="h-6 w-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2.5">
                      <h3 className="font-extrabold text-slate-800 text-lg leading-tight">
                        1. Danh sách sự cố mới phát sinh (Chờ xử lý / Chưa điều trị)
                      </h3>
                      <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-0.5 text-xs font-black text-amber-700">
                        {openIncidents.length} sự cố
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mt-1">
                      Giám sát các sự cố mới báo cáo từ ao nuôi cần tiếp nhận, chỉ định phác đồ hoặc bắt đầu can thiệp điều trị.
                    </p>
                  </div>
                </div>

                {totalPages > 1 && (
                  <div className="text-xs text-slate-500 font-bold self-end sm:self-center">
                    Trang {categoryPage} / {totalPages}
                  </div>
                )}
              </div>

              {/* Lưới danh sách sự cố mới */}
              {openIncidents.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-emerald-200 bg-emerald-50/40 p-12 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-100 flex items-center justify-center text-emerald-600 mb-3 shadow-xs">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <h4 className="text-base font-extrabold text-slate-800">
                    Tất cả các ao nuôi đang an toàn!
                  </h4>
                  <p className="text-xs text-slate-500 mt-1 max-w-md">
                    Hiện tại không có sự cố mới nào chờ tiếp nhận. Các sự cố đang áp dụng phác đồ nằm tại tab <strong>"2. Quá trình điều trị"</strong>.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {paginatedItems.map((incident) => (
                    <div
                      key={incident.id}
                      className="group relative flex flex-col justify-between rounded-3xl border border-white/80 bg-white p-5 text-left shadow-sm shadow-slate-200/60 backdrop-blur-lg transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:border-amber-300"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="text-base font-extrabold text-slate-800 group-hover:text-amber-600 transition-colors line-clamp-2">
                            {incident.title}
                          </h4>
                          <span className="shrink-0 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[11px] font-bold text-amber-700">
                            Sự cố mới
                          </span>
                        </div>

                        <p className="mt-2.5 line-clamp-3 text-xs font-medium text-slate-500 leading-relaxed">
                          {incident.description}
                        </p>
                      </div>

                      <div className="mt-4 space-y-2.5 border-t border-slate-100 pt-3 text-[11px] font-medium text-slate-500">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-100 text-[10px] font-bold">
                            <Building2 className="w-3 h-3 text-emerald-600" />
                            <span className="truncate max-w-[120px]">{incident.crop.pond.farm.name}</span>
                          </span>
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-cyan-50 text-cyan-800 border border-cyan-100 text-[10px] font-bold">
                            <Waves className="w-3 h-3 text-cyan-600" />
                            <span>{incident.crop.pond.name}</span>
                          </span>
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-indigo-50 text-indigo-800 border border-indigo-100 text-[10px] font-bold">
                            <Layers className="w-3 h-3 text-indigo-600" />
                            <span>{incident.crop.stage === 'NURSERY' ? 'Ương' : 'Thương phẩm'}</span>
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-xs pt-1">
                          <p className="truncate text-slate-500">
                            Phụ trách:{' '}
                            <span className="font-semibold text-slate-700">
                              {incident.assignedTo?.fullName || 'Chưa phân công'}
                            </span>
                          </p>
                          <span className="text-[10px] text-slate-400">
                            {new Date(incident.createdAt).toLocaleDateString('vi-VN')}
                          </span>
                        </div>

                        <div className="pt-2 border-t border-slate-100 flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => openIncident(incident)}
                            className="px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs transition-all cursor-pointer shadow-xs"
                            title="Xem chi tiết & phân công"
                          >
                            Chi tiết
                          </button>
                          <button
                            type="button"
                            onClick={() => handleStartTreatmentDirectly(incident)}
                            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white font-bold text-xs transition-all shadow-md shadow-amber-600/20 cursor-pointer"
                          >
                            <Stethoscope className="w-3.5 h-3.5" />
                            <span>Tiếp nhận & Vào điều trị</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Phân trang nếu > 9 */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 pt-4">
                  <button
                    type="button"
                    onClick={() => setCategoryPage((p) => Math.max(1, p - 1))}
                    disabled={categoryPage === 1}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" /> Trước
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                    <button
                      key={page}
                      type="button"
                      onClick={() => setCategoryPage(page)}
                      className={`w-8 h-8 rounded-xl text-xs font-black transition-all cursor-pointer ${
                        categoryPage === page
                          ? 'bg-amber-600 text-white shadow-xs'
                          : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {page}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setCategoryPage((p) => Math.min(totalPages, p + 1))}
                    disabled={categoryPage === totalPages}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    Sau <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          );
        })()
      ) : (
        /* ══════════════ TAB 2: QUÁ TRÌNH CAN THIỆP & THEO DÕI ĐIỀU TRỊ ══════════════ */
        (() => {
          const ITEMS_PER_PAGE = 9;
          const totalPages = Math.ceil(treatingIncidents.length / ITEMS_PER_PAGE);
          const paginatedItems = treatingIncidents.slice(
            (categoryPage - 1) * ITEMS_PER_PAGE,
            categoryPage * ITEMS_PER_PAGE
          );

          return (
            <div className="w-full space-y-6 animate-in fade-in duration-300">
              {/* Header Box: 2. Quá trình điều trị */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-3xl border border-indigo-200/80 bg-indigo-500/10 p-5 shadow-xs backdrop-blur-xl">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white shadow-xs text-indigo-600">
                    <Stethoscope className="h-6 w-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2.5">
                      <h3 className="font-extrabold text-slate-800 text-lg leading-tight">
                        2. Quá trình can thiệp & Theo dõi điều trị
                      </h3>
                      <span className="rounded-full border border-indigo-200 bg-indigo-50 px-3 py-0.5 text-xs font-black text-indigo-700">
                        {treatingIncidents.length} ao đang điều trị
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mt-1">
                      Các sự cố đang trong phác đồ can thiệp. Bạn có thể cập nhật thuốc/vật tư và điều trị nhiều đợt liên tiếp cho đến khi tôm khỏi bệnh để hoàn tất hồ sơ.
                    </p>
                  </div>
                </div>

                {totalPages > 1 && (
                  <div className="text-xs text-slate-500 font-bold self-end sm:self-center">
                    Trang {categoryPage} / {totalPages}
                  </div>
                )}
              </div>

              {/* Lưới danh sách sự cố đang điều trị */}
              {treatingIncidents.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-indigo-200 bg-indigo-50/40 p-12 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-100 flex items-center justify-center text-indigo-600 mb-3 shadow-xs">
                    <Stethoscope className="w-6 h-6" />
                  </div>
                  <h4 className="text-base font-extrabold text-slate-800">
                    Hiện không có ao nào đang trong quá trình điều trị
                  </h4>
                  <p className="text-xs text-slate-500 mt-1 max-w-md">
                    Sau khi tiếp nhận sự cố mới từ tab <strong>"1. Sự cố"</strong> và bắt đầu xử lý, sự cố sẽ chuyển vào đây để bạn có thể xuất thuốc và theo dõi nhiều đợt.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {paginatedItems.map((incident) => (
                    <div
                      key={incident.id}
                      className="group relative flex flex-col justify-between rounded-3xl border border-white/80 bg-white p-5 text-left shadow-sm shadow-slate-200/60 backdrop-blur-lg transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:border-indigo-300"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="text-base font-extrabold text-slate-800 group-hover:text-indigo-600 transition-colors line-clamp-2">
                            {incident.title}
                          </h4>
                          <span className="shrink-0 rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-0.5 text-[11px] font-bold text-indigo-700">
                            Đang điều trị
                          </span>
                        </div>

                        <p className="mt-2.5 line-clamp-2 text-xs font-medium text-slate-500 leading-relaxed">
                          {incident.description}
                        </p>
                      </div>

                      <div className="mt-4 space-y-2.5 border-t border-slate-100 pt-3 text-[11px] font-medium text-slate-500">
                        {/* Tags Farm, Pond, Stage */}
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-100 text-[10px] font-bold">
                            <Building2 className="w-3 h-3 text-emerald-600" />
                            <span className="truncate max-w-[120px]">{incident.crop.pond.farm.name}</span>
                          </span>
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-cyan-50 text-cyan-800 border border-cyan-100 text-[10px] font-bold">
                            <Waves className="w-3 h-3 text-cyan-600" />
                            <span>{incident.crop.pond.name}</span>
                          </span>
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-indigo-50 text-indigo-800 border border-indigo-100 text-[10px] font-bold">
                            <Layers className="w-3 h-3 text-indigo-600" />
                            <span>{incident.crop.stage === 'NURSERY' ? 'Ương' : 'Thương phẩm'}</span>
                          </span>
                        </div>

                        {/* Can thiệp gần nhất */}
                        <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-2.5 text-xs">
                          <div className="flex items-center justify-between text-[11px] font-bold text-indigo-950">
                            <span>Đã can thiệp:</span>
                            <span className="text-indigo-700 font-extrabold">{incident._count?.updates ?? 0} đợt điều trị</span>
                          </div>
                          {incident.treatment && (
                            <p className="mt-1 line-clamp-2 text-[11px] font-medium text-slate-600">
                              {incident.treatment}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center justify-between text-xs pt-1">
                          <p className="truncate text-slate-500">
                            Phụ trách:{' '}
                            <span className="font-semibold text-slate-700">
                              {incident.assignedTo?.fullName || 'Chưa phân công'}
                            </span>
                          </p>
                          <span className="text-[10px] text-slate-400">
                            Bắt đầu: {incident.startedAt ? new Date(incident.startedAt).toLocaleDateString('vi-VN') : 'Gần đây'}
                          </span>
                        </div>

                        <div className="pt-2 border-t border-slate-100 flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => openIncident(incident)}
                            className="px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs transition-all cursor-pointer shadow-xs"
                            title="Xem chi tiết & lịch sử"
                          >
                            Chi tiết
                          </button>
                          <button
                            type="button"
                            onClick={() => openTreatmentWorkspace(incident)}
                            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white font-bold text-xs transition-all shadow-md shadow-indigo-600/20 cursor-pointer"
                          >
                            <Stethoscope className="w-3.5 h-3.5" />
                            <span>Cập nhật điều trị / Nhập thuốc</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Phân trang nếu > 9 */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 pt-4">
                  <button
                    type="button"
                    onClick={() => setCategoryPage((p) => Math.max(1, p - 1))}
                    disabled={categoryPage === 1}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" /> Trước
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                    <button
                      key={page}
                      type="button"
                      onClick={() => setCategoryPage(page)}
                      className={`w-8 h-8 rounded-xl text-xs font-black transition-all cursor-pointer ${
                        categoryPage === page
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {page}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setCategoryPage((p) => Math.min(totalPages, p + 1))}
                    disabled={categoryPage === totalPages}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    Sau <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          );
        })()
      )}

      {showCreate && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/60 p-4 sm:p-6 backdrop-blur-md animate-in fade-in duration-200">
          <div className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-white/60 bg-white shadow-2xl backdrop-blur-xl animate-in zoom-in-95 duration-200">
            <div className="flex shrink-0 items-center justify-between border-b border-slate-100 bg-slate-50/80 px-6 py-4">
              <div><h3 className="text-xl font-black text-slate-800">Báo cáo sự cố</h3><p className="text-sm text-slate-500">Ghi nhận sự cố cho một vụ nuôi đang hoạt động.</p></div>
              <button onClick={() => { setShowCreate(false); setCreateErrors({}); }} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100"><X className="h-5 w-5" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div><label className="mb-1 block text-sm font-bold text-slate-700">Vụ nuôi <span className="text-red-500">*</span></label><select value={createForm.cropId} onChange={(event) => updateCreateField('cropId', event.target.value)} aria-invalid={Boolean(createErrors.cropId)} className={`w-full rounded-xl border bg-white p-3 text-sm outline-none ${createErrors.cropId ? 'border-red-400 bg-red-50/40 focus:border-red-500' : 'border-slate-200 focus:border-indigo-400'}`}>
                {loadingCrops && <option value="">Đang tải vụ nuôi...</option>}
                {!loadingCrops && activeCrops.length === 0 && <option value="">Không có vụ nuôi đang hoạt động</option>}
                {activeCrops.map((crop) => <option key={crop.id} value={crop.id}>{crop.pond.farm?.name || 'Trang trại'} · {crop.pond.name} · {new Date(crop.startDate).toLocaleDateString('vi-VN')}</option>)}
              </select>{createErrors.cropId && <p className="mt-1.5 flex items-center gap-1 text-xs font-semibold text-red-600"><AlertCircle className="h-3.5 w-3.5" />{createErrors.cropId}</p>}</div>
              <div><div className="mb-1 flex items-center justify-between"><label className="text-sm font-bold text-slate-700">Tiêu đề <span className="text-red-500">*</span></label><span className="text-xs text-slate-400">{createForm.title.length}/200</span></div><input value={createForm.title} onChange={(event) => updateCreateField('title', event.target.value)} maxLength={200} aria-invalid={Boolean(createErrors.title)} className={`w-full rounded-xl border p-3 text-sm outline-none ${createErrors.title ? 'border-red-400 bg-red-50/40 focus:border-red-500' : 'border-slate-200 focus:border-indigo-400'}`} placeholder="Ví dụ: Tôm nổi đầu bất thường" />{createErrors.title && <p className="mt-1.5 flex items-center gap-1 text-xs font-semibold text-red-600"><AlertCircle className="h-3.5 w-3.5" />{createErrors.title}</p>}</div>
              <div><div className="mb-1 flex items-center justify-between"><label className="text-sm font-bold text-slate-700">Mô tả <span className="text-red-500">*</span></label><span className="text-xs text-slate-400">{createForm.description.length}/2000</span></div><textarea value={createForm.description} onChange={(event) => updateCreateField('description', event.target.value)} maxLength={2000} rows={5} aria-invalid={Boolean(createErrors.description)} className={`w-full rounded-xl border p-3 text-sm outline-none ${createErrors.description ? 'border-red-400 bg-red-50/40 focus:border-red-500' : 'border-slate-200 focus:border-indigo-400'}`} placeholder="Mô tả dấu hiệu, thời gian phát hiện và tình trạng hiện tại..." />{createErrors.description && <p className="mt-1.5 flex items-center gap-1 text-xs font-semibold text-red-600"><AlertCircle className="h-3.5 w-3.5" />{createErrors.description}</p>}</div>
              <p className="text-xs text-slate-400"><span className="font-bold text-red-500">*</span> Trường bắt buộc</p>
              <div className="flex gap-3"><button onClick={() => { setShowCreate(false); setCreateErrors({}); }} disabled={saving} className="flex-1 rounded-xl bg-slate-100 py-3 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-200">Hủy</button><button onClick={createIncident} disabled={saving || loadingCrops || activeCrops.length === 0} className={`flex-1 rounded-xl bg-gradient-to-r py-3 text-sm font-bold text-white shadow-lg transition-all disabled:opacity-50 ${primaryButtonClass}`}>{saving ? 'Đang gửi...' : 'Gửi báo cáo'}</button></div>
            </div>
          </div>
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/60 p-4 sm:p-6 backdrop-blur-md animate-in fade-in duration-200">
          <div className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-white/60 bg-white shadow-2xl backdrop-blur-xl animate-in zoom-in-95 duration-200">
            <div className="flex shrink-0 items-start justify-between border-b border-slate-100 bg-slate-50/90 px-6 py-4">
              <div>
                <div className="flex items-center gap-3">
                  <h3 className="text-xl font-black text-slate-800">{selected.title}</h3>
                  <span className={`rounded-full border px-3 py-1 text-xs font-bold ${STATUS_STYLES[selected.status]}`}>{STATUS_LABELS[selected.status]}</span>
                </div>
                {/* RÕ THÔNG TIN TRANG TRẠI - AO - VỤ NUÔI */}
                <div className="mt-2.5 flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold shadow-2xs">
                    <Building2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Trang trại: <strong>{selected.crop.pond.farm.name}</strong></span>
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-cyan-50 text-cyan-800 border border-cyan-200 text-xs font-bold shadow-2xs">
                    <Waves className="w-3.5 h-3.5 text-cyan-600" />
                    <span>Ao nuôi: <strong>{selected.crop.pond.name}</strong></span>
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-indigo-50 text-indigo-800 border border-indigo-200 text-xs font-bold shadow-2xs">
                    <Layers className="w-3.5 h-3.5 text-indigo-600" />
                    <span>
                      Vụ nuôi: <strong>{selected.crop.stage === 'NURSERY' ? 'Vụ Ương' : 'Vụ Thương phẩm'}</strong>
                      {selected.crop.status ? ` (${selected.crop.status === 'ACTIVE' ? 'Đang nuôi' : 'Đã thu'})` : ''}
                      {selected.crop.startDate ? ` • Bắt đầu ${new Date(selected.crop.startDate).toLocaleDateString('vi-VN')}` : ''}
                    </span>
                  </span>
                </div>
              </div>
              <button onClick={closeIncident} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 transition-colors cursor-pointer"><X className="h-5 w-5" /></button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-6 p-6">
              <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600 border border-slate-100 space-y-3">
                <div>
                  <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider block mb-1">
                    Mô tả dấu hiệu sự cố
                  </span>
                  <p className="text-slate-800 font-semibold leading-relaxed">{selected.description}</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-slate-200/80 text-xs">
                  <div>
                    <span className="text-slate-400">Người báo cáo:</span>
                    <p className="mt-0.5 font-bold text-slate-700">{selected.reporter?.fullName || 'Dữ liệu cũ chưa ghi nhận'}</p>
                  </div>
                  <div>
                    <span className="text-slate-400">Phụ trách điều trị:</span>
                    <p className="mt-0.5 font-bold text-indigo-600">{selected.assignedTo?.fullName || 'Chưa phân công'}</p>
                  </div>
                  <div>
                    <span className="text-slate-400">Thời điểm phát hiện:</span>
                    <p className="mt-0.5 font-bold text-slate-700">{new Date(selected.createdAt).toLocaleString('vi-VN')}</p>
                  </div>
                  {selected.resolvedAt && (
                    <div>
                      <span className="text-slate-400">Thời điểm xử lý xong:</span>
                      <p className="mt-0.5 font-bold text-emerald-600">{new Date(selected.resolvedAt).toLocaleString('vi-VN')}</p>
                    </div>
                  )}
                </div>
              </div>

              {canAssign && (
                <div className="rounded-2xl border border-slate-200 p-4">
                  <label className="mb-2 block text-sm font-black text-slate-700">Phân công kỹ thuật viên</label>
                  <select value={selected.assignedToId || ''} onChange={(event) => assignTechnician(event.target.value)} disabled={saving || loadingTechnicians} className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm outline-none focus:border-indigo-400 disabled:cursor-wait disabled:opacity-60">
                    <option value="">Chưa phân công</option>
                    {technicians.map((technician) => <option key={technician.id} value={technician.id}>{technician.fullName} · {technician.email}</option>)}
                  </select>
                  {loadingTechnicians ? (
                    <p className="mt-2 flex items-center gap-2 text-xs text-slate-500"><RefreshCw className="h-3.5 w-3.5 animate-spin" /> Đang tải danh sách kỹ thuật viên...</p>
                  ) : technicians.length === 0 && <p className="mt-2 text-xs text-amber-600">Trang trại chưa có kỹ thuật viên đang hoạt động.</p>}
                </div>
              )}

              <div>
                <h4 className="mb-3 flex items-center gap-2 font-black text-slate-700"><Clock3 className="h-4 w-4" /> Tiến trình điều trị</h4>
                {loadingDetail ? (
                  <div className="flex items-center gap-2 rounded-2xl bg-slate-50 p-4 text-sm font-semibold text-slate-500">
                    <RefreshCw className="h-4 w-4 animate-spin text-indigo-500" /> Đang tải tiến trình điều trị...
                  </div>
                ) : selected.updates?.length ? (
                  <div className="space-y-3 border-l-2 border-indigo-100 pl-5">
                    {selected.updates.map((update) => (
                      <div key={update.id} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                        <div className="flex justify-between gap-3"><strong className="text-sm text-slate-700">{update.author.fullName}</strong><span className="text-xs text-slate-400">{new Date(update.createdAt).toLocaleString('vi-VN')}</span></div>
                        <p className="mt-2 text-sm text-slate-700"><strong>{update.eventType === 'TREATMENT' || update.eventType === 'RESOLVED' ? 'Điều trị' : 'Sự kiện'}:</strong> {update.treatment}</p>
                        {update.observation && <p className="mt-1 text-sm text-slate-500"><strong>Quan sát:</strong> {update.observation}</p>}
                        {update.result && <p className="mt-1 text-sm text-slate-500"><strong>Kết quả:</strong> {update.result}</p>}
                      </div>
                    ))}
                  </div>
                ) : <p className="text-sm text-slate-400">Chưa có cập nhật điều trị.</p>}
              </div>

              {!loadingDetail && (
                role === 'FARM_MANAGER' && selected.status === 'RESOLVED' ? (
                  <div className="space-y-3">
                    <button
                      onClick={() => openTreatmentWorkspace(selected)}
                      className="w-full flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-600 to-blue-600 py-3.5 text-sm font-bold text-white shadow-lg hover:from-indigo-700 hover:to-blue-700 transition-all"
                    >
                      <Bot className="h-4 w-4 text-cyan-300" /> Xem trang điều trị & Phân tích AI (Kho vật tư)
                    </button>
                    <div className="space-y-3 rounded-2xl border border-amber-100 bg-amber-50/40 p-4">
                      <h4 className="font-black text-amber-900">Mở lại sự cố</h4>
                      <textarea value={treatment} onChange={(event) => setTreatment(event.target.value)} rows={3} placeholder="Lý do mở lại..." className="w-full rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-amber-400" />
                      <button onClick={reopen} disabled={saving} className="w-full rounded-xl bg-amber-500 py-2.5 text-sm font-bold text-white disabled:opacity-50">Mở lại</button>
                    </div>
                  </div>
                ) : role !== 'TECHNICIAN' ? (
                  <div className="space-y-3">
                    <button
                      onClick={() => openTreatmentWorkspace(selected)}
                      className="w-full flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-600 to-blue-600 py-3.5 text-sm font-bold text-white shadow-lg hover:from-indigo-700 hover:to-blue-700 transition-all"
                    >
                      <Bot className="h-4 w-4 text-cyan-300" /> Mở trang điều trị & Phân tích AI (Kho vật tư)
                    </button>
                    <div className="rounded-xl bg-slate-50 p-3 text-center text-sm font-semibold text-slate-500">
                      Bạn có thể theo dõi tiến trình; việc điều trị do kỹ thuật viên được phân công thực hiện.
                    </div>
                  </div>
                ) : selected.assignedToId !== currentUserId ? (
                  <div className="space-y-3">
                    <button
                      onClick={() => openTreatmentWorkspace(selected)}
                      className="w-full flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-600 to-blue-600 py-3.5 text-sm font-bold text-white shadow-lg hover:from-indigo-700 hover:to-blue-700 transition-all"
                    >
                      <Bot className="h-4 w-4 text-cyan-300" /> Mở trang điều trị & Phân tích AI (Kho vật tư)
                    </button>
                    <div className="rounded-xl bg-amber-50 p-3 text-center text-sm font-semibold text-amber-700">
                      Sự cố này chưa được giao cho bạn nên bạn không thể cập nhật điều trị.
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <button
                      onClick={() => openTreatmentWorkspace(selected)}
                      className="w-full flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-600 to-blue-600 py-3.5 text-sm font-bold text-white shadow-lg hover:from-indigo-700 hover:to-blue-700 transition-all cursor-pointer"
                    >
                      <Stethoscope className="h-4 w-4" /> Mở trang điều trị & Phân tích AI (Kho vật tư)
                    </button>
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      )}
        </>
      )}
    </div>
  );
}
