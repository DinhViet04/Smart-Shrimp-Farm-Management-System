import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
  Wrench,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Search,
  X,
  Waves,
  ChevronDown,
  ArrowRight,
  History,
  Building2,
  Eye,
} from 'lucide-react';
import { pondService } from '../../services/pond.service';
import { waterQualityService } from '../../services/water-quality.service';
import { incidentService, type Incident } from '../../services/incident.service';
import LoadingMotion from '../../components/LoadingMotion';
import WaterTreatmentWorkspace from './WaterTreatmentWorkspace';
import { useRealtimeRefresh } from '../../hooks/useRealtimeRefresh';
import type { StoredUser } from '../../types/user';

// ─── Types & Data Interfaces ───────────────────────────────────────────────────

export interface Farm {
  id: string;
  name: string;
}

export interface Pond {
  id: string;
  name: string;
  farmId: string;
  areaSize?: number;
  depth?: number;
}

export interface AIChatMessage {
  id: string;
  sender: 'ai' | 'user';
  text: string;
  timestamp: string;
}

export interface ChemicalItem {
  id: string;
  name: string;
  stock: number;
  unit: string;
  category: string;
}

export interface TreatmentAction {
  chemicalId: string;
  chemicalName: string;
  quantity: number;
  unit: string;
  note: string;
  technicianName: string;
  timestamp: string;
  updates?: any[];
}

export interface WaterWarningRecord {
  id: string;
  date: string;
  time: string;
  farmName: string;
  pondId: string;
  pondName: string;
  hazardLevel: 'DANGER' | 'WARNING';
  summaryText: string;
  status: 'UNTREATED' | 'TREATED';
  parameters: {
    temperature: number;
    ph: number;
    dissolvedOxygen: number;
    salinity: number;
    alkalinity: number;
    nh3: number;
    h2s?: number;
    transparency?: number;
  };
  triggeredParams: string[];
  treatment?: TreatmentAction;
  updates?: any[];
  rawRecordTime?: string;
  /** Nguồn cảnh báo: lần đo vượt ngưỡng (mặc định) hoặc sự cố "Môi trường & Nước ao" được báo cáo */
  source?: 'READING' | 'INCIDENT';
  incidentId?: string;
}

export interface WaterTreatmentProps {
  initialFarmId?: string;
  initialPondId?: string;
  /** Tab mở sẵn: 'incident' = Cảnh báo cần xử lý, 'history' = Lịch sử đã xử lý */
  initialView?: 'incident' | 'history';
  onOpenWorkspace?: (record: WaterWarningRecord) => void;
  /** Tự mở Workspace của ao initialPondId (chỉ một lần). Tắt khi người dùng đã bấm "Quay lại". */
  autoOpenWorkspace?: boolean;
}

// ─── Parser Helper for Real History Records ────────────────────────────────────

