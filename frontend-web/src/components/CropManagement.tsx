import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Plus,
  Calendar,
  Waves,
  Edit2,
  Trash2,
  Search,
  CheckCircle2,
  ChevronDown,
  Gauge,
  FileText,
  TrendingUp,
  Check,
  Target,
  X,
  Users,
  Clock,
  History,
  RefreshCw,
  AlertCircle,
  Building2,
  Sparkles,
  Scale,
  Utensils,
  Activity,
  CalendarDays,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import { farmService } from '../services/farm.service';
import { pondService } from '../services/pond.service';
import { cropService, type Crop } from '../services/crop.service';
import SplitCropModal from './SplitCropModal';

interface Farm {
  id: string;
  name: string;
  address?: string;
  area?: number;
  status?: string;
  farmingModel?: string;
}

interface Pond {
  id: string;
  name: string;
  farmId: string;
  areaSize?: number;
  depth?: number;
}

const CROP_STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Đang nuôi',
  HARVESTED: 'Đã thu hoạch',
  FAILED: 'Thất thu',
};

const CROP_STATUS_BADGES: Record<string, { dot: string; bg: string }> = {
  ACTIVE: { dot: 'bg-emerald-500 animate-pulse', bg: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
  HARVESTED: { dot: 'bg-blue-500', bg: 'border-blue-200 bg-blue-50 text-blue-700' },
  FAILED: { dot: 'bg-rose-500', bg: 'border-rose-200 bg-rose-50 text-rose-700' },
};

// Date helper functions
const addDaysToDateString = (dateStr: string, days: number): string => {
  if (!dateStr || isNaN(days) || days <= 0) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

const getDaysDifference = (startDateStr: string, endDateStr: string): number => {
  if (!startDateStr || !endDateStr) return 0;
  const start = new Date(startDateStr);
  const end = new Date(endDateStr);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0;
  const diffTime = end.getTime() - start.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
  return diffDays > 0 ? diffDays : 0;
};

interface CropManagementProps {
  initialEditCrop?: Crop | null;
  onClearEditCrop?: () => void;
}

export default function CropManagement({ initialEditCrop, onClearEditCrop }: CropManagementProps = {}) {
  const [crops, setCrops] = useState<Crop[]>([]);
  const [farms, setFarms] = useState<Farm[]>([]);
  const [ponds, setPonds] = useState<Pond[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState<'active' | 'history'>('active');

  // ── Filters ─────────────────────────────────────────────────────────────────
  const [filterStatus, setFilterStatus] = useState('');
  const [search, setSearch] = useState('');

  // ── Modal State ─────────────────────────────────────────────────────────────
  const [showModal, setShowModal] = useState(false);
  const [editingCropId, setEditingCropId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    farmId: '',
    pondId: '',
    startDate: new Date().toISOString().slice(0, 10),
    initialShrimpCount: '100000',
    status: 'ACTIVE',
    stage: 'COMMERCIAL' as 'NURSERY' | 'COMMERCIAL',
    expectedTransferDate: '',
    targetHarvestSize: '30',
    targetSurvivalRate: '85',
    targetTotalFeedKg: '3400',
    expectedHarvestDate: '',
    expectedDurationDays: '95',
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [harvestCrop, setHarvestCrop] = useState<Crop | null>(null);
  const [harvesting, setHarvesting] = useState(false);
  const [splitCropTarget, setSplitCropTarget] = useState<Crop | null>(null);

  const canSplitCrop = useCallback(
    (crop: Crop) => {
      const farm = farms.find((f) => f.id === crop.pond?.farmId);
      const farmModel = crop.pond?.farm?.farmingModel || farm?.farmingModel;
      return (
        crop.status === 'ACTIVE' &&
        crop.stage === 'NURSERY' &&
        farmModel === 'HIGH_TECH'
      );
    },
    [farms],
  );

  // ── Toast ────────────────────────────────────────────────────────────────────
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  // ── Derived Data ─────────────────────────────────────────────────────────────
  const formPondsList = formData.farmId
    ? ponds.filter((p) => p.farmId === formData.farmId)
    : ponds;

  // Selected Pond for Stocking Density calculation
  const selectedPond = useMemo(() => {
    return ponds.find((p) => p.id === formData.pondId);
  }, [ponds, formData.pondId]);

  // Stocking Density calculation & Assessment
  const densityAssessment = useMemo(() => {
    const area = selectedPond?.areaSize || 0;
    const count = parseFloat(formData.initialShrimpCount);
    if (area <= 0 || isNaN(count) || count <= 0) {
      return {
        density: 0,
        densityFormatted: '0',
        level: 'NONE' as const,
        label: '',
        sublabel: '',
        boxBg: 'bg-slate-50',
        borderColor: 'border-slate-200',
        textColor: 'text-slate-800',
        badgeBg: 'bg-slate-100 text-slate-600 border-slate-200',
        isWarning: false,
        isDanger: false,
        isBlocked: false,
      };
    }

    const density = count / area;
    const densityFormatted = density % 1 === 0 ? density.toString() : density.toFixed(1);

    if (density < 100) {
      return {
        density,
        densityFormatted,
        level: 'LOW' as const,
        label: 'Mật độ thấp / Quảng canh (< 100 con/m²)',
        sublabel: 'Phù hợp mô hình bán thâm canh hoặc ít quạt nước.',
        boxBg: 'bg-sky-50/70',
        borderColor: 'border-sky-300',
        textColor: 'text-sky-700',
        badgeBg: 'bg-sky-50 text-sky-700 border-sky-200',
        isWarning: false,
        isDanger: false,
        isBlocked: false,
      };
    } else if (density <= 200) {
      return {
        density,
        densityFormatted,
        level: 'SAFE' as const,
        label: 'Mật độ an toàn, hiệu quả cao (100 – 200 con/m²)',
        sublabel: 'Chuẩn tối ưu hóa tăng trưởng và FCR.',
        boxBg: 'bg-emerald-50/80',
        borderColor: 'border-emerald-400',
        textColor: 'text-emerald-700',
        badgeBg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        isWarning: false,
        isDanger: false,
        isBlocked: false,
      };
    } else if (density <= 220) {
      return {
        density,
        densityFormatted,
        level: 'WARNING' as const,
        label: 'Mật độ cao (200 – 220 con/m²)',
        sublabel: 'Yêu cầu oxy đáy mạnh và quạt nước liên tục.',
        boxBg: 'bg-amber-50/90',
        borderColor: 'border-amber-400',
        textColor: 'text-amber-700',
        badgeBg: 'bg-amber-50 text-amber-700 border-amber-200',
        isWarning: true,
        isDanger: false,
        isBlocked: false,
      };
    } else {
      return {
        density,
        densityFormatted,
        level: 'DANGER' as const,
        label: 'VƯỢT BÁO ĐỘNG (> 220 – 250 con/m²)',
        sublabel: 'Mật độ quá tải nghiêm trọng, tuyệt đối không nên thả!',
        boxBg: 'bg-rose-50',
        borderColor: 'border-rose-400',
        textColor: 'text-rose-700',
        badgeBg: 'bg-rose-50 text-rose-700 border-rose-300',
        isWarning: false,
        isDanger: true,
        isBlocked: density > 250,
      };
    }
  }, [selectedPond, formData.initialShrimpCount]);

  // Estimated harvested shrimp count calculation
  const estimatedHarvestCount = useMemo(() => {
    const count = parseFloat(formData.initialShrimpCount) || 0;
    const rate = parseFloat(formData.targetSurvivalRate) || 0;
    return Math.round((count * rate) / 100);
  }, [formData.initialShrimpCount, formData.targetSurvivalRate]);

  // Estimated harvest biomass in kg
  const estimatedBiomassKg = useMemo(() => {
    const size = parseFloat(formData.targetHarvestSize) || 0;
    if (size <= 0 || estimatedHarvestCount <= 0) return 0;
    return Math.round((estimatedHarvestCount / size) * 10) / 10;
  }, [estimatedHarvestCount, formData.targetHarvestSize]);

  // Average weight per shrimp (g) = 1000 / targetHarvestSize
  const targetAvgWeightG = useMemo(() => {
    const size = parseFloat(formData.targetHarvestSize) || 0;
    if (size <= 0) return null;
    return (1000 / size).toFixed(1);
  }, [formData.targetHarvestSize]);

  // Estimated FCR = Total Feed (kg) / Harvest Biomass (kg)
  const estimatedFCR = useMemo(() => {
    const feed = parseFloat(formData.targetTotalFeedKg) || 0;
    if (feed <= 0 || estimatedBiomassKg <= 0) return null;
    const fcr = feed / estimatedBiomassKg;
    return fcr.toFixed(2);
  }, [formData.targetTotalFeedKg, estimatedBiomassKg]);

  const fcrRating = useMemo(() => {
    if (!estimatedFCR) return null;
    const num = parseFloat(estimatedFCR);
    if (num <= 1.25) return { label: 'Tối ưu (< 1.25)', color: 'text-emerald-700 bg-emerald-100/80 border-emerald-200' };
    if (num <= 1.45) return { label: 'Tiêu chuẩn (1.25 - 1.45)', color: 'text-blue-700 bg-blue-100/80 border-blue-200' };
    if (num <= 1.65) return { label: 'Cần lưu ý (1.45 - 1.65)', color: 'text-amber-700 bg-amber-100/80 border-amber-200' };
    return { label: 'Cao (> 1.65)', color: 'text-rose-700 bg-rose-100/80 border-rose-200' };
  }, [estimatedFCR]);

  // Calculated duration in days = (expectedHarvestDate - startDate) tự động tính
  const calculatedDurationDays = useMemo(() => {
    if (!formData.startDate || !formData.expectedHarvestDate) return 0;
    return getDaysDifference(formData.startDate, formData.expectedHarvestDate);
  }, [formData.startDate, formData.expectedHarvestDate]);

  // Calculated transfer days = (expectedTransferDate - startDate) nếu là ao ương dưỡng
  const calculatedTransferDays = useMemo(() => {
    if (!formData.startDate || !formData.expectedTransferDate) return 0;
    return getDaysDifference(formData.startDate, formData.expectedTransferDate);
  }, [formData.startDate, formData.expectedTransferDate]);

  // ── Fetch Initial Data ───────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [farmsData, pondsData, cropsData] = await Promise.all([
        farmService.getMy().catch(() => farmService.getAll()),
        pondService.getAll(),
        cropService.getAll({
          status: activeView === 'active' ? 'ACTIVE' : filterStatus || undefined,
        }),
      ]);
      setFarms(farmsData);
      setPonds(pondsData);
      setCrops(cropsData);
    } catch (err: any) {
      showToast(err.message || 'Lỗi khi tải dữ liệu vụ nuôi', 'error');
    } finally {
      setLoading(false);
    }
  }, [activeView, filterStatus]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (initialEditCrop) {
      openEditModal(initialEditCrop);
      onClearEditCrop?.();
    }
  }, [initialEditCrop]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Grouped Farms Calculation ──────────────────────────────────────────────
  const groupedFarms = useMemo(() => {
    const searchLower = search.trim().toLowerCase();

    return farms.map((farm) => {
      // Ponds belonging to this farm
      const farmPonds = ponds.filter((p) => p.farmId === farm.id);
      const farmPondIds = new Set(farmPonds.map((p) => p.id));

      // Crops belonging to this farm
      const farmCrops = crops.filter((crop) => {
        const isThisFarm = crop.pond?.farmId === farm.id || farmPondIds.has(crop.pondId);
        if (!isThisFarm) return false;

        if (activeView === 'active' && crop.status !== 'ACTIVE') return false;
        if (activeView === 'history' && crop.status === 'ACTIVE') return false;
        if (filterStatus && crop.status !== filterStatus) return false;

        if (searchLower) {
          const pName = crop.pond?.name?.toLowerCase() || '';
          const fName = farm.name?.toLowerCase() || '';
          if (!pName.includes(searchLower) && !fName.includes(searchLower)) return false;
        }
        return true;
      });

      const activeFarmCrops = crops.filter(
        (c) => (c.pond?.farmId === farm.id || farmPondIds.has(c.pondId)) && c.status === 'ACTIVE'
      );
      const totalFarmShrimp = activeFarmCrops.reduce(
        (sum, c) => sum + (Number(c.initialShrimpCount) || 0),
        0
      );

      const totalPondArea = farmPonds.reduce((acc, p) => acc + (Number(p.areaSize) || 0), 0);
      const farmArea = Number(farm.area) || 0;
      const usagePercentage = farmArea > 0 ? Math.min(100, Math.round((totalPondArea / farmArea) * 100)) : 0;

      return {
        ...farm,
        crops: farmCrops,
        activeCropsCount: activeFarmCrops.length,
        totalFarmShrimp,
        farmPonds,
        totalPondArea,
        farmArea,
        usagePercentage,
      };
    });
  }, [farms, ponds, crops, activeView, filterStatus, search]);

  // Total Summary KPIs
  const activeCropsCount = useMemo(() => crops.filter((c) => c.status === 'ACTIVE').length, [crops]);
  const totalActiveShrimp = useMemo(
    () => crops.filter((c) => c.status === 'ACTIVE').reduce((sum, c) => sum + (Number(c.initialShrimpCount) || 0), 0),
    [crops]
  );
  const activePondIds = useMemo(
    () => new Set(crops.filter((c) => c.status === 'ACTIVE').map((c) => c.pondId)),
    [crops]
  );
  const activeWaterArea = useMemo(
    () => ponds.filter((p) => activePondIds.has(p.id)).reduce((sum, p) => sum + (Number(p.areaSize) || 0), 0),
    [ponds, activePondIds]
  );

  // ── Modal Handlers ──────────────────────────────────────────────────────────
  const openAddModal = (defaultFarmId?: string) => {
    setEditingCropId(null);
    const today = new Date().toISOString().slice(0, 10);
    const defaultHarvest = addDaysToDateString(today, 95);
    const defaultTransfer = addDaysToDateString(today, 25);

    const chosenFarmId = defaultFarmId || (farms.length > 0 ? farms[0].id : '');
    const matchingPonds = chosenFarmId ? ponds.filter((p) => p.farmId === chosenFarmId) : ponds;
    const chosenPondId = matchingPonds.length > 0 ? matchingPonds[0].id : (ponds.length > 0 ? ponds[0].id : '');

    setFormData({
      farmId: chosenFarmId,
      pondId: chosenPondId,
      startDate: today,
      initialShrimpCount: '100000',
      status: 'ACTIVE',
      stage: 'COMMERCIAL',
      expectedTransferDate: defaultTransfer,
      targetHarvestSize: '30',
      targetSurvivalRate: '85',
      targetTotalFeedKg: '3400',
      expectedHarvestDate: defaultHarvest,
      expectedDurationDays: '95',
    });
    setFormErrors({});
    setShowModal(true);
  };

  const openEditModal = (crop: Crop) => {
    setEditingCropId(crop.id);
    const dateStr = crop.startDate ? new Date(crop.startDate).toISOString().slice(0, 10) : '';
    const harvestDateStr = crop.expectedHarvestDate ? new Date(crop.expectedHarvestDate).toISOString().slice(0, 10) : '';
    const transferDateStr = crop.expectedTransferDate ? new Date(crop.expectedTransferDate).toISOString().slice(0, 10) : '';

    let days = crop.expectedDurationDays?.toString() || '';
    if (!days && dateStr && harvestDateStr) {
      days = getDaysDifference(dateStr, harvestDateStr).toString();
    }

    setFormData({
      farmId: crop.pond?.farmId || '',
      pondId: crop.pondId,
      startDate: dateStr,
      initialShrimpCount: crop.initialShrimpCount.toString(),
      status: crop.status,
      stage: (crop.stage as any) || 'COMMERCIAL',
      expectedTransferDate: transferDateStr || (dateStr ? addDaysToDateString(dateStr, 25) : ''),
      targetHarvestSize: crop.targetHarvestSize?.toString() || '30',
      targetSurvivalRate: crop.targetSurvivalRate?.toString() || '85',
      targetTotalFeedKg: crop.targetTotalFeedKg?.toString() || '3400',
      expectedHarvestDate: harvestDateStr || (dateStr ? addDaysToDateString(dateStr, 95) : ''),
      expectedDurationDays: days || '95',
    });
    setFormErrors({});
    setShowModal(true);
  };

  // ── Date Change Handlers ──────────────────────────────────────────────────
  const handleStartDateChange = (newStartDate: string) => {
    setFormData((prev) => ({
      ...prev,
      startDate: newStartDate,
    }));
  };

  const handleHarvestDateChange = (newHarvestDate: string) => {
    setFormData((prev) => ({
      ...prev,
      expectedHarvestDate: newHarvestDate,
    }));
  };



  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!window.confirm('Bạn có chắc chắn muốn xóa vụ nuôi này?')) return;
    try {
      await cropService.remove(id);
      showToast('Xóa vụ nuôi thành công!', 'success');
      fetchData();
    } catch (err: any) {
      showToast(err.message || 'Không thể xóa vụ nuôi', 'error');
    }
  };

  const handleHarvest = async (e: React.MouseEvent, crop: Crop) => {
    e.stopPropagation();
    setHarvestCrop(crop);
  };

  const confirmHarvest = async () => {
    if (!harvestCrop) return;
    setHarvesting(true);
    try {
      await cropService.harvest(harvestCrop.id);
      showToast('Đã đóng vụ nuôi và ghi nhận thu hoạch!', 'success');
      setHarvestCrop(null);
      fetchData();
    } catch (err: any) {
      showToast(err.message || 'Không thể đóng vụ nuôi', 'error');
    } finally {
      setHarvesting(false);
    }
  };

  const validateForm = (): boolean => {
    const errs: Record<string, string> = {};
    if (!formData.farmId) errs.farmId = 'Vui lòng chọn trang trại';
    if (!formData.pondId) errs.pondId = 'Vui lòng chọn ao nuôi';
    if (!formData.startDate) errs.startDate = 'Vui lòng chọn ngày thả giống';

    const cnt = parseInt(formData.initialShrimpCount, 10);
    if (!formData.initialShrimpCount || isNaN(cnt) || cnt <= 0) {
      errs.initialShrimpCount = 'Số lượng giống thả phải là số nguyên dương (> 0)';
    } else if (selectedPond?.areaSize && selectedPond.areaSize > 0) {
      const density = cnt / selectedPond.areaSize;
      if (density > 250) {
        errs.initialShrimpCount = `Mật độ thả (${density.toFixed(1)} con/m²) vượt ngưỡng báo động tối đa (> 250 con/m²). Tuyệt đối không được thả!`;
      }
    }

    if (formData.targetHarvestSize) {
      const hSize = parseFloat(formData.targetHarvestSize);
      if (isNaN(hSize) || hSize <= 0) {
        errs.targetHarvestSize = 'Kích thước thu hoạch dự kiến phải là số dương (> 0 con/kg)';
      }
    }

    if (formData.targetSurvivalRate) {
      const rate = parseFloat(formData.targetSurvivalRate);
      if (isNaN(rate) || rate < 0 || rate > 100) {
        errs.targetSurvivalRate = 'Tỷ lệ sống phải từ 0% đến 100% (không được âm)';
      }
    }

    if (formData.targetTotalFeedKg) {
      const feed = parseFloat(formData.targetTotalFeedKg);
      if (isNaN(feed) || feed < 0) {
        errs.targetTotalFeedKg = 'Tổng lượng thức ăn phải là số không âm (≥ 0 kg)';
      }
    }



    if (formData.stage === 'NURSERY') {
      if (!formData.expectedTransferDate) {
        errs.expectedTransferDate = 'Vui lòng chọn ngày dự tính tách ao';
      } else if (!formData.startDate) {
        errs.startDate = 'Vui lòng chọn ngày thả giống trước';
      } else {
        const s = new Date(formData.startDate);
        const t = new Date(formData.expectedTransferDate);
        if (isNaN(t.getTime())) {
          errs.expectedTransferDate = 'Ngày dự tính tách ao không hợp lệ';
        } else if (t <= s) {
          errs.expectedTransferDate = 'Ngày dự tính tách ao phải sau ngày thả giống ít nhất 1 ngày';
        }
      }
    } else {
      if (!formData.expectedHarvestDate) {
        errs.expectedHarvestDate = 'Vui lòng chọn ngày thu hoạch dự kiến';
      } else if (!formData.startDate) {
        errs.startDate = 'Vui lòng chọn ngày thả giống trước';
      } else {
        const s = new Date(formData.startDate);
        const h = new Date(formData.expectedHarvestDate);
        if (isNaN(h.getTime())) {
          errs.expectedHarvestDate = 'Ngày thu hoạch dự kiến không hợp lệ';
        } else if (h <= s) {
          errs.expectedHarvestDate = 'Ngày thu hoạch dự kiến phải sau ngày thả giống ít nhất 1 ngày';
        }
      }
    }

    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setSaving(true);
    try {
      const isNursery = formData.stage === 'NURSERY';
      const payload = {
        pondId: formData.pondId,
        startDate: new Date(formData.startDate).toISOString(),
        initialShrimpCount: parseInt(formData.initialShrimpCount, 10),
        status: formData.status,
        stage: formData.stage,
        expectedTransferDate: isNursery && formData.expectedTransferDate
          ? new Date(formData.expectedTransferDate).toISOString()
          : undefined,
        targetHarvestSize: formData.targetHarvestSize ? parseFloat(formData.targetHarvestSize) : undefined,
        targetSurvivalRate: formData.targetSurvivalRate ? parseFloat(formData.targetSurvivalRate) : undefined,
        targetTotalFeedKg: formData.targetTotalFeedKg ? parseFloat(formData.targetTotalFeedKg) : undefined,
        expectedHarvestDate: !isNursery && formData.expectedHarvestDate
          ? new Date(formData.expectedHarvestDate).toISOString()
          : (isNursery && formData.expectedTransferDate ? new Date(formData.expectedTransferDate).toISOString() : undefined),
        expectedDurationDays: isNursery
          ? (calculatedTransferDays > 0 ? calculatedTransferDays : undefined)
          : (calculatedDurationDays > 0 ? calculatedDurationDays : undefined),
      };

      if (editingCropId) {
        await cropService.update(editingCropId, {
          startDate: payload.startDate,
          initialShrimpCount: payload.initialShrimpCount,
          status: payload.status,
          stage: payload.stage,
          expectedTransferDate: payload.expectedTransferDate,
          targetHarvestSize: payload.targetHarvestSize,
          targetSurvivalRate: payload.targetSurvivalRate,
          targetTotalFeedKg: payload.targetTotalFeedKg,
          expectedHarvestDate: payload.expectedHarvestDate,
          expectedDurationDays: payload.expectedDurationDays,
        });
        showToast('Cập nhật vụ nuôi thành công!', 'success');
      } else {
        await cropService.create(payload);
        showToast('Tạo vụ nuôi mới thành công!', 'success');
      }

      setShowModal(false);
      fetchData();
    } catch (err: any) {
      showToast(err.message || 'Lỗi khi lưu vụ nuôi', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Helper for computing Days in Culture (DOC)
  const getDOC = (startDateStr: string) => {
    const start = new Date(startDateStr).getTime();
    const now = new Date().getTime();
    const diffDays = Math.floor((now - start) / (1000 * 60 * 60 * 24));
    return diffDays >= 0 ? diffDays : 0;
  };

  return (
    <div className="relative z-10 max-w-7xl mx-auto space-y-6">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed top-6 right-6 z-[100] px-4 py-3 rounded-2xl shadow-lg border flex items-center gap-3 animate-in slide-in-from-right-8 fade-in duration-300 ${
            toast.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
              : 'bg-red-50 border-red-200 text-red-700'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5" />
          ) : (
            <AlertCircle className="w-5 h-5" />
          )}
          <p className="text-sm font-semibold">{toast.message}</p>
        </div>
      )}

      {/* Header Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/80 backdrop-blur-xl p-4 sm:p-6 rounded-3xl shadow-xl shadow-blue-900/5 border border-white/60">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-gradient-to-br from-blue-50 to-indigo-50 text-blue-600 rounded-2xl flex items-center justify-center shadow-inner border border-blue-100/50">
            <CalendarDays className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-2xl font-black bg-clip-text text-transparent bg-gradient-to-r from-blue-700 via-indigo-600 to-cyan-500 tracking-tight">
              Quản Lý Vụ Nuôi
            </h2>
            <p className="text-sm text-slate-500 font-medium">
              Theo dõi chu kỳ nuôi, mật độ giống, FCR và mục tiêu sản lượng phân chia theo từng trang trại
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm tên ao hoặc trại..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl text-sm font-medium focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all shadow-inner"
            />
          </div>
          <button
            onClick={() => openAddModal()}
            className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-sm font-bold rounded-xl flex items-center gap-2 transition-all duration-300 shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50 hover:-translate-y-0.5 whitespace-nowrap cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Thêm vụ mới
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* KPI 1: Active Crops */}
        <div className="bg-white/80 backdrop-blur-xl p-4 sm:p-5 rounded-3xl border border-white/60 shadow-lg shadow-blue-900/5 flex items-center gap-4 transition-all hover:-translate-y-0.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 flex items-center justify-center text-blue-600 shadow-inner">
            <Waves className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Vụ Nuôi Hoạt Động</p>
            <p className="text-2xl font-black text-slate-800">
              {activeCropsCount}{' '}
              <span className="text-xs font-bold text-slate-400 font-normal">/ {crops.length} tổng vụ</span>
            </p>
          </div>
        </div>

        {/* KPI 2: Total Active Shrimp */}
        <div className="bg-white/80 backdrop-blur-xl p-4 sm:p-5 rounded-3xl border border-white/60 shadow-lg shadow-blue-900/5 flex items-center gap-4 transition-all hover:-translate-y-0.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-50 to-blue-50 border border-cyan-100 flex items-center justify-center text-cyan-600 shadow-inner">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Tổng Giống Đang Thả</p>
            <p className="text-2xl font-black text-slate-800">
              {totalActiveShrimp.toLocaleString()}{' '}
              <span className="text-xs font-bold text-slate-400 font-normal">con giống</span>
            </p>
          </div>
        </div>

        {/* KPI 3: Water Area in Active Production */}
        <div className="bg-white/80 backdrop-blur-xl p-4 sm:p-5 rounded-3xl border border-white/60 shadow-lg shadow-blue-900/5 flex items-center gap-4 transition-all hover:-translate-y-0.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shadow-inner">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Ao Đang Vận Hành</p>
            <p className="text-2xl font-black text-slate-800">
              {activePondIds.size}{' '}
              <span className="text-xs font-bold text-slate-400 font-normal">
                ao ({activeWaterArea.toLocaleString()} m²)
              </span>
            </p>
          </div>
        </div>
      </div>

      {/* Filter & View Switcher Bar */}
      <div className="bg-white/80 backdrop-blur-md rounded-3xl p-4 sm:p-5 border border-white/60 shadow-xl shadow-blue-900/5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        {/* Tab switcher */}
        <div className="flex bg-slate-100/80 p-1.5 rounded-2xl w-fit">
          <button
            onClick={() => setActiveView('active')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeView === 'active'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Waves className="w-3.5 h-3.5" />
            Đang nuôi (Active)
            <span className="px-2 py-0.5 rounded-md bg-blue-50 text-[10px] text-blue-700 font-black border border-blue-100">
              {activeCropsCount}
            </span>
          </button>

          <button
            onClick={() => setActiveView('history')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeView === 'history'
                ? 'bg-white text-slate-800 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            Lịch sử vụ nuôi
            <span className="px-2 py-0.5 rounded-md bg-slate-200 text-[10px] text-slate-700 font-black">
              {crops.filter((c) => c.status !== 'ACTIVE').length}
            </span>
          </button>
        </div>

        {/* Right sub-filters */}
        <div className="flex items-center gap-3">
          {activeView === 'history' && (
            <div className="relative">
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="pl-3.5 pr-8 py-2 rounded-xl border border-slate-200 bg-slate-50/50 text-xs font-bold text-slate-700 outline-none focus:bg-white focus:border-blue-500 appearance-none transition-all cursor-pointer shadow-inner"
              >
                <option value="">Tất cả trạng thái lịch sử</option>
                <option value="HARVESTED">Đã thu hoạch</option>
                <option value="FAILED">Thất thu</option>
              </select>
              <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          )}

          <button
            onClick={fetchData}
            className="p-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-blue-600 transition-colors shadow-inner cursor-pointer"
            title="Tải lại danh sách"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Loading state */}
      {loading ? (
        <div className="flex items-center justify-center h-64 bg-white/80 backdrop-blur-xl rounded-3xl border border-white/60 shadow-sm">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin"></div>
            <p className="text-slate-500 text-sm font-medium">Đang tải dữ liệu vụ nuôi...</p>
          </div>
        </div>
      ) : farms.length === 0 ? (
        /* No Farms State */
        <div className="flex flex-col items-center justify-center h-64 bg-white/90 backdrop-blur-xl rounded-3xl border border-slate-200/80 shadow-sm text-center px-6">
          <div className="w-16 h-16 bg-blue-50 text-blue-500 rounded-2xl flex items-center justify-center mb-4 shadow-inner border border-blue-100/50">
            <Building2 className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-slate-800 mb-1">Bạn chưa tạo Trang Trại nào</h3>
          <p className="text-slate-500 text-sm mb-4">Vui lòng tạo trang trại và ao nuôi trước khi bắt đầu tạo các vụ nuôi.</p>
        </div>
      ) : groupedFarms.every((g) => g.crops.length === 0) && search ? (
        /* No Search Results */
        <div className="flex flex-col items-center justify-center h-64 bg-white/80 backdrop-blur-xl rounded-3xl border border-white/60 shadow-sm text-center px-6">
          <div className="w-16 h-16 bg-slate-100 text-slate-400 rounded-2xl flex items-center justify-center mb-4">
            <Search className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-slate-700 mb-1">Không tìm thấy vụ nuôi phù hợp</h3>
          <p className="text-slate-500 text-sm">Không có kết quả nào khớp với từ khóa "{search}".</p>
        </div>
      ) : (
        /* Grouped By Farm Sections */
        <div className="space-y-8">
          {groupedFarms.map((farmGroup) => (
            <div
              key={farmGroup.id}
              className="bg-white/80 backdrop-blur-xl rounded-3xl border border-white/80 shadow-xl shadow-blue-900/5 overflow-hidden transition-all duration-300"
            >
              {/* Farm Section Header Banner */}
              <div className="h-1.5 bg-gradient-to-r from-blue-600 via-indigo-500 to-cyan-400"></div>

              <div className="p-5 sm:p-6 space-y-5">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                  <div className="space-y-2.5">
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 text-blue-600 flex items-center justify-center border border-blue-100 shadow-inner">
                        <Building2 className="w-5 h-5" />
                      </div>
                      <h3 className="text-xl font-black text-slate-800 tracking-tight">
                        {farmGroup.name}
                      </h3>

                      {/* Status badge */}
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-bold rounded-full border ${
                          farmGroup.status === 'ACTIVE'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200/80'
                            : 'bg-rose-50 text-rose-700 border-rose-200/80'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            farmGroup.status === 'ACTIVE' ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
                          }`}
                        />
                        {farmGroup.status === 'ACTIVE' ? 'Hoạt động' : 'Tạm ngưng'}
                      </span>

                      {/* Farming Model Badge */}
                      <span
                        className={`inline-flex items-center gap-1.5 px-3 py-0.5 text-xs font-bold rounded-full border ${
                          farmGroup.farmingModel === 'TRADITIONAL'
                            ? 'bg-amber-50 text-amber-700 border-amber-200/80'
                            : 'bg-blue-50 text-blue-700 border-blue-200/80'
                        }`}
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        {farmGroup.farmingModel === 'TRADITIONAL'
                          ? 'Mô hình truyền thống'
                          : 'Mô hình công nghệ cao'}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs font-medium text-slate-500 pl-0 sm:pl-13">
                      {farmGroup.address && (
                        <span className="inline-flex items-center gap-1 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-100">
                          <Building2 className="w-3.5 h-3.5 text-blue-500" />
                          {farmGroup.address}
                        </span>
                      )}
                      <span>
                        Quy mô: <strong className="text-slate-700 font-bold">{farmGroup.farmPonds?.length || 0} ao nuôi</strong>
                      </span>
                      <span>•</span>
                      <span>
                        Đang thả:{' '}
                        <strong className="text-blue-600 font-bold">
                          {farmGroup.totalFarmShrimp?.toLocaleString() || 0} con giống
                        </strong>
                      </span>
                    </div>
                  </div>

                  {/* Right side controls */}
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-slate-600 bg-slate-50 px-3.5 py-2 rounded-xl border border-slate-200/60 shadow-inner">
                      🌾 <strong>{farmGroup.crops.length}</strong> vụ ({activeView === 'active' ? 'đang nuôi' : 'lịch sử'})
                    </span>
                    <button
                      onClick={() => openAddModal(farmGroup.id)}
                      className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all shadow-md shadow-blue-500/20 hover:shadow-blue-500/40 hover:-translate-y-0.5 whitespace-nowrap cursor-pointer"
                    >
                      <Plus className="w-4 h-4" /> Thêm vụ cho trại này
                    </button>
                  </div>
                </div>

                {/* Crops Grid for this farm */}
                {farmGroup.crops.length === 0 ? (
                  <div className="bg-slate-50/50 rounded-2xl border-2 border-dashed border-slate-200/80 p-8 text-center">
                    <div className="w-12 h-12 bg-white text-slate-400 rounded-2xl flex items-center justify-center mx-auto mb-2 border border-slate-100 shadow-sm">
                      <CalendarDays className="w-6 h-6 text-blue-400" />
                    </div>
                    <p className="text-sm font-bold text-slate-700 mb-1">
                      {activeView === 'active'
                        ? 'Trang trại này hiện chưa có vụ nuôi nào đang hoạt động'
                        : 'Chưa có lịch sử vụ nuôi nào tại trang trại này'}
                    </p>
                    <p className="text-xs text-slate-400 mb-4">
                      {activeView === 'active'
                        ? 'Bắt đầu khởi tạo vụ nuôi để kiểm soát mật độ giống, FCR và theo dõi tăng trưởng.'
                        : 'Các vụ nuôi sau khi thu hoạch hoặc đóng lại sẽ được lưu trữ tại đây.'}
                    </p>
                    {activeView === 'active' && (
                      <button
                        onClick={() => openAddModal(farmGroup.id)}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl inline-flex items-center gap-1.5 shadow-sm transition-all hover:-translate-y-0.5 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" /> Tạo vụ nuôi mới
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {farmGroup.crops.map((crop: Crop) => {
                      const statusBadge = CROP_STATUS_BADGES[crop.status] || CROP_STATUS_BADGES.ACTIVE;
                      const doc = getDOC(crop.startDate);
                      const startDateFormatted = new Date(crop.startDate).toLocaleDateString('vi-VN');
                      const cropArea = crop.pond?.areaSize || 0;
                      const densityVal = cropArea > 0 ? crop.initialShrimpCount / cropArea : null;
                      const cropDensity = densityVal !== null
                        ? (densityVal % 1 === 0 ? densityVal.toString() : densityVal.toFixed(1))
                        : null;

                      // Density Badge color
                      let densityBadgeBg = 'bg-slate-100 text-slate-600 border-slate-200';
                      if (densityVal !== null) {
                        if (densityVal < 100) {
                          densityBadgeBg = 'bg-sky-50 text-sky-700 border-sky-200';
                        } else if (densityVal <= 200) {
                          densityBadgeBg = 'bg-emerald-50 text-emerald-700 border-emerald-200';
                        } else if (densityVal <= 220) {
                          densityBadgeBg = 'bg-amber-50 text-amber-700 border-amber-200';
                        } else {
                          densityBadgeBg = 'bg-rose-50 text-rose-700 border-rose-200';
                        }
                      }

                      return (
                        <div
                          key={crop.id}
                          className="bg-white rounded-3xl border border-slate-100 shadow-md shadow-slate-200/50 hover:shadow-2xl hover:shadow-blue-500/10 transition-all hover:-translate-y-1.5 duration-300 group flex flex-col overflow-hidden relative"
                        >
                          {/* Card Gradient Top Cover */}
                          <div className="h-20 bg-gradient-to-br from-blue-600 via-indigo-600 to-cyan-500 relative overflow-hidden">
                            <div className="absolute inset-0 bg-white/15 backdrop-blur-xs pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                            <div className="absolute -bottom-6 -right-6 w-24 h-24 bg-white/10 rounded-full blur-xl"></div>
                          </div>

                          <div className="p-5 relative flex-1 flex flex-col">
                            {/* Floating Icon */}
                            <div className="w-12 h-12 bg-white border border-white/80 rounded-2xl flex items-center justify-center absolute -top-8 shadow-xl shadow-blue-900/10 group-hover:scale-110 transition-all duration-300 z-20">
                              <Waves className="w-6 h-6 text-blue-600" />
                            </div>

                            <div className="mt-4 flex-1 flex flex-col justify-between space-y-4">
                              <div>
                                <div className="flex items-start justify-between gap-2 mb-2">
                                  <div>
                                    <h4 className="text-lg font-black text-slate-800 tracking-tight group-hover:text-blue-600 transition-colors">
                                      {crop.pond?.name || 'Ao nuôi'}
                                    </h4>
                                    <p className="text-xs font-semibold text-slate-400">
                                      {cropArea > 0 ? `Diện tích: ${cropArea.toLocaleString()} m²` : 'Ao nuôi tôm'}
                                    </p>
                                  </div>

                                  <div className="flex flex-col items-end gap-1">
                                    <span
                                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-full border ${statusBadge.bg}`}
                                    >
                                      <span className={`w-1.5 h-1.5 rounded-full ${statusBadge.dot}`} />
                                      {CROP_STATUS_LABELS[crop.status] || crop.status}
                                    </span>

                                    {/* Stage Badge */}
                                    <span
                                      className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-md border ${
                                        crop.stage === 'NURSERY'
                                          ? 'bg-purple-50 text-purple-700 border-purple-200'
                                          : 'bg-blue-50 text-blue-700 border-blue-200'
                                      }`}
                                    >
                                      <span>{crop.stage === 'NURSERY' ? '🌱' : '🦐'}</span>
                                      {crop.stage === 'NURSERY' ? 'Ao Ương dưỡng' : 'Nuôi Thương phẩm'}
                                    </span>

                                    {/* Lineage: Parent Crop */}
                                    {crop.parentCrop && (
                                      <span
                                        className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-md border bg-indigo-50 text-indigo-700 border-indigo-200"
                                        title={`Tách từ ao: ${crop.parentCrop.pond?.name || 'Ao ương'}`}
                                      >
                                        <span>🌿</span> Tách từ {crop.parentCrop.pond?.name || 'ao ương'}
                                      </span>
                                    )}

                                    {/* Lineage: Child Crops */}
                                    {crop.childCrops && crop.childCrops.length > 0 && (
                                      <span
                                        className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-md border bg-emerald-50 text-emerald-700 border-emerald-200"
                                        title={`Đã tách sang ${crop.childCrops.length} ao thương phẩm`}
                                      >
                                        <span>✨</span> Đã tách ({crop.childCrops.length} ao)
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {/* Nursery Transfer Callout if applicable */}
                                {crop.stage === 'NURSERY' && crop.expectedTransferDate && crop.status === 'ACTIVE' && (
                                  <div className="mb-2 p-2 bg-purple-50/80 rounded-xl border border-purple-200/80 flex items-center justify-between text-xs">
                                    <span className="flex items-center gap-1 text-[11px] font-bold text-purple-900">
                                      <ArrowRight className="w-3.5 h-3.5 text-purple-600" /> Dự kiến tách ao:
                                    </span>
                                    <span className="font-black text-purple-900 text-[11px] bg-white px-2 py-0.5 rounded-md border border-purple-100 shadow-2xs">
                                      {new Date(crop.expectedTransferDate).toLocaleDateString('vi-VN')}
                                    </span>
                                  </div>
                                )}

                                {/* Nursery Harvested & Split Summary for Historical Cards */}
                                {crop.stage === 'NURSERY' && crop.actualNurseryHarvest && (
                                  <div className="mb-2 p-2 bg-purple-50/90 rounded-xl border border-purple-200 flex items-center justify-between text-[11px]">
                                    <span className="font-bold text-purple-900">
                                      Đã xuất ương: {crop.actualNurseryHarvest.toLocaleString()} con
                                    </span>
                                    <span className="font-black text-emerald-700 bg-white px-2 py-0.5 rounded-md border border-purple-100">
                                      Sống: {crop.nurserySurvivalRate || 0}%
                                    </span>
                                  </div>
                                )}

                                {/* Matrix stats */}
                                <div className="grid grid-cols-2 gap-2.5 bg-slate-50/70 p-3 rounded-2xl border border-slate-100/80 shadow-inner my-3">
                                  <div className="flex flex-col gap-0.5">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                                      <Calendar className="w-3 h-3 text-blue-500" /> Ngày thả giống
                                    </span>
                                    <span className="text-xs font-black text-slate-800">{startDateFormatted}</span>
                                  </div>

                                  <div className="flex flex-col gap-0.5">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                                      <Clock className="w-3 h-3 text-blue-500" /> Thời gian nuôi
                                    </span>
                                    <span className="text-xs font-black text-blue-600">
                                      {crop.status === 'ACTIVE' ? `Ngày ${doc} (DOC)` : 'Đã kết thúc'}
                                    </span>
                                  </div>

                                  <div className="flex flex-col gap-0.5 pt-2 border-t border-slate-200/50">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                                      <Users className="w-3 h-3 text-blue-500" /> Số lượng giống
                                    </span>
                                    <span className="text-xs font-black text-slate-800">
                                      {crop.initialShrimpCount.toLocaleString()}{' '}
                                      <span className="text-[10px] font-bold text-slate-400">con</span>
                                    </span>
                                  </div>

                                  <div className="flex flex-col gap-0.5 pt-2 border-t border-slate-200/50">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                                      <Gauge className="w-3 h-3 text-blue-500" /> Mật độ thả
                                    </span>
                                    <div>
                                      {cropDensity ? (
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold border ${densityBadgeBg}`}>
                                          {cropDensity} con/m²
                                        </span>
                                      ) : (
                                        <span className="text-xs font-semibold text-slate-400">--</span>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                {/* Target & Planning Snippet */}
                                {(crop.targetHarvestSize || crop.targetSurvivalRate || crop.targetTotalFeedKg || crop.expectedHarvestDate) && (
                                  <div className="p-3 bg-gradient-to-r from-blue-50/60 to-indigo-50/50 rounded-2xl border border-blue-100/80 space-y-1.5 text-xs">
                                    <div className="flex items-center justify-between font-bold text-slate-700">
                                      <span className="flex items-center gap-1 text-blue-700 text-xs font-bold">
                                        <Target className="w-3.5 h-3.5 text-blue-600" /> Kế hoạch mục tiêu
                                      </span>
                                      {crop.expectedDurationDays && (
                                        <span className="text-[10px] px-2 py-0.5 rounded-md bg-blue-100/90 text-blue-800 font-bold">
                                          {crop.expectedDurationDays} ngày
                                        </span>
                                      )}
                                    </div>
                                    <div className="grid grid-cols-3 gap-2 text-[11px] pt-1.5 border-t border-blue-100/60 text-slate-600">
                                      <div>
                                        <span className="text-slate-400 block text-[10px]">Size đích</span>
                                        <span className="font-bold text-slate-800">
                                          {crop.targetHarvestSize ? `${crop.targetHarvestSize} con/kg` : '--'}
                                        </span>
                                      </div>
                                      <div>
                                        <span className="text-slate-400 block text-[10px]">Tỷ lệ sống</span>
                                        <span className="font-bold text-emerald-700">
                                          {crop.targetSurvivalRate ? `${crop.targetSurvivalRate}%` : '--'}
                                        </span>
                                      </div>
                                      <div>
                                        <span className="text-slate-400 block text-[10px]">Thức ăn (kg)</span>
                                        <span className="font-bold text-amber-700">
                                          {crop.targetTotalFeedKg ? `${crop.targetTotalFeedKg.toLocaleString()} kg` : '--'}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>

                              {/* Card Footer Actions */}
                              <div className="pt-3 border-t border-slate-100/80 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  {canSplitCrop(crop) && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSplitCropTarget(crop);
                                      }}
                                      className="px-3 py-1.5 bg-gradient-to-r from-purple-50 to-indigo-50 hover:from-purple-100 hover:to-indigo-100 text-purple-700 rounded-xl transition-all text-xs font-black flex items-center gap-1.5 cursor-pointer border border-purple-200/90 shadow-2xs hover:scale-105 hover:shadow-purple-500/10"
                                      title="Tách ao và chuyển sang các ao nuôi thương phẩm"
                                    >
                                      <Sparkles className="w-3.5 h-3.5 text-purple-600" /> Tách ao
                                    </button>
                                  )}

                                  {crop.status === 'ACTIVE' && (
                                    <button
                                      onClick={(e) => handleHarvest(e, crop)}
                                      className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl transition-colors text-xs font-bold flex items-center gap-1 cursor-pointer border border-emerald-200/60"
                                      title="Đóng vụ và ghi nhận đã thu hoạch"
                                    >
                                      <CheckCircle2 className="w-3.5 h-3.5" /> Thu hoạch
                                    </button>
                                  )}
                                </div>

                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => openEditModal(crop)}
                                    className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors cursor-pointer"
                                    title="Chỉnh sửa / Cập nhật mục tiêu"
                                  >
                                    <Edit2 className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={(e) => handleDelete(e, crop.id)}
                                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                                    title="Xóa vụ nuôi"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
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
          ))}
        </div>
      )}

      {/* Create / Edit Modal (Ultra-Professional Spacious Balanced 2-Column) */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 md:p-8 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-5xl xl:max-w-6xl shadow-2xl overflow-hidden border border-slate-200/80 max-h-[90vh] flex flex-col">
            
            {/* ── Header ─────────────────────────────────────────── */}
            <div className="px-7 py-4.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/80 flex-shrink-0">
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20 flex-shrink-0">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-2.5">
                    <h3 className="text-lg font-bold text-slate-800">
                      {editingCropId ? 'Cập Nhật Vụ Nuôi' : 'Tạo Vụ Nuôi Mới'}
                    </h3>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                      formData.stage === 'NURSERY' 
                        ? 'bg-purple-50 text-purple-700 border-purple-200' 
                        : 'bg-blue-50 text-blue-700 border-blue-200'
                    }`}>
                      {formData.stage === 'NURSERY' ? 'Ương Dưỡng' : 'Thương Phẩm'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Cấu hình vị trí ao, số lượng giống và chỉ tiêu kỹ thuật vụ nuôi
                  </p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setShowModal(false)} 
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer"
                title="Đóng"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* ── Form Body (Spacious Perfectly Symmetrical 2-Column Grid) ──────── */}
            <form id="cropForm" onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 sm:p-7 bg-slate-50/40">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
                
                {/* ── CỘT TRÁI: Vị trí ao & Thả giống ────── */}
                <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/80 shadow-2xs space-y-4 flex flex-col justify-between">
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 pb-2.5 border-b border-slate-100">
                      <FileText className="w-4.5 h-4.5 text-blue-600" />
                      <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wide">
                        Vị Trí Ao & Thả Giống
                      </h4>
                    </div>

                    {/* Hàng 1: Trang trại & Ao nuôi */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                          <Building2 className="w-4 h-4 text-slate-400" />
                          Trang trại <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                          <select
                            disabled={!!editingCropId}
                            value={formData.farmId}
                            onChange={(e) => {
                              const newFarmId = e.target.value;
                              const relatedPonds = ponds.filter(p => p.farmId === newFarmId);
                              setFormData({ 
                                ...formData, 
                                farmId: newFarmId, 
                                pondId: relatedPonds.length > 0 ? relatedPonds[0].id : '' 
                              });
                            }}
                            className="w-full bg-slate-50/70 hover:bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-slate-800 outline-none focus:bg-white focus:border-blue-500 appearance-none transition-all cursor-pointer pr-8 disabled:opacity-60"
                          >
                            <option value="" disabled>-- Chọn trang trại --</option>
                            {farms.map((f) => (
                              <option key={f.id} value={f.id}>{f.name}</option>
                            ))}
                          </select>
                          <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        </div>
                        {formErrors.farmId && (
                          <p className="text-xs text-red-600 font-medium mt-1">{formErrors.farmId}</p>
                        )}
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                            <Waves className="w-4 h-4 text-slate-400" />
                            Ao nuôi <span className="text-red-500">*</span>
                          </label>
                          {selectedPond?.areaSize && (
                            <span className="text-xs font-bold text-blue-600">
                              {selectedPond.areaSize.toLocaleString('vi-VN')} m²
                            </span>
                          )}
                        </div>
                        <div className="relative">
                          <select
                            disabled={!!editingCropId || !formData.farmId}
                            value={formData.pondId}
                            onChange={(e) => setFormData({ ...formData, pondId: e.target.value })}
                            className="w-full bg-slate-50/70 hover:bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-slate-800 outline-none focus:bg-white focus:border-blue-500 appearance-none transition-all cursor-pointer pr-8 disabled:opacity-60"
                          >
                            <option value="" disabled>-- Chọn ao nuôi --</option>
                            {formPondsList.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name} {p.areaSize ? `(${p.areaSize.toLocaleString('vi-VN')} m²)` : ''}
                              </option>
                            ))}
                          </select>
                          <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        </div>
                        {formErrors.pondId && (
                          <p className="text-xs text-red-600 font-medium mt-1">{formErrors.pondId}</p>
                        )}
                      </div>
                    </div>

                    {/* Hàng 2: Giai đoạn nuôi */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        Giai đoạn nuôi <span className="text-red-500">*</span>
                      </label>
                      <div className="grid grid-cols-2 gap-2.5 p-1.5 bg-slate-100/80 rounded-xl border border-slate-200/80">
                        <button
                          type="button"
                          onClick={() => {
                            setFormData((prev) => ({
                              ...prev,
                              stage: 'NURSERY',
                              expectedTransferDate: prev.expectedTransferDate || (prev.startDate ? addDaysToDateString(prev.startDate, 25) : ''),
                            }));
                          }}
                          className={`py-2.5 px-3 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                            formData.stage === 'NURSERY'
                              ? 'bg-purple-600 text-white shadow-sm'
                              : 'text-slate-600 hover:text-slate-900 hover:bg-white/70'
                          }`}
                        >
                          <span>🌱</span> Ương Dưỡng
                        </button>
                        
                        <button
                          type="button"
                          onClick={() => {
                            setFormData((prev) => ({
                              ...prev,
                              stage: 'COMMERCIAL',
                              expectedHarvestDate: prev.expectedHarvestDate || (prev.startDate ? addDaysToDateString(prev.startDate, 95) : ''),
                            }));
                          }}
                          className={`py-2.5 px-3 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                            formData.stage === 'COMMERCIAL'
                              ? 'bg-blue-600 text-white shadow-sm'
                              : 'text-slate-600 hover:text-slate-900 hover:bg-white/70'
                          }`}
                        >
                          <span>🦐</span> Thương Phẩm
                        </button>
                      </div>
                    </div>

                    {/* Hàng 3: Ngày thả giống & Trạng thái */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                          <Calendar className="w-4 h-4 text-slate-400" />
                          Ngày thả giống <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="date"
                          value={formData.startDate}
                          onChange={(e) => handleStartDateChange(e.target.value)}
                          className="w-full bg-slate-50/70 hover:bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-slate-800 outline-none focus:bg-white focus:border-blue-500"
                        />
                        {formErrors.startDate && (
                          <p className="text-xs text-red-600 font-medium mt-1">{formErrors.startDate}</p>
                        )}
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                          <ShieldCheck className="w-4 h-4 text-slate-400" />
                          Trạng thái <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                          <select
                            value={formData.status}
                            onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                            className="w-full bg-slate-50/70 hover:bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-slate-800 outline-none focus:bg-white focus:border-blue-500 appearance-none pr-8 cursor-pointer"
                          >
                            <option value="ACTIVE">Đang nuôi</option>
                            <option value="HARVESTED">Đã thu hoạch</option>
                            <option value="FAILED">Thất thu</option>
                          </select>
                          <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        </div>
                      </div>
                    </div>

                    {/* Hàng 4: Số lượng giống thả & Mật độ thả */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 items-end">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                          <Users className="w-4 h-4 text-slate-400" />
                          Số giống thả (con) <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            min="1"
                            step="1"
                            placeholder="100000"
                            value={formData.initialShrimpCount}
                            onChange={(e) => setFormData({ ...formData, initialShrimpCount: e.target.value })}
                            className={`w-full bg-slate-50/70 hover:bg-white border rounded-xl px-3.5 py-2.5 text-sm font-bold text-slate-800 outline-none pr-12 ${
                              formErrors.initialShrimpCount
                                ? 'border-red-400 focus:border-red-500'
                                : 'border-slate-200 focus:bg-white focus:border-blue-500'
                            }`}
                          />
                          <span className="text-xs font-bold text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                            con
                          </span>
                        </div>
                        {formErrors.initialShrimpCount && (
                          <p className="text-xs text-red-600 font-medium mt-1">{formErrors.initialShrimpCount}</p>
                        )}
                      </div>

                      {/* Mật độ thả */}
                      <div className={`p-2.5 rounded-xl border ${densityAssessment.boxBg} ${densityAssessment.borderColor} flex flex-col justify-between h-[58px]`}>
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-slate-600 flex items-center gap-1">
                            <Gauge className="w-3.5 h-3.5 text-slate-400" /> Mật độ:
                          </span>
                          <span className={`px-2 py-0.5 rounded font-bold text-[11px] border ${densityAssessment.badgeBg}`}>
                            {densityAssessment.level === 'SAFE' && 'Tối ưu'}
                            {densityAssessment.level === 'WARNING' && 'Cảnh báo'}
                            {densityAssessment.level === 'DANGER' && 'Báo động'}
                            {densityAssessment.level === 'LOW' && 'Mật độ thấp'}
                            {densityAssessment.level === 'NONE' && '--'}
                          </span>
                        </div>
                        <div className="flex items-baseline justify-between">
                          <span className="text-sm font-black text-slate-800">
                            {densityAssessment.densityFormatted} <span className="text-xs font-normal text-slate-500">con/m²</span>
                          </span>
                          <div className="w-20 h-1.5 rounded-full overflow-hidden bg-slate-200 flex gap-0.5">
                            <div className={`h-full flex-1 ${densityAssessment.level === 'LOW' ? 'bg-sky-500' : 'bg-slate-200'}`} />
                            <div className={`h-full flex-1 ${densityAssessment.level === 'SAFE' ? 'bg-emerald-500' : 'bg-slate-200'}`} />
                            <div className={`h-full flex-1 ${densityAssessment.level === 'WARNING' ? 'bg-amber-500' : 'bg-slate-200'}`} />
                            <div className={`h-full flex-1 ${densityAssessment.level === 'DANGER' ? 'bg-rose-500' : 'bg-slate-200'}`} />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* ── CỘT PHẢI: Chỉ tiêu kỹ thuật & Dự báo ────── */}
                <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/80 shadow-2xs space-y-4 flex flex-col justify-between">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
                      <div className="flex items-center gap-2">
                        <TrendingUp className={`w-4.5 h-4.5 ${formData.stage === 'NURSERY' ? 'text-purple-600' : 'text-emerald-600'}`} />
                        <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wide">
                          Chỉ Tiêu & Dự Báo Kỹ Thuật
                        </h4>
                      </div>
                    </div>

                    {/* Hàng 1: Kích cỡ mục tiêu & Tỷ lệ sống */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                            <Scale className="w-4 h-4 text-slate-400" />
                            Kích cỡ mục tiêu
                          </label>
                          {targetAvgWeightG && (
                            <span className="text-xs font-bold text-emerald-600">
                              ~{targetAvgWeightG} g/con
                            </span>
                          )}
                        </div>
                        <div className="relative">
                          <input
                            type="number"
                            step="0.1"
                            min="0.1"
                            placeholder="30"
                            value={formData.targetHarvestSize}
                            onChange={(e) => setFormData({ ...formData, targetHarvestSize: e.target.value })}
                            className="w-full bg-slate-50/70 hover:bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-bold text-slate-800 outline-none focus:bg-white focus:border-blue-500 pr-14"
                          />
                          <span className="text-xs font-bold text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                            con/kg
                          </span>
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                            <Activity className="w-4 h-4 text-slate-400" />
                            Tỷ lệ sống mục tiêu
                          </label>
                          <span className="text-xs font-bold text-emerald-600">
                            ~{estimatedHarvestCount.toLocaleString('vi-VN')} con
                          </span>
                        </div>
                        <div className="relative">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="0.5"
                            placeholder="85"
                            value={formData.targetSurvivalRate}
                            onChange={(e) => setFormData({ ...formData, targetSurvivalRate: e.target.value })}
                            className="w-full bg-slate-50/70 hover:bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-bold text-slate-800 outline-none focus:bg-white focus:border-blue-500 pr-9"
                          />
                          <span className="text-xs font-bold text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                            %
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Hàng 2: Tổng thức ăn & Ngày kết thúc giai đoạn (Đồng nhất vị trí 100%) */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                            <Utensils className="w-4 h-4 text-slate-400" />
                            Tổng thức ăn (kg)
                          </label>
                          {fcrRating && (
                            <span className={`px-2 py-0.5 text-[11px] rounded-md font-bold border ${fcrRating.color}`}>
                              FCR ~{estimatedFCR}
                            </span>
                          )}
                        </div>
                        <div className="relative">
                          <input
                            type="number"
                            step="10"
                            min="0"
                            placeholder="3400"
                            value={formData.targetTotalFeedKg}
                            onChange={(e) => setFormData({ ...formData, targetTotalFeedKg: e.target.value })}
                            className="w-full bg-slate-50/70 hover:bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-bold text-slate-800 outline-none focus:bg-white focus:border-blue-500 pr-10"
                          />
                          <span className="text-xs font-bold text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                            kg
                          </span>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                          <Calendar className="w-4 h-4 text-slate-400" />
                          {formData.stage === 'NURSERY' ? 'Ngày dự tính tách ao' : 'Ngày thu hoạch dự kiến'} <span className="text-red-500">*</span>
                        </label>
                        {formData.stage === 'NURSERY' ? (
                          <input
                            type="date"
                            value={formData.expectedTransferDate}
                            onChange={(e) => setFormData((prev) => ({ ...prev, expectedTransferDate: e.target.value }))}
                            className={`w-full bg-slate-50/70 hover:bg-white border rounded-xl px-3.5 py-2.5 text-sm font-semibold text-slate-800 outline-none focus:bg-white ${
                              formErrors.expectedTransferDate
                                ? 'border-red-400 focus:border-red-500'
                                : 'border-slate-200 focus:border-purple-500'
                            }`}
                          />
                        ) : (
                          <input
                            type="date"
                            value={formData.expectedHarvestDate}
                            onChange={(e) => handleHarvestDateChange(e.target.value)}
                            className={`w-full bg-slate-50/70 hover:bg-white border rounded-xl px-3.5 py-2.5 text-sm font-semibold text-slate-800 outline-none focus:bg-white ${
                              formErrors.expectedHarvestDate
                                ? 'border-red-400 focus:border-red-500'
                                : 'border-slate-200 focus:border-blue-500'
                            }`}
                          />
                        )}
                        {formData.stage === 'NURSERY' && formErrors.expectedTransferDate && (
                          <p className="text-xs text-red-600 font-medium mt-1">{formErrors.expectedTransferDate}</p>
                        )}
                        {formData.stage === 'COMMERCIAL' && formErrors.expectedHarvestDate && (
                          <p className="text-xs text-red-600 font-medium mt-1">{formErrors.expectedHarvestDate}</p>
                        )}
                      </div>
                    </div>

                    {/* Hàng 3: Chu kỳ (DOC) & Sinh khối */}
                    <div className="grid grid-cols-2 gap-3.5 p-3 bg-slate-50/80 rounded-xl border border-slate-200/80 text-sm">
                      <div>
                        <span className="text-xs text-slate-400 block font-medium">
                          {formData.stage === 'NURSERY' ? 'Chu kỳ ương (DOC)' : 'Chu kỳ nuôi (DOC)'}
                        </span>
                        <span className={`font-bold flex items-center gap-1.5 text-sm mt-0.5 ${formData.stage === 'NURSERY' ? 'text-purple-700' : 'text-blue-700'}`}>
                          <CalendarDays className="w-4 h-4" />
                          {formData.stage === 'NURSERY'
                            ? (calculatedTransferDays > 0 ? `${calculatedTransferDays} ngày` : '--')
                            : (calculatedDurationDays > 0 ? `${calculatedDurationDays} ngày` : '--')}
                        </span>
                      </div>
                      <div>
                        <span className="text-xs text-slate-400 block font-medium">
                          {formData.stage === 'NURSERY' ? 'Sinh khối khi tách' : 'Sinh khối dự kiến'}
                        </span>
                        <span className="font-bold text-slate-800 text-sm mt-0.5 block">
                          {estimatedBiomassKg >= 1000 ? `~${(estimatedBiomassKg / 1000).toFixed(2)} tấn` : `~${estimatedBiomassKg.toLocaleString('vi-VN')} kg`}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Hàng 4: Live Executive Summary Ribbon */}
                  <div className="pt-3 border-t border-slate-100 grid grid-cols-3 gap-3 text-center">
                    <div className="bg-blue-50/80 p-2.5 rounded-xl border border-blue-100">
                      <span className="text-xs text-slate-500 block font-medium">Ước tính thu</span>
                      <span className="font-black text-blue-800 text-sm">~{estimatedHarvestCount.toLocaleString('vi-VN')}</span>
                    </div>
                    <div className="bg-emerald-50/80 p-2.5 rounded-xl border border-emerald-100">
                      <span className="text-xs text-slate-500 block font-medium">Sản lượng</span>
                      <span className="font-black text-emerald-800 text-sm">
                        {estimatedBiomassKg >= 1000 ? `${(estimatedBiomassKg / 1000).toFixed(1)} tấn` : `${estimatedBiomassKg} kg`}
                      </span>
                    </div>
                    <div className="bg-indigo-50/80 p-2.5 rounded-xl border border-indigo-100">
                      <span className="text-xs text-slate-500 block font-medium">FCR mục tiêu</span>
                      <span className="font-black text-indigo-800 text-sm">{estimatedFCR ? `~${estimatedFCR}` : '--'}</span>
                    </div>
                  </div>
                </div>

              </div>
            </form>

            {/* ── Fixed Footer ────────────────────────────────────── */}
            <div className="px-7 py-4 border-t border-slate-100 flex items-center justify-end gap-3 bg-white flex-shrink-0">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                disabled={saving}
                className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-sm transition-colors cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="submit"
                form="cropForm"
                disabled={saving || densityAssessment.isBlocked}
                className={`px-6 py-2.5 text-white font-bold rounded-xl text-sm shadow-md transition-all flex items-center gap-2 cursor-pointer ${
                  densityAssessment.isBlocked
                    ? 'bg-slate-300 cursor-not-allowed shadow-none'
                    : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-blue-500/20'
                }`}
              >
                {saving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Đang lưu...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    {editingCropId ? 'Lưu Thay Đổi' : 'Tạo Vụ Nuôi Mới'}
                  </>
                )}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Harvest Confirmation Modal */}
      {harvestCrop && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl p-6 text-center">
            <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-slate-800 mb-2">Xác nhận thu hoạch</h3>
            <p className="text-slate-500 text-sm mb-6">
              Bạn có chắc chắn muốn đóng vụ nuôi tại{' '}
              <span className="font-semibold text-slate-700">{harvestCrop.pond?.name || 'ao nuôi'}</span>?
              Trạng thái vụ sẽ chuyển thành “Đã thu hoạch”.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setHarvestCrop(null)}
                disabled={harvesting}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl transition-colors text-sm cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                onClick={confirmHarvest}
                disabled={harvesting}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl transition-colors text-sm flex items-center justify-center cursor-pointer"
              >
                {harvesting ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Thu hoạch ngay'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Split Crop Modal */}
      {splitCropTarget && (
        <SplitCropModal
          crop={splitCropTarget}
          allPonds={ponds}
          activeCrops={crops}
          onClose={() => setSplitCropTarget(null)}
          onSuccess={(msg) => {
            showToast(msg, 'success');
            fetchData();
          }}
        />
      )}
    </div>
  );
}
