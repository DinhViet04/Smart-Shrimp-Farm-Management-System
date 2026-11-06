import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  History,
  Layers,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
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

export const INCIDENT_CATEGORIES = [
  { id: 'Sức khỏe & Dịch bệnh', label: 'Bệnh tôm / Sức khỏe', icon: '🦐', placeholder: 'Ví dụ: Tôm nổi đầu tấp mé bờ lúc sáng sớm' },
  { id: 'Môi trường nước', label: 'Môi trường & Nước ao', icon: '💧', placeholder: 'Ví dụ: Khí độc NO2 vượt ngưỡng 5.0mg/l, oxy hòa tan giảm mạnh' },
  { id: 'Thiết bị & Máy móc', label: 'Thiết bị & Quạt nước', icon: '⚙️', placeholder: 'Ví dụ: Dàn quạt nước số 2 bị kẹt trục, máy sục khí ngưng hoạt động' },
  { id: 'Điện lưới & Năng lượng', label: 'Điện & Máy phát', icon: '⚡', placeholder: 'Ví dụ: Mất điện lưới trạm bơm, máy phát dự phòng không tự nổ' },
  { id: 'Bờ ao & Hạ tầng', label: 'Bờ ao & Bạt HDPE', icon: '🏞️', placeholder: 'Ví dụ: Rò rỉ bạt lót bờ tây ao A1, sạt lở mé mương thoát nước' },
  { id: 'Kho thức ăn & Vật tư', label: 'Kho thức ăn & Thuốc', icon: '📦', placeholder: 'Ví dụ: Phát hiện bao cám ẩm mốc, thiếu hóa chất vôi tạt cấp bách' },
  { id: 'Sự cố khác / An ninh', label: 'An ninh & Sự cố khác', icon: '🚨', placeholder: 'Ví dụ: Mưa dông bão làm rách lưới che, người lạ tiếp cận khu vực nuôi' },
];

export const INCIDENT_SEVERITIES = [
  { id: 'Thấp', label: 'Thấp', sublabel: 'Theo dõi thường kỳ', color: 'border-slate-200 bg-slate-50 text-slate-700' },
  { id: 'Trung bình', label: 'Trung bình', sublabel: 'Cần kiểm tra trong ca', color: 'border-blue-200 bg-blue-50 text-blue-700' },
  { id: 'Cao', label: 'Cao', sublabel: 'Cần xử lý sớm', color: 'border-amber-200 bg-amber-50 text-amber-800' },
  { id: 'Khẩn cấp', label: 'Khẩn cấp', sublabel: 'Nguy cơ thiệt hại tức thì', color: 'border-rose-300 bg-rose-50 text-rose-700 font-bold' },
];

export function parseIncidentMetadata(title: string, description: string) {
  let category = '';
  let cleanTitle = title;
  const catMatch = title.match(/^\[(.*?)\]/);
  if (catMatch) {
    category = catMatch[1];
    cleanTitle = title.replace(/^\[(.*?)\]\s*/, '');
  } else {
    const descCatMatch = description.match(/\[Phân loại:\s*(.*?)\]/i);
    if (descCatMatch) category = descCatMatch[1];
  }

  let severity = '';
  const descSevMatch = description.match(/\[Mức độ:\s*(.*?)\]/i);
  if (descSevMatch) severity = descSevMatch[1];

  let location = '';
  const descLocMatch = description.match(/\[Vị trí:\s*(.*?)\]/i);
  if (descLocMatch) location = descLocMatch[1];

  const cleanDescription = description.replace(/^(\[.*?\]\s*)+\n*/, '').trim();

  return { category, severity, location, cleanTitle, cleanDescription };
}

export function renderCategoryBadge(category: string) {
  if (!category) return null;
  const catUpper = category.toUpperCase();
  if (catUpper.includes('BỆNH') || catUpper.includes('TÔM') || catUpper.includes('SỨC KHỎE')) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-700 border border-rose-200">
        <span>🦐</span> {category}
      </span>
    );
  }
  if (catUpper.includes('MÔI TRƯỜNG') || catUpper.includes('NƯỚC')) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-cyan-50 px-2 py-0.5 text-[10px] font-bold text-cyan-700 border border-cyan-200">
        <span>💧</span> {category}
      </span>
    );
  }
  if (catUpper.includes('THIẾT BỊ') || catUpper.includes('MÁY') || catUpper.includes('QUẠT')) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700 border border-amber-200">
        <span>⚙️</span> {category}
      </span>
    );
  }
  if (catUpper.includes('ĐIỆN') || catUpper.includes('NĂNG LƯỢNG')) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-yellow-50 px-2 py-0.5 text-[10px] font-bold text-yellow-800 border border-yellow-200">
        <span>⚡</span> {category}
      </span>
    );
  }
  if (catUpper.includes('BỜ AO') || catUpper.includes('BẠT') || catUpper.includes('HẠ TẦNG')) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
        <span>🏞️</span> {category}
      </span>
    );
  }
  if (catUpper.includes('KHO') || catUpper.includes('THỨC ĂN') || catUpper.includes('VẬT TƯ')) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-purple-50 px-2 py-0.5 text-[10px] font-bold text-purple-700 border border-purple-200">
        <span>📦</span> {category}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700 border border-slate-200">
      <span>🚨</span> {category}
    </span>
  );
}

