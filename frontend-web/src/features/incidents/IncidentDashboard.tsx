import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, AlertTriangle, Bot, CheckCircle2, Clock3, Plus, RefreshCw, Search, Stethoscope, X } from 'lucide-react';
import { incidentService, type Incident, type IncidentStatus, type IncidentTechnician } from '../../services/incident.service';
import { type Crop } from '../../services/crop.service';
import { pondService } from '../../services/pond.service';
import LoadingMotion from '../../components/LoadingMotion';
import TreatmentWorkspace from './TreatmentWorkspace';

const STATUS_LABELS: Record<IncidentStatus, string> = {
  OPEN: 'Chờ xử lý',
  TREATING: 'Đang điều trị',
  RESOLVED: 'Đã xử lý',
};

const STATUS_STYLES: Record<IncidentStatus, string> = {
  OPEN: 'bg-amber-50 text-amber-700 border-amber-200',
  TREATING: 'bg-blue-50 text-blue-700 border-blue-200',
  RESOLVED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

const STATUS_CONFIG: Record<IncidentStatus, {
  label: string;
  badgeStyle: string;
  headerBg: string;
  headerText: string;
  headerBorder: string;
  icon: typeof AlertTriangle;
  emptyText: string;
}> = {
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
    label: 'Đã xử lý',
    badgeStyle: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    headerBg: 'bg-emerald-500/10 border-emerald-200/80 text-emerald-900',
    headerText: 'text-emerald-600',
    headerBorder: 'border-emerald-200',
    icon: CheckCircle2,
    emptyText: 'Không có sự cố đã xử lý',
  },
};

const ALL_STATUSES: IncidentStatus[] = ['OPEN', 'TREATING', 'RESOLVED'];

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Đã xảy ra lỗi';
}

type IncidentRole = 'ADMIN' | 'FARM_MANAGER' | 'TECHNICIAN' | 'FARMER';
type CreateIncidentErrors = Partial<Record<'cropId' | 'title' | 'description', string>>;

