import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Wrench,
  ChevronLeft,
  ChevronRight,
  Filter,
  RotateCcw,
  RefreshCw,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Clock,
  Droplets,
  Search,
  Package,
  X,
  FileText,
  Thermometer,
  FlaskConical,
  Waves,
  Check,
  ChevronDown,
  Sparkles,
  UserCheck,
  Building2,
  ArrowUpRight,
  ShieldAlert,
} from 'lucide-react';
import { pondService } from '../../services/pond.service';
import { waterQualityService } from '../../services/water-quality.service';
import { inventoryService } from '../../services/inventory.service';
import LoadingMotion from '../../components/LoadingMotion';

// ─── Types & Data Interfaces ───────────────────────────────────────────────────

export interface Farm {
  id: string;
  name: string;
}

export interface Pond {
  id: string;
  name: string;
  farmId: string;
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
  rawRecordTime?: string;
}

interface WaterTreatmentProps {
  initialFarmId?: string;
  initialPondId?: string;
}

// ─── Parser Helper for Real History Records ────────────────────────────────────

function parseRecordFromHistory(r: any, treatmentsMap: Record<string, TreatmentAction>): WaterWarningRecord {
  const d = new Date(r.recordTime || r.createdAt || Date.now());
  const dateStr = isNaN(d.getTime())
    ? '-'
    : d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const timeStr = isNaN(d.getTime())
    ? '-'
    : d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false });

  // Detect out-of-range parameters
  const triggered: string[] = [];
  const summaries: string[] = [];

  const temp = Number(r.temperature) || 0;
  const ph = Number(r.ph) || 0;
  const doVal = Number(r.dissolvedOxygen) || 0;
  const sal = Number(r.salinity) || 0;
  const alk = Number(r.alkalinity) || 0;
  const nh3 = Number(r.nh3) || 0;
  const h2s = Number(r.h2s) || 0;

  if (nh3 > 0.30) {
    triggered.push('nh3');
    summaries.push(`NH3 cao: ${nh3} mg/L`);
  }
  if (doVal > 0 && doVal < 4.0) {
    triggered.push('dissolvedOxygen');
    summaries.push(`DO thấp: ${doVal} mg/L`);
  }
  if (ph > 0 && (ph < 7.5 || ph > 8.5)) {
    triggered.push('ph');
    summaries.push(`pH dao động: ${ph}`);
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

  const isDanger =
    r.overallStatus === 'Danger' ||
    nh3 > 0.50 ||
    doVal < 3.0 ||
    h2s > 0.05 ||
    ph < 7.0 ||
    ph > 9.0;

  const hazardLevel: 'DANGER' | 'WARNING' = isDanger ? 'DANGER' : 'WARNING';
  const summaryText = summaries.length > 0 ? summaries.join(' • ') : 'Cần theo dõi môi trường ao';

  const savedTreatment = treatmentsMap[r.id];

  return {
    id: r.id || `WQ-${Date.now()}`,
    date: dateStr,
    time: timeStr,
    rawRecordTime: r.recordTime,
    farmName: r.farmName || 'Trang trại',
    pondId: r.pondId || r.pondName || 'pond-1',
    pondName: r.pondName || 'Ao nuôi',
    hazardLevel,
    summaryText,
    status: savedTreatment ? 'TREATED' : 'UNTREATED',
    triggeredParams: triggered.length > 0 ? triggered : ['nh3'],
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
    treatment: savedTreatment || undefined,
  };
}

// ─── Toast Component ──────────────────────────────────────────────────────────