function parseRecordFromHistory(r: any): WaterWarningRecord {
  const d = new Date(r.recordTime || r.createdAt || Date.now());
  const dateStr = isNaN(d.getTime())
    ? '-'
    : d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const timeStr = isNaN(d.getTime())
    ? '-'
    : d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false });

  const temp = Number(r.temperature) || 0;
  const ph = Number(r.ph) || 0;
  const doVal = Number(r.dissolvedOxygen) || 0;
  const sal = Number(r.salinity) || 0;
  const alk = Number(r.alkalinity) || 0;
  const nh3 = Number(r.nh3) || 0;
  const h2s = Number(r.h2s) || 0;

  const triggered: string[] = [];
  const summaries: string[] = [];

  if (nh3 > 0.3) {
    triggered.push('nh3');
    summaries.push(`NH3 cao: ${nh3} mg/L`);
  }
  if (doVal > 0 && doVal < 4.0) {
    triggered.push('dissolvedOxygen');
    summaries.push(`DO thấp: ${doVal} mg/L`);
  }
  if (ph > 0 && (ph < 7.5 || ph > 8.5)) {
    triggered.push('ph');
    summaries.push(`pH biến động: ${ph}`);
  }
  if (alk > 0 && (alk < 100 || alk > 160)) {
    triggered.push('alkalinity');
    summaries.push(`Độ kiềm: ${alk} mg/L`);
  }
  if (temp > 0 && (temp < 25 || temp > 30)) {
    triggered.push('temperature');
    summaries.push(`Nhiệt độ: ${temp}°C`);
  }
  if (h2s > 0.03) {
    triggered.push('h2s');
    summaries.push(`H2S cao: ${h2s} mg/L`);
  }

  // Chỉ số = 0 nghĩa là không đo -> không tính là nguy hiểm
  const isDanger =
    r.overallStatus === 'Danger' ||
    nh3 > 0.50 ||
    (doVal > 0 && doVal < 3.0) ||
    h2s > 0.05 ||
    (ph > 0 && ph < 7.0) ||
    ph > 9.0;

  const hazardLevel: 'DANGER' | 'WARNING' = isDanger ? 'DANGER' : 'WARNING';
  const summaryText = summaries.length > 0 ? summaries.join(' • ') : 'Cần theo dõi môi trường ao';

  // Việc xử lý được lưu trong bảng water_treatments trên server (dùng chung mọi tài khoản / thiết bị)
  const serverTreatment = r.treatment as
    | { note?: string | null; chemicals?: Array<{ inventoryId?: string; name: string; quantity: number; unit: string }> | null; treatedByName?: string | null; treatedAt: string }
    | null
    | undefined;
  const savedTreatment: TreatmentAction | undefined = serverTreatment
    ? {
        chemicalId: serverTreatment.chemicals?.[0]?.inventoryId || 'tech-op',
        chemicalName:
          (serverTreatment.chemicals || []).map((c) => `${c.quantity} ${c.unit} ${c.name}`).join(', ') || 'Can thiệp kỹ thuật',
        quantity: Number(serverTreatment.chemicals?.[0]?.quantity) || 1,
        unit: serverTreatment.chemicals?.[0]?.unit || 'lần',
        note: serverTreatment.note || 'Đã can thiệp xử lý chất lượng nước ao nuôi.',
        technicianName: serverTreatment.treatedByName || 'Kỹ thuật viên',
        timestamp: new Date(serverTreatment.treatedAt).toLocaleString('vi-VN', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }),
      }
    : undefined;

  return {
    id: r.id || `WQ-${Date.now()}`,
    date: dateStr,
    time: timeStr,
    rawRecordTime: r.recordTime,
    farmName: r.farmName || 'Trang trại',
    pondId: r.pondId || '',
    pondName: r.pondName || 'Ao nuôi',
    hazardLevel,
    summaryText,
    status: savedTreatment ? 'TREATED' : 'UNTREATED',
    // Lần đo bình thường -> rỗng (trước đây gán mặc định ['nh3'] khiến mọi lần đo đều thành cảnh báo)
    triggeredParams: triggered,
    parameters: {
      temperature: temp,
      ph: ph,
      dissolvedOxygen: doVal,
      salinity: sal,
      alkalinity: alk,
      nh3: nh3,
      h2s: h2s,
      transparency: Number(r.transparency) || 0,
    },
    treatment: savedTreatment,
    updates: [],
  };
}

// ─── Sự cố "Môi trường & Nước ao" -> thẻ cảnh báo trong danh sách xử lý nước ──────────

/** Sự cố thuộc loại Môi trường nước (theo nhãn phân loại trong tiêu đề / mô tả) */
function isWaterIncident(inc: Incident): boolean {
  const category =
    inc.title?.match(/^\[(.*?)\]/)?.[1] || inc.description?.match(/\[Phân loại:\s*(.*?)\]/i)?.[1] || '';
  return /môi trường|nước ao/i.test(category);
}