export default function IncidentDashboard({ role }: { role: IncidentRole }) {
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
  const primaryButtonClass = isFarmer
    ? 'from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 shadow-teal-500/30'
    : 'from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 shadow-indigo-500/30';
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [selected, setSelected] = useState<Incident | null>(null);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [assignedToMe, setAssignedToMe] = useState(role === 'TECHNICIAN');
  const [loading, setLoading] = useState(true);
  const [loadingCrops, setLoadingCrops] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [loadingTechnicians, setLoadingTechnicians] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [treatment, setTreatment] = useState('');
  const [observation, setObservation] = useState('');
  const [result, setResult] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [activeCrops, setActiveCrops] = useState<Crop[]>([]);
  const [createForm, setCreateForm] = useState({ cropId: '', title: '', description: '' });
  const [createErrors, setCreateErrors] = useState<CreateIncidentErrors>({});
  const [technicians, setTechnicians] = useState<IncidentTechnician[]>([]);
  const [activeWorkspaceIncident, setActiveWorkspaceIncident] = useState<Incident | null>(null);

  const loadIncidents = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await incidentService.getAll({
        status: status || undefined,
        assignedToMe: adminView ? false : assignedToMe,
        search: search.trim() || undefined,
      });
      setIncidents(response.content);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }, [adminView, assignedToMe, search, status]);

  useEffect(() => {
    const timeout = window.setTimeout(loadIncidents, 250);
    return () => window.clearTimeout(timeout);
  }, [loadIncidents]);

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
    setObservation('');
    setResult('');
    setNotice(message);
  };

  const openTreatmentWorkspace = (inc: Incident) => {
    setSelected(null);
    setActiveWorkspaceIncident(inc);
  };

  const startTreatment = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      const updated = await incidentService.startTreatment(selected.id);
      setSelected(null);
      setActiveWorkspaceIncident(updated);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setSaving(false);
    }
  };

  const submitUpdate = async (resolve = false) => {
    if (!selected || !treatment.trim()) {
      setError('Vui lòng nhập biện pháp điều trị.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      if (resolve) {
        await incidentService.resolve(selected.id, { treatment, result: result || undefined });
        await refreshSelected('Đã đánh dấu sự cố là đã xử lý.');
      } else {
        await incidentService.addUpdate(selected.id, {
          treatment,
          observation: observation || undefined,
          result: result || undefined,
        });
        await refreshSelected('Đã thêm cập nhật điều trị.');
      }
    } catch (requestError) {
      setError(getErrorMessage(requestError));
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

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm tên hoặc mô tả sự cố..." className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-indigo-400" />
          </div>
          <select value={status} onChange={(event) => setStatus(event.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 outline-none focus:border-indigo-400">
            <option value="">Tất cả trạng thái</option>
            <option value="OPEN">Chờ xử lý</option>
            <option value="TREATING">Đang điều trị</option>
            <option value="RESOLVED">Đã xử lý</option>
          </select>
          {role === 'TECHNICIAN' && (
            <label className="flex items-center gap-3 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700">
              <input type="checkbox" checked={assignedToMe} onChange={(event) => setAssignedToMe(event.target.checked)} /> Chỉ sự cố giao cho tôi
            </label>
          )}
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
      ) : (
        (() => {
          const visibleStatuses: IncidentStatus[] = status
            ? [(status as IncidentStatus)]
            : ALL_STATUSES;

          return (
            <div className={`grid gap-6 ${visibleStatuses.length === 1 ? 'grid-cols-1 max-w-xl mx-auto' : 'grid-cols-1 lg:grid-cols-3'}`}>
              {visibleStatuses.map((statusKey) => {
                const config = STATUS_CONFIG[statusKey];
                const StatusIcon = config.icon;
                const items = incidents.filter((item) => item.status === statusKey);

                return (
                  <div
                    key={statusKey}
                    className="flex flex-col rounded-3xl border border-slate-200/80 bg-slate-50/60 p-4 shadow-sm backdrop-blur-xl min-h-[450px]"
                  >
                    {/* Header Cột Trạng Thái */}
                    <div className={`flex items-center justify-between rounded-2xl border ${config.headerBorder} ${config.headerBg} p-3.5 mb-4 shadow-xs`}>
                      <div className="flex items-center gap-2.5">
                        <div className={`flex h-9 w-9 items-center justify-center rounded-xl bg-white shadow-xs ${config.headerText}`}>
                          <StatusIcon className="h-5 w-5" />
                        </div>
                        <div>
                          <h3 className="font-extrabold text-slate-800 text-base leading-tight">
                            {config.label}
                          </h3>
                          <span className="text-xs font-medium text-slate-500">
                            {items.length} sự cố
                          </span>
                        </div>
                      </div>
                      <span className={`rounded-full border px-3 py-1 text-xs font-bold ${STATUS_STYLES[statusKey]}`}>
                        {items.length}
                      </span>
                    </div>

                    {/* Danh Sách Thẻ Sự Cố Theo Trạng Thái */}
                    <div className="flex-1 space-y-3.5">
                      {items.length === 0 ? (
                        <div className="flex h-44 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white/70 p-4 text-center">
                          <StatusIcon className="mb-2 h-7 w-7 text-slate-300" />
                          <p className="text-sm font-bold text-slate-400">{config.emptyText}</p>
                        </div>
                      ) : (
                        items.map((incident) => (
                          <button
                            key={incident.id}
                            onClick={() => openIncident(incident)}
                            className={`w-full group rounded-2xl border border-white/80 bg-white p-4 text-left shadow-sm shadow-slate-200/60 backdrop-blur-lg transition-all duration-300 hover:-translate-y-1 hover:shadow-md ${
                              isFarmer ? 'hover:border-teal-300 hover:shadow-teal-500/10' : 'hover:border-indigo-300 hover:shadow-indigo-500/10'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <h4 className="text-base font-extrabold text-slate-800 group-hover:text-indigo-600 transition-colors line-clamp-2">
                                {incident.title}
                              </h4>
                              <span className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${STATUS_STYLES[incident.status]}`}>
                                {STATUS_LABELS[incident.status]}
                              </span>
                            </div>

                            <p className="mt-2 line-clamp-2 text-xs font-medium text-slate-500 leading-relaxed">
                              {incident.description}
                            </p>

                            <div className="mt-3 space-y-1 border-t border-slate-100 pt-2.5 text-[11px] font-medium text-slate-500">
                              <p className="truncate">
                                <strong className="text-slate-700">{incident.crop.pond.farm.name}</strong> · {incident.crop.pond.name}
                              </p>
                              <p className="truncate text-slate-500">
                                Phụ trách: <span className="font-semibold text-slate-700">{incident.assignedTo?.fullName || 'Chưa phân công'}</span>
                              </p>
                              <div className="flex items-center justify-between pt-1 text-[10px] text-slate-400">
                                <span>{incident._count?.updates ?? 0} cập nhật</span>
                                <span>{new Date(incident.updatedAt).toLocaleDateString('vi-VN')}</span>
                              </div>
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
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
                <p className="mt-1 text-sm text-slate-500">{selected.crop.pond.farm.name} · {selected.crop.pond.name}</p>
              </div>
              <button onClick={closeIncident} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100"><X className="h-5 w-5" /></button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-6 p-6">
              <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
                <p>{selected.description}</p>
                <p className="mt-2 text-xs">Người báo cáo: <strong>{selected.reporter?.fullName || 'Dữ liệu cũ chưa ghi nhận'}</strong></p>
                <p className="mt-2 text-xs">Phụ trách: <strong>{selected.assignedTo?.fullName || 'Chưa phân công'}</strong></p>
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
                  <div className="space-y-3 rounded-2xl border border-amber-100 bg-amber-50/40 p-4">
                    <h4 className="font-black text-amber-900">Mở lại sự cố</h4>
                    <textarea value={treatment} onChange={(event) => setTreatment(event.target.value)} rows={3} placeholder="Lý do mở lại..." className="w-full rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-amber-400" />
                    <button onClick={reopen} disabled={saving} className="w-full rounded-xl bg-amber-500 py-2.5 text-sm font-bold text-white disabled:opacity-50">Mở lại</button>
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
                ) : selected.status === 'OPEN' ? (
                  <button onClick={startTreatment} disabled={saving} className="w-full flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-600 to-blue-600 py-3.5 text-sm font-bold text-white shadow-lg hover:from-indigo-700 hover:to-blue-700 disabled:opacity-50 transition-all">
                    <Stethoscope className="h-4 w-4" /> Bắt đầu điều trị (Mở trang AI & Vật tư kho)
                  </button>
                ) : (
                  <div className="space-y-3 rounded-2xl border border-indigo-100 bg-indigo-50/40 p-4">
                    <button
                      onClick={() => openTreatmentWorkspace(selected)}
                      className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 py-3 text-sm font-bold text-white shadow-md hover:from-indigo-700 hover:to-blue-700 transition-all"
                    >
                      <Bot className="h-4 w-4 text-cyan-300" /> Mở trang điều trị & Phân tích AI (Kho vật tư)
                    </button>

                    <h4 className="flex items-center gap-2 font-black text-indigo-900 pt-2"><Stethoscope className="h-4 w-4" /> {selected.status === 'RESOLVED' ? 'Mở lại sự cố' : 'Cập nhật điều trị Nhanh'}</h4>
                    <textarea value={treatment} onChange={(event) => setTreatment(event.target.value)} rows={3} placeholder={selected.status === 'RESOLVED' ? 'Lý do mở lại...' : 'Biện pháp điều trị đã thực hiện...'} className="w-full rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-indigo-400" />
                    {selected.status === 'TREATING' && (
                      <>
                        <textarea value={observation} onChange={(event) => setObservation(event.target.value)} rows={2} placeholder="Quan sát sau điều trị (không bắt buộc)..." className="w-full rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-indigo-400" />
                        <textarea value={result} onChange={(event) => setResult(event.target.value)} rows={2} placeholder="Kết quả (không bắt buộc)..." className="w-full rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-indigo-400" />
                      </>
                    )}
                    <div className="flex gap-3">
                      {selected.status === 'RESOLVED' ? (
                        <button onClick={reopen} disabled={saving} className="flex-1 rounded-xl bg-amber-500 py-2.5 text-sm font-bold text-white disabled:opacity-50">Mở lại</button>
                      ) : (
                        <>
                          <button onClick={() => submitUpdate(false)} disabled={saving} className="flex-1 rounded-xl bg-indigo-600 py-2.5 text-sm font-bold text-white disabled:opacity-50">Lưu cập nhật</button>
                          <button onClick={() => submitUpdate(true)} disabled={saving} className="flex-1 rounded-xl bg-emerald-600 py-2.5 text-sm font-bold text-white disabled:opacity-50">Đã xử lý</button>
                        </>
                      )}
                    </div>
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