export function renderSeverityBadge(severity: string) {
  if (!severity) return null;
  const sevUpper = severity.toUpperCase();
  if (sevUpper.includes('KHẨN CẤP') || sevUpper.includes('CRITICAL')) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-rose-600 text-white px-2 py-0.5 text-[10px] font-black animate-pulse shadow-xs">
        ● KHẨN CẤP
      </span>
    );
  }
  if (sevUpper.includes('CAO') || sevUpper.includes('HIGH')) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 text-amber-800 border border-amber-300 px-2 py-0.5 text-[10px] font-bold">
        ● Mức cao
      </span>
    );
  }
  if (sevUpper.includes('TRUNG BÌNH') || sevUpper.includes('MEDIUM')) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 text-[10px] font-bold">
        ● Mức vừa
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 text-slate-600 border border-slate-200 px-2 py-0.5 text-[10px] font-medium">
      ● Mức thấp
    </span>
  );
}

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

  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [selected, setSelected] = useState<Incident | null>(null);

  // Filter states
  const [ponds, setPonds] = useState<OverviewPond[]>([]);
  const [allCrops, setAllCrops] = useState<Crop[]>([]);
  const [selectedPondId, setSelectedPondId] = useState('');
  const [selectedCropId, setSelectedCropId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

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
  const [createForm, setCreateForm] = useState({
    cropId: '',
    category: 'Sức khỏe & Dịch bệnh',
    severity: 'Trung bình',
    location: '',
    title: '',
    description: '',
    selfAssign: false,
  });
  const [createErrors, setCreateErrors] = useState<CreateIncidentErrors>({});
  const [technicians, setTechnicians] = useState<IncidentTechnician[]>([]);
  const [activeWorkspaceIncident, setActiveWorkspaceIncident] = useState<Incident | null>(null);

  // Tự động mở ca điều trị nếu được truyền initialIncidentId
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
    ? 'from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 shadow-teal-500/25'
    : 'from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 shadow-indigo-500/25';

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

  // Danh sách sự cố sau khi qua bộ lọc
  const filteredIncidents = useMemo(() => {
    return incidents.filter((item) => {
      if (selectedPondId && item.crop?.pond?.id !== selectedPondId) return false;
      if (selectedCropId && item.crop?.id !== selectedCropId) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const inTitle = item.title.toLowerCase().includes(q);
        const inDesc = item.description.toLowerCase().includes(q);
        const inPond = item.crop?.pond?.name?.toLowerCase().includes(q);
        if (!inTitle && !inDesc && !inPond) return false;
      }
      return true;
    });
  }, [incidents, selectedPondId, selectedCropId, searchQuery]);

  // 1. Sự cố mới phát sinh (Chờ xử lý / chưa bắt đầu)
  const openIncidents = useMemo(() => {
    return filteredIncidents.filter((item) => item.status === 'OPEN' && !item.startedAt);
  }, [filteredIncidents]);

  // 2. Quá trình điều trị (Đang can thiệp)
  const treatingIncidents = useMemo(() => {
    return filteredIncidents.filter(
      (item) => item.status === 'TREATING' || (item.status === 'OPEN' && !!item.startedAt)
    );
  }, [filteredIncidents]);

  // 3. Đã hoàn tất điều trị
  const resolvedIncidents = useMemo(() => {
    return filteredIncidents.filter((item) => item.status === 'RESOLVED');
  }, [filteredIncidents]);

  const activeFilterCount = [
    Boolean(selectedPondId),
    Boolean(selectedCropId),
    Boolean(searchQuery.trim()),
  ].filter(Boolean).length;

  const handleResetFilters = () => {
    setSelectedPondId('');
    setSelectedCropId('');
    setSearchQuery('');
  };

  useEffect(() => {
    setCategoryPage(1);
  }, [selectedPondId, selectedCropId, searchQuery, subTab]);

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
        ? incident.crop?.pond?.farm?.id ? incidentService.getTechnicians(incident.crop.pond.farm.id) : Promise.resolve([])
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
    if (!createForm.cropId) validationErrors.cropId = 'Vui lòng chọn một vụ/ao nuôi liên quan.';
    if (!createForm.title.trim()) validationErrors.title = 'Vui lòng nhập tiêu đề sự cố.';
    if (!createForm.description.trim()) validationErrors.description = 'Vui lòng mô tả chi tiết tình trạng sự cố.';
    setCreateErrors(validationErrors);

    if (Object.keys(validationErrors).length > 0) {
      setError('Vui lòng kiểm tra lại các trường được đánh dấu đỏ.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await incidentService.create({
        cropId: createForm.cropId,
        title: createForm.title.trim(),
        description: createForm.description.trim(),
        category: createForm.category,
        severity: createForm.severity,
        location: createForm.location.trim() || undefined,
        selfAssign: role === 'TECHNICIAN' ? createForm.selfAssign : false,
      });
      setShowCreate(false);
      setCreateForm({
        cropId: activeCrops[0]?.id || '',
        category: 'Sức khỏe & Dịch bệnh',
        severity: 'Trung bình',
        location: '',
        title: '',
        description: '',
        selfAssign: false,
      });
      setCreateErrors({});
      await loadIncidents();
      setNotice(
        role === 'TECHNICIAN' && createForm.selfAssign
          ? 'Đã ghi nhận sự cố và bạn đã tự tiếp nhận xử lý ca này.'
          : 'Đã gửi báo cáo sự cố thành công! Quản lý trang trại đã nhận được thông báo để điều phối xử lý.'
      );
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

  const updateCreateField = (field: string, value: any) => {
    setCreateForm((current) => ({ ...current, [field]: value }));
    setCreateErrors((current) => ({ ...current, [field as keyof CreateIncidentErrors]: undefined }));
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
    if (adminView) return;
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
    <div className="relative mx-auto w-full max-w-7xl space-y-5">
      {/* ── CHẾ ĐỘ XEM 3 BƯỚC: 1. Sự cố | 2. Quá trình điều trị | 3. Lịch sử (Segmented Pill Bar) ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-2 bg-slate-100/90 rounded-3xl border border-slate-200/80 shadow-xs">
        <div className="inline-flex items-center p-1 bg-white/95 rounded-2xl border border-slate-200/60 shadow-xs flex-wrap gap-1">
          {/* Tab 1: Sự cố */}
          <button
            type="button"
            onClick={() => {
              setSubTab('incident');
              setCategoryPage(1);
            }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
              subTab === 'incident'
                ? 'bg-amber-600 text-white shadow-sm shadow-amber-600/30'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
            }`}
          >
            <AlertTriangle className="w-4 h-4" />
            <span>1. Sự cố mới</span>
            {openIncidents.length > 0 && (
              <span
                className={`ml-0.5 rounded-full px-2 py-0.5 text-[10px] font-black ${
                  subTab === 'incident' ? 'bg-white text-amber-700' : 'bg-amber-100 text-amber-700'
                }`}
              >
                {openIncidents.length}
              </span>
            )}
          </button>

          {/* Tab 2: Quá trình điều trị */}
          <button
            type="button"
            onClick={() => {
              setSubTab('treatment');
              setCategoryPage(1);
            }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
              subTab === 'treatment'
                ? isFarmer
                  ? 'bg-teal-600 text-white shadow-sm shadow-teal-600/30'
                  : 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
            }`}
          >
            <Stethoscope className="w-4 h-4" />
            <span>2. Quá trình điều trị</span>
            {treatingIncidents.length > 0 && (
              <span
                className={`ml-0.5 rounded-full px-2 py-0.5 text-[10px] font-black ${
                  subTab === 'treatment'
                    ? 'bg-white text-indigo-700'
                    : 'bg-indigo-100 text-indigo-700'
                }`}
              >
                {treatingIncidents.length}
              </span>
            )}
          </button>

          {/* Tab 3: Lịch sử & Nhật ký điều trị */}
          <button
            type="button"
            onClick={() => setSubTab('history')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
              subTab === 'history'
                ? isFarmer
                  ? 'bg-teal-600 text-white shadow-sm shadow-teal-600/30'
                  : 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
            }`}
          >
            <History className="w-4 h-4" />
            <span>3. Lịch sử điều trị</span>
            {resolvedIncidents.length > 0 && (
              <span
                className={`ml-0.5 rounded-full px-2 py-0.5 text-[10px] font-black ${
                  subTab === 'history' ? 'bg-white text-indigo-700' : 'bg-slate-200 text-slate-700'
                }`}
              >
                {resolvedIncidents.length}
              </span>
            )}
          </button>
        </div>

        <div className="hidden sm:flex items-center gap-2 pr-4 text-xs text-slate-500 font-medium">
          {subTab === 'incident' ? (
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              Sự cố phát hiện tại ao nuôi · Chờ phân công & tiếp nhận
            </span>
          ) : subTab === 'treatment' ? null : (
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              Hồ sơ ca bệnh đã khỏi hoàn toàn & nghiệm thu
            </span>
          )}
        </div>
      </div>

      {(notice || error) && (
        <div
          className={`fixed right-6 top-6 z-[200] flex max-w-[calc(100vw-3rem)] items-center gap-3 rounded-2xl border px-4 py-3 shadow-lg animate-in slide-in-from-right-8 fade-in duration-300 ${
            error ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'
          }`}
        >
          {error ? <AlertCircle className="h-5 w-5 shrink-0" /> : <CheckCircle2 className="h-5 w-5 shrink-0" />}
          <p className="text-xs font-bold">{error || notice}</p>
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
          {/* Header Card với Bộ Lọc Gọn Gàng */}
          <div className="rounded-3xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-sm space-y-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-3.5">
                <div
                  className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br shadow-md ${
                    isFarmer
                      ? 'from-teal-500 to-emerald-600 shadow-teal-500/20'
                      : 'from-indigo-500 to-blue-600 shadow-indigo-500/20'
                  }`}
                >
                  <Stethoscope className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                    Sự Cố & Quá Trình Điều Trị
                  </h2>
                  <p className="text-xs font-medium text-slate-500 mt-0.5">
                    {subTab === 'incident'
                      ? 'Giám sát và tiếp nhận các sự cố sức khỏe tôm mới phát hiện tại các ao nuôi'
                      : 'Không gian làm việc điều trị, kê đơn thuốc và Bác sĩ AI hỗ trợ lâm sàng'}
                  </p>
                </div>
              </div>

              <div className="flex w-full flex-wrap gap-2 lg:w-auto">
                {canCreate && (
                  <button
                    onClick={openCreateIncident}
                    className={`flex items-center gap-2 rounded-xl bg-gradient-to-r px-4 py-2.5 text-xs font-bold text-white shadow-md transition-all hover:-translate-y-0.5 cursor-pointer ${primaryButtonClass}`}
                  >
                    <Plus className="h-4 w-4" /> Báo cáo sự cố mới
                  </button>
                )}
                <button
                  onClick={loadIncidents}
                  disabled={loading}
                  className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-60 transition-all cursor-pointer shadow-2xs"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin text-indigo-600' : ''}`} />
                  Làm mới
                </button>
              </div>
            </div>

            {/* ── TOOLBAR BỘ LỌC THÔNG MINH ── */}
            <div className="pt-3 border-t border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 flex-1 max-w-3xl">
                {/* 1. Tìm kiếm từ khóa */}
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Tìm tên sự cố / triệu chứng..."
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:border-indigo-500 focus:bg-white"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* 2. Lọc theo Ao nuôi */}
                <div className="relative">
                  <Waves className="w-4 h-4 text-cyan-600 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <select
                    value={selectedPondId}
                    onChange={(e) => handlePondChange(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-7 text-xs font-bold text-slate-700 outline-none focus:border-indigo-500 focus:bg-white appearance-none cursor-pointer"
                  >
                    <option value="">Tất cả ao nuôi</option>
                    {ponds.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} {p.farm?.name ? `(${p.farm.name})` : ''}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                </div>

                {/* 3. Lọc theo Vụ nuôi */}
                <div className="relative">
                  <Layers className="w-4 h-4 text-indigo-600 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <select
                    value={selectedCropId}
                    onChange={(e) => setSelectedCropId(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-7 text-xs font-bold text-slate-700 outline-none focus:border-indigo-500 focus:bg-white appearance-none cursor-pointer"
                  >
                    <option value="">Tất cả vụ nuôi</option>
                    {filteredCrops.map((c) => {
                      const pName = c.pond?.name || ponds.find((p) => p.id === c.pondId)?.name || 'Ao';
                      const st = c.stage === 'NURSERY' ? 'Ương' : 'Thương phẩm';
                      return (
                        <option key={c.id} value={c.id}>
                          {pName} · {st}
                        </option>
                      );
                    })}
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                </div>
              </div>

              {activeFilterCount > 0 && (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-600 hover:text-rose-700 transition-colors cursor-pointer self-start md:self-center"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Xóa bộ lọc ({activeFilterCount})</span>
                </button>
              )}
            </div>
          </div>

          {/* ── NỘI DUNG CHÍNH THEO TAB ── */}
          {loading && incidents.length === 0 ? (
            <LoadingMotion
              mode="page"
              title="Đang tải dữ liệu Sự cố & Điều trị..."
              subtitle="Hệ thống đang đồng bộ danh sách sự cố và tiến trình điều trị từ trang trại..."
              icon={<AlertTriangle className="w-12 h-12 text-rose-500" />}
              color="rose"
            />
          ) : subTab === 'incident' ? (
            /* ══════════════ TAB 1: SỰ CỐ MỚI PHÁT SINH (CHỜ XỬ LÝ) ══════════════ */
            (() => {
              const ITEMS_PER_PAGE = 9;
              const totalPages = Math.ceil(openIncidents.length / ITEMS_PER_PAGE);
              const paginatedItems = openIncidents.slice(
                (categoryPage - 1) * ITEMS_PER_PAGE,
                categoryPage * ITEMS_PER_PAGE
              );

              return (
                <div className="w-full space-y-4 animate-in fade-in duration-300">
                  {/* Banner tiêu đề */}
                  <div className="flex items-center justify-between p-4 rounded-2xl border border-amber-200/80 bg-amber-50/70">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center font-bold shadow-xs">
                        <AlertTriangle className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-extrabold text-slate-900 text-sm">
                          Sự cố mới phát hiện tại ao nuôi ({openIncidents.length})
                        </h3>
                        <p className="text-xs text-slate-600">
                          Các sự cố cần tiếp nhận phác đồ can thiệp ngay để kiểm soát mầm bệnh
                        </p>
                      </div>
                    </div>
                  </div>

                  {openIncidents.length === 0 ? (
                    <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-emerald-200 bg-emerald-50/40 p-12 text-center">
                      <div className="w-12 h-12 rounded-2xl bg-emerald-100 flex items-center justify-center text-emerald-600 mb-3 shadow-xs">
                        <CheckCircle2 className="w-6 h-6" />
                      </div>
                      <h4 className="text-base font-extrabold text-slate-800">
                        Không có sự cố mới nào chờ xử lý!
                      </h4>
                      <p className="text-xs text-slate-500 mt-1 max-w-md">
                        Tất cả ao nuôi đều ổn định. Các ca đang trong phác đồ can thiệp nằm tại tab{' '}
                        <strong>"2. Quá trình điều trị"</strong>.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {paginatedItems.map((item) => {
                        const meta = parseIncidentMetadata(item.title, item.description);
                        return (
                        <div
                          key={item.id}
                          className="group relative flex flex-col justify-between rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xs transition-all duration-200 hover:-translate-y-1 hover:shadow-md hover:border-amber-300"
                        >
                          <div className="space-y-3">
                            {/* Badges row */}
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-cyan-50 text-cyan-800 border border-cyan-200 text-[11px] font-bold">
                                <Waves className="w-3 h-3 text-cyan-600" />
                                <span>{item.crop?.pond?.name || 'Chung'}</span>
                              </span>
                              {renderCategoryBadge(meta.category)}
                              {renderSeverityBadge(meta.severity)}
                              <span className="ml-auto rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-black text-amber-700">
                                ● Sự cố mới
                              </span>
                            </div>

                            <h4 className="text-base font-extrabold text-slate-900 group-hover:text-amber-700 transition-colors line-clamp-2">
                              {meta.cleanTitle}
                            </h4>

                            <p className="text-xs font-medium text-slate-500 leading-relaxed line-clamp-3 bg-slate-50/80 p-2.5 rounded-xl border border-slate-100">
                              {meta.cleanDescription}
                            </p>
                          </div>

                          <div className="mt-4 pt-3 border-t border-slate-100 space-y-3">
                            <div className="flex items-center justify-between text-[11px] text-slate-500 font-medium">
                              <span>Phụ trách: <strong className="text-slate-700">{item.assignedTo?.fullName || 'Chưa giao'}</strong></span>
                              <span>{new Date(item.createdAt).toLocaleDateString('vi-VN')}</span>
                            </div>

                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => openIncident(item)}
                                className="px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs transition-all shadow-2xs cursor-pointer"
                              >
                                Chi tiết
                              </button>
                              {!adminView && <button
                                type="button"
                                onClick={() => handleStartTreatmentDirectly(item)}
                                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white font-bold text-xs transition-all shadow-sm shadow-amber-600/20 cursor-pointer"
                              >
                                <Stethoscope className="w-3.5 h-3.5" />
                                <span>Tiếp nhận & Vào điều trị</span>
                                <ArrowRight className="w-3.5 h-3.5" />
                              </button>}
                            </div>
                          </div>
                        </div>
                      ); })}
                    </div>
                  )}

                  {/* Phân trang */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-center gap-2 pt-4">
                      <button
                        type="button"
                        onClick={() => setCategoryPage((p) => Math.max(1, p - 1))}
                        disabled={categoryPage === 1}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
                      >
                        <ChevronLeft className="w-4 h-4" /> Trước
                      </button>
                      <span className="text-xs font-bold text-slate-500">
                        {categoryPage} / {totalPages}
                      </span>
                      <button
                        type="button"
                        onClick={() => setCategoryPage((p) => Math.min(totalPages, p + 1))}
                        disabled={categoryPage === totalPages}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
                      >
                        Sau <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })()
          ) : (
            /* ══════════════ TAB 2: QUÁ TRÌNH CAN THIỆP & ĐIỀU TRỊ ══════════════ */
            (() => {
              const ITEMS_PER_PAGE = 9;
              const totalPages = Math.ceil(treatingIncidents.length / ITEMS_PER_PAGE);
              const paginatedItems = treatingIncidents.slice(
                (categoryPage - 1) * ITEMS_PER_PAGE,
                categoryPage * ITEMS_PER_PAGE
              );

              return (
                <div className="w-full space-y-4 animate-in fade-in duration-300">
                  {/* Banner tiêu đề */}
                  <div className="flex items-center justify-between p-4 rounded-2xl border border-indigo-200/80 bg-indigo-50/70">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold shadow-xs">
                        <Stethoscope className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-extrabold text-slate-900 text-sm">
                          Các ao đang can thiệp điều trị ({treatingIncidents.length})
                        </h3>
                        <p className="text-xs text-slate-600">
                          Nhấn <strong>"Vào bàn điều trị / Kê đơn"</strong> để xuất thuốc từ kho hoặc nhận phác đồ từ Bác sĩ AI
                        </p>
                      </div>
                    </div>
                  </div>

                  {treatingIncidents.length === 0 ? (
                    <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-indigo-200 bg-indigo-50/40 p-12 text-center">
                      <div className="w-12 h-12 rounded-2xl bg-indigo-100 flex items-center justify-center text-indigo-600 mb-3 shadow-xs">
                        <Stethoscope className="w-6 h-6" />
                      </div>
                      <h4 className="text-base font-extrabold text-slate-800">
                        Hiện không có ao nào đang trong quá trình điều trị
                      </h4>
                      <p className="text-xs text-slate-500 mt-1 max-w-md">
                        Khi tiếp nhận sự cố mới từ tab <strong>"1. Sự cố mới"</strong>, ao sẽ chuyển vào đây để bạn theo dõi và xuất thuốc nhiều đợt.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {paginatedItems.map((item) => {
                        const meta = parseIncidentMetadata(item.title, item.description);
                        return (
                        <div
                          key={item.id}
                          className="group relative flex flex-col justify-between rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xs transition-all duration-200 hover:-translate-y-1 hover:shadow-md hover:border-indigo-300"
                        >
                          <div className="space-y-3">
                            {/* Badges row */}
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-cyan-50 text-cyan-800 border border-cyan-200 text-[11px] font-bold">
                                <Waves className="w-3 h-3 text-cyan-600" />
                                <span>{item.crop?.pond?.name || 'Chung'}</span>
                              </span>
                              {renderCategoryBadge(meta.category)}
                              {renderSeverityBadge(meta.severity)}
                              <span className="ml-auto rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-0.5 text-[10px] font-black text-indigo-700">
                                ● Đang điều trị
                              </span>
                            </div>

                            <h4 className="text-base font-extrabold text-slate-900 group-hover:text-indigo-700 transition-colors line-clamp-2">
                              {meta.cleanTitle}
                            </h4>

                            <p className="text-xs font-medium text-slate-500 leading-relaxed line-clamp-2">
                              {meta.cleanDescription}
                            </p>

                            {/* Box can thiệp gần nhất */}
                            <div className="rounded-2xl border border-indigo-100 bg-indigo-50/50 p-3 text-xs space-y-1">
                              <div className="flex items-center justify-between font-extrabold text-indigo-950 text-[11px]">
                                <span>Tiến trình can thiệp:</span>
                                <span className="text-indigo-700 bg-white px-2 py-0.5 rounded-md border border-indigo-100">
                                  {item._count?.updates ?? 0} đợt điều trị
                                </span>
                              </div>
                              {item.treatment && (
                                <p className="text-[11px] font-medium text-slate-600 line-clamp-2">
                                  {item.treatment}
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="mt-4 pt-3 border-t border-slate-100 space-y-3">
                            <div className="flex items-center justify-between text-[11px] text-slate-500 font-medium">
                              <span>Phụ trách: <strong className="text-slate-700">{item.assignedTo?.fullName || 'Chưa giao'}</strong></span>
                              <span>Bắt đầu: {item.startedAt ? new Date(item.startedAt).toLocaleDateString('vi-VN') : 'Gần đây'}</span>
                            </div>

                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => openIncident(item)}
                                className="px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs transition-all shadow-2xs cursor-pointer"
                              >
                                Chi tiết
                              </button>
                              {!adminView && <button
                                type="button"
                                onClick={() => openTreatmentWorkspace(item)}
                                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white font-bold text-xs transition-all shadow-sm shadow-indigo-600/20 cursor-pointer"
                              >
                                <Stethoscope className="w-3.5 h-3.5" />
                                <span>Vào bàn điều trị / Kê đơn</span>
                                <ArrowRight className="w-3.5 h-3.5" />
                              </button>}
                            </div>
                          </div>
                        </div>
                      ); })}
                    </div>
                  )}

                  {/* Phân trang */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-center gap-2 pt-4">
                      <button
                        type="button"
                        onClick={() => setCategoryPage((p) => Math.max(1, p - 1))}
                        disabled={categoryPage === 1}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
                      >
                        <ChevronLeft className="w-4 h-4" /> Trước
                      </button>
                      <span className="text-xs font-bold text-slate-500">
                        {categoryPage} / {totalPages}
                      </span>
                      <button
                        type="button"
                        onClick={() => setCategoryPage((p) => Math.min(totalPages, p + 1))}
                        disabled={categoryPage === totalPages}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
                      >
                        Sau <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })()
          )}
        </>
      )}

      {/* ── MODAL: BÁO CÁO SỰ CỐ MỚI ── */}
      {showCreate && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 p-4 sm:p-6 backdrop-blur-md animate-in fade-in duration-200">
          <div className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-white/60 bg-white shadow-2xl backdrop-blur-xl animate-in zoom-in-95 duration-200">
            <div className="flex shrink-0 items-center justify-between border-b border-slate-100 bg-slate-50/80 px-6 py-4">
              <div>
                <h3 className="text-lg font-black text-slate-800">Báo Cáo Sự Cố Trang Trại</h3>
                <p className="text-xs text-slate-500">
                  Ghi nhận mọi sự cố (bệnh tôm, máy móc, điện, ao, kho...) để Quản lý tiếp nhận và điều phối kịp thời.
                </p>
              </div>
              <button
                onClick={() => {
                  setShowCreate(false);
                  setCreateErrors({});
                }}
                className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {/* Phân loại sự cố */}
              <div>
                <label className="mb-1.5 block text-xs font-bold text-slate-700">
                  Phân loại sự cố <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {INCIDENT_CATEGORIES.map((cat) => {
                    const isSelected = createForm.category === cat.id;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => updateCreateField('category', cat.id)}
                        className={`flex items-center gap-2 p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                          isSelected
                            ? 'border-indigo-600 bg-indigo-50/80 text-indigo-950 font-bold shadow-xs ring-1 ring-indigo-500/30'
                            : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 text-xs font-medium'
                        }`}
                      >
                        <span className="text-base">{cat.icon}</span>
                        <span className="text-[11px] leading-tight line-clamp-1">{cat.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Mức độ nghiêm trọng */}
              <div>
                <label className="mb-1.5 block text-xs font-bold text-slate-700">
                  Mức độ khẩn cấp <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {INCIDENT_SEVERITIES.map((sev) => {
                    const isSelected = createForm.severity === sev.id;
                    return (
                      <button
                        key={sev.id}
                        type="button"
                        onClick={() => updateCreateField('severity', sev.id)}
                        className={`flex flex-col items-center justify-center p-2 rounded-xl border text-center transition-all cursor-pointer ${
                          isSelected
                            ? `${sev.color} ring-2 ring-indigo-500/30 shadow-xs font-bold`
                            : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <span className="text-xs font-bold">{sev.label}</span>
                        <span className="text-[9.5px] opacity-75">{sev.sublabel}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Vị trí / Vụ nuôi */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-700">
                    Ao / Vụ nuôi liên quan <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={createForm.cropId}
                    onChange={(event) => updateCreateField('cropId', event.target.value)}
                    className={`w-full rounded-xl border bg-white p-2.5 text-xs font-semibold outline-none ${
                      createErrors.cropId ? 'border-rose-400 bg-rose-50/40 focus:border-rose-500' : 'border-slate-200 focus:border-indigo-400'
                    }`}
                  >
                    {loadingCrops && <option value="">Đang tải vụ nuôi...</option>}
                    {!loadingCrops && activeCrops.length === 0 && (
                      <option value="">Không có vụ nuôi đang hoạt động</option>
                    )}
                    {activeCrops.map((crop) => (
                      <option key={crop.id} value={crop.id}>
                        {crop.pond.farm?.name || 'Trại'} · {crop.pond.name}
                      </option>
                    ))}
                  </select>
                  {createErrors.cropId && (
                    <p className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-rose-600">
                      <AlertCircle className="h-3 w-3" />
                      {createErrors.cropId}
                    </p>
                  )}
                </div>

                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-700">
                    Vị trí / Khu vực cụ thể
                  </label>
                  <input
                    value={createForm.location}
                    onChange={(event) => updateCreateField('location', event.target.value)}
                    maxLength={100}
                    className="w-full rounded-xl border border-slate-200 p-2.5 text-xs font-semibold outline-none focus:border-indigo-400"
                    placeholder="Ví dụ: Cống xả, Trạm bơm 1, Kho cám A..."
                  />
                </div>
              </div>

              {/* Tiêu đề */}
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700">
                  Tiêu đề tóm tắt sự cố <span className="text-rose-500">*</span>
                </label>
                <input
                  value={createForm.title}
                  onChange={(event) => updateCreateField('title', event.target.value)}
                  maxLength={200}
                  className={`w-full rounded-xl border p-2.5 text-xs font-semibold outline-none ${
                    createErrors.title ? 'border-rose-400 bg-rose-50/40 focus:border-rose-500' : 'border-slate-200 focus:border-indigo-400'
                  }`}
                  placeholder={
                    INCIDENT_CATEGORIES.find(c => c.id === createForm.category)?.placeholder ||
                    'Ví dụ: Tôm nổi đầu, hỏng máy quạt, rò rỉ bạt đáy...'
                  }
                />
                {createErrors.title && (
                  <p className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-rose-600">
                    <AlertCircle className="h-3 w-3" />
                    {createErrors.title}
                  </p>
                )}
              </div>

              {/* Mô tả */}
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700">
                  Mô tả chi tiết tình trạng & đề xuất xử lý <span className="text-rose-500">*</span>
                </label>
                <textarea
                  value={createForm.description}
                  onChange={(event) => updateCreateField('description', event.target.value)}
                  maxLength={2000}
                  rows={3}
                  className={`w-full rounded-xl border p-2.5 text-xs outline-none font-medium ${
                    createErrors.description ? 'border-rose-400 bg-rose-50/40 focus:border-rose-500' : 'border-slate-200 focus:border-indigo-400'
                  }`}
                  placeholder="Mô tả hiện tượng quan sát được, thời điểm bắt đầu, thiệt hại ước tính và đề xuất bộ phận/nhân sự cần hỗ trợ..."
                />
                {createErrors.description && (
                  <p className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-rose-600">
                    <AlertCircle className="h-3 w-3" />
                    {createErrors.description}
                  </p>
                )}
              </div>

              {/* Phân công xử lý */}
              {role === 'TECHNICIAN' ? (
                <div className="rounded-2xl border border-indigo-100 bg-indigo-50/50 p-3.5 space-y-2">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={createForm.selfAssign}
                      onChange={(e) => updateCreateField('selfAssign', e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                    <div>
                      <span className="text-xs font-bold text-indigo-950">
                        Tôi là Kỹ thuật viên phụ trách và sẽ tự tiếp nhận xử lý ca này
                      </span>
                      <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                        Nếu bỏ chọn, sự cố sẽ chuyển ngay đến <strong>Quản lý trang trại</strong> để liên hệ thợ điện, cơ khí, kho bãi hoặc kỹ thuật viên chuyên trách khác.
                      </p>
                    </div>
                  </label>
                </div>
              ) : (
                <div className="rounded-2xl border border-teal-100 bg-teal-50/60 p-3 text-xs text-teal-800 flex items-start gap-2.5">
                  <span className="text-base">📢</span>
                  <div className="text-[11px] leading-relaxed">
                    <strong>Thông báo gửi tới Quản lý:</strong> Sự cố bạn báo cáo sẽ được gửi tức thời đến Quản lý trang trại để liên hệ đúng bộ phận chuyên môn xử lý.
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreate(false);
                    setCreateErrors({});
                  }}
                  disabled={saving}
                  className="flex-1 rounded-xl bg-slate-100 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-200 cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={createIncident}
                  disabled={saving || loadingCrops || activeCrops.length === 0}
                  className={`flex-1 rounded-xl bg-gradient-to-r py-2.5 text-xs font-bold text-white shadow-md transition-all disabled:opacity-50 cursor-pointer ${primaryButtonClass}`}
                >
                  {saving ? 'Đang gửi...' : 'Gửi báo cáo sự cố'}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── MODAL: CHI TIẾT SỰ CỐ & PHÂN CÔNG ── */}
      {selected && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 p-4 sm:p-6 backdrop-blur-md animate-in fade-in duration-200">
          <div className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-white/60 bg-white shadow-2xl backdrop-blur-xl animate-in zoom-in-95 duration-200">
            <div className="flex shrink-0 items-start justify-between border-b border-slate-100 bg-slate-50/90 px-6 py-4">
              <div>
                <div className="flex items-center gap-3">
                  <h3 className="text-lg font-black text-slate-900">{selected.title}</h3>
                  <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${STATUS_STYLES[selected.status]}`}>
                    {STATUS_LABELS[selected.status]}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs font-bold">
                  <span className="px-2.5 py-0.5 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200">
                    Trang trại: {selected.crop?.pond?.farm?.name || '--'}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-lg bg-cyan-50 text-cyan-800 border border-cyan-200">
                    Ao: {selected.crop?.pond?.name || '--'}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-lg bg-indigo-50 text-indigo-800 border border-indigo-200">
                    {selected.crop?.stage === 'NURSERY' ? 'Vụ Ương' : 'Vụ Thương phẩm'}
                  </span>
                </div>
              </div>
              <button
                onClick={closeIncident}
                className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-5 p-6">
              <div className="rounded-2xl bg-slate-50 p-4 border border-slate-100 space-y-3">
                <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 block">
                  Mô tả dấu hiệu sự cố
                </span>
                <p className="text-xs font-semibold text-slate-800 leading-relaxed">{selected.description}</p>
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200/80 text-[11px]">
                  <div>
                    <span className="text-slate-400">Người báo cáo:</span>
                    <p className="font-bold text-slate-700">{selected.reporter?.fullName || 'Chưa ghi'}</p>
                  </div>
                  <div>
                    <span className="text-slate-400">Phụ trách điều trị:</span>
                    <p className="font-bold text-indigo-600">{selected.assignedTo?.fullName || 'Chưa giao'}</p>
                  </div>
                </div>
              </div>

              {canAssign && (
                <div className="rounded-2xl border border-slate-200 p-4 space-y-2">
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-700">
                    Phân công kỹ thuật viên phụ trách
                  </label>
                  <select
                    value={selected.assignedToId || ''}
                    onChange={(event) => assignTechnician(event.target.value)}
                    disabled={saving || loadingTechnicians}
                    className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs font-bold text-slate-800 outline-none focus:border-indigo-500"
                  >
                    <option value="">Chưa phân công</option>
                    {technicians.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.fullName} · {t.email}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Lịch sử cập nhật */}
              <div className="space-y-2.5">
                <h4 className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-slate-700">
                  <Clock3 className="w-4 h-4 text-indigo-500" /> Tiến trình điều trị ({selected.updates?.length || 0})
                </h4>
                {loadingDetail ? (
                  <p className="text-xs text-slate-400">Đang tải...</p>
                ) : selected.updates?.length ? (
                  <div className="space-y-2">
                    {selected.updates.map((upd) => (
                      <div key={upd.id} className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs space-y-1">
                        <div className="flex justify-between font-bold text-slate-700">
                          <span>{upd.author?.fullName}</span>
                          <span className="text-[10px] text-slate-400 font-normal">
                            {new Date(upd.createdAt).toLocaleString('vi-VN')}
                          </span>
                        </div>
                        <p className="text-slate-700">{upd.treatment}</p>
                        {upd.observation && <p className="text-slate-500 italic text-[11px]">Quan sát: {upd.observation}</p>}
                        {upd.result && <p className="text-emerald-700 font-semibold text-[11px]">Kết quả: {upd.result}</p>}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">Chưa có cập nhật điều trị.</p>
                )}
              </div>

              {selected.status === 'RESOLVED' && canAssign && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4 space-y-3">
                  <h4 className="text-xs font-black text-amber-900 uppercase tracking-wider flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-amber-600" /> Mở lại sự cố nếu tái phát
                  </h4>
                  <textarea
                    value={treatment}
                    onChange={(event) => setTreatment(event.target.value)}
                    rows={2}
                    placeholder="Nhập lý do mở lại sự cố (ví dụ: phát hiện triệu chứng tái phát sau 3 ngày)..."
                    className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs outline-none focus:border-amber-400 font-medium"
                  />
                  <button
                    type="button"
                    onClick={reopen}
                    disabled={saving}
                    className="rounded-xl bg-amber-500 px-4 py-2 text-xs font-bold text-white hover:bg-amber-600 transition-all disabled:opacity-50 cursor-pointer shadow-xs"
                  >
                    {saving ? 'Đang mở lại...' : 'Mở lại sự cố'}
                  </button>
                </div>
              )}

              {/* Nút vào Workspace */}
              {!adminView ? <div className="pt-2">
                <button
                  type="button"
                  onClick={() => openTreatmentWorkspace(selected)}
                  className="w-full flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-600 to-blue-600 py-3 text-xs font-bold text-white shadow-md hover:from-indigo-700 hover:to-blue-700 transition-all cursor-pointer"
                >
                  <Stethoscope className="w-4 h-4" />
                  <span>Vào trang điều trị & Kê đơn thuốc (Bác sĩ AI)</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div> : <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4 text-center text-xs font-semibold text-blue-700">Chế độ giám sát chỉ đọc. Việc điều trị do Quản lý trang trại và Kỹ thuật viên thực hiện.</div>}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