function incidentToWarning(inc: Incident, latestByPond: Map<string, WaterWarningRecord>): WaterWarningRecord {
  const created = new Date(inc.createdAt);
  const pond = inc.crop?.pond;
  const latest = pond?.id ? latestByPond.get(pond.id) : undefined;
  const severity = inc.description?.match(/\[Mức độ:\s*(.*?)\]/i)?.[1] || '';
  const isDanger = /khẩn cấp|cao|nguy hiểm/i.test(severity);
  const cleanTitle = (inc.title || '').replace(/^\[(.*?)\]\s*/, '');
  const cleanDesc = (inc.description || '').replace(/^(\[.*?\]\s*)+\n*/, '').trim();
  const resolved = inc.status === 'RESOLVED';
  const resolvedAt = inc.resolvedAt ? new Date(inc.resolvedAt) : null;

  return {
    id: `INC-${inc.id}`,
    source: 'INCIDENT',
    incidentId: inc.id,
    date: created.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }),
    time: created.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false }),
    rawRecordTime: inc.createdAt,
    farmName: pond?.farm?.name || 'Trang trại',
    pondId: pond?.id || '',
    pondName: pond?.name || 'Ao nuôi',
    hazardLevel: isDanger ? 'DANGER' : 'WARNING',
    summaryText: `Sự cố được báo cáo: ${cleanTitle}${cleanDesc ? ` — ${cleanDesc}` : ''}`,
    status: resolved ? 'TREATED' : 'UNTREATED',
    // Dùng số đo gần nhất của ao (nếu có) để màn xử lý tính liều & AI tư vấn
    parameters: latest?.parameters || {
      temperature: 0,
      ph: 0,
      dissolvedOxygen: 0,
      salinity: 0,
      alkalinity: 0,
      nh3: 0,
      h2s: 0,
      transparency: 0,
    },
    triggeredParams: latest?.triggeredParams || [],
    treatment: resolved
      ? {
          chemicalId: 'incident',
          chemicalName: 'Xử lý sự cố môi trường nước',
          quantity: 1,
          unit: 'lần',
          note: inc.treatment || 'Đã xử lý sự cố môi trường nước.',
          technicianName: inc.assignedTo?.fullName || 'Kỹ thuật viên',
          timestamp: resolvedAt
            ? resolvedAt.toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
            : '',
        }
      : undefined,
    updates: [],
  };
}

// ─── Main Water Treatment Component ──────────────────────────────────────────