interface ToastMessage {
  id: string;
  title: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

function ToastContainer({ toasts, onClose }: { toasts: ToastMessage[]; onClose: (id: string) => void }) {
  return (
    <div className="fixed top-20 right-6 z-[200] flex flex-col gap-2.5 max-w-md w-full pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto flex items-start gap-3 p-4 rounded-2xl shadow-2xl border text-xs sm:text-sm animate-in slide-in-from-right-8 duration-300 backdrop-blur-xl ${t.type === 'success'
            ? 'bg-emerald-50/95 border-emerald-200 text-emerald-900'
            : t.type === 'error'
              ? 'bg-red-50/95 border-red-200 text-red-900'
              : 'bg-indigo-50/95 border-indigo-200 text-indigo-900'
            }`}
        >
          {t.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />}
          {t.type === 'error' && <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />}
          {t.type === 'info' && <Sparkles className="w-5 h-5 text-indigo-600 flex-shrink-0 mt-0.5" />}
          <div className="flex-1 min-w-0">
            <h4 className="font-bold text-xs uppercase tracking-wider">{t.title}</h4>
            <p className="mt-0.5 font-medium text-xs opacity-90">{t.message}</p>
          </div>
          <button
            onClick={() => onClose(t.id)}
            className="p-1 hover:bg-black/5 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-4 h-4 text-slate-400" />
          </button>
        </div>
      ))}
    </div>
  );
}

// ─── Main Water Treatment Component ──────────────────────────────────────────

export default function WaterTreatment({ initialFarmId, initialPondId }: WaterTreatmentProps = {}) {
  // ── User Role & Theme Sync ──────────────────────────────────────────────────
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

  const isFarmer = currentUser?.role === 'FARMER';
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

  // ── Farms & Ponds State ─────────────────────────────────────────────────────
  const [farms, setFarms] = useState<Farm[]>([]);
  const [ponds, setPonds] = useState<Pond[]>([]);
  const [selectedFarmId, setSelectedFarmId] = useState(initialFarmId || '');
  const [selectedPondId, setSelectedPondId] = useState(initialPondId || '');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [hazardFilter, setHazardFilter] = useState<'ALL' | 'DANGER' | 'WARNING'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // ── Data & Pagination State ─────────────────────────────────────────────────
  const [records, setRecords] = useState<WaterWarningRecord[]>([]);
  const [page, setPage] = useState(0);
  const [size] = useState(10);
  const [totalElements, setTotalElements] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [inventory, setInventory] = useState<ChemicalItem[]>([]);
  const [loadingInventory, setLoadingInventory] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Modal / Detail state
  const [selectedRecord, setSelectedRecord] = useState<WaterWarningRecord | null>(null);
  const [selectedChemId, setSelectedChemId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [treatmentNote, setTreatmentNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filtered ponds based on selected farm
  const filteredPonds = useMemo(() => {
    return selectedFarmId ? ponds.filter((p) => p.farmId === selectedFarmId) : ponds;
  }, [ponds, selectedFarmId]);

  // Load Farm & Pond overview options
  useEffect(() => {
    (async () => {
      try {
        const { farms: farmsData, ponds: pondsData } = await pondService.getOverview();
        setFarms(farmsData || []);
        setPonds(pondsData || []);

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
        console.warn('Could not fetch farm/pond list');
      }
    })();
  }, [initialFarmId, initialPondId]);

  // ── Fetch Water Quality History Records (Paginated) ─────────────────────────
  const fetchHistoryRecords = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await waterQualityService.getHistory({
        farmId: selectedFarmId || undefined,
        pondId: selectedPondId || undefined,
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
        page,
        size,
        sort: 'desc',
      });

      const rawList = res?.content || [];
      setTotalElements(res?.totalElements || 0);

      // Load saved treatment actions map from localStorage
      const savedMapStr = localStorage.getItem('water_treatments_map');
      const treatmentsMap: Record<string, TreatmentAction> = savedMapStr ? JSON.parse(savedMapStr) : {};

      // Filter and parse history records
      const parsedRecords = rawList
        .filter((r: any) => {
          if (r.overallStatus === 'Warning' || r.overallStatus === 'Danger') return true;
          const nh3 = Number(r.nh3) || 0;
          const doVal = Number(r.dissolvedOxygen) || 0;
          const ph = Number(r.ph) || 0;
          const alk = Number(r.alkalinity) || 0;
          const temp = Number(r.temperature) || 0;
          const h2s = Number(r.h2s) || 0;

          return (
            nh3 > 0.30 ||
            (doVal > 0 && doVal < 4.0) ||
            (ph > 0 && (ph < 7.5 || ph > 8.5)) ||
            (alk > 0 && (alk < 100 || alk > 160)) ||
            (temp > 0 && (temp < 25 || temp > 30)) ||
            h2s > 0.03
          );
        })
        .map((r: any) => parseRecordFromHistory(r, treatmentsMap));

      if (parsedRecords.length > 0) {
        setRecords(parsedRecords);
      } else if (rawList.length > 0) {
        setRecords(rawList.map((r: any) => parseRecordFromHistory(r, treatmentsMap)));
      } else {
        setRecords([]);
      }
    } catch (err) {
      console.warn('Error loading water quality history:', err);
      setRecords([]);
    } finally {
      setIsLoading(false);
    }
  }, [selectedFarmId, selectedPondId, fromDate, toDate, page, size]);

  // ── Fetch Inventory Items (Medications & Chemicals) ─────────────────────────
  const fetchInventoryFromStore = useCallback(async () => {
    setLoadingInventory(true);
    try {
      const res = await inventoryService.getAll('', 'ALL', selectedFarmId || undefined);
      const items = res?.data || res || [];
      if (Array.isArray(items) && items.length > 0) {
        const medChemItems = items
          .filter(
            (item: any) =>
              item.category === 'MEDICINE' || item.category === 'CHEMICAL' || item.category !== 'FEED'
          )
          .map((item: any) => ({
            id: item.id,
            name: item.itemName,
            stock: Number(item.quantity) || 0,
            unit: item.unit || 'kg',
            category:
              item.category === 'MEDICINE'
                ? 'Thuốc thủy sản'
                : item.category === 'CHEMICAL'
                  ? 'Hóa chất xử lý'
                  : 'Kho vật tư',
          }));

        setInventory(medChemItems);
      }
    } catch (err) {
      console.warn('Could not fetch inventory items from API', err);
    } finally {
      setLoadingInventory(false);
    }
  }, [selectedFarmId]);

  useEffect(() => {
    fetchHistoryRecords();
    fetchInventoryFromStore();
  }, [fetchHistoryRecords, fetchInventoryFromStore]);

  // Handle reset search & location filters
  const handleResetFilters = () => {
    setSelectedFarmId('');
    setSelectedPondId('');
    setFromDate('');
    setToDate('');
    setHazardFilter('ALL');
    setSearchQuery('');
    setPage(0);
  };

  // Toast Helper
  const addToast = (title: string, message: string, type: 'success' | 'error' | 'info' = 'success') => {
    const id = Date.now().toString();
    setToasts((prev) => [...prev, { id, title, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Derived statistics
  const stats = useMemo(() => {
    const total = records.length;
    const untreated = records.filter((r) => r.status === 'UNTREATED').length;
    const danger = records.filter((r) => r.hazardLevel === 'DANGER' && r.status === 'UNTREATED').length;
    const treated = records.filter((r) => r.status === 'TREATED').length;
    return { total, untreated, danger, treated };
  }, [records]);

  // Filtered records based on search and hazard level
  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      const matchSearch =
        r.pondName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.summaryText.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.id.toLowerCase().includes(searchQuery.toLowerCase());

      const matchHazard = hazardFilter === 'ALL' || r.hazardLevel === hazardFilter;

      return matchSearch && matchHazard;
    });
  }, [records, searchQuery, hazardFilter]);

  // Split filtered records into 2 vertical card columns
  const untreatedList = useMemo(() => {
    return filteredRecords.filter((r) => r.status === 'UNTREATED');
  }, [filteredRecords]);

  const treatedList = useMemo(() => {
    return filteredRecords.filter((r) => r.status === 'TREATED');
  }, [filteredRecords]);

  const totalPages = Math.ceil(totalElements / size);

  // Selected chemical info for unit display
  const currentSelectedChem = useMemo(() => {
    return inventory.find((c) => c.id === selectedChemId);
  }, [inventory, selectedChemId]);

  // Open detail modal handler
  const handleOpenDetail = (record: WaterWarningRecord) => {
    setSelectedRecord(record);
    if (record.treatment) {
      setSelectedChemId(record.treatment.chemicalId);
      setQuantity(record.treatment.quantity.toString());
      setTreatmentNote(record.treatment.note);
    } else {
      setSelectedChemId('');
      setQuantity('');
      setTreatmentNote('');
    }
  };

  // Submit Treatment Form
  const handleSubmitTreatment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRecord) return;

    if (!selectedChemId) {
      addToast('Lỗi nhập liệu', 'Vui lòng chọn loại Thuốc / Hóa chất từ danh mục kho', 'error');
      return;
    }

    const qty = parseFloat(quantity);
    if (isNaN(qty) || qty <= 0) {
      addToast('Lỗi nhập liệu', 'Vui lòng nhập số lượng sử dụng hợp lệ (> 0)', 'error');
      return;
    }

    if (currentSelectedChem && qty > currentSelectedChem.stock) {
      addToast(
        'Tồn kho không đủ',
        `Số lượng cần dùng (${qty} ${currentSelectedChem.unit}) vượt quá lượng tồn trong kho (${currentSelectedChem.stock} ${currentSelectedChem.unit})`,
        'error'
      );
      return;
    }

    setIsSubmitting(true);

    try {
      // 1. Record chemical usage in backend inventory store
      await inventoryService.recordUsage(selectedChemId, {
        quantityUsed: qty,
        usageDate: new Date().toISOString(),
        notes: `[Xử lý sự cố môi trường - ${selectedRecord.pondName}] ${treatmentNote.trim()}`,
        pondId: selectedRecord.pondId,
      });

      const now = new Date();
      const timeStr = `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1)
        .toString()
        .padStart(2, '0')}/${now.getFullYear()} ${now.getHours().toString().padStart(2, '0')}:${now
          .getMinutes()
          .toString()
          .padStart(2, '0')}`;

      const updatedTreatment: TreatmentAction = {
        chemicalId: selectedChemId,
        chemicalName: currentSelectedChem?.name || 'Hóa chất xử lý',
        quantity: qty,
        unit: currentSelectedChem?.unit || 'đơn vị',
        note: treatmentNote.trim() || 'Xử lý sự cố chất lượng nước theo định lượng.',
        technicianName: currentUser?.fullName || 'KTV. Nguyễn Văn Quản Lý',
        timestamp: timeStr,
      };

      // 2. Persist treatment action to localStorage map
      const savedMapStr = localStorage.getItem('water_treatments_map');
      const treatmentsMap: Record<string, TreatmentAction> = savedMapStr ? JSON.parse(savedMapStr) : {};
      treatmentsMap[selectedRecord.id] = updatedTreatment;
      localStorage.setItem('water_treatments_map', JSON.stringify(treatmentsMap));

      // 3. Update records state locally
      setRecords((prev) =>
        prev.map((r) =>
          r.id === selectedRecord.id
            ? {
              ...r,
              status: 'TREATED',
              treatment: updatedTreatment,
            }
            : r
        )
      );

      // 4. Update local inventory stock view
      setInventory((prev) =>
        prev.map((item) =>
          item.id === selectedChemId ? { ...item, stock: Math.max(0, item.stock - qty) } : item
        )
      );

      // 5. Update modal view state
      setSelectedRecord((prev) =>
        prev
          ? {
            ...prev,
            status: 'TREATED',
            treatment: updatedTreatment,
          }
          : null
      );

      // 6. Refresh backend inventory store
      await fetchInventoryFromStore();

      addToast(
        'Xử lý & Xuất kho thành công',
        `Đã chuyển sự cố sang danh mục "Đã xử lý". Hệ thống đã tự động xuất kho ${qty} ${currentSelectedChem?.unit} ${currentSelectedChem?.name}.`,
        'success'
      );
    } catch (err: any) {
      addToast('Lỗi xử lý', err.message || 'Không thể thực hiện xuất kho', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Helper render for single record card
  const renderRecordCard = (item: WaterWarningRecord) => {
    const isDanger = item.hazardLevel === 'DANGER';
    const isUntreated = item.status === 'UNTREATED';

    return (
      <div
        key={item.id}
        onClick={() => handleOpenDetail(item)}
        className={`group bg-white rounded-3xl border transition-all duration-300 shadow-xs hover:shadow-xl hover:-translate-y-0.5 p-5 cursor-pointer relative overflow-hidden flex flex-col justify-between gap-3.5 ${isUntreated
          ? isDanger
            ? 'border-red-200/80 hover:border-red-300 hover:shadow-red-500/10'
            : 'border-amber-200/80 hover:border-amber-300 hover:shadow-amber-500/10'
          : 'border-emerald-200/80 hover:border-emerald-300 hover:shadow-emerald-500/10'
          }`}
      >
        {/* Top status indicator ribbon */}
        <div
          className={`absolute top-0 left-0 right-0 h-1.5 ${isUntreated ? (isDanger ? 'bg-red-500' : 'bg-amber-400') : 'bg-emerald-500'
            }`}
        />

        {/* Card Header: Date/Time + Hazard Badge */}
        <div className="flex items-center justify-between gap-2 pt-1">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-400">
            <Clock className="w-3.5 h-3.5 text-indigo-500" />
            <span>
              {item.time} • {item.date}
            </span>
          </div>

          {/* Hazard Level Badge */}
          <div className="flex items-center gap-2">
            {isDanger ? (
              <span className="px-2.5 py-0.5 text-[11px] font-black rounded-full bg-red-50 text-red-700 border border-red-200/80 flex items-center gap-1 shadow-xs">
                <AlertTriangle className="w-3 h-3 text-red-600 animate-pulse" />
                Nguy hiểm
              </span>
            ) : (
              <span className="px-2.5 py-0.5 text-[11px] font-extrabold rounded-full bg-amber-50 text-amber-800 border border-amber-200/80 flex items-center gap-1 shadow-xs">
                <AlertCircle className="w-3 h-3 text-amber-600" />
                Cảnh báo
              </span>
            )}

            {/* Process Status Badge */}
            {isUntreated ? (
              <span className="px-2.5 py-0.5 text-[11px] font-black rounded-full bg-red-600 text-white shadow-xs flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                Chưa xử lý
              </span>
            ) : (
              <span className="px-2.5 py-0.5 text-[11px] font-black rounded-full bg-emerald-50 text-emerald-700 border border-emerald-300 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                Đã xử lý
              </span>
            )}
          </div>
        </div>

        {/* Pond Name & Location */}
        <div>
          <h3 className="text-base sm:text-lg font-black text-slate-900 group-hover:text-indigo-600 transition-colors flex items-center justify-between">
            <span>{item.pondName}</span>
            <ArrowUpRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-600 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
          </h3>
          <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider mt-0.5 flex items-center gap-1">
            <Building2 className="w-3 h-3 text-slate-400" /> {item.farmName}
          </p>
        </div>

        {/* Problem Summary Box */}
        <div
          className={`p-3 rounded-2xl border text-xs font-bold flex items-start gap-2.5 ${isUntreated
            ? isDanger
              ? 'bg-red-50/70 border-red-200 text-red-950'
              : 'bg-amber-50/70 border-amber-200 text-amber-950'
            : 'bg-emerald-50/60 border-emerald-200/80 text-emerald-950'
            }`}
        >
          <Droplets className={`w-4 h-4 flex-shrink-0 mt-0.5 ${isDanger ? 'text-red-600' : 'text-amber-600'}`} />
          <div className="flex-1">
            <span className="text-[9px] font-extrabold uppercase tracking-wider opacity-70 block">
              Chỉ số ghi nhận
            </span>
            <span className="text-xs">{item.summaryText}</span>
          </div>
        </div>

        {/* Key Triggered Parameter Badges preview */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          {item.triggeredParams.map((pKey) => {
            const val = item.parameters[pKey as keyof typeof item.parameters];
            let label = pKey.toUpperCase();
            let unit = '';
            if (pKey === 'nh3') {
              label = 'NH3';
              unit = 'mg/L';
            }
            if (pKey === 'dissolvedOxygen') {
              label = 'DO';
              unit = 'mg/L';
            }
            if (pKey === 'ph') label = 'pH';
            if (pKey === 'alkalinity') {
              label = 'Độ kiềm';
              unit = 'mg/L';
            }
            if (pKey === 'temperature') {
              label = 'Nhiệt độ';
              unit = '°C';
            }

            return (
              <span
                key={pKey}
                className="px-2 py-0.5 rounded-lg bg-red-100/80 text-red-800 font-extrabold text-[10px] border border-red-200"
              >
                ⚠️ {label}: {val} {unit}
              </span>
            );
          })}
        </div>

        {/* Card Footer Action */}
        <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs font-bold">
          {item.treatment ? (
            <div className="text-emerald-700 flex items-center gap-1 text-[11px] truncate max-w-[70%]">
              <UserCheck className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="truncate">
                Đã xuất: <strong>{item.treatment.chemicalName}</strong> ({item.treatment.quantity} {item.treatment.unit})
              </span>
            </div>
          ) : (
            <span className="text-slate-400 text-[11px]">Chưa ghi nhận phương án</span>
          )}

          <button
            onClick={(e) => {
              e.stopPropagation();
              handleOpenDetail(item);
            }}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-xs ${isUntreated
              ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-500/20'
              : 'bg-emerald-100 hover:bg-emerald-200 text-emerald-800'
              }`}
          >
            <Wrench className="w-3.5 h-3.5" />
            {isUntreated ? 'Xử lý ngay' : 'Xem chi tiết'}
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 pb-12 font-sans antialiased text-slate-800">
      {/* Toast notifications */}
      <ToastContainer toasts={toasts} onClose={removeToast} />

      {/* ── 1. PAGE HEADER BANNER (SYNCHRONIZED WITH OTHER ENVIRONMENT PAGES) ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/80 backdrop-blur-xl p-6 rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100">
        <div className="flex items-center gap-4">
          <div
            className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${themeGradientHeader} flex items-center justify-center text-white shadow-lg ${themeShadowHeader}`}
          >
            <Wrench className="w-6 h-6" />
          </div>
          <div>
            <h2
              className={`text-xl font-bold bg-gradient-to-r ${themeTextGradientHeader} bg-clip-text text-transparent`}
            >
              Xử Lý Môi Trường Nước
            </h2>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Đồng bộ dữ liệu Lịch sử đo lường, phân chia 2 cột Chưa xử lý & Đã xử lý và kết nối Kho vật tư
            </p>
          </div>
        </div>

        <button
          onClick={() => {
            fetchHistoryRecords();
            fetchInventoryFromStore();
          }}
          disabled={isLoading || loadingInventory}
          className="flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition-all cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 text-slate-500 ${isLoading ? 'animate-spin' : ''}`} />
          Làm mới dữ liệu
        </button>
      </div>

      {/* ── 2. FILTER SEARCH BAR (SYNCHRONIZED WITH WATERQUALITYHISTORY) ─────── */}
      <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-500" /> Bộ Lọc Tìm Kiếm
          </span>
          {(selectedFarmId || selectedPondId || fromDate || toDate || hazardFilter !== 'ALL' || searchQuery) && (
            <button
              onClick={handleResetFilters}
              className="text-xs font-semibold text-rose-600 hover:text-rose-700 flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Đặt lại bộ lọc
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
          {/* Trang trại Filter */}
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">Trang trại</label>
            <select
              value={selectedFarmId}
              onChange={(e) => {
                setSelectedFarmId(e.target.value);
                setSelectedPondId('');
                setPage(0);
              }}
              className={`w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 text-slate-800 outline-none ${themeFocusRing}`}
            >
              <option value="">Tất cả trang trại</option>
              {farms.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>

          {/* Ao nuôi Filter */}
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">Ao nuôi</label>
            <select
              value={selectedPondId}
              onChange={(e) => {
                setSelectedPondId(e.target.value);
                setPage(0);
              }}
              className={`w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 text-slate-800 outline-none ${themeFocusRing}`}
            >
              <option value="">Tất cả ao</option>
              {filteredPonds.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Từ ngày Filter */}
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">Từ ngày</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => {
                setFromDate(e.target.value);
                setPage(0);
              }}
              className={`w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 text-slate-800 outline-none ${themeFocusRing}`}
            />
          </div>

          {/* Đến ngày Filter */}
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">Đến ngày</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => {
                setToDate(e.target.value);
                setPage(0);
              }}
              className={`w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 text-slate-800 outline-none ${themeFocusRing}`}
            />
          </div>

          {/* Mức độ Nguy hiểm Filter */}
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">Mức độ nguy hiểm</label>
            <select
              value={hazardFilter}
              onChange={(e) => {
                setHazardFilter(e.target.value as any);
                setPage(0);
              }}
              className={`w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 text-slate-800 outline-none ${themeFocusRing}`}
            >
              <option value="ALL">Tất cả mức độ</option>
              <option value="DANGER">🔴 Nguy hiểm (Gấp)</option>
              <option value="WARNING">🟡 Cảnh báo</option>
            </select>
          </div>
        </div>

        {/* Quick Search Row */}
        <div className="pt-2">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm theo tên ao, chỉ số (vd: NH3, DO), mã bản ghi..."
              className={`w-full pl-10 pr-4 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 text-slate-800 outline-none ${themeFocusRing}`}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── 3. METRIC CARDS OVERVIEW ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="bg-white p-4.5 rounded-3xl border border-slate-100 shadow-xs hover:shadow-md transition-shadow flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Lịch sử đo có sự cố</p>
            <h3 className="text-xl sm:text-2xl font-black text-slate-900 mt-0.5">{stats.total}</h3>
          </div>
          <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <ShieldAlert className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4.5 rounded-3xl border border-slate-100 shadow-xs hover:shadow-md transition-shadow flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Chưa xử lý </p>
            <h3 className="text-xl sm:text-2xl font-black text-red-600 mt-0.5">{stats.untreated}</h3>
            <p className="text-[10px] text-red-500 font-bold mt-0.5 flex items-center gap-1">

            </p>
          </div>
          <div className="w-10 h-10 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center">
            <AlertCircle className="w-5 h-5 animate-pulse" />
          </div>
        </div>

        <div className="bg-white p-4.5 rounded-3xl border border-slate-100 shadow-xs hover:shadow-md transition-shadow flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Đã hoàn thành </p>
            <h3 className="text-xl sm:text-2xl font-black text-emerald-600 mt-0.5">{stats.treated}</h3>
          </div>
          <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4.5 rounded-3xl border border-slate-100 shadow-xs hover:shadow-md transition-shadow flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Kho Thuốc & Hóa chất</p>
            <h3 className="text-xl sm:text-2xl font-black text-indigo-600 mt-0.5">{inventory.length} sản phẩm</h3>
            <p className="text-[10px] text-emerald-600 font-bold mt-0.5 flex items-center gap-1">
            </p>
          </div>
          <div className="w-10 h-10 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center">
            <Package className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* ── 4. TWO VERTICAL COLUMNS LAYOUT & LOADING MOTION ─────────────────── */}
      {isLoading ? (
        <LoadingMotion
          mode="card"
          title="Đang tải dữ liệu xử lý môi trường..."
          subtitle="Đồng bộ danh sách cảnh báo từ Lịch sử đo lường và Kho vật tư..."
          icon={<Waves className="w-10 h-10 text-indigo-600 animate-pulse" />}
          color="indigo"
        />
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            {/* ════════════════════════════════════════════════════════════════════
                CỘT 1 (THẺ DỌC 1): SỰ CỐ CHƯA XỬ LÝ
               ════════════════════════════════════════════════════════════════════ */}
            <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5 flex flex-col gap-4">
              <div className="flex items-center justify-between pb-3.5 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-red-600 text-white flex items-center justify-center font-bold shadow-xs">
                    <AlertTriangle className="w-4.5 h-4.5 animate-pulse" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                      Sự Cố Chưa Xử Lý
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-red-600 text-white">
                        {untreatedList.length}
                      </span>
                    </h3>
                    <p className="text-[11px] text-slate-400 font-medium">
                      Các đợt đo cần kỹ thuật viên can thiệp & xuất kho gấp
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                {untreatedList.length === 0 ? (
                  <div className="bg-slate-50/70 p-8 rounded-2xl border border-dashed border-slate-200 text-center space-y-2">
                    <CheckCircle2 className="w-9 h-9 text-emerald-500 mx-auto" />
                    <h4 className="text-xs font-bold text-slate-800">Không có sự cố nào chưa xử lý!</h4>
                    <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
                      Tất cả các cảnh báo chỉ số đo lường trong hệ thống đều đã được xử lý xong.
                    </p>
                  </div>
                ) : (
                  untreatedList.map((item) => renderRecordCard(item))
                )}
              </div>
            </div>

            {/* ════════════════════════════════════════════════════════════════════
                CỘT 2 (THẺ DỌC 2): SỰ CỐ ĐÃ XỬ LÝ
               ════════════════════════════════════════════════════════════════════ */}
            <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5 flex flex-col gap-4">
              <div className="flex items-center justify-between pb-3.5 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold shadow-xs">
                    <CheckCircle2 className="w-4.5 h-4.5" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                      Sự Cố Đã Xử Lý
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-emerald-600 text-white">
                        {treatedList.length}
                      </span>
                    </h3>
                    <p className="text-[11px] text-slate-400 font-medium">
                      Nhật ký các đợt đo đã áp dụng phác đồ & xuất kho vật tư
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                {treatedList.length === 0 ? (
                  <div className="bg-slate-50/70 p-8 rounded-2xl border border-dashed border-slate-200 text-center space-y-2">
                    <FileText className="w-9 h-9 text-slate-300 mx-auto" />
                    <h4 className="text-xs font-bold text-slate-700">Chưa có bản ghi xử lý nào</h4>
                    <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
                      Chọn nút "Xử lý ngay" ở Cột Chưa xử lý để ghi nhận phác đồ.
                    </p>
                  </div>
                ) : (
                  treatedList.map((item) => renderRecordCard(item))
                )}
              </div>
            </div>
          </div>

          {/* ── 5. PAGINATION BAR (SYNCHRONIZED WITH WATERQUALITYHISTORY) ──────── */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between bg-white px-6 py-4 rounded-2xl border border-slate-100 shadow-sm text-xs">
              <span className="text-slate-500 font-medium">
                Hiển thị bản ghi từ <span className="font-bold text-slate-700">{page * size + 1}</span> đến{' '}
                <span className="font-bold text-slate-700">{Math.min((page + 1) * size, totalElements)}</span>{' '}
                trong tổng số <span className="font-bold text-slate-700">{totalElements}</span> bản ghi
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-all"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-sm font-bold text-slate-700">
                  {page + 1} / {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={page === totalPages - 1}
                  className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-all"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── 6. DETAIL INTERACTION MODAL (RESPONSIVE & PERFECTLY CENTERED) ──── */}
      {selectedRecord && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-5 bg-slate-950/70 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-2xl lg:max-w-3xl max-h-[86vh] mx-auto my-auto shadow-2xl flex flex-col overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-200 relative">

            {/* Solid Modal Header */}
            <div className="pt-5 sm:pt-6 pb-4 px-5 sm:px-7 border-b border-slate-100 bg-white flex items-start justify-between flex-shrink-0 z-20">
              <div className="space-y-1.5 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  {selectedRecord.hazardLevel === 'DANGER' ? (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-red-100 text-red-700 border border-red-200">
                      🔴 Mức Nguy hiểm
                    </span>
                  ) : (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-amber-100 text-amber-800 border border-amber-200">
                      🟡 Mức Cảnh báo
                    </span>
                  )}
                  {selectedRecord.status === 'TREATED' ? (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
                      ✓ Đã xử lý
                    </span>
                  ) : (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-red-600 text-white">
                      Chưa xử lý
                    </span>
                  )}
                </div>

                <h3 className="text-lg sm:text-xl font-black text-slate-900 flex items-center gap-2 pt-0.5">
                  <Droplets className="w-5 h-5 text-indigo-600 flex-shrink-0" />
                  {selectedRecord.pondName}
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  {selectedRecord.farmName} • Đo lúc: <strong>{selectedRecord.time} - {selectedRecord.date}</strong>
                </p>
              </div>

              <button
                onClick={() => setSelectedRecord(null)}
                className="p-2 -mr-1 -mt-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors cursor-pointer flex-shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body - Scrollable Content */}
            <div className="p-4 sm:p-5 flex-1 overflow-y-auto space-y-4">
              {/* Summary Problem Alert */}
              <div
                className={`p-3 rounded-2xl border flex items-start gap-2.5 ${selectedRecord.hazardLevel === 'DANGER'
                  ? 'bg-red-50 border-red-200 text-red-950'
                  : 'bg-amber-50 border-amber-200 text-amber-950'
                  }`}
              >
                <AlertTriangle
                  className={`w-4 h-4 flex-shrink-0 mt-0.5 ${selectedRecord.hazardLevel === 'DANGER' ? 'text-red-600' : 'text-amber-600'
                    }`}
                />
                <div>
                  <h4 className="font-extrabold text-[11px] uppercase tracking-wider">Cảnh báo thông số bất thường</h4>
                  <p className="text-xs sm:text-sm font-bold mt-0.5">{selectedRecord.summaryText}</p>
                </div>
              </div>

              {/* ── Parameters Grid (6 Compact Water Quality Indicators) ── */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-[11px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-1">
                    <FlaskConical className="w-3.5 h-3.5 text-indigo-600" />
                    Tất cả chỉ số đo lường thực tế
                  </h4>
                  <span className="text-[10px] text-slate-400 font-medium">
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {[
                    {
                      key: 'temperature',
                      label: 'Nhiệt độ',
                      val: selectedRecord.parameters.temperature,
                      unit: '°C',
                      icon: <Thermometer className="w-3.5 h-3.5" />,
                      ideal: '25 - 30°C',
                    },
                    {
                      key: 'ph',
                      label: 'Độ pH',
                      val: selectedRecord.parameters.ph,
                      unit: '',
                      icon: <FlaskConical className="w-3.5 h-3.5" />,
                      ideal: '7.5 - 8.5',
                    },
                    {
                      key: 'dissolvedOxygen',
                      label: 'Oxy hòa tan (DO)',
                      val: selectedRecord.parameters.dissolvedOxygen,
                      unit: 'mg/L',
                      icon: <Waves className="w-3.5 h-3.5" />,
                      ideal: '> 4.0 mg/L',
                    },
                    {
                      key: 'salinity',
                      label: 'Độ mặn',
                      val: selectedRecord.parameters.salinity,
                      unit: 'ppt',
                      icon: <Droplets className="w-3.5 h-3.5" />,
                      ideal: '10 - 25 ppt',
                    },
                    {
                      key: 'alkalinity',
                      label: 'Độ kiềm',
                      val: selectedRecord.parameters.alkalinity,
                      unit: 'mg/L',
                      icon: <FlaskConical className="w-3.5 h-3.5" />,
                      ideal: '100 - 160 mg/L',
                    },
                    {
                      key: 'nh3',
                      label: 'Khí độc NH3',
                      val: selectedRecord.parameters.nh3,
                      unit: 'mg/L',
                      icon: <AlertTriangle className="w-3.5 h-3.5" />,
                      ideal: '< 0.30 mg/L',
                    },
                  ].map((param) => {
                    const isTriggered = selectedRecord.triggeredParams.includes(param.key);

                    return (
                      <div
                        key={param.key}
                        className={`p-2.5 sm:p-3 rounded-2xl border transition-all relative overflow-hidden ${isTriggered
                          ? 'bg-red-50/90 border-red-300 ring-2 ring-red-500/20 shadow-xs'
                          : 'bg-slate-50/70 border-slate-200/80 hover:bg-white'
                          }`}
                      >
                        {isTriggered && (
                          <div className="absolute top-1.5 right-1.5">
                            <span className="px-1.5 py-0.2 rounded bg-red-600 text-white text-[8px] font-black uppercase">
                              Vượt ngưỡng
                            </span>
                          </div>
                        )}

                        <div className="flex items-center gap-1 text-[11px] font-bold text-slate-400 mb-0.5">
                          <span className={isTriggered ? 'text-red-600' : 'text-indigo-600'}>{param.icon}</span>
                          <span className={isTriggered ? 'text-red-900 font-extrabold' : 'text-slate-600'}>
                            {param.label}
                          </span>
                        </div>

                        <div
                          className={`text-base sm:text-lg font-black ${isTriggered ? 'text-red-600' : 'text-slate-900'
                            }`}
                        >
                          {param.val}{' '}
                          <span className="text-[10px] font-medium text-slate-400 ml-0.5">{param.unit}</span>
                        </div>

                        <div className="mt-0.5 text-[9px] font-medium text-slate-400">Khuyên dùng: {param.ideal}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* ── Show Treatment Logs if Already Treated ── */}
              {selectedRecord.treatment && (
                <div className="p-3.5 bg-emerald-50/80 border border-emerald-200 rounded-2xl space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-emerald-900 uppercase tracking-wider flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Nhật ký xử lý & Xuất kho
                    </span>
                    <span className="text-[10px] font-bold text-emerald-700">
                      {selectedRecord.treatment.timestamp}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-0.5">
                    <div className="bg-white/80 p-2 rounded-xl border border-emerald-100">
                      <span className="text-[9px] text-slate-400 block font-bold">Hóa chất đã xuất kho</span>
                      <span className="font-extrabold text-emerald-950 text-xs">
                        {selectedRecord.treatment.chemicalName} ({selectedRecord.treatment.quantity}{' '}
                        {selectedRecord.treatment.unit})
                      </span>
                    </div>
                    <div className="bg-white/80 p-2 rounded-xl border border-emerald-100">
                      <span className="text-[9px] text-slate-400 block font-bold">Kỹ thuật viên thực hiện</span>
                      <span className="font-extrabold text-emerald-950 text-xs">
                        {selectedRecord.treatment.technicianName}
                      </span>
                    </div>
                  </div>
                  <div className="text-xs text-emerald-900 bg-white/60 p-2 rounded-xl border border-emerald-100 font-medium">
                    💬 <strong>Ghi chú:</strong> {selectedRecord.treatment.note}
                  </div>
                </div>
              )}

              {/* ── 6. TREATMENT ACTION FORM ────────────────────────────────────────── */}
              <div className="pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs sm:text-sm font-black text-slate-900 flex items-center gap-1.5">
                    <Wrench className="w-4 h-4 text-indigo-600" />
                    {selectedRecord.status === 'TREATED' ? 'Cập nhật phác đồ xử lý' : 'Biểu mẫu Can thiệp & Xuất kho'}
                  </h4>
                  <span className="text-[10px] text-indigo-600 font-bold bg-indigo-50 px-2 py-0.5 rounded-full flex items-center gap-1">
                  </span>
                </div>

                <form onSubmit={handleSubmitTreatment} className="space-y-3">
                  {/* Row 1: Select Chemical + Quantity */}
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                    {/* Chemical Dropdown Linked to Inventory Store */}
                    <div className="sm:col-span-8">
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Thuốc / Hóa chất sử dụng <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <select
                          value={selectedChemId}
                          onChange={(e) => setSelectedChemId(e.target.value)}
                          required
                          disabled={loadingInventory}
                          className="w-full px-3 py-2 pr-9 rounded-xl border border-slate-200 bg-slate-50/50 text-xs sm:text-sm font-semibold text-slate-800 appearance-none outline-none hover:bg-white hover:border-slate-300 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all cursor-pointer disabled:opacity-50"
                        >
                          <option value="">
                            {loadingInventory
                              ? '-- Đang đồng bộ danh mục từ Kho... --'
                              : '-- Chọn thuốc / hóa chất từ tồn kho --'}
                          </option>
                          {inventory.map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.name} (Tồn: {item.stock} {item.unit})
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      </div>

                      {currentSelectedChem ? (
                        <p className="mt-1 text-[10px] text-emerald-600 font-bold flex items-center gap-1">
                          <Package className="w-3 h-3 text-emerald-600" /> Tồn kho khả dụng:{' '}
                          <span className="text-slate-900 font-black">
                            {currentSelectedChem.stock} {currentSelectedChem.unit}
                          </span>{' '}
                          ({currentSelectedChem.category})
                        </p>
                      ) : (
                        <p className="mt-1 text-[10px] text-slate-400 font-medium">
                          💡 Danh mục thuốc & hóa chất liên kết trực tiếp từ phân hệ Kho vật tư.
                        </p>
                      )}
                    </div>

                    {/* Quantity Input */}
                    <div className="sm:col-span-4">
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Số lượng sử dụng <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          step="any"
                          min="0.1"
                          value={quantity}
                          onChange={(e) => setQuantity(e.target.value)}
                          placeholder="0.0"
                          required
                          className="w-full pl-3 pr-10 py-2 rounded-xl border border-slate-200 bg-slate-50/50 text-xs sm:text-sm font-bold text-slate-900 outline-none hover:bg-white focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-extrabold text-slate-400 pointer-events-none uppercase">
                          {currentSelectedChem?.unit || 'đơn vị'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Row 2: Note Textarea */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Ghi chú xử lý / Hướng dẫn kỹ thuật
                    </label>
                    <textarea
                      rows={2.5}
                      value={treatmentNote}
                      onChange={(e) => setTreatmentNote(e.target.value)}
                      placeholder="Mô tả các thao tác đã thực hiện (vd: Tạt lúc 14:00, tăng quạt nước 100% công suất, đo lại sau 2 giờ...)"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50/50 text-xs sm:text-sm font-medium text-slate-800 outline-none hover:bg-white focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all"
                    />
                  </div>

                  {/* Form Action Submit Button Bar */}
                  <div className="pt-2 flex items-center justify-end gap-2.5">
                    <button
                      type="button"
                      onClick={() => setSelectedRecord(null)}
                      className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                    >
                      Hủy bỏ
                    </button>

                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-black transition-all cursor-pointer shadow-md shadow-indigo-500/25 flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
                    >
                      {isSubmitting ? (
                        <>
                          <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Đang xuất kho & xử lý...
                        </>
                      ) : (
                        <>
                          <Check className="w-4 h-4" />
                          Xác nhận & Xuất kho
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
