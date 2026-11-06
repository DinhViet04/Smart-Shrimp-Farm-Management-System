import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  History,
  Layers,
  MapPin,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  UserCheck,
  UserX,
  Wrench,
  X,
} from 'lucide-react';
import {
  incidentService,
  type Incident,
  type IncidentTechnician,
} from '../../services/incident.service';
import { pondService, type OverviewPond } from '../../services/pond.service';
import LoadingMotion from '../../components/LoadingMotion';
import CreateFarmIncident from './CreateFarmIncident';
import {
  FARM_INCIDENT_CATEGORIES,
  FARM_INCIDENT_SEVERITIES,
  parseIncidentMetadata,
  formatDate,
  getErrorMessage,
  type FarmIncidentTab,
} from './farmIncidentConstants';

interface FarmIncidentDashboardProps {
  role?: 'ADMIN' | 'FARM_MANAGER' | 'TECHNICIAN' | 'FARMER';
  initialTab?: FarmIncidentTab;
}

export default function FarmIncidentDashboard({
  role: propRole,
  initialTab = 'open',
}: FarmIncidentDashboardProps) {
  // Current user & role from localStorage
  const [currentUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('user') || '{}');
    } catch {
      return {};
    }
  });

  const role =
    propRole ||
    (currentUser?.role as 'ADMIN' | 'FARM_MANAGER' | 'TECHNICIAN' | 'FARMER') ||
    'FARMER';
  const currentUserId = currentUser?.id || '';

  const isManager = role === 'FARM_MANAGER' || role === 'ADMIN';
  const isTechnician = role === 'TECHNICIAN';
  const isFarmer = role === 'FARMER';

  // Technician Sub-View: 'my_reports' vs 'assigned_to_me'
  const [techViewMode, setTechViewMode] = useState<'my_reports' | 'assigned_to_me'>('my_reports');

  // Main status tab
  const [tab, setTab] = useState<FarmIncidentTab | 'all'>(isManager ? (initialTab || 'open') : 'all');
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // Metadata filter states
  const [ponds, setPonds] = useState<OverviewPond[]>([]);
  const [farmId, setFarmId] = useState('');
  const [selectedPondId, setSelectedPondId] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedSeverity, setSelectedSeverity] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Views & Modals state
  const [view, setView] = useState<'list' | 'create'>('list');
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);

  const [activeIncident, setActiveIncident] = useState<Incident | null>(null);
  const [technicians, setTechnicians] = useState<IncidentTechnician[]>([]);
  const [loadingTechnicians, setLoadingTechnicians] = useState(false);
  const [selectedTechId, setSelectedTechId] = useState('');
  const [assignNote, setAssignNote] = useState('');

  // Progress update state
  const [updateNote, setUpdateNote] = useState('');
  const [resolveNote, setResolveNote] = useState('');
  const [isFinishing, setIsFinishing] = useState(false);
  const [reopenReason, setReopenReason] = useState('');
  const [showReopenBox, setShowReopenBox] = useState(false);

  // Auto clear alerts
  useEffect(() => {
    if (!error && !notice) return;
    const t = window.setTimeout(() => {
      setError('');
      setNotice('');
    }, 4500);
    return () => window.clearTimeout(t);
  }, [error, notice]);

  // Load ponds
  useEffect(() => {
    let isMounted = true;
    pondService
      .getOverview()
      .then((overview) => {
        if (!isMounted) return;
        setPonds(overview?.ponds || []);
        if (overview?.farms?.[0]?.id) {
          setFarmId(overview.farms[0].id);
        } else if (overview?.ponds?.[0]?.farmId) {
          setFarmId(overview.ponds[0].farmId);
        }
      })
      .catch((err) => {
        console.warn('Failed to load ponds:', err);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  // Fetch incidents
  const loadIncidents = useCallback(async () => {
    setLoading(true);
    try {
      const filters: Parameters<typeof incidentService.getAll>[0] = {
        size: 400,
        pondId: selectedPondId || undefined,
      };

      // Backend security: Farmer only fetches own reported incidents
      if (isFarmer) {
        filters.reportedByMe = true;
      }

      const response = await incidentService.getAll(filters);
      const list = Array.isArray(response)
        ? response
        : Array.isArray(response?.content)
        ? response.content
        : [];
      setIncidents(list);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [selectedPondId, isFarmer]);

  useEffect(() => {
    loadIncidents();
  }, [loadIncidents]);

  // Load technicians for a farm when needed
  const loadTechnicians = async (targetFarmId?: string) => {
    const fId = targetFarmId || farmId;
    if (!fId) return;
    setLoadingTechnicians(true);
    try {
      const list = await incidentService.getTechnicians(fId);
      setTechnicians(list);
    } catch (err) {
      console.warn('Failed to load technicians:', err);
    } finally {
      setLoadingTechnicians(false);
    }
  };

  // Open incident detail modal
  const handleOpenDetail = async (inc: Incident) => {
    setActiveIncident(inc);
    setUpdateNote('');
    setResolveNote('');
    setIsFinishing(false);
    setShowReopenBox(false);
    setReopenReason('');
    setShowDetailModal(true);

    try {
      const detail = await incidentService.getById(inc.id);
      setActiveIncident(detail);
      const targetFarmId = detail?.crop?.pond?.farm?.id || (detail?.crop?.pond as any)?.farmId || farmId;
      if (isManager && targetFarmId) {
        loadTechnicians(targetFarmId);
      }
    } catch (err) {
      console.error('Error refreshing incident detail:', err);
    }
  };

  // Open assign modal
  const handleOpenAssign = async (inc: Incident, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setActiveIncident(inc);
    setSelectedTechId(inc.assignedToId || '');
    setAssignNote('');
    setShowAssignModal(true);
    const targetFarmId = inc.crop?.pond?.farm?.id || (inc.crop?.pond as any)?.farmId || farmId;
    if (targetFarmId) {
      loadTechnicians(targetFarmId);
    }
  };

  // ── ROLE FILTERING ──
  // Farmer: ONLY sees incidents reported by themselves
  // Technician: Toggles between 'my_reports' (reported by me) and 'assigned_to_me' (tasks assigned to me)
  // Manager: Manages ALL incidents
  // WHITELIST: Chỉ hiển thị sự cố trang trại thuần túy
  // Báo cáo sự cố là luồng dữ liệu độc lập, hoàn toàn tách biệt
  // không liên quan đến chức năng "Sức khỏe tôm" và "Môi trường nước"
  const farmOnlyIncidents = useMemo(() => {
    // Danh sách các danh mục sự cố cơ sở hạ tầng / trang trại hợp lệ
    const VALID_FARM_CATEGORIES = [
      'thiết bị & máy móc',
      'thiết bị',
      'điện lưới & năng lượng',
      'điện & năng lượng',
      'điện & máy phát',
      'bờ ao, bạt lót & cống',
      'bờ ao & bạt hdpe',
      'bờ ao & hạ tầng',
      'kênh cấp & nguồn nước',
      'kho bãi & vật tư',
      'kho thức ăn & vật tư',
      'kho thức ăn & thuốc',
      'an ninh & sự cố khác',
      'an ninh & khẩn cấp',
      'sự cố khác / an ninh',
    ];

    return incidents.filter((i) => {
      const { category } = parseIncidentMetadata(i.title, i.description);
      const catLower = (category || '').trim().toLowerCase();
      // Loại bỏ hoàn toàn nếu không có category trang trại (các sự cố không nhãn cũ)
      if (!catLower) return false;

      // Loại bỏ dứt khoát nếu liên quan sức khỏe tôm hoặc môi trường nước
      if (
        catLower.includes('sức khỏe') ||
        catLower.includes('dịch bệnh') ||
        catLower.includes('bệnh tôm') ||
        catLower.includes('môi trường') ||
        catLower.includes('nước ao')
      ) {
        return false;
      }

      // Chỉ chấp nhận nếu khớp với danh mục sự cố trang trại
      return VALID_FARM_CATEGORIES.some(
        (validCat) => catLower.includes(validCat) || validCat.includes(catLower)
      );
    });
  }, [incidents]);

  const roleScopedIncidents = useMemo(() => {
    if (isFarmer) {
      return farmOnlyIncidents.filter((i) => i.reporter?.id === currentUserId || (i as any).reporterId === currentUserId);
    }
    if (isTechnician) {
      if (techViewMode === 'my_reports') {
        return farmOnlyIncidents.filter((i) => i.reporter?.id === currentUserId || (i as any).reporterId === currentUserId);
      }
      return farmOnlyIncidents.filter((i) => i.assignedToId === currentUserId || i.assignedTo?.id === currentUserId);
    }
    return farmOnlyIncidents;
  }, [farmOnlyIncidents, isFarmer, isTechnician, techViewMode, currentUserId]);

  // Metadata & search filter
  const filteredIncidents = useMemo(() => {
    return roleScopedIncidents.filter((item) => {
      if (!item) return false;
      const { category, severity, location, cleanTitle, cleanDescription } = parseIncidentMetadata(
        item.title,
        item.description
      );

      // Pond filter
      if (selectedPondId && item.crop?.pond?.id !== selectedPondId) return false;

      // Category filter
      if (selectedCategory && !category.toLowerCase().includes(selectedCategory.toLowerCase())) {
        return false;
      }

      // Severity filter
      if (selectedSeverity && !severity.toLowerCase().includes(selectedSeverity.toLowerCase())) {
        return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const pondName = item.crop?.pond?.name?.toLowerCase() || '';
        const reporterName = item.reporter?.fullName?.toLowerCase() || '';
        const assigneeName = item.assignedTo?.fullName?.toLowerCase() || '';

        const inTitle = cleanTitle.toLowerCase().includes(q);
        const inDesc = cleanDescription.toLowerCase().includes(q);
        const inLoc = location.toLowerCase().includes(q);
        const inPond = pondName.includes(q);
        const inReporter = reporterName.includes(q);
        const inAssignee = assigneeName.includes(q);

        if (!inTitle && !inDesc && !inLoc && !inPond && !inReporter && !inAssignee) {
          return false;
        }
      }

      return true;
    });
  }, [roleScopedIncidents, selectedPondId, selectedCategory, selectedSeverity, searchQuery]);

  // Tab grouping
  const openIncidents = useMemo(() => {
    // Chờ tiếp nhận & phân công (status OPEN & chưa có người phụ trách)
    return filteredIncidents.filter((i) => i.status === 'OPEN' && !i.assignedToId);
  }, [filteredIncidents]);

  const treatingIncidents = useMemo(() => {
    // Đang xử lý: Đã phân công hoặc đang TREATING
    return filteredIncidents.filter(
      (i) => i.status === 'TREATING' || (i.status === 'OPEN' && Boolean(i.assignedToId))
    );
  }, [filteredIncidents]);

  const resolvedIncidents = useMemo(() => {
    return filteredIncidents.filter((i) => i.status === 'RESOLVED');
  }, [filteredIncidents]);

  // Current tab items
  const currentTabIncidents = useMemo(() => {
    if (tab === 'open') return openIncidents;
    if (tab === 'treating') return treatingIncidents;
    if (tab === 'resolved') return resolvedIncidents;
    return filteredIncidents;
  }, [tab, openIncidents, treatingIncidents, resolvedIncidents, filteredIncidents]);

  // Manager Stats
  const stats = useMemo(() => {
    const list = roleScopedIncidents;
    const pendingCount = list.filter((i) => i.status === 'OPEN' && !i.assignedToId).length;
    const treatingCount = list.filter(
      (i) => i.status === 'TREATING' || (i.status === 'OPEN' && Boolean(i.assignedToId))
    ).length;
    const resolvedCount = list.filter((i) => i.status === 'RESOLVED').length;
    const criticalCount = list.filter((i) => {
      const meta = parseIncidentMetadata(i.title, i.description);
      return (
        i.status !== 'RESOLVED' &&
        (meta.severity.toUpperCase().includes('KHẨN CẤP') ||
          meta.severity.toUpperCase().includes('CRITICAL') ||
          meta.severity.toUpperCase().includes('CAO'))
      );
    }).length;

    return { pendingCount, treatingCount, resolvedCount, criticalCount, total: list.length };
  }, [roleScopedIncidents]);

  // Reset filters
  const hasActiveFilters = Boolean(
    selectedPondId || selectedCategory || selectedSeverity || searchQuery.trim()
  );
  const handleResetFilters = () => {
    setSelectedPondId('');
    setSelectedCategory('');
    setSelectedSeverity('');
    setSearchQuery('');
  };

  // Submit Assign Technician
  const handleAssignSubmit = async () => {
    if (!activeIncident || !selectedTechId) return;
    setSaving(true);
    try {
      await incidentService.assign(activeIncident.id, selectedTechId);
      if (assignNote.trim()) {
        await incidentService.addUpdate(activeIncident.id, {
          treatment: `Chỉ đạo của Quản lý: ${assignNote.trim()}`,
        });
      }
      setShowAssignModal(false);
      setAssignNote('');
      const updated = await incidentService.getById(activeIncident.id);
      setActiveIncident(updated);
      await loadIncidents();
      setNotice('Đã tiếp nhận sự cố và phân công kỹ thuật viên phụ trách thành công!');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  // Start repair (by assigned technician)
  const handleStartRepair = async () => {
    if (!activeIncident) return;
    setSaving(true);
    try {
      await incidentService.startTreatment(activeIncident.id);
      const updated = await incidentService.getById(activeIncident.id);
      setActiveIncident(updated);
      await loadIncidents();
      setNotice('Đã xác nhận bắt đầu tiến hành khắc phục sự cố tại hiện trường.');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  // Progress update / resolve
  const handleSaveProgress = async () => {
    if (!activeIncident) return;
    if (!updateNote.trim() && !resolveNote.trim()) {
      setError('Vui lòng nhập nội dung tiến trình xử lý.');
      return;
    }

    setSaving(true);
    try {
      if (isFinishing) {
        await incidentService.resolve(activeIncident.id, {
          treatment: updateNote.trim() || 'Đã khắc phục hoàn tất sự cố.',
          result: resolveNote.trim() || 'Nghiệm thu hoàn tất, thiết bị/hạ tầng đã vận hành ổn định.',
        });
        setNotice('Đã nghiệm thu và hoàn tất khắc phục sự cố trang trại!');
      } else {
        await incidentService.addUpdate(activeIncident.id, {
          treatment: updateNote.trim(),
        });
        setNotice('Đã cập nhật tiến trình khắc phục vào nhật ký sự cố.');
      }

      setUpdateNote('');
      setResolveNote('');
      setIsFinishing(false);
      const updated = await incidentService.getById(activeIncident.id);
      setActiveIncident(updated);
      await loadIncidents();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  // Reopen incident
  const handleReopen = async () => {
    if (!activeIncident || !reopenReason.trim()) {
      setError('Vui lòng nhập lý do mở lại sự cố.');
      return;
    }
    setSaving(true);
    try {
      await incidentService.reopen(activeIncident.id, reopenReason.trim());
      setShowReopenBox(false);
      setReopenReason('');
      const updated = await incidentService.getById(activeIncident.id);
      setActiveIncident(updated);
      await loadIncidents();
      setNotice('Đã mở lại sự cố trang trại để tiếp tục khắc phục.');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  // Render Category Badge
  const renderCatBadge = (catName: string) => {
    const matched = FARM_INCIDENT_CATEGORIES.find(
      (c) => c.id === catName || c.label === catName
    );
    if (matched) {
      return (
        <span
          className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold border ${matched.badgeBg} ${matched.badgeText} ${matched.badgeBorder}`}
        >
          <span>{matched.icon}</span> {matched.label}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold border bg-slate-50 text-slate-700 border-slate-200">
        <span>🔧</span> {catName || 'Sự cố trang trại'}
      </span>
    );
  };

  // Render Severity Badge
  const renderSevBadge = (sevName: string) => {
    const sevUpper = sevName?.toUpperCase() || '';
    if (sevUpper.includes('KHẨN CẤP') || sevUpper.includes('CRITICAL')) {
      return (
        <span className="inline-flex items-center gap-1 rounded-lg bg-rose-600 px-2.5 py-1 text-xs font-black text-white shadow-xs animate-pulse">
          ● KHẨN CẤP
        </span>
      );
    }
    if (sevUpper.includes('CAO') || sevUpper.includes('HIGH')) {
      return (
        <span className="inline-flex items-center gap-1 rounded-lg bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-900 border border-amber-300">
          ● Mức cao
        </span>
      );
    }
    if (sevUpper.includes('TRUNG BÌNH') || sevUpper.includes('MEDIUM')) {
      return (
        <span className="inline-flex items-center gap-1 rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700 border border-blue-200">
          ● Mức vừa
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 border border-slate-200">
        ● Mức thấp
      </span>
    );
  };

  // Can user update progress of active incident?
  const canUpdateActive = useMemo(() => {
    if (!activeIncident) return false;
    if (activeIncident.status === 'RESOLVED') return false;
    if (isManager) return true;
    if (isTechnician && activeIncident.assignedToId === currentUserId) return true;
    return false;
  }, [activeIncident, isManager, isTechnician, currentUserId]);

  if (view === 'create') {
    return (
      <CreateFarmIncident
        role={role}
        onBack={() => setView('list')}
        onSuccess={(_created, isSelfAssigned) => {
          setView('list');
          loadIncidents();
          setNotice(
            isSelfAssigned
              ? 'Đã ghi nhận sự cố và bạn đã tự tiếp nhận xử lý ca này.'
              : 'Đã gửi báo cáo sự cố thành công! Quản lý trang trại đã nhận được thông báo để tiếp nhận & phân công nhân sự.'
          );
        }}
      />
    );
  }

  return (
    <div className="relative mx-auto w-full max-w-7xl space-y-6 pb-16 font-sans">
      {/* Toast Alert Notice */}
      {(notice || error) && (
        <div
          className={`fixed right-6 top-6 z-[250] flex max-w-[calc(100vw-3rem)] items-center gap-3 rounded-2xl border px-5 py-3.5 shadow-xl animate-in slide-in-from-right-8 fade-in duration-300 ${
            error
              ? 'border-rose-200 bg-rose-50 text-rose-800'
              : 'border-emerald-200 bg-emerald-50 text-emerald-800'
          }`}
        >
          {error ? (
            <AlertCircle className="h-5 w-5 text-rose-600 shrink-0" />
          ) : (
            <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
          )}
          <span className="text-xs sm:text-sm font-bold">{error || notice}</span>
          <button
            onClick={() => {
              setError('');
              setNotice('');
            }}
            className="ml-2 text-slate-400 hover:text-slate-600 cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* ── HEADER SECTION ── */}
      <div className="rounded-3xl border border-slate-200/90 bg-white p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500 text-white shadow-md shadow-amber-500/20">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                  {isFarmer
                    ? 'Lịch Sử Báo Cáo Sự Cố Trang Trại'
                    : isTechnician
                    ? 'Báo Cáo Sự Cố & Nhiệm Vụ Khắc Phục'
                    : 'Trung Tâm Điều Phối & Quản Lý Sự Cố Trang Trại'}
                </h1>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold border ${
                    isManager
                      ? 'bg-blue-50 text-blue-700 border-blue-200'
                      : isTechnician
                      ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                      : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  }`}
                >
                  {isManager ? 'Quản lý' : isTechnician ? 'Kỹ thuật viên' : 'Nông dân'}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 mt-1">
                {isFarmer
                  ? 'Theo dõi tiến độ Quản lý tiếp nhận và phân công khắc phục các sự cố do bạn gửi lên.'
                  : isTechnician
                  ? 'Báo cáo sự cố thiết bị/hạ tầng lên Quản lý và theo dõi các nhiệm vụ khắc phục được giao.'
                  : 'Tiếp nhận toàn bộ sự cố từ Nông dân & Kỹ thuật viên; phân công nhân sự khắc phục kịp thời.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => loadIncidents()}
              disabled={loading}
              className="flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer"
              title="Tải lại danh sách"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>

            {/* Báo cáo sự cố mới button */}
            <button
              onClick={() => setView('create')}
              className="flex items-center gap-2 rounded-2xl bg-amber-500 hover:bg-amber-600 px-5 py-3 text-xs sm:text-sm font-bold text-white shadow-md shadow-amber-500/20 transition-all cursor-pointer"
            >
              <Plus className="h-4 w-4 stroke-[3]" />
              <span>{isManager ? 'Lập Sự Cố Mới' : 'Báo Cáo Sự Cố Mới'}</span>
            </button>
          </div>
        </div>

        {/* ── TECHNICIAN SUB-VIEW TOGGLE ── */}
        {isTechnician && (
          <div className="mt-5 pt-4 border-t border-slate-100 flex flex-wrap gap-2">
            <button
              onClick={() => setTechViewMode('my_reports')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                techViewMode === 'my_reports'
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <Send className="w-3.5 h-3.5" />
              Sự cố tôi đã báo cáo (
              {
                incidents.filter(
                  (i) => i.reporter?.id === currentUserId || (i as any).reporterId === currentUserId
                ).length
              }
              )
            </button>

            <button
              onClick={() => setTechViewMode('assigned_to_me')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                techViewMode === 'assigned_to_me'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <Wrench className="w-3.5 h-3.5" />
              Nhiệm vụ được giao cho tôi (
              {
                incidents.filter(
                  (i) => i.assignedToId === currentUserId || i.assignedTo?.id === currentUserId
                ).length
              }
              )
            </button>
          </div>
        )}

        {/* ── MANAGER STATS BANNER ── */}
        {isManager && (
          <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-slate-100">
            <div
              onClick={() => setTab('open')}
              className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                tab === 'open'
                  ? 'border-amber-400 bg-amber-50/80 ring-2 ring-amber-400/20'
                  : 'border-slate-200 bg-slate-50/60 hover:bg-white'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-900">Chờ tiếp nhận</span>
                <span className="h-2 w-2 rounded-full bg-amber-500" />
              </div>
              <div className="text-2xl font-black text-amber-800 mt-1">
                {stats.pendingCount}
              </div>
              <p className="text-[11px] text-amber-700 mt-0.5">Cần Manager phân công</p>
            </div>

            <div
              onClick={() => setTab('treating')}
              className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                tab === 'treating'
                  ? 'border-indigo-400 bg-indigo-50/80 ring-2 ring-indigo-400/20'
                  : 'border-slate-200 bg-slate-50/60 hover:bg-white'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-indigo-900">Đang khắc phục</span>
                <span className="h-2 w-2 rounded-full bg-indigo-500" />
              </div>
              <div className="text-2xl font-black text-indigo-800 mt-1">
                {stats.treatingCount}
              </div>
              <p className="text-[11px] text-indigo-700 mt-0.5">Đã phân công nhân sự</p>
            </div>

            <div
              onClick={() => setTab('resolved')}
              className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                tab === 'resolved'
                  ? 'border-emerald-400 bg-emerald-50/80 ring-2 ring-emerald-400/20'
                  : 'border-slate-200 bg-slate-50/60 hover:bg-white'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-900">Đã hoàn tất</span>
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
              </div>
              <div className="text-2xl font-black text-emerald-800 mt-1">
                {stats.resolvedCount}
              </div>
              <p className="text-[11px] text-emerald-700 mt-0.5">Đã nghiệm thu xong</p>
            </div>

            <div
              onClick={() => {
                setTab('all');
                setSelectedSeverity('Khẩn cấp');
              }}
              className="p-3.5 rounded-2xl border border-rose-200 bg-rose-50/60 transition-all cursor-pointer hover:bg-rose-50"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-rose-900">Nguy cấp / Cao</span>
                {stats.criticalCount > 0 && (
                  <span className="h-2.5 w-2.5 rounded-full bg-rose-600 animate-ping" />
                )}
              </div>
              <div className="text-2xl font-black text-rose-800 mt-1">
                {stats.criticalCount}
              </div>
              <p className="text-[11px] text-rose-700 mt-0.5">Cần chú ý xử lý gấp</p>
            </div>
          </div>
        )}
      </div>

      {/* ── FILTER & TAB TOOLBAR ── */}
      <div className="rounded-3xl border border-slate-200/90 bg-white p-4 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Main Status Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
            {isManager ? (
              <>
                <button
                  onClick={() => setTab('open')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                    tab === 'open'
                      ? 'bg-amber-500 text-white shadow-xs'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <span>Chờ tiếp nhận</span>
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                      tab === 'open'
                        ? 'bg-amber-600 text-white'
                        : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {openIncidents.length}
                  </span>
                </button>

                <button
                  onClick={() => setTab('treating')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                    tab === 'treating'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <span>Đang khắc phục</span>
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                      tab === 'treating'
                        ? 'bg-indigo-700 text-white'
                        : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {treatingIncidents.length}
                  </span>
                </button>

                <button
                  onClick={() => setTab('resolved')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                    tab === 'resolved'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <span>Đã hoàn tất</span>
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                      tab === 'resolved'
                        ? 'bg-emerald-700 text-white'
                        : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {resolvedIncidents.length}
                  </span>
                </button>

                <button
                  onClick={() => setTab('all')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                    tab === 'all'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  Tất cả ({filteredIncidents.length})
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setTab('all')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                    tab === 'all'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  Tất cả ({roleScopedIncidents.length})
                </button>
                <button
                  onClick={() => setTab('open')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                    tab === 'open'
                      ? 'bg-amber-500 text-white shadow-xs'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  Chờ tiếp nhận ({openIncidents.length})
                </button>
                <button
                  onClick={() => setTab('treating')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                    tab === 'treating'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  Đang xử lý ({treatingIncidents.length})
                </button>
                <button
                  onClick={() => setTab('resolved')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                    tab === 'resolved'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  Đã giải quyết ({resolvedIncidents.length})
                </button>
              </>
            )}
          </div>

          {/* Search Box */}
          <div className="relative w-full md:w-72">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm theo tiêu đề, vị trí, người gửi..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50/60 pl-10 pr-4 py-2 text-xs text-slate-800 placeholder:text-slate-400 focus:bg-white focus:border-amber-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Dropdown Filters */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 text-xs">
          {/* Ao nuôi filter */}
          {ponds.length > 0 && (
            <select
              value={selectedPondId}
              onChange={(e) => setSelectedPondId(e.target.value)}
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-700 focus:outline-none focus:border-amber-500"
            >
              <option value="">Tất cả ao nuôi</option>
              {ponds.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          )}

          {/* Phân loại filter */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-700 focus:outline-none focus:border-amber-500"
          >
            <option value="">Tất cả phân loại</option>
            {FARM_INCIDENT_CATEGORIES.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.icon} {cat.label}
              </option>
            ))}
          </select>

          {/* Mức độ filter */}
          <select
            value={selectedSeverity}
            onChange={(e) => setSelectedSeverity(e.target.value)}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-700 focus:outline-none focus:border-amber-500"
          >
            <option value="">Tất cả mức độ</option>
            {FARM_INCIDENT_SEVERITIES.map((sev) => (
              <option key={sev.id} value={sev.id}>
                {sev.label}
              </option>
            ))}
          </select>

          {/* Reset filter button */}
          {hasActiveFilters && (
            <button
              onClick={handleResetFilters}
              className="px-2.5 py-1.5 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50 transition-colors flex items-center gap-1 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" /> Xóa bộ lọc
            </button>
          )}
        </div>
      </div>

      {/* ── INCIDENTS LIST ── */}
      {loading ? (
        <div className="py-16">
          <LoadingMotion
            mode="card"
            title="Đang đồng bộ sự cố trang trại..."
            subtitle="Hệ thống đang tải dữ liệu hiện trường..."
            color="amber"
          />
        </div>
      ) : currentTabIncidents.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
            <CheckCircle2 className="h-7 w-7" />
          </div>
          <h3 className="mt-4 text-base font-bold text-slate-800">
            Không có sự cố nào trong mục này
          </h3>
          <p className="mt-1 text-xs text-slate-500 max-w-md mx-auto">
            {hasActiveFilters
              ? 'Không tìm thấy sự cố phù hợp với bộ lọc hiện tại. Hãy thử đặt lại bộ lọc.'
              : isFarmer
              ? 'Bạn chưa gửi báo cáo sự cố nào hoặc toàn bộ sự cố đã được Quản lý giải quyết.'
              : isTechnician && techViewMode === 'assigned_to_me'
              ? 'Hiện bạn chưa có nhiệm vụ khắc phục sự cố nào được Quản lý phân công.'
              : 'Trang trại hiện đang vận hành ổn định, không có sự cố nào cần xử lý.'}
          </p>
          {hasActiveFilters ? (
            <button
              onClick={handleResetFilters}
              className="mt-4 inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Đặt lại bộ lọc
            </button>
          ) : (
            <button
              onClick={() => setView('create')}
              className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-amber-500 px-4 py-2 text-xs font-bold text-white hover:bg-amber-600 shadow-xs cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" /> Báo cáo sự cố mới
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {currentTabIncidents.map((inc) => {
            const { category, severity, location, cleanTitle, cleanDescription } =
              parseIncidentMetadata(inc.title, inc.description);
            const isAssigned = Boolean(inc.assignedToId);
            const isResolved = inc.status === 'RESOLVED';
            const pondName = inc.crop?.pond?.name;
            const displayLoc = location || (pondName ? `Ao ${pondName}` : 'Toàn trang trại');

            return (
              <div
                key={inc.id}
                onClick={() => handleOpenDetail(inc)}
                className={`group relative rounded-3xl border bg-white p-5 shadow-xs hover:shadow-md transition-all cursor-pointer flex flex-col justify-between ${
                  isResolved
                    ? 'border-slate-200 opacity-80 hover:opacity-100'
                    : !isAssigned
                    ? 'border-amber-300 ring-1 ring-amber-400/30'
                    : 'border-slate-200/90 hover:border-indigo-300'
                }`}
              >
                {/* Card Top: Badges */}
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    {renderCatBadge(category)}
                    {renderSevBadge(severity)}
                  </div>

                  {/* Title */}
                  <h3 className="text-base font-bold text-slate-900 group-hover:text-amber-600 transition-colors line-clamp-2">
                    {cleanTitle}
                  </h3>

                  {/* Location badge */}
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 mt-2">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">{displayLoc}</span>
                  </div>

                  {/* Description snippet */}
                  <p className="text-xs text-slate-600 mt-2.5 line-clamp-2 leading-relaxed">
                    {cleanDescription || 'Không có mô tả chi tiết.'}
                  </p>
                </div>

                {/* Card Bottom: Status & Meta */}
                <div className="mt-4 pt-3.5 border-t border-slate-100 space-y-3">
                  {/* Status & Assignee indicator */}
                  <div className="flex items-center justify-between gap-2 text-xs">
                    {isResolved ? (
                      <span className="inline-flex items-center gap-1 text-emerald-700 font-bold bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        Đã nghiệm thu hoàn tất
                      </span>
                    ) : isAssigned ? (
                      <span className="inline-flex items-center gap-1 text-indigo-700 font-bold bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-200 truncate">
                        <Wrench className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                        <span className="truncate">
                          Phụ trách: {inc.assignedTo?.fullName || 'Kỹ thuật viên'}
                        </span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-amber-800 font-bold bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200 animate-pulse">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        Chờ tiếp nhận & phân công
                      </span>
                    )}

                    <span className="text-[11px] text-slate-400 font-medium shrink-0">
                      {formatDate(inc.createdAt)}
                    </span>
                  </div>

                  {/* Reporter tag */}
                  <div className="text-[11px] text-slate-400 flex items-center justify-between">
                    <span>
                      Người gửi:{' '}
                      <strong className="text-slate-600">
                        {inc.reporter?.fullName || 'Nhân sự trại'}
                      </strong>
                    </span>
                    {inc._count?.updates ? (
                      <span className="text-slate-500 font-semibold">
                        {inc._count.updates} nhật ký
                      </span>
                    ) : null}
                  </div>

                  {/* Manager Quick Action Button */}
                  {isManager && !isResolved && (
                    <div className="pt-1">
                      {!isAssigned ? (
                        <button
                          type="button"
                          onClick={(e) => handleOpenAssign(inc, e)}
                          className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs shadow-xs transition-all cursor-pointer"
                        >
                          <UserCheck className="w-3.5 h-3.5" />
                          Tiếp Nhận & Phân Công Nhiệm Vụ
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => handleOpenAssign(inc, e)}
                          className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 font-semibold text-xs transition-all cursor-pointer"
                        >
                          <UserX className="w-3.5 h-3.5" />
                          Đổi người phụ trách
                        </button>
                      )}
                    </div>
                  )}

                  {/* Technician Quick Action */}
                  {isTechnician &&
                    inc.assignedToId === currentUserId &&
                    !isResolved && (
                      <div className="pt-1">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenDetail(inc);
                          }}
                          className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs transition-all cursor-pointer"
                        >
                          <Wrench className="w-3.5 h-3.5" />
                          Cập nhật tiến trình khắc phục
                        </button>
                      </div>
                    )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── MODAL: ASSIGN TECHNICIAN (DÀNH CHO QUẢN LÝ) ── */}
      {showAssignModal && activeIncident && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl border border-slate-100 space-y-5 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                  <UserCheck className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Tiếp Nhận & Phân Công Khắc Phục
                  </h3>
                  <p className="text-xs text-slate-500">
                    Chỉ định Kỹ thuật viên phụ trách xử lý sự cố này
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowAssignModal(false)}
                className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Incident Summary */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3.5 text-xs space-y-1.5">
              <p className="font-bold text-slate-900 text-sm">{activeIncident.title}</p>
              <div className="flex items-center gap-2 text-slate-500">
                <MapPin className="w-3.5 h-3.5" />
                <span>{activeIncident.crop?.pond?.name || 'Trang trại'}</span>
                <span>•</span>
                <span>Người báo cáo: {activeIncident.reporter?.fullName || 'N/A'}</span>
              </div>
            </div>

            {/* Technician List */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700">
                Chọn Kỹ thuật viên phụ trách <span className="text-rose-500">*</span>
              </label>

              {loadingTechnicians ? (
                <div className="flex items-center gap-2 text-xs text-slate-500 py-4 justify-center">
                  <RefreshCw className="h-4 w-4 animate-spin text-amber-500" />
                  Đang tải danh sách kỹ thuật viên...
                </div>
              ) : technicians.length > 0 ? (
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {technicians.map((tech) => {
                    const isSelected = selectedTechId === tech.id;
                    return (
                      <button
                        key={tech.id}
                        type="button"
                        onClick={() => setSelectedTechId(tech.id)}
                        className={`w-full flex items-center justify-between p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                          isSelected
                            ? 'border-indigo-600 bg-indigo-50/70 ring-2 ring-indigo-500/20'
                            : 'border-slate-200 bg-slate-50/50 hover:bg-white'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`h-9 w-9 rounded-xl flex items-center justify-center font-bold text-xs ${
                              isSelected
                                ? 'bg-indigo-600 text-white'
                                : 'bg-slate-200 text-slate-700'
                            }`}
                          >
                            {tech.fullName
                              ?.split(' ')
                              .map((n) => n[0])
                              .join('')
                              .slice(0, 2)
                              .toUpperCase() || 'KT'}
                          </div>
                          <div>
                            <p className="text-xs font-bold text-slate-900">{tech.fullName}</p>
                            <p className="text-[11px] text-slate-400">{tech.email}</p>
                          </div>
                        </div>
                        {isSelected && <CheckCircle2 className="h-4 w-4 text-indigo-600" />}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                  Chưa tìm thấy nhân sự Kỹ thuật viên hoạt động trong trang trại này. Bạn có thể thêm nhân sự vào mục Quản lý Trang Trại.
                </div>
              )}
            </div>

            {/* Instruction note */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Chỉ đạo của Quản lý (tùy chọn)
              </label>
              <textarea
                rows={2}
                value={assignNote}
                onChange={(e) => setAssignNote(e.target.value)}
                placeholder="Ví dụ: Mang motor dự phòng 3kW thay thế ngay trong sáng nay, kiểm tra kỹ dây nguồn..."
                className="w-full rounded-2xl border border-slate-200 px-3.5 py-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 bg-slate-50/50 resize-none"
              />
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowAssignModal(false)}
                disabled={saving}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleAssignSubmit}
                disabled={saving || !selectedTechId}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-xs font-bold text-white shadow-xs cursor-pointer disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    Đang phân công...
                  </>
                ) : (
                  <>
                    <UserCheck className="h-3.5 w-3.5" />
                    Xác Nhận & Giao Nhiệm Vụ
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: CHI TIẾT SỰ CỐ & NHẬT KÝ TIẾN TRÌNH ── */}
      {showDetailModal && activeIncident && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-3xl bg-white shadow-2xl border border-slate-100 overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 flex items-start justify-between gap-3 shrink-0 bg-slate-50/50">
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  {renderCatBadge(
                    parseIncidentMetadata(activeIncident.title, activeIncident.description).category
                  )}
                  {renderSevBadge(
                    parseIncidentMetadata(activeIncident.title, activeIncident.description).severity
                  )}
                  <span
                    className={`rounded-lg px-2.5 py-0.5 text-xs font-bold ${
                      activeIncident.status === 'RESOLVED'
                        ? 'bg-emerald-100 text-emerald-800'
                        : activeIncident.assignedToId
                        ? 'bg-indigo-100 text-indigo-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {activeIncident.status === 'RESOLVED'
                      ? 'Đã nghiệm thu hoàn tất'
                      : activeIncident.assignedToId
                      ? 'Đang khắc phục'
                      : 'Chờ Quản lý tiếp nhận'}
                  </span>
                </div>
                <h2 className="text-lg font-black text-slate-900">
                  {parseIncidentMetadata(activeIncident.title, activeIncident.description).cleanTitle}
                </h2>
                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mt-1">
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    {parseIncidentMetadata(activeIncident.title, activeIncident.description).location ||
                      activeIncident.crop?.pond?.name ||
                      'Toàn trang trại'}
                  </span>
                  <span>•</span>
                  <span>Báo cáo: {formatDate(activeIncident.createdAt)}</span>
                </div>
              </div>
              <button
                onClick={() => setShowDetailModal(false)}
                className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body (Scrollable) */}
            <div className="p-6 overflow-y-auto space-y-5">
              {/* Personnel Info Card */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 rounded-2xl bg-slate-50 border border-slate-200/80 text-xs">
                <div>
                  <span className="text-slate-400 font-semibold block">Người báo cáo sự cố</span>
                  <p className="font-bold text-slate-900 text-sm mt-0.5">
                    {activeIncident.reporter?.fullName || 'N/A'}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Vai trò: {activeIncident.reporter?.role || 'Nhân sự trại'}
                  </p>
                </div>
                <div>
                  <span className="text-slate-400 font-semibold block">Kỹ thuật viên phụ trách</span>
                  {activeIncident.assignedTo ? (
                    <div>
                      <p className="font-bold text-indigo-900 text-sm mt-0.5 flex items-center gap-1">
                        <Wrench className="w-3.5 h-3.5 text-indigo-600" />
                        {activeIncident.assignedTo.fullName}
                      </p>
                      <p className="text-[11px] text-indigo-700">{activeIncident.assignedTo.email}</p>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-amber-700 font-semibold">Chưa phân công</span>
                      {isManager && (
                        <button
                          type="button"
                          onClick={() => {
                            setShowDetailModal(false);
                            handleOpenAssign(activeIncident);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-amber-500 text-white font-bold text-[11px] hover:bg-amber-600 cursor-pointer"
                        >
                          Phân công ngay
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Description */}
              <div>
                <h4 className="text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-amber-500" />
                  Mô tả hiện trạng hiện trường
                </h4>
                <div className="rounded-2xl border border-slate-200 bg-white p-4 text-xs text-slate-800 leading-relaxed whitespace-pre-line shadow-2xs">
                  {parseIncidentMetadata(activeIncident.title, activeIncident.description)
                    .cleanDescription || 'Không có mô tả chi tiết.'}
                </div>
              </div>

              {/* Treatment / Progress Timeline */}
              <div>
                <h4 className="text-xs font-bold text-slate-700 mb-2.5 flex items-center gap-1.5">
                  <History className="w-3.5 h-3.5 text-blue-500" />
                  Nhật ký tiến trình xử lý ({activeIncident.updates?.length || 0})
                </h4>

                {activeIncident.updates && activeIncident.updates.length > 0 ? (
                  <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                    {activeIncident.updates.map((up) => {
                      return (
                        <div key={up.id} className="relative text-xs">
                          <span className="absolute -left-6 top-1 h-3 w-3 rounded-full border-2 border-white bg-blue-500 shadow-xs" />
                          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-1">
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="font-bold text-slate-800">
                                {up.author?.fullName || 'Hệ thống'} ({up.author?.role || 'Cán bộ'})
                              </span>
                              <span className="text-slate-400">{formatDate(up.createdAt)}</span>
                            </div>
                            <p className="text-slate-700 leading-relaxed">{up.treatment}</p>
                            {up.result && (
                              <p className="text-emerald-700 font-semibold pt-1 border-t border-slate-200/60 mt-1">
                                Kết quả nghiệm thu: {up.result}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">Chưa có cập nhật tiến trình nào.</p>
                )}
              </div>

              {/* Progress Update Form (For Manager or Assigned Technician) */}
              {canUpdateActive && (
                <div className="rounded-2xl border border-blue-200 bg-blue-50/40 p-4 space-y-3">
                  <h4 className="text-xs font-bold text-blue-900 flex items-center gap-1.5">
                    <Send className="w-3.5 h-3.5 text-blue-600" />
                    Cập nhật tiến trình khắc phục hiện trường
                  </h4>

                  <textarea
                    rows={3}
                    value={updateNote}
                    onChange={(e) => setUpdateNote(e.target.value)}
                    placeholder="Ghi nhận linh kiện đã thay thế, biện pháp đã thực hiện, kết quả chạy thử..."
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 resize-none"
                  />

                  {/* Manager Resolve Checkbox */}
                  {isManager && (
                    <label className="flex items-center gap-2 text-xs font-bold text-slate-800 cursor-pointer pt-1">
                      <input
                        type="checkbox"
                        checked={isFinishing}
                        onChange={(e) => setIsFinishing(e.target.checked)}
                        className="h-4 w-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300"
                      />
                      <span>Nghiệm thu và xác nhận hoàn tất khắc phục sự cố này</span>
                    </label>
                  )}

                  {isFinishing && (
                    <input
                      type="text"
                      value={resolveNote}
                      onChange={(e) => setResolveNote(e.target.value)}
                      placeholder="Ghi chú nghiệm thu (VD: Máy bơm đã chạy thử 30 phút ổn định, bàn giao vận hành)"
                      className="w-full rounded-xl border border-emerald-300 bg-white px-3.5 py-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-500"
                    />
                  )}

                  <div className="flex justify-end pt-1">
                    <button
                      type="button"
                      onClick={handleSaveProgress}
                      disabled={saving}
                      className={`px-4 py-2 rounded-xl text-xs font-bold text-white shadow-xs cursor-pointer ${
                        isFinishing
                          ? 'bg-emerald-600 hover:bg-emerald-700'
                          : 'bg-blue-600 hover:bg-blue-700'
                      }`}
                    >
                      {saving ? (
                        'Đang lưu...'
                      ) : isFinishing ? (
                        <span className="flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Nghiệm Thu & Đóng Sự Cố
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5">
                          <Send className="w-3.5 h-3.5" /> Ghi Nhật Ký Tiến Trình
                        </span>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Technician Quick Start button */}
              {isTechnician &&
                activeIncident.assignedToId === currentUserId &&
                activeIncident.status === 'OPEN' && (
                  <div className="p-3.5 rounded-2xl border border-indigo-200 bg-indigo-50/70 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-indigo-900">
                        Bạn được Quản lý phân công xử lý sự cố này
                      </p>
                      <p className="text-[11px] text-indigo-700">
                        Bấm xác nhận bắt đầu khi bạn đã có mặt tại hiện trường.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleStartRepair}
                      disabled={saving}
                      className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-xs font-bold text-white shadow-xs cursor-pointer"
                    >
                      Bắt đầu xử lý
                    </button>
                  </div>
                )}

              {/* Reopen Box (For Manager if incident is resolved) */}
              {isManager && activeIncident.status === 'RESOLVED' && (
                <div className="border-t border-slate-100 pt-4">
                  {!showReopenBox ? (
                    <button
                      type="button"
                      onClick={() => setShowReopenBox(true)}
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-amber-700 cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Mở lại sự cố nếu thiết bị/hạ tầng tái phát lỗi
                    </button>
                  ) : (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4 space-y-2.5">
                      <p className="text-xs font-bold text-amber-900">Lý do mở lại sự cố:</p>
                      <textarea
                        rows={2}
                        value={reopenReason}
                        onChange={(e) => setReopenReason(e.target.value)}
                        placeholder="Mô tả lý do mở lại (VD: Dàn quạt chạy được 1 giờ lại bị phát tiếng kêu lạ...)"
                        className="w-full rounded-xl border border-amber-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-amber-500"
                      />
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setShowReopenBox(false)}
                          className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-white cursor-pointer"
                        >
                          Hủy
                        </button>
                        <button
                          type="button"
                          onClick={handleReopen}
                          disabled={saving || !reopenReason.trim()}
                          className="px-4 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-xs font-bold text-white shadow-xs cursor-pointer disabled:opacity-50"
                        >
                          Xác nhận mở lại sự cố
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-end shrink-0">
              <button
                type="button"
                onClick={() => setShowDetailModal(false)}
                className="px-5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-xs font-bold text-slate-700 cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