export default function WaterTreatment({
  initialFarmId,
  initialPondId,
  initialView = 'incident',
  onOpenWorkspace,
  autoOpenWorkspace = true,
}: WaterTreatmentProps = {}) {
  // ── User Role & Theme Sync ──────────────────────────────────────────────────
  const [currentUser, setCurrentUser] = useState<StoredUser | null>(null);

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

  const isFarmer = currentUser?.role === 'FARMER';

  // ── Segmented SubTab: 1. Cần xử lý | 2. Lịch sử đã xử lý ──
  const [subTab, setSubTab] = useState<'incident' | 'history'>(initialView);
  const [categoryPage, setCategoryPage] = useState(1);

  // ── Farms, Ponds & Filters State ───────────────────────────────────────────
  const [farms, setFarms] = useState<Farm[]>([]);
  const [ponds, setPonds] = useState<Pond[]>([]);
  const [selectedFarmId, setSelectedFarmId] = useState(initialFarmId || '');
  const [selectedPondId, setSelectedPondId] = useState(initialPondId || '');
  const [hazardFilter, setHazardFilter] = useState<'ALL' | 'DANGER' | 'WARNING'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // ── Data & Workspace State ──────────────────────────────────────────────────
  const [records, setRecords] = useState<WaterWarningRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedRecord, setSelectedRecord] = useState<WaterWarningRecord | null>(null);

  // Filtered ponds based on selected farm
  const filteredPonds = useMemo(() => {
    return selectedFarmId ? ponds.filter((p) => p.farmId === selectedFarmId) : ponds;
  }, [ponds, selectedFarmId]);

  // Load farms and ponds
  // Realtime: tăng bộ đếm để effect bên dưới tải lại khi dữ liệu thay đổi
  const [farmsRealtimeTick, setFarmsRealtimeTick] = useState(0);
  useRealtimeRefresh(['farms', 'ponds'], () => setFarmsRealtimeTick((v) => v + 1));
  useEffect(() => {
    async function loadFarmsAndPonds() {
      try {
        const { farms: farmsData, ponds: pondsData } = await pondService.getOverview();
        const farmList: Farm[] = (farmsData || []).map((f: any) => ({
          id: f.id,
          name: f.name,
        }));
        const pondList: Pond[] = (pondsData || []).map((p: any) => ({
          id: p.id,
          name: p.name,
          farmId: p.farmId || (p.farm as any)?.id || '',
          areaSize: Number(p.areaSize) || 1000,
          depth: Number(p.depth) || 1.2,
        }));
        setFarms(farmList);
        setPonds(pondList);
      } catch (err) {
        console.warn('Could not load farms and ponds', err);
      }
    }
    loadFarmsAndPonds();
  }, [farmsRealtimeTick]);

  // Fetch real warning records from water quality history
  const fetchHistoryRecords = useCallback(async (silent?: unknown) => {
    if (silent !== true) setIsLoading(true);
    try {
      const [res, incidentRes] = await Promise.all([
        waterQualityService.getHistory({
          farmId: selectedFarmId || undefined,
          pondId: selectedPondId || undefined,
          page: 0,
          size: 100,
        }),
        // Sự cố "Môi trường & Nước ao" do người dùng báo cáo cũng là cảnh báo cần xử lý
        incidentService
          .getAll({ farmId: selectedFarmId || undefined, pondId: selectedPondId || undefined, size: 100 })
          .catch(() => ({ content: [] as Incident[], totalElements: 0 })),
      ]);

      const rawItems = Array.isArray(res) ? res : (res as any)?.content || (res as any)?.items || (res as any)?.data || [];
      const parsed: WaterWarningRecord[] = rawItems.map((r: any) => parseRecordFromHistory(r));

      // Số đo mới nhất của từng ao (API trả mới nhất trước)
      const latestByPond = new Map<string, WaterWarningRecord>();
      for (const r of parsed) if (r.pondId && !latestByPond.has(r.pondId)) latestByPond.set(r.pondId, r);

      const incidentWarnings = (incidentRes?.content || [])
        .filter(isWaterIncident)
        .map((inc) => incidentToWarning(inc, latestByPond));

      if (rawItems.length > 0 || incidentWarnings.length > 0) {
        // Filter records that have triggered issues or were marked Danger/Warning
        const warningOnly = parsed.filter(
          (r: WaterWarningRecord) =>
            r.triggeredParams.length > 0 || r.hazardLevel === 'DANGER' || r.treatment
        );
        const time = (r: WaterWarningRecord) => (r.rawRecordTime ? new Date(r.rawRecordTime).getTime() : 0);
        setRecords([...incidentWarnings, ...warningOnly].sort((a, b) => time(b) - time(a)));
      } else {
        // Không có lần đo nào -> không có cảnh báo (không hiển thị dữ liệu mẫu giả)
        setRecords([]);
      }
    } catch (err) {
      console.warn('Không tải được cảnh báo môi trường nước:', err);
      setRecords([]);
    } finally {
      setIsLoading(false);
    }
  }, [selectedFarmId, selectedPondId]);

  // Realtime: tự tải lại khi dữ liệu liên quan thay đổi trên server
  useRealtimeRefresh(['water-quality', 'environment', 'incidents'], () => {
    void fetchHistoryRecords(true);
  });

  useEffect(() => {
    fetchHistoryRecords();
  }, [fetchHistoryRecords]);

  // Open detail workspace handler
  const handleOpenDetail = useCallback(
    (record: WaterWarningRecord) => {
      if (onOpenWorkspace) {
        onOpenWorkspace(record);
        return;
      }
      setSelectedRecord(record);
    },
    [onOpenWorkspace]
  );

  // Tự động mở Workspace nếu được truyền initialPondId — chỉ một lần,
  // để bấm "Quay lại" (hoặc realtime refresh) không bị mở lại ngay lập tức
  const autoOpenedRef = useRef(false);
  useEffect(() => {
    if (!autoOpenWorkspace || autoOpenedRef.current) return;
    if (initialPondId && records.length > 0) {
      const matched =
        records.find(
          (r) =>
            (r.pondId === initialPondId || r.pondName === initialPondId) &&
            r.status === 'UNTREATED'
        ) ||
        records.find(
          (r) => r.pondId === initialPondId || r.pondName === initialPondId
        );
      if (matched) {
        autoOpenedRef.current = true;
        handleOpenDetail(matched);
      }
    }
  }, [autoOpenWorkspace, initialPondId, records, handleOpenDetail]);

  // Filtered records based on search and hazard level
  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      const matchSearch =
        r.pondName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.summaryText.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.farmName.toLowerCase().includes(searchQuery.toLowerCase());

      const matchHazard = hazardFilter === 'ALL' || r.hazardLevel === hazardFilter;
      return matchSearch && matchHazard;
    });
  }, [records, searchQuery, hazardFilter]);

  // Split filtered records into 2 categories: 1. Cần xử lý | 2. Lịch sử đã xử lý
  const openRecords = useMemo(() => {
    return filteredRecords.filter((r) => r.status === 'UNTREATED');
  }, [filteredRecords]);

  const resolvedRecords = useMemo(() => {
    return filteredRecords.filter((r) => r.status === 'TREATED');
  }, [filteredRecords]);

  // Current list for the active subTab
  const currentList = useMemo(() => {
    if (subTab === 'incident') return openRecords;
    return resolvedRecords;
  }, [subTab, openRecords, resolvedRecords]);

  const ITEMS_PER_PAGE = 9;
  const totalPages = Math.ceil(currentList.length / ITEMS_PER_PAGE);
  const paginatedItems = useMemo(() => {
    return currentList.slice(
      (categoryPage - 1) * ITEMS_PER_PAGE,
      categoryPage * ITEMS_PER_PAGE
    );
  }, [currentList, categoryPage]);

  // Render dedicated full workspace if selected locally (fallback when onOpenWorkspace is not supplied)
  if (selectedRecord && !onOpenWorkspace) {
    return (
      <WaterTreatmentWorkspace
        record={selectedRecord}
        onBack={() => {
          setSelectedRecord(null);
          fetchHistoryRecords();
        }}
        onSaved={() => {
          setSelectedRecord(null);
          fetchHistoryRecords();
          setSubTab('history');
        }}
        ponds={ponds}
        farms={farms}
      />
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 pb-12 font-sans antialiased text-slate-800">
      {/* ── CHẾ ĐỘ XEM 2 BƯỚC (Cần xử lý & Lịch sử) ──────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-2 bg-slate-100/90 rounded-3xl border border-slate-200/80 shadow-xs">
        <div className="inline-flex items-center p-1 bg-white/95 rounded-2xl border border-slate-200/60 shadow-xs flex-wrap gap-1">
          {/* Tab 1: Cảnh báo cần xử lý */}
          <button
            type="button"
            onClick={() => {
              setSubTab('incident');
              setCategoryPage(1);
            }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
              subTab === 'incident'
                ? isFarmer
                  ? 'bg-teal-600 text-white shadow-sm shadow-teal-600/30'
                  : 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
            }`}
          >
            <AlertTriangle className="w-4 h-4" />
            <span>1. Cảnh báo cần xử lý</span>
            {openRecords.length > 0 && (
              <span
                className={`ml-0.5 rounded-full px-2 py-0.5 text-[10px] font-black ${
                  subTab === 'incident' ? 'bg-white text-indigo-700' : 'bg-rose-100 text-rose-700'
                }`}
              >
                {openRecords.length}
              </span>
            )}
          </button>

          {/* Tab 2: Lịch sử đã xử lý */}
          <button
            type="button"
            onClick={() => {
              setSubTab('history');
              setCategoryPage(1);
            }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
              subTab === 'history'
                ? isFarmer
                  ? 'bg-teal-600 text-white shadow-sm shadow-teal-600/30'
                  : 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/30'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
            }`}
          >
            <History className="w-4 h-4" />
            <span>2. Lịch sử đã xử lý</span>
            {resolvedRecords.length > 0 && (
              <span
                className={`ml-0.5 rounded-full px-2 py-0.5 text-[10px] font-black ${
                  subTab === 'history' ? 'bg-white text-emerald-700' : 'bg-slate-200 text-slate-700'
                }`}
              >
                {resolvedRecords.length}
              </span>
            )}
          </button>
        </div>

        <div className="hidden sm:flex items-center gap-2 pr-4 text-xs text-slate-500 font-medium">
          {subTab === 'incident' ? (
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              Chất lượng nước có chỉ số bất thường · Chờ can thiệp 1 bước
            </span>
          ) : (
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              Hồ sơ các đợt đã can thiệp xử lý hóa chất & vi sinh
            </span>
          )}
        </div>
      </div>

      {/* ── HEADER CARD VỚI BỘ LỌC THÔNG MINH (Chuẩn Sức Khỏe Tôm) ──────────── */}
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
              <Wrench className="h-6 w-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                Chất Lượng Nước & Quá Trình Xử Lý
              </h2>
              <p className="text-xs font-medium text-slate-500 mt-0.5">
                {subTab === 'incident'
                  ? 'Giám sát và tiếp nhận các cảnh báo thông số bất thường phát hiện tại các ao nuôi'
                  : 'Hồ sơ các đợt xử lý chất lượng nước đã hoàn tất'}
              </p>
            </div>
          </div>

          <div className="flex w-full flex-wrap gap-2 lg:w-auto">
            <button
              onClick={fetchHistoryRecords}
              disabled={isLoading}
              className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-60 transition-all cursor-pointer shadow-2xs"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin text-indigo-600' : ''}`} />
              Làm mới
            </button>
          </div>
        </div>

        {/* ── TOOLBAR BỘ LỌC THÔNG MINH ── */}
        <div className="pt-3 border-t border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 flex-1 max-w-3xl">
            {/* 1. Tìm kiếm */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm tên ao, chỉ số (vd: NH3, DO)..."
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

            {/* 2. Lọc theo Trang trại */}
            <div className="relative">
              <Building2 className="w-4 h-4 text-indigo-600 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <select
                value={selectedFarmId}
                onChange={(e) => {
                  setSelectedFarmId(e.target.value);
                  setSelectedPondId('');
                  setCategoryPage(1);
                }}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-7 text-xs font-bold text-slate-700 outline-none focus:border-indigo-500 focus:bg-white appearance-none cursor-pointer"
              >
                <option value="">Tất cả trang trại</option>
                {farms.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
            </div>

            {/* 3. Lọc theo Ao nuôi */}
            <div className="relative">
              <Waves className="w-4 h-4 text-cyan-600 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <select
                value={selectedPondId}
                onChange={(e) => {
                  setSelectedPondId(e.target.value);
                  setCategoryPage(1);
                }}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-7 text-xs font-bold text-slate-700 outline-none focus:border-indigo-500 focus:bg-white appearance-none cursor-pointer"
              >
                <option value="">Tất cả ao nuôi</option>
                {filteredPonds.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
            </div>
          </div>

          {/* Nút đặt lại */}
          {(selectedFarmId || selectedPondId || searchQuery || hazardFilter !== 'ALL') && (
            <button
              onClick={() => {
                setSelectedFarmId('');
                setSelectedPondId('');
                setSearchQuery('');
                setHazardFilter('ALL');
                setCategoryPage(1);
              }}
              className="text-xs font-semibold text-rose-600 hover:text-rose-700 flex items-center gap-1 cursor-pointer self-end md:self-center"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Đặt lại bộ lọc
            </button>
          )}
        </div>
      </div>

      {/* ── CARD GRID DANH SÁCH (3 Cột Giống Sức Khỏe Tôm) ───────────────────── */}
      {isLoading ? (
        <LoadingMotion
          mode="card"
          title="Đang tải dữ liệu xử lý môi trường..."
          subtitle="Đồng bộ danh sách cảnh báo từ Lịch sử đo lường và Kho vật tư..."
          icon={<Waves className="w-10 h-10 text-indigo-600 animate-pulse" />}
          color="indigo"
        />
      ) : paginatedItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 bg-white rounded-3xl border border-slate-200 text-center shadow-xs">
          <div className="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400 mb-3">
            <CheckCircle2 className="w-8 h-8 text-emerald-500" />
          </div>
          <h4 className="text-base font-extrabold text-slate-800">
            {subTab === 'incident'
              ? 'Không có cảnh báo mới nào chờ xử lý!'
              : 'Chưa có hồ sơ xử lý nào trong lịch sử.'}
          </h4>
          <p className="text-xs text-slate-500 mt-1 max-w-md">
            {subTab === 'incident'
              ? 'Tất cả các ao nuôi đều đang có chỉ số môi trường an toàn đạt chuẩn kỹ thuật.'
              : 'Chưa có ca can thiệp xử lý nào được lưu trong lịch sử.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4.5">
            {paginatedItems.map((item) => {
              const isDanger = item.hazardLevel === 'DANGER';
              const isUntreated = item.status === 'UNTREATED';

              return (
                <div
                  key={item.id}
                  className="group relative flex flex-col justify-between rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xs transition-all duration-200 hover:-translate-y-1 hover:shadow-md hover:border-indigo-300 overflow-hidden"
                >
                  {/* Top ribbon */}
                  <div
                    className={`absolute top-0 left-0 right-0 h-1.5 ${
                      !isUntreated
                        ? 'bg-emerald-500'
                        : isDanger
                          ? 'bg-rose-500'
                          : 'bg-amber-400'
                    }`}
                  />

                  <div className="space-y-3 pt-1">
                    {/* Header: Pond tag + Status pill */}
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-cyan-50 text-cyan-800 border border-cyan-200 text-[11px] font-bold">
                        <Waves className="w-3 h-3 text-cyan-600" />
                        <span>{item.pondName}</span>
                      </span>

                      <span
                        className={`rounded-full border px-2.5 py-0.5 text-[10px] font-black ${
                          !isUntreated
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                            : isDanger
                              ? 'border-rose-200 bg-rose-50 text-rose-700'
                              : 'border-amber-200 bg-amber-50 text-amber-700'
                        }`}
                      >
                        {!isUntreated
                          ? '✓ Đã hoàn tất'
                          : isDanger
                            ? '🔴 Mức Nguy hiểm'
                            : '🟡 Mức Cảnh báo'}
                      </span>
                    </div>

                    {/* Title */}
                    <h4 className="text-base font-extrabold text-slate-900 group-hover:text-indigo-600 transition-colors line-clamp-1">
                      {item.pondName} — {item.farmName}
                    </h4>
                    {item.source === 'INCIDENT' && (
                      <span className="inline-flex w-fit items-center gap-1 px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200 text-[10.5px] font-bold">
                        📣 Sự cố báo cáo
                      </span>
                    )}

                    {/* Summary problem alert */}
                    <div
                      className={`p-3 rounded-2xl border text-xs font-semibold leading-relaxed ${
                        isDanger
                          ? 'bg-rose-50/70 border-rose-200 text-rose-950'
                          : 'bg-amber-50/70 border-amber-200 text-amber-950'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-[10px] mb-1">
                        <AlertTriangle className={`w-3.5 h-3.5 ${isDanger ? 'text-rose-600' : 'text-amber-600'}`} />
                        <span>Chỉ số cảnh báo:</span>
                      </div>
                      <p className="line-clamp-2">{item.summaryText}</p>
                    </div>

                    {/* Parameter indicators chips */}
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {item.triggeredParams.slice(0, 3).map((pKey) => {
                        let label = pKey;
                        const val = (item.parameters as any)[pKey] || '';
                        let unit = '';
                        if (pKey === 'nh3') {
                          label = 'NH3';
                          unit = 'mg/L';
                        } else if (pKey === 'dissolvedOxygen') {
                          label = 'DO';
                          unit = 'mg/L';
                        } else if (pKey === 'ph') {
                          label = 'pH';
                        } else if (pKey === 'alkalinity') {
                          label = 'Độ kiềm';
                          unit = 'mg/L';
                        }

                        return (
                          <span
                            key={pKey}
                            className="px-2 py-0.5 rounded-lg bg-rose-50 text-rose-800 font-extrabold text-[10px] border border-rose-200"
                          >
                            ⚠️ {label}: {val} {unit}
                          </span>
                        );
                      })}
                    </div>
                  </div>

                  {/* Card Footer Actions */}
                  <div className="mt-4 pt-3 border-t border-slate-100 space-y-2.5">
                    <div className="flex items-center justify-between text-[11px] text-slate-500 font-medium">
                      <span>{item.source === 'INCIDENT' ? 'Báo cáo lúc' : 'Đo lúc'}: <strong>{item.time} ({item.date})</strong></span>
                      {item.treatment && (
                        <span className="text-emerald-700 font-bold flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Đã xử lý
                        </span>
                      )}
                    </div>

                    <div className="pt-1">
                      {isUntreated ? (
                        <button
                          type="button"
                          onClick={() => handleOpenDetail(item)}
                          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white font-bold text-xs transition-all shadow-sm shadow-indigo-600/20 cursor-pointer"
                        >
                          <Wrench className="w-3.5 h-3.5" />
                          <span>Xử lý & Xuất kho (Gợi ý AI)</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleOpenDetail(item)}
                          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs transition-all shadow-2xs cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5 text-slate-500" />
                          <span>Xem chi tiết can thiệp</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

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
      )}
    </div>
  );
}
