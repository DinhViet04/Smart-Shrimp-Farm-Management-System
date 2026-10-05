import { useState, useMemo, useEffect } from 'react';
import {
  ArrowLeft,
  Search,
  Calendar,
  Layers,
  Waves,
  RefreshCw,
  Package,
  Pill,
  FlaskConical,
  Box,
  User,
  Clock,
  ChevronDown,
  Eye,
  Utensils,
  X,
  Activity,
  PackagePlus,
  PackageMinus,
  Sparkles,
  Building2,
  CheckCircle2,
} from 'lucide-react';
import LoadingMotion from '../../components/LoadingMotion';
import { inventoryService } from '../../services/inventory.service';
import { cropService, type Crop } from '../../services/crop.service';
import {
  feedingLogService,
  DEFAULT_FEEDING_SESSIONS,
  type DailyFeedingGroup,
} from '../../services/feeding-log.service';
import InventoryActionModal from './InventoryActionModal';

interface InventoryUsageHistoryViewProps {
  farmId: string;
  farmName?: string;
  ponds: any[];
  onBack: () => void;
}

export default function InventoryUsageHistoryView({
  farmId,
  farmName,
  ponds,
  onBack,
}: InventoryUsageHistoryViewProps) {
  const [logs, setLogs] = useState<any[]>([]);
  const [feedingGroups, setFeedingGroups] = useState<DailyFeedingGroup[]>([]);
  const [crops, setCrops] = useState<Crop[]>([]);
  const [inventoryItems, setInventoryItems] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal chi tiết cữ ăn & chi tiết giao dịch kho
  const [selectedFeedingGroup, setSelectedFeedingGroup] = useState<DailyFeedingGroup | null>(null);
  const [selectedMovementLog, setSelectedMovementLog] = useState<any | null>(null);

  // Modal nhập / xuất kho trực tiếp ngay tại trang Nhật ký sử dụng
  const [isActionModalOpen, setIsActionModalOpen] = useState(false);
  const [actionModalAction, setActionModalAction] = useState<'IMPORT' | 'EXPORT'>('IMPORT');
  const [actionItem, setActionItem] = useState<any | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Bộ lọc loại biến động: ALL (Cả Nhập & Xuất) | IMPORT (Chỉ Nhập) | EXPORT (Chỉ Xuất) | FEEDING (Nhật ký cho ăn ao)
  const [movementType, setMovementType] = useState<'ALL' | 'IMPORT' | 'EXPORT' | 'FEEDING'>('ALL');

  // Bộ lọc danh mục vật tư
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | 'FEED' | 'MEDICINE' | 'CHEMICAL'>('ALL');
  const [selectedYear, setSelectedYear] = useState<string>('ALL');
  const [selectedCropId, setSelectedCropId] = useState<string>('ALL');
  const [selectedPondId, setSelectedPondId] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch cả nhật ký kho, nhật ký cho ăn hàng ngày và danh sách vật tư của farm
  const fetchAllData = async () => {
    if (!farmId) return;
    setIsLoading(true);
    setError(null);
    try {
      const [usageData, feedingRes, inventoryRes] = await Promise.all([
        inventoryService.getUsageLogs(farmId, undefined, undefined, 1000),
        feedingLogService.getAllGrouped({ farmId, size: 500 }).catch((err) => {
          console.warn('Could not fetch daily feeding logs:', err);
          return { data: [] };
        }),
        inventoryService.getAll(undefined, undefined, farmId).catch(() => ({ data: [] })),
      ]);
      setLogs(usageData || []);
      setFeedingGroups(feedingRes?.data || []);
      const itemsList = Array.isArray(inventoryRes)
        ? inventoryRes
        : inventoryRes?.data || [];
      setInventoryItems(itemsList);
    } catch (err: any) {
      setError(err.message || 'Không thể tải nhật ký biến động kho');
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch crops
  useEffect(() => {
    const fetchCrops = async () => {
      try {
        const cropsData = await cropService.getAll({ summary: true });
        const farmCrops = (cropsData || []).filter(
          (c) => c.pond?.farmId === farmId || ponds.some((p) => p.id === c.pondId)
        );
        setCrops(farmCrops);
      } catch {
        setCrops([]);
      }
    };

    fetchCrops();
  }, [farmId, ponds]);

  useEffect(() => {
    fetchAllData();
  }, [farmId]);

  // Nhận diện một dòng nhật ký là Nhập kho hay Xuất kho
  const isImportLog = (log: any): boolean => {
    return log?.type === 'IMPORT' || log?.notes?.startsWith('[NHẬP KHO') || false;
  };

  // Parse ghi chú và gói quy cách của log
  const parseLogDetails = (log: any) => {
    const rawNote = log.notes || '';
    const isImport = isImportLog(log);

    if (isImport) {
      const match = rawNote.match(/^\[NHẬP KHO(?::\s*([^\]]+))?\](.*)/);
      if (match) {
        return {
          isImport: true,
          actionLabel: 'Nhập kho',
          packageInfo: match[1]?.trim() || '',
          cleanNote: match[2]?.replace(/^ —\s*/, '').trim() || '',
          purpose: 'Bổ sung tồn kho sản phẩm',
        };
      }
      return {
        isImport: true,
        actionLabel: 'Nhập kho',
        packageInfo: '',
        cleanNote: rawNote,
        purpose: 'Bổ sung tồn kho sản phẩm',
      };
    }

    // Xuất kho
    if (rawNote.startsWith('[Mục đích:')) {
      const match = rawNote.match(/^\[Mục đích:\s*([^\]]+)\](.*)/);
      if (match) {
        return {
          isImport: false,
          actionLabel: 'Xuất kho',
          packageInfo: '',
          cleanNote: match[2]?.replace(/^ —\s*/, '').trim() || '',
          purpose: match[1]?.trim() || 'Xuất sử dụng',
        };
      }
    }

    if (rawNote.startsWith('Xuất kho từ Nhật ký cho ăn')) {
      return {
        isImport: false,
        actionLabel: 'Xuất kho',
        packageInfo: '',
        cleanNote: rawNote,
        purpose: '🦐 Cho tôm ăn ao nuôi',
      };
    }

    return {
      isImport: false,
      actionLabel: 'Xuất kho',
      packageInfo: '',
      cleanNote: rawNote,
      purpose: 'Xuất sử dụng tại trang trại',
    };
  };

  // Trích xuất ao liên quan từ ghi chú
  const extractPondFromNote = (note?: string) => {
    if (!note) return null;

    // 1. Ưu tiên so khớp chính xác với danh sách ao trong props.ponds
    if (ponds && ponds.length > 0) {
      // Sắp xếp theo độ dài tên giảm dần (để "Ao số 10" khớp trước "Ao số 1")
      const sortedPonds = [...ponds].sort((a, b) => (b.name?.length || 0) - (a.name?.length || 0));
      for (const p of sortedPonds) {
        if (p.name && new RegExp(`(^|[^\\p{L}\\d])${p.name}([^\\p{L}\\d]|$)`, 'iu').test(note)) {
          return p.name;
        }
      }
      for (const p of sortedPonds) {
        if (p.name && note.toLowerCase().includes(p.name.toLowerCase())) {
          return p.name;
        }
      }
    }

    // 2. Nhận diện từ định dạng prefix hệ thống: "Xuất kho từ Nhật ký cho ăn - Ao số 2"
    const prefixMatch = note.match(/(?:Nhật ký cho ăn|xuất cho ăn)\s*[-—–:]\s*([^\n,;—–]+)/i);
    if (prefixMatch && prefixMatch[1]) {
      const candidate = prefixMatch[1].trim();
      if (/^ao/i.test(candidate)) {
        return candidate;
      }
    }

    // 3. Fallback: regex nhận diện tên ao đầy đủ bao gồm cả chữ số/tên ao phía sau (vd: "Ao số 2", "Ao 2", "Ao lắng", "Ao ương 1")
    const match = note.match(/Ao\s+(?:số\s+)?[\p{L}\d\.\-_]+/iu);
    if (match) return match[0].trim();

    return null;
  };

  // Danh sách các năm có dữ liệu
  const availableYears = useMemo(() => {
    const yearsSet = new Set<number>();
    logs.forEach((log) => {
      if (log.usageDate) {
        const y = new Date(log.usageDate).getFullYear();
        if (!isNaN(y)) yearsSet.add(y);
      }
    });
    feedingGroups.forEach((fg) => {
      if (fg.feedingDate) {
        const y = new Date(fg.feedingDate).getFullYear();
        if (!isNaN(y)) yearsSet.add(y);
      }
    });
    yearsSet.add(new Date().getFullYear());
    return Array.from(yearsSet).sort((a, b) => b - a);
  }, [logs, feedingGroups]);

  // Lọc nhật ký cho ăn hàng ngày
  const filteredFeedingGroups = useMemo(() => {
    return feedingGroups.filter((group) => {
      if (selectedYear !== 'ALL') {
        const groupYear = new Date(group.feedingDate).getFullYear();
        if (String(groupYear) !== selectedYear) return false;
      }
      if (selectedPondId !== 'ALL' && group.pondId !== selectedPondId) return false;
      if (selectedCropId !== 'ALL' && group.cropId !== selectedCropId) return false;

      // Danh mục: Feeding chỉ gồm thức ăn cám (FEED)
      if (categoryFilter !== 'ALL' && categoryFilter !== 'FEED') {
        return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const pondName = (group.pondName || '').toLowerCase();
        const creatorName = (group.createdBy || '').toLowerCase();
        const products = (group.sessions || [])
          .map((s) => (s.feedProductName || '').toLowerCase())
          .join(' ');
        const notes = (group.sessions || [])
          .map((s) => (s.note || '').toLowerCase())
          .join(' ');

        if (
          !pondName.includes(q) &&
          !creatorName.includes(q) &&
          !products.includes(q) &&
          !notes.includes(q)
        ) {
          return false;
        }
      }

      return true;
    });
  }, [feedingGroups, selectedYear, selectedPondId, selectedCropId, searchQuery, categoryFilter]);

  // Lọc cơ sở cho danh sách logs biến động kho
  const filteredLogsBase = useMemo(() => {
    return logs.filter((log) => {
      const isImport = isImportLog(log);

      // 1. Lọc theo Năm
      if (selectedYear !== 'ALL') {
        const logYear = new Date(log.usageDate).getFullYear();
        if (String(logYear) !== selectedYear) return false;
      }

      // 2. Lọc theo Danh mục
      if (categoryFilter !== 'ALL') {
        if (log.inventory?.category !== categoryFilter) return false;
      }

      // 3. Lọc theo Ao nuôi
      if (selectedPondId !== 'ALL') {
        // Nhập kho là nhập về kho tổng trang trại, không thể nhập vào một ao nuôi cụ thể
        if (isImport) return false;

        const targetPond = ponds.find((p) => p.id === selectedPondId);
        const pondName = targetPond?.name?.toLowerCase() || '';
        const notesLower = (log.notes || '').toLowerCase();
        const matchesPond =
          pondName &&
          (notesLower.includes(pondName) ||
            notesLower.includes(`ao ${pondName}`) ||
            notesLower.includes(`ao: ${pondName}`));
        if (!matchesPond) return false;
      }

      // 4. Lọc theo Vụ nuôi
      if (selectedCropId !== 'ALL') {
        // Nhập kho là nhập về kho tổng trang trại, không thuộc về một vụ nuôi cụ thể
        if (isImport) return false;

        const targetCrop = crops.find((c) => c.id === selectedCropId);
        if (targetCrop) {
          // Vụ nuôi luôn thuộc về một ao nuôi cụ thể: targetCrop.pondId
          const targetPond = ponds.find((p) => p.id === targetCrop.pondId) || targetCrop.pond;
          const targetPondName = (targetPond?.name || '').toLowerCase();
          const notesLower = (log.notes || '').toLowerCase();

          // Kiểm tra xem giao dịch xuất kho này có dành cho ao của vụ này không
          const matchesPond =
            targetPondName &&
            (notesLower.includes(targetPondName) ||
              notesLower.includes(`ao ${targetPondName}`) ||
              notesLower.includes(`ao: ${targetPondName}`));

          if (!matchesPond) return false;

          // Kiểm tra mốc thời gian của vụ nuôi
          const logTime = new Date(log.usageDate).getTime();
          const cropStart = new Date(targetCrop.startDate).getTime();
          const cropEnd = targetCrop.expectedHarvestDate
            ? new Date(targetCrop.expectedHarvestDate).getTime()
            : targetCrop.status === 'HARVESTED'
            ? new Date(targetCrop.updatedAt || '').getTime()
            : Infinity;

          if (logTime < cropStart || logTime > cropEnd) return false;
        }
      }

      // 5. Tìm kiếm theo tên vật tư, người ghi nhận, ghi chú
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const itemName = (log.inventory?.itemName || '').toLowerCase();
        const creatorName = (log.creator?.fullName || '').toLowerCase();
        const notes = (log.notes || '').toLowerCase();
        if (!itemName.includes(q) && !creatorName.includes(q) && !notes.includes(q)) {
          return false;
        }
      }

      return true;
    });
  }, [logs, selectedYear, categoryFilter, selectedPondId, selectedCropId, searchQuery, ponds, crops]);

  // Lọc theo Loại biến động (Nhập / Xuất / Tất cả)
  const activeMovementLogs = useMemo(() => {
    if (movementType === 'IMPORT') {
      return filteredLogsBase.filter((l) => isImportLog(l));
    }
    if (movementType === 'EXPORT') {
      return filteredLogsBase.filter((l) => !isImportLog(l));
    }
    return filteredLogsBase;
  }, [filteredLogsBase, movementType]);

  // Thống kê tổng quan (KPIs Overview)
  const stats = useMemo(() => {
    const importLogs = filteredLogsBase.filter((l) => isImportLog(l));
    const exportLogs = filteredLogsBase.filter((l) => !isImportLog(l));

    const totalFeedingKg = filteredFeedingGroups.reduce((acc, g) => acc + (g.totalFeedKg || 0), 0);
    const totalDays = filteredFeedingGroups.length;
    const totalCompleted = filteredFeedingGroups.reduce((acc, g) => acc + (g.completedSessions || 0), 0);
    const totalDelayed = filteredFeedingGroups.reduce((acc, g) => acc + (g.delayedSessions || 0), 0);
    const totalSkipped = filteredFeedingGroups.reduce((acc, g) => acc + (g.skippedSessions || 0), 0);
    const totalSessions = totalCompleted + totalDelayed + totalSkipped;
    const feedingCompletionRate = totalSessions > 0 ? Math.round((totalCompleted / totalSessions) * 100) : 100;

    const totalExportKg = exportLogs.reduce((acc, l) => acc + (Number(l.quantityUsed) || 0), 0);

    const uniqueActiveItems = new Set(
      filteredLogsBase.map((l) => l.inventoryId).filter(Boolean)
    ).size;

    return {
      importCount: importLogs.length,
      exportCount: exportLogs.length,
      totalMovements: filteredLogsBase.length,
      totalExportKg: Math.round(totalExportKg * 100) / 100,
      uniqueActiveItems,
      totalFeedingKg: Math.round(totalFeedingKg * 100) / 100,
      totalDays,
      feedingCompletionRate,
    };
  }, [filteredLogsBase, filteredFeedingGroups]);

  const resetFilters = () => {
    setMovementType('ALL');
    setCategoryFilter('ALL');
    setSelectedYear('ALL');
    setSelectedCropId('ALL');
    setSelectedPondId('ALL');
    setSearchQuery('');
  };

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 }).format(value || 0);
  };

  const formatDate = (date: string) => {
    try {
      return new Intl.DateTimeFormat('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(date));
    } catch {
      return date;
    }
  };

  const formatDayOnly = (date: string) => {
    try {
      const d = new Date(date);
      const daysOfWeek = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
      const dayName = daysOfWeek[d.getDay()];
      const dateFormatted = new Intl.DateTimeFormat('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }).format(d);
      return { dayName, dateFormatted };
    } catch {
      return { dayName: '', dateFormatted: date };
    }
  };

  const getCategoryDetails = (category: string) => {
    switch (category) {
      case 'FEED':
        return {
          label: 'Thức ăn',
          icon: <Package className="w-3.5 h-3.5" />,
          badgeColor: 'text-amber-700 bg-amber-50 border-amber-200',
        };
      case 'MEDICINE':
        return {
          label: 'Thuốc điều trị',
          icon: <Pill className="w-3.5 h-3.5" />,
          badgeColor: 'text-rose-700 bg-rose-50 border-rose-200',
        };
      case 'CHEMICAL':
        return {
          label: 'Hóa chất xử lý',
          icon: <FlaskConical className="w-3.5 h-3.5" />,
          badgeColor: 'text-cyan-700 bg-cyan-50 border-cyan-200',
        };
      default:
        return {
          label: 'Sản phẩm khác',
          icon: <Box className="w-3.5 h-3.5" />,
          badgeColor: 'text-slate-700 bg-slate-50 border-slate-200',
        };
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-in fade-in duration-300 relative">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-6 right-6 z-[100] px-4 py-3 rounded-2xl shadow-xl border border-emerald-200 bg-emerald-50 text-emerald-700 flex items-center gap-3 animate-in slide-in-from-right-8 fade-in duration-300">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <p className="text-sm font-bold">{toastMessage}</p>
        </div>
      )}

      {/* ── 1. HEADER & BREADCRUMB ────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white/90 backdrop-blur-xl p-5 sm:p-6 rounded-3xl shadow-xl shadow-blue-900/5 border border-white/60">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-3 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-2xl border border-slate-200 transition-all hover:scale-105 active:scale-95 shadow-sm group"
            title="Quay lại Quản lý kho"
          >
            <ArrowLeft className="w-5 h-5 text-slate-600 group-hover:-translate-x-0.5 transition-transform" />
          </button>
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider mb-0.5">
              <span>Quản lý kho</span>
              <span>/</span>
              <span className="text-blue-600">Nhật ký Sử dụng</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-800 tracking-tight flex items-center gap-3">
              Nhật ký Sử dụng
              <span className="text-xs font-bold px-3 py-1 bg-blue-100 text-blue-700 rounded-full border border-blue-200">
                {farmName || 'Trang trại'}
              </span>
            </h1>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 self-end sm:self-auto">
          <button
            onClick={fetchAllData}
            disabled={isLoading}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-600 font-bold text-xs hover:bg-slate-50 transition-colors shadow-sm cursor-pointer"
            title="Tải lại dữ liệu mới nhất"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-blue-600' : ''}`} />
            Làm mới
          </button>
        </div>
      </div>

      {/* ── 2. TOP 4 KPI CARDS THỐNG KÊ TRỰC QUAN ───────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Thẻ 1: Lịch sử Nhập kho */}
        <div className="bg-gradient-to-br from-white to-emerald-50/40 p-5 rounded-3xl border border-emerald-200/80 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-100/80 text-emerald-700 flex items-center justify-center shrink-0 border border-emerald-200 shadow-inner">
            <PackagePlus className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold text-emerald-800 uppercase tracking-wider">Lịch sử Nhập kho</p>
            <p className="text-2xl font-black text-emerald-700 mt-0.5 truncate">
              {stats.importCount} <span className="text-xs font-bold text-emerald-600/70">lượt nhập</span>
            </p>
            <p className="text-[11px] text-slate-500 font-medium mt-0.5">
              Bổ sung hàng vào kho trang trại
            </p>
          </div>
        </div>

        {/* Thẻ 2: Lịch sử Xuất kho */}
        <div className="bg-gradient-to-br from-white to-rose-50/40 p-5 rounded-3xl border border-rose-200/80 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-rose-100/80 text-rose-700 flex items-center justify-center shrink-0 border border-rose-200 shadow-inner">
            <PackageMinus className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold text-rose-800 uppercase tracking-wider">Lịch sử Xuất kho</p>
            <p className="text-2xl font-black text-rose-700 mt-0.5 truncate">
              {stats.exportCount} <span className="text-xs font-bold text-rose-600/70">lượt xuất</span>
            </p>
            <p className="text-[11px] text-slate-500 font-medium mt-0.5 truncate">
              {stats.totalExportKg > 0 ? (
                <>
                  <span className="font-bold text-rose-600">-{stats.totalExportKg.toLocaleString('vi-VN')} kg</span> xuất dùng ao
                </>
              ) : (
                'Xuất dùng cho các ao nuôi trong kỳ'
              )}
            </p>
          </div>
        </div>

        {/* Thẻ 3: Mặt hàng phát sinh biến động */}
        <div className="bg-gradient-to-br from-white to-blue-50/40 p-5 rounded-3xl border border-blue-200/80 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-100/80 text-blue-700 flex items-center justify-center shrink-0 border border-blue-200 shadow-inner">
            <Layers className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold text-blue-800 uppercase tracking-wider">Mặt hàng biến động</p>
            <p className="text-2xl font-black text-blue-700 mt-0.5 truncate">
              {stats.uniqueActiveItems} <span className="text-xs font-bold text-slate-400">mặt hàng</span>
            </p>
            <p className="text-[11px] text-slate-500 font-medium mt-0.5">
              {stats.totalMovements} tổng lượt giao dịch phát sinh
            </p>
          </div>
        </div>

        {/* Thẻ 4: Cữ cho tôm ăn */}
        <div className="bg-gradient-to-br from-white to-amber-50/40 p-5 rounded-3xl border border-amber-200/80 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-100/80 text-amber-700 flex items-center justify-center shrink-0 border border-amber-200 shadow-inner">
            <Utensils className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold text-amber-800 uppercase tracking-wider">Nhật ký cho ăn ao</p>
            <p className="text-2xl font-black text-amber-700 mt-0.5 truncate">
              {formatNumber(stats.totalFeedingKg)} <span className="text-xs font-bold text-amber-600/70">kg cám</span>
            </p>
            <p className="text-[11px] text-slate-500 font-medium mt-0.5">
              {stats.totalDays} ngày • Đúng giờ {stats.feedingCompletionRate}%
            </p>
          </div>
        </div>
      </div>

      {/* ── 3. THANH ĐIỀU HƯỚNG LOẠI BIẾN ĐỘNG & BỘ LỌC TỔNG THỂ ──────────────── */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-5 space-y-4">
        
        {/* HÀNG 1: Quick Switcher giữa các loại biến động */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-1.5 p-1 bg-slate-100/90 rounded-2xl border border-slate-200/60 overflow-x-auto max-w-full">
            <button
              type="button"
              onClick={() => setMovementType('ALL')}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-2 ${
                movementType === 'ALL'
                  ? 'bg-white text-blue-700 shadow-md shadow-blue-500/10 border border-blue-100'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-blue-600" />
              Tất cả biến động ({filteredLogsBase.length})
            </button>

            <button
              type="button"
              onClick={() => setMovementType('IMPORT')}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-2 ${
                movementType === 'IMPORT'
                  ? 'bg-white text-emerald-700 shadow-md shadow-emerald-500/10 border border-emerald-200'
                  : 'text-slate-600 hover:text-emerald-700 hover:bg-white/60'
              }`}
            >
              <PackagePlus className="w-3.5 h-3.5 text-emerald-600" />
              Lịch sử Nhập kho ({stats.importCount})
            </button>

            <button
              type="button"
              onClick={() => setMovementType('EXPORT')}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-2 ${
                movementType === 'EXPORT'
                  ? 'bg-white text-rose-700 shadow-md shadow-rose-500/10 border border-rose-200'
                  : 'text-slate-600 hover:text-rose-700 hover:bg-white/60'
              }`}
            >
              <PackageMinus className="w-3.5 h-3.5 text-rose-600" />
              Lịch sử Xuất kho ({stats.exportCount})
            </button>

            <button
              type="button"
              onClick={() => setMovementType('FEEDING')}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-2 ${
                movementType === 'FEEDING'
                  ? 'bg-white text-amber-700 shadow-md shadow-amber-500/10 border border-amber-200'
                  : 'text-slate-600 hover:text-amber-700 hover:bg-white/60'
              }`}
            >
              <Utensils className="w-3.5 h-3.5 text-amber-600" />
              Nhật ký cho ăn ao ({filteredFeedingGroups.length} ngày)
            </button>
          </div>

          {(movementType !== 'ALL' || categoryFilter !== 'ALL' || selectedYear !== 'ALL' || selectedPondId !== 'ALL' || selectedCropId !== 'ALL' || searchQuery) && (
            <button
              onClick={resetFilters}
              className="text-xs font-bold text-blue-600 hover:text-blue-800 transition-colors underline self-start sm:self-auto"
            >
              Đặt lại tất cả bộ lọc
            </button>
          )}
        </div>

        {/* HÀNG 2: Bộ lọc Danh mục sản phẩm */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="text-xs font-black text-slate-400 uppercase tracking-wider mr-2">Danh mục sản phẩm:</span>
          <button
            onClick={() => setCategoryFilter('ALL')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all border ${
              categoryFilter === 'ALL'
                ? 'bg-blue-600 text-white border-blue-600 shadow-sm shadow-blue-500/25 ring-2 ring-blue-500/20'
                : 'bg-slate-100 text-slate-700 border-slate-200/80 hover:bg-slate-200 hover:text-slate-900'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            Tất cả danh mục
          </button>
          <button
            onClick={() => setCategoryFilter('FEED')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
              categoryFilter === 'FEED'
                ? 'bg-amber-500 text-white shadow-sm'
                : 'bg-amber-50 text-amber-800 hover:bg-amber-100'
            }`}
          >
            <Package className="w-3.5 h-3.5" /> Thức ăn tôm
          </button>
          <button
            onClick={() => setCategoryFilter('MEDICINE')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
              categoryFilter === 'MEDICINE'
                ? 'bg-rose-500 text-white shadow-sm'
                : 'bg-rose-50 text-rose-800 hover:bg-rose-100'
            }`}
          >
            <Pill className="w-3.5 h-3.5" /> Thuốc
          </button>
          <button
            onClick={() => setCategoryFilter('CHEMICAL')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
              categoryFilter === 'CHEMICAL'
                ? 'bg-cyan-600 text-white shadow-sm'
                : 'bg-cyan-50 text-cyan-800 hover:bg-cyan-100'
            }`}
          >
            <FlaskConical className="w-3.5 h-3.5" /> Hóa chất 
          </button>
        </div>

        {/* HÀNG 3: Chi tiết Năm, Vụ nuôi, Ao nuôi, Tìm kiếm */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
          {/* Lọc theo Năm */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              <Calendar className="w-3.5 h-3.5 text-blue-600" />
              Năm thực hiện
            </label>
            <div className="relative">
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:border-blue-500 outline-none transition-all cursor-pointer appearance-none pr-8"
              >
                <option value="ALL">Tất cả các năm</option>
                {availableYears.map((year) => (
                  <option key={year} value={String(year)}>
                    Năm {year}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* Lọc theo Vụ nuôi */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              <Layers className="w-3.5 h-3.5 text-indigo-600" />
              Vụ nuôi
            </label>
            <div className="relative">
              <select
                value={selectedCropId}
                onChange={(e) => {
                  const newCropId = e.target.value;
                  setSelectedCropId(newCropId);
                  if (newCropId !== 'ALL') {
                    const c = crops.find((crop) => crop.id === newCropId);
                    if (c?.pondId) {
                      setSelectedPondId(c.pondId);
                    }
                  }
                }}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:border-blue-500 outline-none transition-all cursor-pointer appearance-none pr-8"
              >
                <option value="ALL">Tất cả vụ nuôi</option>
                {crops.map((crop, idx) => (
                  <option key={crop.id} value={crop.id}>
                    Vụ {idx + 1} ({crop.pond?.name || 'Ao'} - {new Date(crop.startDate).toLocaleDateString('vi-VN')})
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* Lọc theo Ao nuôi */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              <Waves className="w-3.5 h-3.5 text-cyan-600" />
              Ao nuôi
            </label>
            <div className="relative">
              <select
                value={selectedPondId}
                onChange={(e) => {
                  const newPondId = e.target.value;
                  setSelectedPondId(newPondId);
                  if (selectedCropId !== 'ALL') {
                    const c = crops.find((crop) => crop.id === selectedCropId);
                    if (c && c.pondId !== newPondId) {
                      setSelectedCropId('ALL');
                    }
                  }
                }}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:border-blue-500 outline-none transition-all cursor-pointer appearance-none pr-8"
              >
                <option value="ALL">Tất cả các ao</option>
                {ponds.map((pond) => (
                  <option key={pond.id} value={pond.id}>
                    {pond.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* Ô tìm kiếm từ khóa */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              <Search className="w-3.5 h-3.5 text-slate-500" />
              Tìm kiếm nhanh
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="Tên sản phẩm, người ghi, ghi chú..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:border-blue-500 outline-none transition-all pr-8 shadow-inner"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                  title="Xóa tìm kiếm"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── 4. BẢNG HIỂN THỊ DỮ LIỆU CHÍNH ───────────────────────────────── */}
      {movementType === 'FEEDING' ? (
        /* ──── TRƯỜNG HỢP A: BẢNG NHẬT KÝ CHO ĂN HẰNG NGÀY ──── */
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold border border-amber-200">
                <Utensils className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-800">
                  Nhật ký cho ăn hằng ngày theo cữ
                </h3>
                <p className="text-xs text-slate-400 font-medium">
                  Tổng hợp lượng thức ăn cho tôm ăn thực tế tại từng ao nuôi qua các cữ trong ngày
                </p>
              </div>
            </div>
            <span className="text-xs font-black bg-amber-50 text-amber-800 border border-amber-200 px-3 py-1 rounded-full self-start sm:self-auto">
              {filteredFeedingGroups.length} ngày cho ăn
            </span>
          </div>

          {isLoading ? (
            <div className="p-6">
              <LoadingMotion
                mode="card"
                title="Đang tải nhật ký cho ăn..."
                subtitle="Đang đồng bộ số liệu các cữ cho tôm ăn tại các ao nuôi..."
                icon={<Utensils className="w-10 h-10 text-amber-600 animate-pulse" />}
                color="amber"
                badgeText="Đang nạp nhật ký cữ ăn"
              />
            </div>
          ) : error ? (
            <div className="py-16 text-center text-red-600 text-sm font-semibold">{error}</div>
          ) : filteredFeedingGroups.length === 0 ? (
            <div className="py-20 flex flex-col items-center justify-center text-center px-4">
              <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-400 mb-3 border border-amber-100">
                <Utensils className="w-8 h-8" />
              </div>
              <h4 className="text-base font-bold text-slate-700">Chưa có nhật ký cho ăn nào</h4>
              <p className="text-xs text-slate-400 mt-1 max-w-sm">
                Không tìm thấy lượt cho ăn nào khớp với bộ lọc hiện tại. Khi nông dân ghi nhận cữ ăn, dữ liệu sẽ tự động đồng bộ tại đây.
              </p>
              <button
                onClick={resetFilters}
                className="mt-4 px-4 py-2 bg-amber-50 hover:bg-amber-100 text-amber-700 text-xs font-bold rounded-xl transition-colors"
              >
                Xóa tất cả bộ lọc
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[1050px]">
                <colgroup>
                  <col className="w-[140px]" />
                  <col className="w-[120px]" />
                  <col className="w-[150px]" />
                  <col className="w-[230px]" />
                  <col className="w-[140px]" />
                  <col className="w-[150px]" />
                  <col className="w-[150px]" />
                  <col className="w-[100px]" />
                </colgroup>
                <thead>
                  <tr className="bg-slate-50/90 border-b border-slate-200/80 text-[11px] font-black text-slate-500 uppercase tracking-wider">
                    <th className="px-4 py-3.5">Ngày cho ăn</th>
                    <th className="px-4 py-3.5">Ao nuôi</th>
                    <th className="px-4 py-3.5">Vụ nuôi</th>
                    <th className="px-4 py-3.5">Loại thức ăn sử dụng</th>
                    <th className="px-4 py-3.5 text-right">Tổng lượng (kg)</th>
                    <th className="px-4 py-3.5 text-center">Các cữ trong ngày</th>
                    <th className="px-4 py-3.5">Người ghi nhận</th>
                    <th className="px-4 py-3.5 text-center">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {filteredFeedingGroups.map((group) => {
                    const { dayName, dateFormatted } = formatDayOnly(group.feedingDate);
                    const uniqueFeeds = Array.from(
                      new Set(
                        (group.sessions || [])
                          .filter((s) => s.feedingStatus !== 'SKIPPED' && s.feedProductName)
                          .map((s) => s.feedProductName)
                      )
                    );

                    return (
                      <tr key={group.id} className="hover:bg-slate-50/70 transition-colors">
                        {/* Ngày cho ăn */}
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 border border-amber-100">
                              <Calendar className="w-4 h-4" />
                            </div>
                            <div>
                              <p className="text-xs font-bold text-slate-800 leading-tight">
                                {dateFormatted}
                              </p>
                              <p className="text-[11px] text-slate-400 font-medium">{dayName}</p>
                            </div>
                          </div>
                        </td>

                        {/* Ao nuôi */}
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-extrabold bg-blue-50 text-blue-700 border border-blue-100 shadow-2xs">
                            <Waves className="w-3.5 h-3.5" />
                            {group.pondName}
                          </span>
                        </td>

                        {/* Vụ nuôi */}
                        <td className="px-4 py-3.5 whitespace-nowrap text-xs text-slate-500 font-medium">
                          {group.cropStartDate
                            ? `Ngày thả ${new Date(group.cropStartDate).toLocaleDateString('vi-VN')}`
                            : 'Vụ hiện tại'}
                        </td>

                        {/* Loại thức ăn sử dụng */}
                        <td className="px-4 py-3.5">
                          {uniqueFeeds.length > 0 ? (
                            <div className="flex flex-wrap gap-1.5">
                              {uniqueFeeds.map((feedName) => (
                                <span
                                  key={feedName}
                                  className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200"
                                >
                                  <Package className="w-3 h-3 text-amber-600" />
                                  {feedName}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400 italic">Chưa ghi loại cám</span>
                          )}
                        </td>

                        {/* Tổng lượng cho ăn */}
                        <td className="px-4 py-3.5 text-right whitespace-nowrap">
                          <span className="text-sm sm:text-base font-black text-amber-700 bg-amber-50 px-2.5 py-1 rounded-xl border border-amber-200 shadow-2xs">
                            - {formatNumber(group.totalFeedKg)} <span className="text-xs font-semibold text-slate-400">kg</span>
                          </span>
                        </td>

                        {/* Các cữ trong ngày */}
                        <td className="px-4 py-3.5">
                          <div className="flex flex-col items-center justify-center gap-1">
                            <div className="flex items-center gap-1">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                {group.completedSessions}/7 Xong
                              </span>
                              {group.delayedSessions > 0 && (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-50 text-amber-700 border border-amber-200">
                                  {group.delayedSessions} Trễ
                                </span>
                              )}
                              {group.skippedSessions > 0 && (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-slate-100 text-slate-600 border border-slate-200">
                                  {group.skippedSessions} Bỏ
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-1">
                              {(group.sessions || []).map((s, idx) => (
                                <span
                                  key={s.id || idx}
                                  title={`Cữ ${idx + 1}: ${
                                    s.feedingStatus === 'COMPLETED'
                                      ? 'Hoàn thành'
                                      : s.feedingStatus === 'DELAYED'
                                      ? 'Trễ cử'
                                      : 'Bỏ cử'
                                  } (${s.feedAmount || 0} kg)`}
                                  className={`w-2 h-2 rounded-full ${
                                    s.feedingStatus === 'COMPLETED'
                                      ? 'bg-emerald-500'
                                      : s.feedingStatus === 'DELAYED'
                                      ? 'bg-amber-400'
                                      : 'bg-slate-200'
                                  }`}
                                />
                              ))}
                            </div>
                          </div>
                        </td>

                        {/* Người ghi nhận */}
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-xs font-bold text-slate-600 shrink-0">
                              {group.createdBy ? group.createdBy.charAt(0) : <User className="w-3.5 h-3.5" />}
                            </div>
                            <span className="text-xs font-bold text-slate-800">
                              {group.createdBy || 'Nông dân'}
                            </span>
                          </div>
                        </td>

                        {/* Thao tác */}
                        <td className="px-4 py-3.5 text-center whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => setSelectedFeedingGroup(group)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-600 hover:text-white transition-all text-xs font-bold shadow-2xs group cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5 text-blue-600 group-hover:text-white transition-colors" />
                            Chi tiết cữ
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        /* ──── TRƯỜNG HỢP B: BẢNG LỊCH SỬ BIẾN ĐỘNG KHO (NHẬP & XUẤT) ──── */
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
            <div className="flex items-center gap-2.5">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold border ${
                movementType === 'IMPORT'
                  ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                  : movementType === 'EXPORT'
                  ? 'bg-rose-50 text-rose-600 border-rose-200'
                  : 'bg-blue-50 text-blue-600 border-blue-200'
              }`}>
                {movementType === 'IMPORT' ? (
                  <PackagePlus className="w-4 h-4" />
                ) : movementType === 'EXPORT' ? (
                  <PackageMinus className="w-4 h-4" />
                ) : (
                  <Box className="w-4 h-4" />
                )}
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-800">
                  {movementType === 'IMPORT'
                    ? 'Lịch sử Nhập kho (+)'
                    : movementType === 'EXPORT'
                    ? 'Lịch sử Xuất kho (-)'
                    : 'Lịch sử Biến động kho (Cả Nhập & Xuất)'}
                </h3>
                <p className="text-xs text-slate-400 font-medium">
                  {movementType === 'IMPORT'
                    ? 'Danh sách các lần bổ sung nhập hàng vào kho trang trại'
                    : movementType === 'EXPORT'
                    ? 'Danh sách các lần xuất kho thức ăn, thuốc và hóa chất đem sử dụng'
                    : 'Chi tiết từng lần biến động tăng / giảm số lượng sản phẩm trong kho'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-xs font-black px-3 py-1 rounded-full border ${
                movementType === 'IMPORT'
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : movementType === 'EXPORT'
                  ? 'bg-rose-50 text-rose-800 border-rose-200'
                  : 'bg-slate-100 text-slate-700 border border-slate-200'
              }`}>
                {activeMovementLogs.length} giao dịch
              </span>
            </div>
          </div>

          {isLoading ? (
            <div className="p-6">
              <LoadingMotion
                mode="card"
                title={movementType === 'IMPORT' ? 'Đang tải lịch sử nhập kho...' : 'Đang tải lịch sử xuất kho...'}
                subtitle="Đang cập nhật chi tiết các biến động hàng hóa trong kho..."
                icon={movementType === 'IMPORT' ? <PackagePlus className="w-10 h-10 text-emerald-600 animate-pulse" /> : <PackageMinus className="w-10 h-10 text-rose-600 animate-pulse" />}
                color={movementType === 'IMPORT' ? 'emerald' : 'rose'}
                badgeText="Đang kết nối kho dữ liệu"
              />
            </div>
          ) : error ? (
            <div className="py-16 text-center text-red-600 text-sm font-semibold">{error}</div>
          ) : activeMovementLogs.length === 0 ? (
            <div className="py-20 flex flex-col items-center justify-center text-center px-4">
              <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 mb-3 border border-slate-200">
                {movementType === 'IMPORT' ? (
                  <PackagePlus className="w-8 h-8 text-emerald-500" />
                ) : movementType === 'EXPORT' ? (
                  <PackageMinus className="w-8 h-8 text-rose-500" />
                ) : (
                  <Box className="w-8 h-8 text-slate-400" />
                )}
              </div>
              <h4 className="text-base font-bold text-slate-700">
                {movementType === 'IMPORT'
                  ? 'Chưa có lịch sử nhập kho nào'
                  : movementType === 'EXPORT'
                  ? 'Chưa có lịch sử xuất kho nào'
                  : 'Chưa có giao dịch biến động nào'}
              </h4>
              <p className="text-xs text-slate-400 mt-1 max-w-sm">
                {categoryFilter !== 'ALL' || selectedYear !== 'ALL' || selectedPondId !== 'ALL' || selectedCropId !== 'ALL' || searchQuery
                  ? 'Không tìm thấy dữ liệu khớp với bộ lọc đang chọn.'
                  : movementType === 'IMPORT'
                  ? 'Hiện tại chưa ghi nhận lượt nhập thêm sản phẩm nào trong hệ thống.'
                  : movementType === 'EXPORT'
                  ? 'Hiện tại chưa ghi nhận lượt xuất kho nào trong hệ thống.'
                  : 'Hiện tại chưa có dữ liệu biến động kho nào được ghi nhận.'}
              </p>
              {(categoryFilter !== 'ALL' || selectedYear !== 'ALL' || selectedPondId !== 'ALL' || selectedCropId !== 'ALL' || searchQuery) && (
                <div className="flex items-center justify-center mt-4">
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                  >
                    Xóa tất cả bộ lọc
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[1100px]">
                <colgroup>
                  <col className="w-[130px]" />
                  <col className="w-[230px]" />
                  <col className="w-[135px]" />
                  <col className="w-[150px]" />
                  <col className="w-[285px]" />
                  <col className="w-[170px]" />
                  <col className="w-[110px]" />
                </colgroup>
                <thead>
                  <tr className="bg-slate-50/90 border-b border-slate-200/80 text-[11px] font-black text-slate-500 uppercase tracking-wider">
                    <th className="px-4 py-3.5">Thời gian</th>
                    <th className="px-4 py-3.5">Sản phẩm & Quy cách</th>
                    <th className="px-4 py-3.5 text-center">Loại biến động</th>
                    <th className="px-4 py-3.5 text-right">Lượng biến động</th>
                    <th className="px-4 py-3.5">Nơi áp dụng & Ghi chú</th>
                    <th className="px-4 py-3.5">Người thực hiện</th>
                    <th className="px-4 py-3.5 text-center">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {activeMovementLogs.map((log) => {
                    const isImport = isImportLog(log);
                    const cat = getCategoryDetails(log.inventory?.category || '');
                    const details = parseLogDetails(log);
                    const pondRelated = extractPondFromNote(log.notes);
                    const unit = log.inventory?.unit || 'kg';
                    const weightPerPkg = log.inventory?.weightPerPkg;
                    const packageType = log.inventory?.packageType || 'Bao';

                    // Tính ước lượng số bao/chai nếu có quy cách
                    const equivalentPackages =
                      weightPerPkg && weightPerPkg > 0
                        ? (log.quantityUsed / weightPerPkg).toFixed(1)
                        : null;

                    return (
                      <tr key={log.id} className="hover:bg-slate-50/70 transition-colors group">
                        {/* 1. Thời gian */}
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-xl bg-slate-100/90 text-slate-500 flex items-center justify-center shrink-0 border border-slate-200/60">
                              <Clock className="w-4 h-4 text-slate-400" />
                            </div>
                            <div>
                              <p className="text-xs font-bold text-slate-800 leading-tight">
                                {formatDate(log.usageDate).split(' ')[0]}
                              </p>
                              <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                                {formatDate(log.usageDate).split(' ')[1] || ''}
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* 2. Sản phẩm & Quy cách */}
                        <td className="px-4 py-3.5">
                          <div className="flex flex-col gap-1 min-w-0 pr-2">
                            <span className="font-extrabold text-slate-900 text-sm truncate" title={log.inventory?.itemName}>
                              {log.inventory?.itemName || 'Sản phẩm đã xóa'}
                            </span>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border ${cat.badgeColor}`}>
                                {cat.icon}
                                {cat.label}
                              </span>
                              {weightPerPkg && (
                                <span className="inline-flex items-center text-[10px] text-slate-600 font-semibold bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200/60 whitespace-nowrap">
                                  {weightPerPkg} {unit}/{packageType}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* 3. Loại biến động */}
                        <td className="px-4 py-3.5 text-center whitespace-nowrap">
                          {isImport ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-black bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs">
                              <PackagePlus className="w-3.5 h-3.5 text-emerald-600" />
                              Nhập kho
                            </span>
                          ) : log.notes?.includes('Nhật ký cho ăn') ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-black bg-amber-50 text-amber-800 border border-amber-200 shadow-2xs">
                              <Utensils className="w-3.5 h-3.5 text-amber-600" />
                              Xuất cho ăn
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-black bg-rose-50 text-rose-700 border border-rose-200 shadow-2xs">
                              <PackageMinus className="w-3.5 h-3.5 text-rose-600" />
                              Xuất kho
                            </span>
                          )}
                        </td>

                        {/* 4. Lượng biến động */}
                        <td className="px-4 py-3.5 text-right whitespace-nowrap">
                          {isImport ? (
                            <div className="flex flex-col items-end">
                              <span className="text-sm font-black text-emerald-700 bg-emerald-50/90 px-2.5 py-0.5 rounded-lg border border-emerald-200/90 shadow-2xs">
                                + {formatNumber(log.quantityUsed)} <span className="text-xs font-bold text-emerald-600">{unit}</span>
                              </span>
                              {details.packageInfo ? (
                                <span className="text-[11px] font-bold text-emerald-600 mt-0.5">
                                  ({details.packageInfo})
                                </span>
                              ) : equivalentPackages ? (
                                <span className="text-[11px] font-medium text-slate-400 mt-0.5">
                                  (~{equivalentPackages} {packageType})
                                </span>
                              ) : null}
                            </div>
                          ) : (
                            <div className="flex flex-col items-end">
                              <span className="text-sm font-black text-rose-700 bg-rose-50/90 px-2.5 py-0.5 rounded-lg border border-rose-200/90 shadow-2xs">
                                - {formatNumber(log.quantityUsed)} <span className="text-xs font-bold text-rose-600">{unit}</span>
                              </span>
                              {equivalentPackages && (
                                <span className="text-[11px] font-medium text-slate-400 mt-0.5">
                                  (~{equivalentPackages} {packageType})
                                </span>
                              )}
                            </div>
                          )}
                        </td>

                        {/* 5. Nơi áp dụng & Ghi chú */}
                        <td className="px-4 py-3.5">
                          <div className="flex flex-col gap-1 min-w-0 pr-2">
                            <div>
                              {isImport ? (
                                <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-lg border border-emerald-200">
                                  <Building2 className="w-3 h-3 text-emerald-600" />
                                  Kho tổng trang trại
                                </span>
                              ) : pondRelated ? (
                                <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-cyan-800 bg-cyan-50 px-2.5 py-0.5 rounded-lg border border-cyan-200 shadow-2xs">
                                  <Waves className="w-3 h-3 text-cyan-600" />
                                  {pondRelated}
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-700 bg-slate-100 px-2.5 py-0.5 rounded-lg border border-slate-200/80">
                                  Toàn trang trại
                                </span>
                              )}
                            </div>
                            <p
                              className="text-xs text-slate-600 font-medium truncate mt-0.5"
                              title={details.cleanNote || details.purpose}
                            >
                              {details.cleanNote ? details.cleanNote : details.purpose || 'Không có ghi chú thêm'}
                            </p>
                          </div>
                        </td>

                        {/* 6. Người thực hiện */}
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-xs font-extrabold text-slate-700 shrink-0">
                              {log.creator?.fullName ? log.creator.fullName.charAt(0).toUpperCase() : <User className="w-3.5 h-3.5" />}
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-slate-800 leading-tight truncate">
                                {log.creator?.fullName || 'Hệ thống'}
                              </p>
                              <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mt-0.5">
                                {log.creator?.role || 'Nhân viên'}
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* 7. Thao tác */}
                        <td className="px-4 py-3.5 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1.5">
                            {log.notes?.includes('Nhật ký cho ăn') && (
                              <button
                                type="button"
                                onClick={() => {
                                  const logDateStr = new Date(log.usageDate).toISOString().split('T')[0];
                                  const pondRelated = extractPondFromNote(log.notes);
                                  const matchingGroup = feedingGroups.find((g) => {
                                    const gDateStr = new Date(g.feedingDate).toISOString().split('T')[0];
                                    return (
                                      gDateStr === logDateStr &&
                                      (!pondRelated ||
                                        g.pondName.toLowerCase().includes(pondRelated.toLowerCase()) ||
                                        pondRelated.toLowerCase().includes(g.pondName.toLowerCase()))
                                    );
                                  });
                                  if (matchingGroup) {
                                    setSelectedFeedingGroup(matchingGroup);
                                  } else {
                                    setSelectedMovementLog(log);
                                  }
                                }}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-500 hover:text-white text-amber-800 border border-amber-200/80 transition-all text-xs font-bold shadow-2xs cursor-pointer group"
                                title="Xem chi tiết các cữ cho ăn trong ngày"
                              >
                                <Utensils className="w-3.5 h-3.5 text-amber-600 group-hover:text-white transition-colors" />
                                Cữ ăn
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => setSelectedMovementLog(log)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-blue-600 hover:text-white text-slate-700 transition-all text-xs font-bold shadow-2xs group cursor-pointer"
                              title="Xem chi tiết phiếu giao dịch"
                            >
                              <Eye className="w-3.5 h-3.5 text-slate-500 group-hover:text-white transition-colors" />
                              Chi tiết
                            </button>
                            {isImport && (
                              <button
                                type="button"
                                onClick={() => {
                                  const found = inventoryItems.find((i) => i.id === log.inventoryId) || log.inventory;
                                  setActionItem(found);
                                  setActionModalAction('IMPORT');
                                  setIsActionModalOpen(true);
                                }}
                                className="p-1.5 bg-emerald-50 hover:bg-emerald-600 hover:text-white text-emerald-700 rounded-xl transition-all border border-emerald-200/60 shadow-2xs cursor-pointer"
                                title="Nhập thêm sản phẩm này vào kho"
                              >
                                <PackagePlus className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── 5. MODAL XEM CHI TIẾT GIAO DỊCH KHO (NHẬP / XUẤT) ────────────────── */}
      {selectedMovementLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-6 relative animate-in zoom-in-95 duration-200">
            <button
              onClick={() => setSelectedMovementLog(null)}
              className="absolute top-5 right-5 p-2 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Header Modal */}
            <div className="flex items-center gap-3.5 mb-5 border-b pb-4 pr-10">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold flex-shrink-0 border ${
                isImportLog(selectedMovementLog)
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-rose-50 text-rose-700 border-rose-200'
              }`}>
                {isImportLog(selectedMovementLog) ? (
                  <PackagePlus className="w-6 h-6" />
                ) : (
                  <PackageMinus className="w-6 h-6" />
                )}
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-800">
                  {isImportLog(selectedMovementLog) ? 'Chi tiết Phiếu Nhập Kho' : 'Chi tiết Phiếu Xuất Kho'}
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  Mã giao dịch: <span className="font-mono font-bold text-slate-700">GD-{selectedMovementLog.id.slice(-8).toUpperCase()}</span>
                </p>
              </div>
            </div>

            {/* Thông tin sản phẩm & số lượng */}
            <div className="space-y-3.5 text-xs">
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-bold text-slate-400 uppercase">Tên sản phẩm</p>
                  <p className="text-base font-extrabold text-slate-800 mt-0.5">
                    {selectedMovementLog.inventory?.itemName || 'Sản phẩm đã xóa'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[11px] font-bold text-slate-400 uppercase">Số lượng biến động</p>
                  <p className={`text-xl font-black mt-0.5 ${
                    isImportLog(selectedMovementLog) ? 'text-emerald-700' : 'text-rose-700'
                  }`}>
                    {isImportLog(selectedMovementLog) ? '+' : '-'}{formatNumber(selectedMovementLog.quantityUsed)} {selectedMovementLog.inventory?.unit || 'kg'}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-white rounded-xl border border-slate-100">
                  <span className="text-slate-400 block font-medium mb-1">Thời gian thực hiện</span>
                  <span className="font-bold text-slate-800">{formatDate(selectedMovementLog.usageDate)}</span>
                </div>
                <div className="p-3 bg-white rounded-xl border border-slate-100">
                  <span className="text-slate-400 block font-medium mb-1">Nơi nhận / Áp dụng</span>
                  <span className="font-bold text-slate-800">
                    {isImportLog(selectedMovementLog)
                      ? 'Kho tổng trang trại'
                      : extractPondFromNote(selectedMovementLog.notes) || 'Toàn trang trại'}
                  </span>
                </div>
              </div>

              <div className="p-3.5 bg-white rounded-xl border border-slate-100 space-y-1">
                <span className="text-slate-400 block font-medium">Mục đích thực hiện</span>
                <span className="font-bold text-slate-800">
                  {parseLogDetails(selectedMovementLog).purpose}
                </span>
                {parseLogDetails(selectedMovementLog).packageInfo && (
                  <p className="text-emerald-700 font-bold text-xs pt-1">
                    Đóng gói: {parseLogDetails(selectedMovementLog).packageInfo}
                  </p>
                )}
              </div>

              <div className="p-3.5 bg-white rounded-xl border border-slate-100 space-y-1">
                <span className="text-slate-400 block font-medium">Ghi chú từ người tạo</span>
                <p className="font-medium text-slate-700">
                  {parseLogDetails(selectedMovementLog).cleanNote || 'Không có ghi chú thêm'}
                </p>
              </div>

              {selectedMovementLog.notes?.includes('Nhật ký cho ăn') && (
                <div className="p-3 bg-amber-50 border border-amber-200/80 rounded-2xl flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                      <Utensils className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-amber-900">Liên kết với Nhật ký cho ăn</p>
                      <p className="text-[11px] text-amber-700 font-medium">Xem chi tiết các cữ ăn của ao trong ngày này</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const logDateStr = new Date(selectedMovementLog.usageDate).toISOString().split('T')[0];
                      const pondRelated = extractPondFromNote(selectedMovementLog.notes);
                      const matchingGroup = feedingGroups.find((g) => {
                        const gDateStr = new Date(g.feedingDate).toISOString().split('T')[0];
                        return (
                          gDateStr === logDateStr &&
                          (!pondRelated ||
                            g.pondName.toLowerCase().includes(pondRelated.toLowerCase()) ||
                            pondRelated.toLowerCase().includes(g.pondName.toLowerCase()))
                        );
                      });
                      if (matchingGroup) {
                        setSelectedMovementLog(null);
                        setSelectedFeedingGroup(matchingGroup);
                      }
                    }}
                    className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <Utensils className="w-3.5 h-3.5" />
                    Xem cữ ăn
                  </button>
                </div>
              )}

              <div className="p-3.5 bg-slate-900 text-white rounded-2xl flex items-center justify-between">
                <div>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                    Người phụ trách thực hiện
                  </p>
                  <p className="text-sm font-bold text-slate-200 mt-0.5">
                    {selectedMovementLog.creator?.fullName || 'Hệ thống'} ({selectedMovementLog.creator?.role || 'Nhân viên'})
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedMovementLog(null)}
                  className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all"
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── 6. MODAL CHI TIẾT CÁC CỮ CHO ĂN TRONG NGÀY ─────────────────────── */}
      {selectedFeedingGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl max-w-3xl w-full p-6 max-h-[90vh] overflow-y-auto relative animate-in zoom-in-95 duration-200">
            <button
              onClick={() => setSelectedFeedingGroup(null)}
              className="absolute top-5 right-5 p-2 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Header Modal */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-5 border-b pb-4 pr-10">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold flex-shrink-0 border border-amber-200">
                  <Utensils className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-xl font-black text-slate-800">
                      Chi tiết cho ăn ngày {new Date(selectedFeedingGroup.feedingDate).toLocaleDateString('vi-VN')}
                    </h3>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-amber-100 text-amber-800">
                      {selectedFeedingGroup.totalFeedKg.toFixed(1)} kg
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    {selectedFeedingGroup.farmName} • <span className="font-bold text-slate-700">{selectedFeedingGroup.pondName}</span> • Ngày thả: {selectedFeedingGroup.cropStartDate ? new Date(selectedFeedingGroup.cropStartDate).toLocaleDateString('vi-VN') : 'N/A'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="px-3 py-1 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  {selectedFeedingGroup.completedSessions}/7 hoàn thành
                </span>
                {selectedFeedingGroup.delayedSessions > 0 && (
                  <span className="px-2.5 py-1 rounded-xl text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                    {selectedFeedingGroup.delayedSessions} trễ
                  </span>
                )}
                {selectedFeedingGroup.skippedSessions > 0 && (
                  <span className="px-2.5 py-1 rounded-xl text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200">
                    {selectedFeedingGroup.skippedSessions} bỏ
                  </span>
                )}
              </div>
            </div>

            {/* Phân bổ lượng thức ăn trực quan qua các cữ */}
            <div className="bg-slate-50 rounded-2xl p-4 mb-5 border border-slate-100">
              <div className="flex items-center justify-between text-xs font-bold text-slate-600 mb-2">
                <span className="flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-blue-600" />
                  Phân bổ thức ăn qua các cữ trong ngày
                </span>
                <span className="text-amber-700 font-black">Tổng: {selectedFeedingGroup.totalFeedKg.toFixed(1)} kg</span>
              </div>
              <div className="h-3 w-full bg-slate-200 rounded-full overflow-hidden flex shadow-inner">
                {(selectedFeedingGroup.sessions || []).map((s, idx) => {
                  const pct = selectedFeedingGroup.totalFeedKg > 0 ? (s.feedAmount / selectedFeedingGroup.totalFeedKg) * 100 : 0;
                  const colors = ['bg-blue-500', 'bg-indigo-500', 'bg-cyan-500', 'bg-teal-500', 'bg-emerald-500', 'bg-amber-500', 'bg-purple-500'];
                  return pct > 0 ? (
                    <div
                      key={s.id || idx}
                      className={`h-full ${colors[idx % colors.length]} transition-all`}
                      style={{ width: `${pct}%` }}
                      title={`Cữ ${idx + 1}: ${s.feedAmount} kg (${Math.round(pct)}%)`}
                    />
                  ) : null;
                })}
              </div>
              <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-400 mt-2 gap-1 font-medium">
                {(selectedFeedingGroup.sessions || []).map((s, idx) => (
                  <span key={s.id || idx}>
                    Cữ {idx + 1}: <strong className="text-slate-700">{s.feedAmount || 0} kg</strong>
                  </span>
                ))}
              </div>
            </div>

            {/* Chi tiết 7 cữ cho ăn trong ngày */}
            <div className="space-y-3 mb-6">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Chi tiết từng cữ cho ăn
              </h4>
              {DEFAULT_FEEDING_SESSIONS.map((defItem, idx) => {
                const sKey = defItem.session;
                const sessionLog = (selectedFeedingGroup.sessions || []).find(
                  (s) => s.feedingSession === sKey
                );
                const isDone = sessionLog?.feedingStatus === 'COMPLETED';
                const isDelayed = sessionLog?.feedingStatus === 'DELAYED';

                return (
                  <div
                    key={sKey}
                    className={`p-4 rounded-2xl border transition-all ${
                      isDone
                        ? 'border-emerald-100 bg-emerald-50/20'
                        : isDelayed
                        ? 'border-amber-200 bg-amber-50/30'
                        : 'border-slate-200 bg-slate-50/50'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs ${
                          isDone ? 'bg-emerald-100 text-emerald-800' : isDelayed ? 'bg-amber-100 text-amber-800' : 'bg-slate-200 text-slate-600'
                        }`}>
                          {idx + 1}
                        </span>
                        <div>
                          <h5 className="text-sm font-bold text-slate-800">{defItem.label}</h5>
                          <p className="text-xs text-slate-400">
                            Giờ dự kiến: {defItem.defaultTime} {sessionLog?.feedingTime && `• Thực tế: ${sessionLog.feedingTime}`}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
                        <div className="text-left sm:text-right max-w-[220px]">
                          <p className="text-xs font-bold text-slate-700 truncate" title={sessionLog?.feedProductName}>
                            {sessionLog?.feedProductName || 'Chưa ghi thức ăn'}
                          </p>
                          <p className="text-sm font-black text-amber-700">
                            {sessionLog?.feedAmount ? `${sessionLog.feedAmount} kg` : '0 kg'}
                          </p>
                        </div>

                        <span
                          className={`px-3 py-1 rounded-xl text-xs font-extrabold flex-shrink-0 ${
                            isDone
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                              : isDelayed
                              ? 'bg-amber-100 text-amber-800 border border-amber-200'
                              : 'bg-slate-200 text-slate-600'
                          }`}
                        >
                          {isDone ? 'Hoàn thành' : isDelayed ? 'Trễ cử' : 'Bỏ cử'}
                        </span>
                      </div>
                    </div>

                    {sessionLog?.note && (
                      <div className="mt-2.5 pt-2 border-t border-slate-200/60 text-xs text-slate-600 font-medium flex items-center gap-1.5">
                        <span className="text-slate-400">Ghi chú:</span> {sessionLog.note}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Footer Modal */}
            <div className="bg-slate-900 text-white rounded-2xl p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">
                  Người phụ trách ghi nhận
                </p>
                <p className="text-sm font-bold text-slate-200 mt-0.5">
                  {selectedFeedingGroup.createdBy || 'Nông dân'} • Tạo lúc: {new Date(selectedFeedingGroup.createdAt).toLocaleDateString('vi-VN')}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSelectedFeedingGroup(null)}
                className="px-6 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all"
              >
                Đóng chi tiết
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 7. MODAL GHI NHẬN NHẬP KHO / XUẤT KHO TRỰC TIẾP ─────────────────── */}
      <InventoryActionModal
        isOpen={isActionModalOpen}
        item={actionItem}
        items={inventoryItems}
        initialAction={actionModalAction}
        ponds={ponds}
        selectedFarmId={farmId}
        onClose={() => {
          setIsActionModalOpen(false);
          setActionItem(null);
        }}
        onSuccess={(msg) => {
          setToastMessage(msg);
          setTimeout(() => setToastMessage(null), 4000);
          fetchAllData();
          if (actionModalAction === 'IMPORT') {
            setMovementType('IMPORT');
          } else {
            setMovementType('EXPORT');
          }
        }}
      />
    </div>
  );
}
