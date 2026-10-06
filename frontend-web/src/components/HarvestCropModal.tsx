import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  CheckCircle2,
  DollarSign,
  Scale,
  Package,
  Pill,
  FlaskConical,
  TrendingUp,
  Target,
  AlertTriangle,
  FileText,
  Calendar,
  Layers,
  Sparkles,
  Plus,
  Trash2,
  Activity,
  Award,
} from 'lucide-react';
import {
  cropService,
  type Crop,
  type HarvestCropPayload,
  type MaterialUsageItem,
} from '../services/crop.service';

interface HarvestCropModalProps {
  isOpen: boolean;
  crop: Crop;
  onClose: () => void;
  onSuccess: (message: string) => void;
}

const formatVND = (num: number | null | undefined): string => {
  if (num === null || num === undefined || isNaN(num)) return '0';
  return new Intl.NumberFormat('vi-VN').format(Math.round(num));
};

export default function HarvestCropModal({
  isOpen,
  crop,
  onClose,
  onSuccess,
}: HarvestCropModalProps) {
  const [activeTab, setActiveTab] = useState<'inputs' | 'inventory' | 'comparison'>('inputs');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Form Inputs
  const [harvestKg, setHarvestKg] = useState<string>('');
  const [harvestSize, setHarvestSize] = useState<string>('');
  const [pricePerKg, setPricePerKg] = useState<string>('');
  const [harvestDate, setHarvestDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [harvestNote, setHarvestNote] = useState<string>('');

  // Material usage lists (editable)
  const [feedItems, setFeedItems] = useState<MaterialUsageItem[]>([]);
  const [medicineItems, setMedicineItems] = useState<MaterialUsageItem[]>([]);
  const [chemicalItems, setChemicalItems] = useState<MaterialUsageItem[]>([]);
  const [availableInventory, setAvailableInventory] = useState<any[]>([]);

  // Selected item to manually add from farm inventory
  const [showAddMaterial, setShowAddMaterial] = useState(false);
  const [addInvId, setAddInvId] = useState('');
  const [addQty, setAddQty] = useState('');

  // Load harvest summary from backend
  useEffect(() => {
    if (!isOpen || !crop) return;

    let isMounted = true;
    setLoading(true);
    setErrorMsg('');

    // Form inputs: pre-populate if crop already has recorded harvest values, otherwise strictly blank
    setHarvestKg(crop.actualHarvestKg ? crop.actualHarvestKg.toString() : '');
    setHarvestSize(crop.actualHarvestSize ? crop.actualHarvestSize.toString() : '');
    setPricePerKg(crop.actualHarvestPricePerKg ? crop.actualHarvestPricePerKg.toString() : '');
    setHarvestNote(crop.harvestNote || '');
    setHarvestDate(
      crop.actualHarvestDate
        ? new Date(crop.actualHarvestDate).toISOString().slice(0, 10)
        : new Date().toISOString().slice(0, 10)
    );

    cropService
      .getHarvestSummary(crop.id)
      .then((res) => {
        if (!isMounted) return;

        // Set material usage lists
        const feedLogs = res.summary.feedLogs || [];
        const medicineLogs = res.summary.medicineLogs || [];
        const chemicalLogs = res.summary.chemicalLogs || [];

        // If crop was already harvested and had stored costs, but logs are empty:
        if (feedLogs.length === 0 && crop.harvestFeedKg) {
          feedLogs.push({
            inventoryId: 'recorded-feed',
            itemName: 'Thức ăn ghi nhận khi thu hoạch',
            category: 'FEED',
            quantityUsed: crop.harvestFeedKg,
            unit: 'kg',
            unitPrice: crop.harvestFeedCost && crop.harvestFeedKg ? Math.round(crop.harvestFeedCost / crop.harvestFeedKg) : 0,
            totalCost: crop.harvestFeedCost || 0,
          });
        }
        if (medicineLogs.length === 0 && crop.harvestMedicineCost) {
          medicineLogs.push({
            inventoryId: 'recorded-med',
            itemName: 'Thuốc ghi nhận khi thu hoạch',
            category: 'MEDICINE',
            quantityUsed: 1,
            unit: 'khoản',
            unitPrice: crop.harvestMedicineCost,
            totalCost: crop.harvestMedicineCost,
          });
        }
        if (chemicalLogs.length === 0 && crop.harvestChemicalCost) {
          chemicalLogs.push({
            inventoryId: 'recorded-chem',
            itemName: 'Hóa chất ghi nhận khi thu hoạch',
            category: 'CHEMICAL',
            quantityUsed: 1,
            unit: 'khoản',
            unitPrice: crop.harvestChemicalCost,
            totalCost: crop.harvestChemicalCost,
          });
        }

        setFeedItems(feedLogs);
        setMedicineItems(medicineLogs);
        setChemicalItems(chemicalLogs);
        setAvailableInventory(res.summary.availableInventory || []);

        // Re-confirm form values from crop if present
        if (crop.actualHarvestKg) setHarvestKg(crop.actualHarvestKg.toString());
        if (crop.actualHarvestSize) setHarvestSize(crop.actualHarvestSize.toString());
        if (crop.actualHarvestPricePerKg) setPricePerKg(crop.actualHarvestPricePerKg.toString());
        if (crop.harvestNote) setHarvestNote(crop.harvestNote);
        if (crop.actualHarvestDate) {
          setHarvestDate(new Date(crop.actualHarvestDate).toISOString().slice(0, 10));
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        console.error('Failed to load harvest summary:', err);
        setErrorMsg('Không thể tải tự động dữ liệu kho của vụ này: ' + (err.message || 'Lỗi kết nối'));
        // Fallback default feed item if crop had targetTotalFeedKg
        if (crop.targetTotalFeedKg) {
          setFeedItems([
            {
              inventoryId: 'mock-feed',
              itemName: 'Thức ăn hỗn hợp tôm (Ước tính vụ)',
              category: 'FEED',
              quantityUsed: crop.targetTotalFeedKg,
              unit: 'kg',
              unitPrice: 38000,
              totalCost: Math.round(crop.targetTotalFeedKg * 38000),
            },
          ]);
        }
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, crop]);

  // Derived Calculations
  const numKg = parseFloat(harvestKg) || 0;
  const numSize = parseFloat(harvestSize) || 0;
  const numPrice = parseFloat(pricePerKg) || 0;

  // 1. Tấn quy đổi
  const tons = useMemo(() => {
    return (numKg / 1000).toFixed(2);
  }, [numKg]);

  // 2. Trọng lượng bình quân (g/con)
  const avgGramPerShrimp = useMemo(() => {
    if (numSize <= 0) return 0;
    return (1000 / numSize).toFixed(1);
  }, [numSize]);

  // 3. Tổng số con tôm thu hoạch = kg * size
  const totalHarvestShrimpCount = useMemo(() => {
    if (numKg <= 0 || numSize <= 0) return 0;
    return Math.round(numKg * numSize);
  }, [numKg, numSize]);

  // 4. Tỉ lệ sống (%) = (Tổng số con thu / Số giống thả ban đầu) * 100%
  const actualSurvivalRate = useMemo(() => {
    if (crop.initialShrimpCount <= 0 || totalHarvestShrimpCount <= 0) return 0;
    return parseFloat(((totalHarvestShrimpCount / crop.initialShrimpCount) * 100).toFixed(1));
  }, [totalHarvestShrimpCount, crop.initialShrimpCount]);

  // 5. Tổng lượng thức ăn thực tế (kg)
  const totalFeedKgUsed = useMemo(() => {
    const sum = feedItems.reduce((acc, item) => acc + (Number(item.quantityUsed) || 0), 0);
    return Math.round(sum * 100) / 100;
  }, [feedItems]);

  // 6. Hệ số FCR khi thu hoạch = Tổng thức ăn (kg) / Sản lượng thu (kg)
  const actualFcr = useMemo(() => {
    if (numKg <= 0 || totalFeedKgUsed <= 0) return 0;
    return parseFloat((totalFeedKgUsed / numKg).toFixed(2));
  }, [totalFeedKgUsed, numKg]);

  // 7. Chi phí vật tư
  const feedCostTotal = useMemo(() => {
    return feedItems.reduce((acc, item) => acc + (Number(item.totalCost) || 0), 0);
  }, [feedItems]);

  const medicineCostTotal = useMemo(() => {
    return medicineItems.reduce((acc, item) => acc + (Number(item.totalCost) || 0), 0);
  }, [medicineItems]);

  const chemicalCostTotal = useMemo(() => {
    return chemicalItems.reduce((acc, item) => acc + (Number(item.totalCost) || 0), 0);
  }, [chemicalItems]);

  const totalMaterialCost = useMemo(() => {
    return feedCostTotal + medicineCostTotal + chemicalCostTotal;
  }, [feedCostTotal, medicineCostTotal, chemicalCostTotal]);

  // 8. Doanh thu = kg * giá 1kg
  const totalRevenue = useMemo(() => {
    return Math.round(numKg * numPrice);
  }, [numKg, numPrice]);

  // 9. Lợi nhuận = Doanh thu - Tổng chi phí
  const netProfit = useMemo(() => {
    return totalRevenue - totalMaterialCost;
  }, [totalRevenue, totalMaterialCost]);

  // Target comparisons
  const targetShrimpCount = useMemo(() => {
    if (!crop.targetSurvivalRate || !crop.initialShrimpCount) return null;
    return Math.round((crop.initialShrimpCount * crop.targetSurvivalRate) / 100);
  }, [crop]);

  const targetBiomassKg = useMemo(() => {
    if (!targetShrimpCount || !crop.targetHarvestSize) return null;
    return Math.round(targetShrimpCount / crop.targetHarvestSize);
  }, [targetShrimpCount, crop.targetHarvestSize]);

  const targetFcr = useMemo(() => {
    if (!crop.targetTotalFeedKg || !targetBiomassKg || targetBiomassKg <= 0) return null;
    return parseFloat((crop.targetTotalFeedKg / targetBiomassKg).toFixed(2));
  }, [crop.targetTotalFeedKg, targetBiomassKg]);

  // DOC calculate
  const doc = useMemo(() => {
    const start = new Date(crop.startDate).getTime();
    const end = new Date(harvestDate).getTime();
    const diff = Math.floor((end - start) / (1000 * 60 * 60 * 24));
    return diff > 0 ? diff : 1;
  }, [crop.startDate, harvestDate]);

  // Handle adding manual material
  const handleAddMaterial = () => {
    if (!addInvId || !addQty || parseFloat(addQty) <= 0) return;
    const inv = availableInventory.find((i) => i.id === addInvId);
    if (!inv) return;

    const qty = parseFloat(addQty);
    const pkgWeight = Number(inv.weightPerPkg) || 1;
    const pricePerPkg = Number(inv.pricePerPackage) || 0;
    const unitPrice = pkgWeight > 0 ? pricePerPkg / pkgWeight : pricePerPkg;
    const cost = Math.round(qty * unitPrice);

    const newItem: MaterialUsageItem = {
      inventoryId: inv.id,
      itemName: inv.itemName,
      category: inv.category,
      quantityUsed: qty,
      unit: inv.unit || 'đơn vị',
      unitPrice: Math.round(unitPrice),
      totalCost: cost,
    };

    if (inv.category === 'FEED') {
      setFeedItems((prev) => [...prev, newItem]);
    } else if (inv.category === 'MEDICINE') {
      setMedicineItems((prev) => [...prev, newItem]);
    } else {
      setChemicalItems((prev) => [...prev, newItem]);
    }

    setAddInvId('');
    setAddQty('');
    setShowAddMaterial(false);
  };

  // Handle removing a material line
  const handleRemoveMaterial = (category: string, index: number) => {
    if (category === 'FEED') {
      setFeedItems((prev) => prev.filter((_, i) => i !== index));
    } else if (category === 'MEDICINE') {
      setMedicineItems((prev) => prev.filter((_, i) => i !== index));
    } else {
      setChemicalItems((prev) => prev.filter((_, i) => i !== index));
    }
  };

  // Handle submit harvest
  const handleSubmitHarvest = async () => {
    if (numKg <= 0) {
      setErrorMsg('Vui lòng nhập sản lượng thu hoạch lớn hơn 0 kg');
      setActiveTab('inputs');
      return;
    }
    if (numSize <= 0) {
      setErrorMsg('Vui lòng nhập kích cỡ tôm thu hoạch lớn hơn 0 con/kg');
      setActiveTab('inputs');
      return;
    }

    setSubmitting(true);
    setErrorMsg('');

    try {
      const payload: HarvestCropPayload = {
        actualHarvestKg: numKg,
        actualHarvestSize: numSize,
        actualHarvestPricePerKg: numPrice,
        actualHarvestCount: totalHarvestShrimpCount,
        actualHarvestRevenue: totalRevenue,
        actualHarvestCost: totalMaterialCost,
        actualHarvestProfit: netProfit,
        actualHarvestFcr: actualFcr,
        actualHarvestSurvivalRate: actualSurvivalRate,
        harvestFeedCost: feedCostTotal,
        harvestMedicineCost: medicineCostTotal,
        harvestChemicalCost: chemicalCostTotal,
        harvestFeedKg: totalFeedKgUsed,
        actualHarvestDate: new Date(harvestDate).toISOString(),
        harvestNote: harvestNote.trim() || undefined,
      };

      await cropService.harvest(crop.id, payload);
      const isEditing = crop.status === 'HARVESTED' || !!crop.actualHarvestKg;
      onSuccess(
        isEditing
          ? 'Cập nhật số liệu thu hoạch thành công!'
          : 'Thu hoạch vụ nuôi thành công! Dữ liệu đã được lưu vào lịch sử vụ nuôi.'
      );
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Lỗi khi ghi nhận thu hoạch vụ nuôi');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-5 md:p-6 bg-slate-950/75 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl w-full max-w-5xl shadow-2xl border border-slate-200/90 overflow-hidden max-h-[92vh] flex flex-col relative">
        {/* Top Gradient Stripe */}
        <div className="h-1.5 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 shrink-0" />

        {/* Modal Header */}
        <div className="p-4 sm:p-6 pb-4 border-b border-slate-100 flex items-start justify-between gap-4 shrink-0 bg-slate-50/50">
          <div className="flex items-start gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center shadow-lg shadow-emerald-500/20 shrink-0 mt-0.5">
              <Scale className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-black text-slate-800 tracking-tight">
                  {crop.status === 'HARVESTED' || !!crop.actualHarvestKg
                    ? 'Chỉnh Sửa Thông Tin Thu Hoạch'
                    : 'Thu Hoạch Vụ Nuôi & Tổng Kết Vụ'}
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  {crop.pond?.name || 'Ao nuôi'}
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200">
                  {crop.pond?.farm?.name || 'Trang trại'}
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium mt-1">
                Ngày thả: <strong className="text-slate-700">{new Date(crop.startDate).toLocaleDateString('vi-VN')}</strong> •
                Giống thả ban đầu: <strong className="text-blue-600">{crop.initialShrimpCount?.toLocaleString()} con</strong> •
                Thời gian nuôi: <strong className="text-emerald-700">{doc} ngày (DOC)</strong>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200/80 px-6 gap-2 bg-white shrink-0">
          <button
            onClick={() => setActiveTab('inputs')}
            className={`py-3 px-3.5 text-xs font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeTab === 'inputs'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Scale className="w-4 h-4" />
            1. Sản lượng, Size & Tài chính
          </button>
          <button
            onClick={() => setActiveTab('inventory')}
            className={`py-3 px-3.5 text-xs font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeTab === 'inventory'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Package className="w-4 h-4" />
            2. Vật tư kho đã sử dụng ({feedItems.length + medicineItems.length + chemicalItems.length})
          </button>
          <button
            onClick={() => setActiveTab('comparison')}
            className={`py-3 px-3.5 text-xs font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeTab === 'comparison'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Target className="w-4 h-4" />
            3. So sánh với Chỉ tiêu ban đầu
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1">
          {loading && (
            <div className="p-3.5 rounded-2xl bg-blue-50/80 border border-blue-200 text-blue-700 text-xs font-semibold flex items-center gap-2.5">
              <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
              <span>Đang tổng hợp dữ liệu vật tư kho và nhật ký cho ăn của vụ...</span>
            </div>
          )}

          {errorMsg && (
            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* TAB 1: SẢN LƯỢNG & TÀI CHÍNH */}
          {activeTab === 'inputs' && (
            <div className="space-y-6">
              {/* Top Banner Metric Summary */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* Total Shrimp Count */}
                <div className="p-3.5 rounded-2xl bg-blue-50/70 border border-blue-100 flex flex-col justify-between">
                  <span className="text-[11px] font-bold text-blue-800 flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-blue-600" /> Tổng tôm thu được
                  </span>
                  <div className="mt-2">
                    <span className="text-xl font-black text-blue-900">
                      {totalHarvestShrimpCount > 0 ? totalHarvestShrimpCount.toLocaleString() : '--'}
                    </span>{' '}
                    {totalHarvestShrimpCount > 0 && (
                      <span className="text-xs font-semibold text-blue-700">con</span>
                    )}
                  </div>
                  <span className="text-[10px] text-blue-600 font-medium mt-1">
                    {totalHarvestShrimpCount > 0 ? 'Công thức: kg thu × size tôm' : 'Chờ nhập kg và size tôm'}
                  </span>
                </div>

                {/* Survival Rate */}
                <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-100 flex flex-col justify-between">
                  <span className="text-[11px] font-bold text-emerald-800 flex items-center gap-1.5">
                    <Award className="w-3.5 h-3.5 text-emerald-600" /> Tỉ lệ sống thực tế
                  </span>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-xl font-black text-emerald-900">
                      {actualSurvivalRate > 0 ? `${actualSurvivalRate}%` : '--'}
                    </span>
                    {crop.targetSurvivalRate && (
                      <span className="text-[10.5px] font-bold text-slate-500">
                        (Mục tiêu: {crop.targetSurvivalRate}%)
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-emerald-700 font-medium mt-1">
                    Dựa trên {crop.initialShrimpCount?.toLocaleString()} con giống thả
                  </span>
                </div>

                {/* FCR */}
                <div className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-100 flex flex-col justify-between">
                  <span className="text-[11px] font-bold text-amber-800 flex items-center gap-1.5">
                    <TrendingUp className="w-3.5 h-3.5 text-amber-600" /> Hệ số FCR thực tế
                  </span>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-xl font-black text-amber-900">
                      {actualFcr > 0 ? actualFcr.toFixed(2) : '--'}
                    </span>
                    {targetFcr && (
                      <span className="text-[10.5px] font-bold text-slate-500">
                        (Mục tiêu: ~{targetFcr.toFixed(2)})
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-amber-700 font-medium mt-1">
                    {totalFeedKgUsed > 0 ? `${totalFeedKgUsed.toLocaleString()} kg thức ăn đã cho ăn` : 'Chưa có nhật ký thức ăn'}
                  </span>
                </div>

                {/* Net Profit Status */}
                <div
                  className={`p-3.5 rounded-2xl border flex flex-col justify-between ${
                    numKg <= 0 || numPrice <= 0
                      ? 'bg-slate-50 border-slate-200'
                      : netProfit >= 0
                      ? 'bg-gradient-to-br from-emerald-50 to-teal-50/80 border-emerald-200'
                      : 'bg-gradient-to-br from-rose-50 to-red-50/80 border-rose-200'
                  }`}
                >
                  <span
                    className={`text-[11px] font-bold flex items-center gap-1.5 ${
                      numKg <= 0 || numPrice <= 0
                        ? 'text-slate-600'
                        : netProfit >= 0
                        ? 'text-emerald-800'
                        : 'text-rose-800'
                    }`}
                  >
                    <DollarSign className="w-3.5 h-3.5" />
                    {numKg <= 0 || numPrice <= 0
                      ? 'Hiệu quả tài chính'
                      : netProfit >= 0
                      ? 'Vụ này Lời (+)'
                      : 'Vụ này Lỗ (-)'}
                  </span>
                  <div className="mt-2">
                    {numKg > 0 && numPrice > 0 ? (
                      <>
                        <span
                          className={`text-lg font-black ${
                            netProfit >= 0 ? 'text-emerald-700' : 'text-rose-700'
                          }`}
                        >
                          {netProfit >= 0 ? `+${formatVND(netProfit)}` : formatVND(netProfit)}
                        </span>{' '}
                        <span className="text-[11px] font-bold text-slate-600">VNĐ</span>
                      </>
                    ) : (
                      <span className="text-xl font-black text-slate-400">--</span>
                    )}
                  </div>
                  <span className="text-[10px] text-slate-500 font-medium mt-1">
                    {numKg > 0 && numPrice > 0 ? 'Doanh thu − Chi phí vật tư' : 'Chờ nhập sản lượng & giá bán'}
                  </span>
                </div>
              </div>

              {/* Input Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 bg-slate-50/70 p-5 rounded-3xl border border-slate-200/80">
                {/* 1. Sản lượng thu (kg) */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                      <Scale className="w-3.5 h-3.5 text-blue-600" />
                      Số lượng tôm thu được <span className="text-rose-500">*</span>
                    </label>
                    <span className="text-[11px] font-black text-blue-700 bg-blue-100/80 px-2 py-0.5 rounded-md border border-blue-200">
                      {numKg > 0 ? `≈ ${tons} tấn` : '-- tấn'}
                    </span>
                  </div>
                  <div className="relative">
                    <input
                      type="number"
                      step="1"
                      min="1"
                      value={harvestKg}
                      onChange={(e) => setHarvestKg(e.target.value)}
                      placeholder="Nhập số kg tôm thu hoạch..."
                      className="w-full pl-3.5 pr-14 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-black text-slate-800 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all shadow-inner"
                    />
                    <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-black text-slate-400">
                      kg
                    </span>
                  </div>
                  <p className="text-[10.5px] text-slate-500">
                    Sản lượng cân được khi kéo lưới hoặc xả cống thu hoạch
                  </p>
                </div>

                {/* 2. Size tôm (con/kg) */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                      <Layers className="w-3.5 h-3.5 text-emerald-600" />
                      Size tôm thu hoạch <span className="text-rose-500">*</span>
                    </label>
                    <span className="text-[11px] font-black text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-md border border-emerald-200">
                      {numSize > 0 ? `≈ ${avgGramPerShrimp} g / con` : '-- g / con'}
                    </span>
                  </div>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.5"
                      min="1"
                      value={harvestSize}
                      onChange={(e) => setHarvestSize(e.target.value)}
                      placeholder="Nhập kích cỡ tôm (con/kg)..."
                      className="w-full pl-3.5 pr-18 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-black text-slate-800 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all shadow-inner"
                    />
                    <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-black text-slate-400">
                      con/kg
                    </span>
                  </div>
                  <p className="text-[10.5px] text-slate-500">
                    Kích cỡ mẫu cân trung bình của mẻ thu hoạch
                  </p>
                </div>

                {/* 3. Giá bán 1kg tôm (VNĐ/kg) */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                      <DollarSign className="w-3.5 h-3.5 text-amber-600" />
                      Giá tiền 1kg tôm bán được <span className="text-slate-400 font-normal">(VNĐ/kg)</span>
                    </label>
                    <span className="text-[11px] font-black text-amber-700 bg-amber-100/80 px-2 py-0.5 rounded-md border border-amber-200">
                      {numPrice > 0 ? `${formatVND(numPrice)} đ / kg` : '-- đ / kg'}
                    </span>
                  </div>
                  <div className="relative">
                    <input
                      type="number"
                      step="1000"
                      min="0"
                      value={pricePerKg}
                      onChange={(e) => setPricePerKg(e.target.value)}
                      placeholder="Nhập đơn giá bán 1kg (VNĐ)..."
                      className="w-full pl-3.5 pr-14 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-black text-slate-800 outline-none focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 transition-all shadow-inner"
                    />
                    <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-black text-slate-400">
                      VNĐ
                    </span>
                  </div>
                  <p className="text-[10.5px] text-slate-500">
                    Giá thương lái hoặc nhà máy thu mua theo size thực tế
                  </p>
                </div>

                {/* 4. Ngày thu hoạch */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-purple-600" />
                      Ngày thực tế thu hoạch <span className="text-rose-500">*</span>
                    </label>
                    <span className="text-[11px] font-bold text-purple-700">
                      DOC: {doc} ngày
                    </span>
                  </div>
                  <input
                    type="date"
                    value={harvestDate}
                    onChange={(e) => setHarvestDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-800 outline-none focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 transition-all shadow-inner"
                  />
                  <p className="text-[10.5px] text-slate-500">
                    Thời điểm kết thúc vụ nuôi chính thức
                  </p>
                </div>
              </div>

              {/* Financial Breakdown Card */}
              <div className="p-5 rounded-3xl bg-gradient-to-br from-slate-900 to-slate-800 text-white shadow-xl space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-700/80">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                      <DollarSign className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-white">Bảng Tổng Kết Tài Chính Vụ Nuôi</h4>
                      <p className="text-[11px] text-slate-400">
                        Đối chiếu Doanh thu bán tôm và Chi phí vật tư kho đã xuất cho ao
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab('inventory')}
                    className="text-xs font-bold text-cyan-300 hover:text-cyan-200 underline cursor-pointer"
                  >
                    Xem chi tiết vật tư kho →
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
                  {/* Revenue */}
                  <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10">
                    <span className="text-xs text-slate-400 font-medium block">1. Tổng Doanh Thu</span>
                    <span className="text-xl font-black text-emerald-400 mt-1 block">
                      {numKg > 0 && numPrice > 0 ? `${formatVND(totalRevenue)} đ` : '-- đ'}
                    </span>
                    <span className="text-[10.5px] text-slate-400 mt-1 block">
                      {numKg > 0 && numPrice > 0
                        ? `${numKg.toLocaleString()} kg × ${formatVND(numPrice)} đ/kg`
                        : 'Chờ nhập sản lượng & đơn giá'}
                    </span>
                  </div>

                  {/* Expenses */}
                  <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10">
                    <span className="text-xs text-slate-400 font-medium block">2. Tổng Chi Phí Vật Tư</span>
                    <span className="text-xl font-black text-amber-400 mt-1 block">
                      {formatVND(totalMaterialCost)} đ
                    </span>
                    <span className="text-[10.5px] text-slate-400 mt-1 block">
                      Thức ăn + Thuốc + Hóa chất
                    </span>
                  </div>

                  {/* Net Profit */}
                  <div
                    className={`p-3.5 rounded-2xl border ${
                      numKg > 0 && numPrice > 0
                        ? netProfit >= 0
                          ? 'bg-emerald-500/10 border-emerald-500/30'
                          : 'bg-rose-500/10 border-rose-500/30'
                        : 'bg-white/5 border-white/10'
                    }`}
                  >
                    <span className="text-xs text-slate-300 font-medium block">
                      3. Lợi Nhuận Ròng (Lời / Lỗ)
                    </span>
                    <span
                      className={`text-xl font-black mt-1 block ${
                        numKg > 0 && numPrice > 0
                          ? netProfit >= 0
                            ? 'text-emerald-400'
                            : 'text-rose-400'
                          : 'text-slate-400'
                      }`}
                    >
                      {numKg > 0 && numPrice > 0
                        ? `${netProfit >= 0 ? `+${formatVND(netProfit)}` : formatVND(netProfit)} đ`
                        : '-- đ'}
                    </span>
                    <span className="text-[10.5px] text-slate-300 font-medium mt-1 block">
                      {numKg > 0 && numPrice > 0
                        ? netProfit >= 0
                          ? '🎉 Vụ có lãi'
                          : '⚠️ Vụ bị thâm hụt'
                        : 'Chờ đối chiếu doanh thu'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Harvest Note */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-slate-500" /> Ghi chú tổng kết vụ
                </label>
                <textarea
                  rows={2}
                  value={harvestNote}
                  onChange={(e) => setHarvestNote(e.target.value)}
                  placeholder="Nhập nhận xét về chất lượng tôm, thời tiết lúc thu hoạch, đánh giá thương lái..."
                  className="w-full p-3 bg-white border border-slate-200 rounded-2xl text-xs font-medium text-slate-800 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all shadow-inner"
                />
              </div>
            </div>
          )}

          {/* TAB 2: VẬT TƯ KHO ĐÃ SỬ DỤNG */}
          {activeTab === 'inventory' && (
            <div className="space-y-6">
              {/* Warehouse summary banner */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/90 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                    Dữ liệu vật tư xuất kho cho {crop.pond?.name}
                  </h4>
                  <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                    Hệ thống tự động tổng hợp từ Nhật ký cho ăn và Phiếu xuất kho theo ao & chu kỳ nuôi
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-700 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-2xs">
                    Tổng chi phí: <strong className="text-amber-700">{formatVND(totalMaterialCost)} đ</strong>
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowAddMaterial(!showAddMaterial)}
                    className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-xs font-bold flex items-center gap-1 transition-colors border border-blue-200/70 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> Thêm vật tư phát sinh
                  </button>
                </div>
              </div>

              {/* Form to manually add inventory item */}
              {showAddMaterial && (
                <div className="p-4 bg-blue-50/50 rounded-2xl border border-blue-200/80 space-y-3 animate-in fade-in">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-blue-900">
                      Thêm vật tư kho phát sinh vào chi phí vụ
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowAddMaterial(false)}
                      className="text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="text-[11px] font-bold text-slate-600 block mb-1">
                        Chọn vật tư trong kho
                      </label>
                      <select
                        value={addInvId}
                        onChange={(e) => setAddInvId(e.target.value)}
                        className="w-full p-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none"
                      >
                        <option value="">-- Chọn vật phẩm trong kho --</option>
                        {availableInventory.map((item) => (
                          <option key={item.id} value={item.id}>
                            [{item.category}] {item.itemName} ({item.unit}) - {formatVND(item.pricePerPackage)} đ
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-600 block mb-1">
                        Số lượng sử dụng
                      </label>
                      <input
                        type="number"
                        min="0.1"
                        step="0.1"
                        value={addQty}
                        onChange={(e) => setAddQty(e.target.value)}
                        placeholder="Số lượng..."
                        className="w-full p-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none"
                      />
                    </div>
                    <div className="flex items-end">
                      <button
                        type="button"
                        onClick={handleAddMaterial}
                        disabled={!addInvId || !addQty}
                        className="w-full py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer"
                      >
                        + Thêm vào chi phí vụ
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* 1. Feed section */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between pb-1 border-b border-slate-200">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
                      <Package className="w-3.5 h-3.5" />
                    </div>
                    <h5 className="text-xs font-black text-slate-800 uppercase tracking-wide">
                      1. Thức Ăn (Tổng: {totalFeedKgUsed.toLocaleString()} kg)
                    </h5>
                  </div>
                  <span className="text-xs font-black text-blue-700">
                    {formatVND(feedCostTotal)} đ
                  </span>
                </div>

                {feedItems.length === 0 ? (
                  <p className="text-xs text-slate-400 italic py-2">
                    Chưa có nhật ký thức ăn nào được ghi nhận cho vụ này.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="bg-slate-50 text-slate-400 font-bold border-b border-slate-100">
                          <th className="p-2.5">Tên thức ăn</th>
                          <th className="p-2.5 text-right">Số lượng (kg)</th>
                          <th className="p-2.5 text-right">Đơn giá (đ/kg)</th>
                          <th className="p-2.5 text-right">Thành tiền (VNĐ)</th>
                          <th className="p-2.5 text-center w-10"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {feedItems.map((item, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/60">
                            <td className="p-2.5 font-bold text-slate-800">{item.itemName}</td>
                            <td className="p-2.5 text-right font-black text-slate-700">
                              {item.quantityUsed.toLocaleString()} {item.unit}
                            </td>
                            <td className="p-2.5 text-right text-slate-500">
                              {formatVND(item.unitPrice)} đ
                            </td>
                            <td className="p-2.5 text-right font-black text-blue-700">
                              {formatVND(item.totalCost)} đ
                            </td>
                            <td className="p-2.5 text-center">
                              <button
                                type="button"
                                onClick={() => handleRemoveMaterial('FEED', idx)}
                                className="text-slate-300 hover:text-rose-500 p-1"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* 2. Medicine section */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between pb-1 border-b border-slate-200">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center">
                      <Pill className="w-3.5 h-3.5" />
                    </div>
                    <h5 className="text-xs font-black text-slate-800 uppercase tracking-wide">
                      2. Thuốc Thú Y Thủy Sản ({medicineItems.length} loại)
                    </h5>
                  </div>
                  <span className="text-xs font-black text-rose-700">
                    {formatVND(medicineCostTotal)} đ
                  </span>
                </div>

                {medicineItems.length === 0 ? (
                  <p className="text-xs text-slate-400 italic py-2">
                    Không phát sinh chi phí thuốc điều trị cho vụ nuôi này.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="bg-slate-50 text-slate-400 font-bold border-b border-slate-100">
                          <th className="p-2.5">Tên thuốc</th>
                          <th className="p-2.5 text-right">Số lượng</th>
                          <th className="p-2.5 text-right">Đơn giá</th>
                          <th className="p-2.5 text-right">Thành tiền (VNĐ)</th>
                          <th className="p-2.5 text-center w-10"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {medicineItems.map((item, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/60">
                            <td className="p-2.5 font-bold text-slate-800">{item.itemName}</td>
                            <td className="p-2.5 text-right font-black text-slate-700">
                              {item.quantityUsed.toLocaleString()} {item.unit}
                            </td>
                            <td className="p-2.5 text-right text-slate-500">
                              {formatVND(item.unitPrice)} đ
                            </td>
                            <td className="p-2.5 text-right font-black text-rose-700">
                              {formatVND(item.totalCost)} đ
                            </td>
                            <td className="p-2.5 text-center">
                              <button
                                type="button"
                                onClick={() => handleRemoveMaterial('MEDICINE', idx)}
                                className="text-slate-300 hover:text-rose-500 p-1"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* 3. Chemical section */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between pb-1 border-b border-slate-200">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center">
                      <FlaskConical className="w-3.5 h-3.5" />
                    </div>
                    <h5 className="text-xs font-black text-slate-800 uppercase tracking-wide">
                      3. Hóa Chất Xử Lý Môi Trường ({chemicalItems.length} loại)
                    </h5>
                  </div>
                  <span className="text-xs font-black text-purple-700">
                    {formatVND(chemicalCostTotal)} đ
                  </span>
                </div>

                {chemicalItems.length === 0 ? (
                  <p className="text-xs text-slate-400 italic py-2">
                    Không phát sinh chi phí hóa chất cho vụ nuôi này.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="bg-slate-50 text-slate-400 font-bold border-b border-slate-100">
                          <th className="p-2.5">Tên hóa chất</th>
                          <th className="p-2.5 text-right">Số lượng</th>
                          <th className="p-2.5 text-right">Đơn giá</th>
                          <th className="p-2.5 text-right">Thành tiền (VNĐ)</th>
                          <th className="p-2.5 text-center w-10"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {chemicalItems.map((item, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/60">
                            <td className="p-2.5 font-bold text-slate-800">{item.itemName}</td>
                            <td className="p-2.5 text-right font-black text-slate-700">
                              {item.quantityUsed.toLocaleString()} {item.unit}
                            </td>
                            <td className="p-2.5 text-right text-slate-500">
                              {formatVND(item.unitPrice)} đ
                            </td>
                            <td className="p-2.5 text-right font-black text-purple-700">
                              {formatVND(item.totalCost)} đ
                            </td>
                            <td className="p-2.5 text-center">
                              <button
                                type="button"
                                onClick={() => handleRemoveMaterial('CHEMICAL', idx)}
                                className="text-slate-300 hover:text-rose-500 p-1"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: SO SÁNH VỚI CHỈ TIÊU BAN ĐẦU */}
          {activeTab === 'comparison' && (
            <div className="space-y-6">
              <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50/60 rounded-2xl border border-blue-100 flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-black text-blue-900 uppercase tracking-wide">
                    Đối chiếu Chỉ tiêu Kế hoạch vs Thực tế Thu hoạch
                  </h4>
                  <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                    Đánh giá mức độ hoàn thành các chỉ số kỹ thuật và hiệu quả nuôi của Farm Manager
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-white text-blue-700 border border-blue-200 shadow-2xs">
                    Thời gian nuôi: {doc} ngày
                  </span>
                </div>
              </div>

              {/* Comparison Table */}
              <div className="overflow-x-auto rounded-2xl border border-slate-200">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                      <th className="p-3.5">Chỉ tiêu kỹ thuật</th>
                      <th className="p-3.5 text-center">Kế hoạch mục tiêu</th>
                      <th className="p-3.5 text-center">Thực tế thu hoạch</th>
                      <th className="p-3.5 text-center">Chênh lệch / Đánh giá</th>
                      <th className="p-3.5 text-center">Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {/* 1. Size tôm */}
                    <tr className="hover:bg-slate-50/60">
                      <td className="p-3.5">
                        <div className="font-bold text-slate-800">Kích cỡ tôm (Size)</div>
                        <div className="text-[10.5px] text-slate-400">Số con trên 1 kg (con/kg)</div>
                      </td>
                      <td className="p-3.5 text-center font-bold text-slate-700">
                        {crop.targetHarvestSize ? `${crop.targetHarvestSize} con/kg` : '--'}
                      </td>
                      <td className="p-3.5 text-center font-black text-blue-700">
                        {numSize > 0 ? `${numSize} con/kg` : '--'}
                      </td>
                      <td className="p-3.5 text-center font-bold">
                        {crop.targetHarvestSize && numSize > 0 ? (
                          numSize <= crop.targetHarvestSize ? (
                            <span className="text-emerald-600 font-bold">
                              Tôm to hơn mục tiêu (+{(crop.targetHarvestSize - numSize).toFixed(1)} size)
                            </span>
                          ) : (
                            <span className="text-amber-600 font-bold">
                              Tôm nhỏ hơn mục tiêu (-{(numSize - crop.targetHarvestSize).toFixed(1)} size)
                            </span>
                          )
                        ) : (
                          '--'
                        )}
                      </td>
                      <td className="p-3.5 text-center">
                        {crop.targetHarvestSize && numSize > 0 ? (
                          numSize <= crop.targetHarvestSize ? (
                            <span className="inline-flex px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-emerald-100 text-emerald-800">
                              Đạt chuẩn
                            </span>
                          ) : (
                            <span className="inline-flex px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-amber-100 text-amber-800">
                              Chưa đạt
                            </span>
                          )
                        ) : (
                          '--'
                        )}
                      </td>
                    </tr>

                    {/* 2. Tỷ lệ sống */}
                    <tr className="hover:bg-slate-50/60">
                      <td className="p-3.5">
                        <div className="font-bold text-slate-800">Tỷ lệ sống (%)</div>
                        <div className="text-[10.5px] text-slate-400">Tỉ lệ con thu được trên giống thả</div>
                      </td>
                      <td className="p-3.5 text-center font-bold text-slate-700">
                        {crop.targetSurvivalRate ? `${crop.targetSurvivalRate}%` : '--'}
                      </td>
                      <td className="p-3.5 text-center font-black text-emerald-700">
                        {actualSurvivalRate > 0 ? `${actualSurvivalRate}%` : '--'}
                      </td>
                      <td className="p-3.5 text-center font-bold">
                        {crop.targetSurvivalRate && actualSurvivalRate > 0 ? (
                          actualSurvivalRate >= crop.targetSurvivalRate ? (
                            <span className="text-emerald-600">
                              +{ (actualSurvivalRate - crop.targetSurvivalRate).toFixed(1) }% (Vượt chỉ tiêu)
                            </span>
                          ) : (
                            <span className="text-rose-600">
                              -{ (crop.targetSurvivalRate - actualSurvivalRate).toFixed(1) }% (Thấp hơn)
                            </span>
                          )
                        ) : (
                          '--'
                        )}
                      </td>
                      <td className="p-3.5 text-center">
                        {crop.targetSurvivalRate && actualSurvivalRate > 0 ? (
                          actualSurvivalRate >= crop.targetSurvivalRate ? (
                            <span className="inline-flex px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-emerald-100 text-emerald-800">
                              Xuất sắc
                            </span>
                          ) : (
                            <span className="inline-flex px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-rose-100 text-rose-800">
                              Hụt chỉ tiêu
                            </span>
                          )
                        ) : (
                          '--'
                        )}
                      </td>
                    </tr>

                    {/* 3. Sản lượng thu hoạch */}
                    <tr className="hover:bg-slate-50/60">
                      <td className="p-3.5">
                        <div className="font-bold text-slate-800">Sản lượng sinh khối</div>
                        <div className="text-[10.5px] text-slate-400">Tổng trọng lượng tôm thu hoạch</div>
                      </td>
                      <td className="p-3.5 text-center font-bold text-slate-700">
                        {targetBiomassKg ? (
                          <>
                            {targetBiomassKg.toLocaleString()} kg{' '}
                            <span className="text-[10.5px] text-slate-400">
                              (~{(targetBiomassKg / 1000).toFixed(2)} tấn)
                            </span>
                          </>
                        ) : (
                          '--'
                        )}
                      </td>
                      <td className="p-3.5 text-center font-black text-blue-700">
                        {numKg > 0 ? (
                          <>
                            {numKg.toLocaleString()} kg{' '}
                            <span className="text-[10.5px] text-slate-500">(~{tons} tấn)</span>
                          </>
                        ) : (
                          '--'
                        )}
                      </td>
                      <td className="p-3.5 text-center font-bold">
                        {targetBiomassKg && numKg > 0 ? (
                          numKg >= targetBiomassKg ? (
                            <span className="text-emerald-600">
                              +{(numKg - targetBiomassKg).toLocaleString()} kg (+
                              {(((numKg - targetBiomassKg) / targetBiomassKg) * 100).toFixed(1)}%)
                            </span>
                          ) : (
                            <span className="text-amber-600">
                              -{(targetBiomassKg - numKg).toLocaleString()} kg (-
                              {(((targetBiomassKg - numKg) / targetBiomassKg) * 100).toFixed(1)}%)
                            </span>
                          )
                        ) : (
                          '--'
                        )}
                      </td>
                      <td className="p-3.5 text-center">
                        {targetBiomassKg && numKg > 0 ? (
                          numKg >= targetBiomassKg ? (
                            <span className="inline-flex px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-emerald-100 text-emerald-800">
                              Vượt kế hoạch
                            </span>
                          ) : (
                            <span className="inline-flex px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-amber-100 text-amber-800">
                              Cần cải thiện
                            </span>
                          )
                        ) : (
                          '--'
                        )}
                      </td>
                    </tr>

                    {/* 4. Tổng thức ăn */}
                    <tr className="hover:bg-slate-50/60">
                      <td className="p-3.5">
                        <div className="font-bold text-slate-800">Tổng lượng thức ăn (kg)</div>
                        <div className="text-[10.5px] text-slate-400">Thực phẩm đã cho ăn toàn vụ</div>
                      </td>
                      <td className="p-3.5 text-center font-bold text-slate-700">
                        {crop.targetTotalFeedKg ? `${crop.targetTotalFeedKg.toLocaleString()} kg` : '--'}
                      </td>
                      <td className="p-3.5 text-center font-black text-amber-700">
                        {totalFeedKgUsed > 0 ? `${totalFeedKgUsed.toLocaleString()} kg` : '--'}
                      </td>
                      <td className="p-3.5 text-center font-bold">
                        {crop.targetTotalFeedKg && totalFeedKgUsed > 0 ? (
                          totalFeedKgUsed <= crop.targetTotalFeedKg ? (
                            <span className="text-emerald-600">
                              Tiết kiệm {(crop.targetTotalFeedKg - totalFeedKgUsed).toLocaleString()} kg
                            </span>
                          ) : (
                            <span className="text-rose-600">
                              Bội chi {(totalFeedKgUsed - crop.targetTotalFeedKg).toLocaleString()} kg
                            </span>
                          )
                        ) : (
                          '--'
                        )}
                      </td>
                      <td className="p-3.5 text-center">
                        {crop.targetTotalFeedKg && totalFeedKgUsed > 0 ? (
                          totalFeedKgUsed <= crop.targetTotalFeedKg ? (
                            <span className="inline-flex px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-emerald-100 text-emerald-800">
                              Tốt
                            </span>
                          ) : (
                            <span className="inline-flex px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-amber-100 text-amber-800">
                              Vượt định mức
                            </span>
                          )
                        ) : (
                          '--'
                        )}
                      </td>
                    </tr>

                    {/* 5. Hệ số FCR */}
                    <tr className="hover:bg-slate-50/60">
                      <td className="p-3.5">
                        <div className="font-bold text-slate-800">Hệ số chuyển đổi thức ăn (FCR)</div>
                        <div className="text-[10.5px] text-slate-400">FCR càng thấp hiệu quả kinh tế càng cao</div>
                      </td>
                      <td className="p-3.5 text-center font-bold text-slate-700">
                        {targetFcr ? `~${targetFcr.toFixed(2)}` : '--'}
                      </td>
                      <td className="p-3.5 text-center font-black text-purple-700">
                        {actualFcr > 0 ? actualFcr.toFixed(2) : '--'}
                      </td>
                      <td className="p-3.5 text-center font-bold">
                        {targetFcr && actualFcr > 0 ? (
                          actualFcr <= targetFcr ? (
                            <span className="text-emerald-600">
                              Tốt hơn {(targetFcr - actualFcr).toFixed(2)}
                            </span>
                          ) : (
                            <span className="text-rose-600">
                              Cao hơn {(actualFcr - targetFcr).toFixed(2)}
                            </span>
                          )
                        ) : (
                          '--'
                        )}
                      </td>
                      <td className="p-3.5 text-center">
                        {targetFcr && actualFcr > 0 ? (
                          actualFcr <= targetFcr ? (
                            <span className="inline-flex px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-emerald-100 text-emerald-800">
                              Tối ưu
                            </span>
                          ) : (
                            <span className="inline-flex px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-rose-100 text-rose-800">
                              Kém hiệu quả
                            </span>
                          )
                        ) : (
                          '--'
                        )}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Assessment card */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
                <div className="text-xs text-slate-700 leading-relaxed">
                  <span className="font-bold text-slate-800">Tổng kết đánh giá vụ nuôi:</span>{' '}
                  {actualSurvivalRate >= 70 && actualFcr <= 1.5 ? (
                    <span>
                      Vụ nuôi đạt kết quả xuất sắc với tỷ lệ sống cao ({actualSurvivalRate}%) và hệ số FCR tối ưu ({actualFcr.toFixed(2)}). Mô hình kiểm soát môi trường và thức ăn hiệu quả cao.
                    </span>
                  ) : actualSurvivalRate >= 60 ? (
                    <span>
                      Vụ nuôi đạt mức khá. Tỷ lệ sống đạt {actualSurvivalRate}%, FCR ở mức {actualFcr.toFixed(2)}. Cần chú ý giảm hao hụt thức ăn ở các mốc ngày nuôi sau ngày 60.
                    </span>
                  ) : (
                    <span>
                      Vụ nuôi gặp một số biến động làm suy giảm tỷ lệ sống ({actualSurvivalRate}%). Cần rà soát lại chỉ số nước và dịch bệnh để rút kinh nghiệm cho vụ kế tiếp.
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:p-5 border-t border-slate-200/80 bg-slate-50/70 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-500 font-medium text-center sm:text-left">
            {crop.status === 'HARVESTED' || !!crop.actualHarvestKg ? (
              <span>Dữ liệu sản lượng, kích cỡ, doanh thu và FCR sẽ được cập nhật lại vào lịch sử vụ nuôi.</span>
            ) : (
              <span>Khi xác nhận, vụ nuôi sẽ chuyển sang trạng thái <strong>“Đã thu hoạch”</strong> và lưu vào lịch sử.</span>
            )}
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
            >
              Hủy bỏ
            </button>
            <button
              type="button"
              onClick={handleSubmitHarvest}
              disabled={submitting || numKg <= 0 || numSize <= 0 || numPrice <= 0}
              title={
                numKg <= 0 || numSize <= 0 || numPrice <= 0
                  ? 'Vui lòng nhập đầy đủ Số lượng tôm, Size tôm và Giá bán 1kg để xác nhận'
                  : crop.status === 'HARVESTED' || !!crop.actualHarvestKg
                  ? 'Lưu lại các thay đổi của thông tin thu hoạch'
                  : 'Xác nhận thu hoạch và lưu lịch sử'
              }
              className="flex-1 sm:flex-initial px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-black flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/25 transition-all hover:-translate-y-0.5 cursor-pointer"
            >
              {submitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Đang ghi nhận...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  {crop.status === 'HARVESTED' || !!crop.actualHarvestKg
                    ? 'Cập Nhật Thu Hoạch'
                    : 'Xác Nhận Thu Hoạch'}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
