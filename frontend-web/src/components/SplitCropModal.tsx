import React, { useState, useMemo } from 'react';
import {
  X,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Sparkles,
  Scale,
  Gauge,
  ShieldCheck,
  Waves,
} from 'lucide-react';
import {
  cropService,
  type Crop,
  type SplitCropPayload,
} from '../services/crop.service';

interface Pond {
  id: string;
  name: string;
  areaSize?: number;
  depth?: number;
  farmId: string;
}

interface SplitDestinationForm {
  pondId: string;
  shrimpCount: string;
  targetHarvestSize: string;
  targetSurvivalRate: string;
  targetTotalFeedKg: string;
  expectedHarvestDate: string;
  expectedDurationDays: string;
}

interface SplitCropModalProps {
  crop: Crop;
  allPonds: Pond[];
  activeCrops: Crop[];
  onClose: () => void;
  onSuccess: (message: string) => void;
}

export default function SplitCropModal({
  crop,
  allPonds,
  activeCrops,
  onClose,
  onSuccess,
}: SplitCropModalProps) {
  const farmId = crop.pond?.farmId;

  // Danh sách tất cả ao thuộc trang trại
  const farmPonds = useMemo(() => {
    return allPonds.filter((p) => p.farmId === farmId);
  }, [allPonds, farmId]);

  // Ao ương hiện tại
  const currentNurseryPond = useMemo(() => {
    return (
      farmPonds.find((p) => p.id === crop.pondId) ||
      (crop.pond ? { ...crop.pond, farmId: farmId || '' } : null)
    );
  }, [farmPonds, crop.pondId, crop.pond, farmId]);

  // ID các ao đang bận nuôi vụ khác
  const busyPondIdMap = useMemo(() => {
    const map = new Map<string, Crop>();
    activeCrops
      .filter((c) => c.status === 'ACTIVE' && c.id !== crop.id)
      .forEach((c) => {
        map.set(c.pondId, c);
      });
    return map;
  }, [activeCrops, crop.id]);

  // Các ao trống khác trong trang trại
  const otherEmptyPonds = useMemo(() => {
    return farmPonds.filter(
      (p) => p.id !== crop.pondId && !busyPondIdMap.has(p.id),
    );
  }, [farmPonds, crop.pondId, busyPondIdMap]);

  // Các ao đang bận
  const busyPonds = useMemo(() => {
    return farmPonds.filter((p) => p.id !== crop.pondId && busyPondIdMap.has(p.id));
  }, [farmPonds, crop.pondId, busyPondIdMap]);

  // Tất cả các ao có thể nhận tôm (Ao ương hiện tại + Các ao trống)
  const availablePonds = useMemo(() => {
    const list: (Pond & { isCurrentNursery?: boolean })[] = [];
    if (currentNurseryPond) {
      list.push({ ...currentNurseryPond, isCurrentNursery: true });
    }
    otherEmptyPonds.forEach((p) => {
      list.push({ ...p, isCurrentNursery: false });
    });
    return list;
  }, [currentNurseryPond, otherEmptyPonds]);

  // Form State
  const [transferDate, setTransferDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [actualHarvestCount, setActualHarvestCount] = useState<string>(
    String(Math.round(crop.initialShrimpCount * 0.9)),
  );
  const [transferSize, setTransferSize] = useState<string>('1000');
  const [splitNote, setSplitNote] = useState<string>('');

  // Initial destination rows
  const [destinations, setDestinations] = useState<SplitDestinationForm[]>(() => {
    const initialPond = currentNurseryPond?.id || otherEmptyPonds[0]?.id || '';
    return [
      {
        pondId: initialPond,
        shrimpCount: String(Math.round(crop.initialShrimpCount * 0.9)),
        targetHarvestSize: '30',
        targetSurvivalRate: '85',
        targetTotalFeedKg: '3200',
        expectedHarvestDate: '',
        expectedDurationDays: '75',
      },
    ];
  });

  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Tính toán nghiệm thu
  const actualHarvestNumber = parseFloat(actualHarvestCount) || 0;
  const initialShrimpCount = crop.initialShrimpCount || 0;

  const survivalRatePercent = useMemo(() => {
    if (initialShrimpCount <= 0 || actualHarvestNumber <= 0) return 0;
    return Number(((actualHarvestNumber / initialShrimpCount) * 100).toFixed(1));
  }, [initialShrimpCount, actualHarvestNumber]);

  const mortalityCount = useMemo(() => {
    const diff = initialShrimpCount - actualHarvestNumber;
    return diff > 0 ? diff : 0;
  }, [initialShrimpCount, actualHarvestNumber]);

  // Tính tổng tôm đã phân bổ
  const totalAllocated = useMemo(() => {
    return destinations.reduce((sum, d) => sum + (parseFloat(d.shrimpCount) || 0), 0);
  }, [destinations]);

  const remainingShrimp = actualHarvestNumber - totalAllocated;
  const isAllocationBalanced = remainingShrimp === 0 && actualHarvestNumber > 0;
  const isAllocationExceeded = remainingShrimp < 0;

  // Thêm ao nhận tôm
  const handleAddDestination = (preferredPondId?: string) => {
    const selectedPondIds = new Set(destinations.map((d) => d.pondId));
    let nextPondId = preferredPondId || '';

    if (!nextPondId) {
      const nextAvail = availablePonds.find((p) => !selectedPondIds.has(p.id));
      nextPondId = nextAvail?.id || '';
    }

    const defaultCount = remainingShrimp > 0 ? String(remainingShrimp) : '0';

    setDestinations((prev) => [
      ...prev,
      {
        pondId: nextPondId,
        shrimpCount: defaultCount,
        targetHarvestSize: '30',
        targetSurvivalRate: '85',
        targetTotalFeedKg: '3000',
        expectedHarvestDate: '',
        expectedDurationDays: '75',
      },
    ]);
  };

  // Xóa ao nhận tôm
  const handleRemoveDestination = (index: number) => {
    if (destinations.length <= 1) return;
    setDestinations((prev) => prev.filter((_, i) => i !== index));
  };

  // Sửa thông tin ao nhận
  const handleDestinationChange = (
    index: number,
    field: keyof SplitDestinationForm,
    value: string,
  ) => {
    setDestinations((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)),
    );
  };

  // Tính DOC
  const nurseryDoc = useMemo(() => {
    if (!crop.startDate) return 0;
    const start = new Date(crop.startDate);
    const now = new Date(transferDate || new Date());
    const diff = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    return diff >= 0 ? diff : 0;
  }, [crop.startDate, transferDate]);

  // Validation
  const validateForm = (): string | null => {
    if (!transferDate) return 'Vui lòng chọn ngày tách ao.';
    if (actualHarvestNumber <= 0) return 'Số tôm thu được phải lớn hơn 0.';
    if (actualHarvestNumber > initialShrimpCount) {
      return `Số tôm thu (${actualHarvestNumber.toLocaleString()}) vượt quá số giống ban đầu (${initialShrimpCount.toLocaleString()}).`;
    }

    if (destinations.length === 0) return 'Cần ít nhất 1 ao nhận tôm.';

    const selectedIds = new Set<string>();
    for (let i = 0; i < destinations.length; i++) {
      const d = destinations[i];
      if (!d.pondId) return `Chưa chọn ao cho dòng #${i + 1}.`;
      if (selectedIds.has(d.pondId)) {
        const pondObj = allPonds.find((p) => p.id === d.pondId);
        return `Ao "${pondObj?.name || d.pondId}" bị chọn trùng lặp.`;
      }
      selectedIds.add(d.pondId);

      const count = parseFloat(d.shrimpCount);
      if (isNaN(count) || count <= 0) {
        return `Số tôm ao #${i + 1} phải lớn hơn 0.`;
      }
    }

    if (remainingShrimp !== 0) {
      if (remainingShrimp > 0) {
        return `Còn dư ${remainingShrimp.toLocaleString()} con chưa phân bổ.`;
      } else {
        return `Tổng tôm phân bổ vượt quá ${Math.abs(remainingShrimp).toLocaleString()} con.`;
      }
    }

    return null;
  };

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const error = validateForm();
    if (error) {
      setErrorMessage(error);
      return;
    }

    setSubmitting(true);
    try {
      const payload: SplitCropPayload = {
        transferDate,
        actualNurseryHarvest: Math.round(actualHarvestNumber),
        transferSize: transferSize ? parseFloat(transferSize) : undefined,
        splitNote: splitNote.trim() || undefined,
        destinations: destinations.map((d) => {
          let expectedHarvestDate: string | undefined = undefined;
          if (d.expectedHarvestDate) {
            expectedHarvestDate = d.expectedHarvestDate;
          } else if (d.expectedDurationDays && parseInt(d.expectedDurationDays) > 0) {
            const hDate = new Date(transferDate);
            hDate.setDate(hDate.getDate() + parseInt(d.expectedDurationDays));
            expectedHarvestDate = hDate.toISOString().slice(0, 10);
          }

          return {
            pondId: d.pondId,
            shrimpCount: Math.round(parseFloat(d.shrimpCount)),
            targetHarvestSize: d.targetHarvestSize ? parseFloat(d.targetHarvestSize) : undefined,
            targetSurvivalRate: d.targetSurvivalRate ? parseFloat(d.targetSurvivalRate) : undefined,
            targetTotalFeedKg: d.targetTotalFeedKg ? parseFloat(d.targetTotalFeedKg) : undefined,
            expectedHarvestDate,
            expectedDurationDays: d.expectedDurationDays ? parseInt(d.expectedDurationDays) : undefined,
          };
        }),
      };

      const result = await cropService.split(crop.id, payload);
      onSuccess(result.message || 'Tách ao thành công!');
      onClose();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Lỗi khi tách ao.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 md:p-8 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-4xl lg:max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-purple-600 text-white flex items-center justify-center shadow-md shadow-purple-500/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-slate-800">
                  Tách Ao Nuôi
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-700">
                  {crop.pond?.name}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Nghiệm thu ao ương và san sẻ tôm sang các ao nuôi thương phẩm
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Error Banner */}
          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 flex items-center gap-2 text-rose-800 text-xs font-medium">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Quick Info Ao Ương */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200/80 text-xs">
            <div>
              <span className="text-[11px] text-slate-400 block">Ao ương</span>
              <span className="font-bold text-slate-700 flex items-center gap-1">
                <Waves className="w-3.5 h-3.5 text-purple-600" />
                {crop.pond?.name}
              </span>
            </div>
            <div>
              <span className="text-[11px] text-slate-400 block">Thời gian ương</span>
              <span className="font-bold text-purple-700">Ngày {nurseryDoc} (DOC)</span>
            </div>
            <div>
              <span className="text-[11px] text-slate-400 block">Giống thả ban đầu</span>
              <span className="font-bold text-slate-800">{crop.initialShrimpCount.toLocaleString()} con</span>
            </div>
            <div>
              <span className="text-[11px] text-slate-400 block">Diện tích ao</span>
              <span className="font-bold text-slate-700">{crop.pond?.areaSize ? `${crop.pond.areaSize.toLocaleString()} m²` : '--'}</span>
            </div>
          </div>

          {/* 1. NGHIỆM THU */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-full bg-purple-600 text-white text-[10px] font-bold flex items-center justify-center">1</span>
                Nghiệm thu ao ương
              </span>

              {/* Tỷ lệ sống Badge */}
              <div className="flex items-center gap-1.5 text-xs">
                <ShieldCheck className="w-3.5 h-3.5 text-purple-600" />
                <span className="text-slate-500 text-[11px]">Tỷ lệ sống:</span>
                <span className={`font-black ${survivalRatePercent >= 80 ? 'text-emerald-600' : survivalRatePercent >= 65 ? 'text-amber-600' : 'text-rose-600'}`}>
                  {survivalRatePercent}%
                </span>
                <span className="text-[10px] text-slate-400">(-{mortalityCount.toLocaleString()} con)</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Ngày tách <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Calendar className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="date"
                    value={transferDate}
                    onChange={(e) => setTransferDate(e.target.value)}
                    required
                    className="w-full pl-8 pr-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:bg-white focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Tôm thu thực tế (con) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  max={initialShrimpCount}
                  value={actualHarvestCount}
                  onChange={(e) => setActualHarvestCount(e.target.value)}
                  required
                  placeholder="VD: 90000"
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-purple-700 focus:bg-white focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Kích cỡ tách (con/kg)
                </label>
                <div className="relative">
                  <Scale className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="number"
                    min="1"
                    value={transferSize}
                    onChange={(e) => setTransferSize(e.target.value)}
                    placeholder="VD: 1000"
                    className="w-full pl-8 pr-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:bg-white focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* 2. PHÂN BỔ AO THƯƠNG PHẨM */}
          <div className="space-y-3 pt-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center">2</span>
                Phân bổ ao nhận tôm
              </span>

              <div className="flex items-center gap-2">
                <span className="text-[11px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md font-semibold border border-emerald-200">
                  {availablePonds.length} ao sẵn sàng
                </span>
                {busyPonds.length > 0 && (
                  <span className="text-[11px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                    {busyPonds.length} ao đang nuôi
                  </span>
                )}
              </div>
            </div>

            {/* Quick-Pick Pond Chips */}
            <div className="flex flex-wrap items-center gap-1.5 p-2 bg-slate-50/80 rounded-xl border border-slate-200/70 text-xs">
              <span className="text-[11px] text-slate-400 font-medium mr-1">Ao khả dụng:</span>
              {availablePonds.map((p) => {
                const isSelected = destinations.some((d) => d.pondId === p.id);
                const isCurrent = p.id === crop.pondId;

                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      if (!isSelected) handleAddDestination(p.id);
                    }}
                    disabled={isSelected}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1 cursor-pointer ${
                      isSelected
                        ? 'bg-blue-600 text-white shadow-2xs cursor-default'
                        : isCurrent
                        ? 'bg-purple-100 text-purple-800 hover:bg-purple-200 border border-purple-200'
                        : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                    }`}
                  >
                    {isCurrent ? '⭐' : ''} {p.name}
                    <span className="text-[10px] opacity-75 font-normal">
                      ({p.areaSize ? `${p.areaSize}m²` : '--'})
                    </span>
                    {isSelected && <CheckCircle2 className="w-3 h-3 ml-0.5" />}
                  </button>
                );
              })}
            </div>

            {/* Destination Rows */}
            <div className="space-y-2.5">
              {destinations.map((dest, index) => {
                const currentPond = allPonds.find((p) => p.id === dest.pondId);
                const pondArea = currentPond?.areaSize || 0;
                const count = parseFloat(dest.shrimpCount) || 0;
                const density = pondArea > 0 ? (count / pondArea).toFixed(1) : '0';
                const densityNum = parseFloat(density);
                const isCurrent = dest.pondId === crop.pondId;

                return (
                  <div
                    key={index}
                    className={`p-3 rounded-xl bg-white border transition-all space-y-2.5 ${
                      isCurrent
                        ? 'border-purple-200 bg-purple-50/20'
                        : 'border-slate-200 hover:border-blue-200'
                    }`}
                  >
                    {/* Top Row: Select Pond + Remove Button */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-1">
                        <span className="w-5 h-5 rounded-md bg-blue-100 text-blue-800 font-bold text-[11px] flex items-center justify-center">
                          #{index + 1}
                        </span>
                        
                        <div className="flex-1 max-w-xs">
                          <select
                            value={dest.pondId}
                            onChange={(e) =>
                              handleDestinationChange(index, 'pondId', e.target.value)
                            }
                            required
                            className="w-full px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:bg-white focus:outline-none focus:border-blue-500"
                          >
                            <option value="">-- Chọn ao nhận --</option>
                            
                            {currentNurseryPond && (
                              <option value={currentNurseryPond.id}>
                                ⭐ {currentNurseryPond.name} ({currentNurseryPond.areaSize || '--'} m²) [Giữ lại nuôi tiếp]
                              </option>
                            )}

                            {otherEmptyPonds.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name} ({p.areaSize || '--'} m²) [Ao trống]
                              </option>
                            ))}

                            {busyPonds.map((p) => (
                              <option key={p.id} value={p.id} disabled>
                                🚫 {p.name} (Đang bận)
                              </option>
                            ))}
                          </select>
                        </div>

                        {isCurrent && (
                          <span className="text-[10px] font-bold text-purple-700 bg-purple-100 px-2 py-0.5 rounded">
                            Ao ương chuyển đổi
                          </span>
                        )}
                      </div>

                      {destinations.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveDestination(index)}
                          className="text-slate-400 hover:text-rose-600 p-1 rounded-md hover:bg-rose-50 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {/* Inputs Row */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                          Số tôm (con) <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={dest.shrimpCount}
                          onChange={(e) =>
                            handleDestinationChange(index, 'shrimpCount', e.target.value)
                          }
                          required
                          placeholder="VD: 45000"
                          className="w-full px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-blue-700 focus:bg-white focus:outline-none focus:border-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                          Mật độ dự kiến
                        </label>
                        <div className="flex items-center h-[29px]">
                          {pondArea > 0 && count > 0 ? (
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-bold rounded border ${
                                densityNum > 250
                                  ? 'bg-rose-50 text-rose-700 border-rose-200'
                                  : densityNum > 150
                                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                                  : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              }`}
                            >
                              <Gauge className="w-3 h-3" />
                              {density} con/m²
                            </span>
                          ) : (
                            <span className="text-[11px] text-slate-400">--</span>
                          )}
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                          Target (con/kg)
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={dest.targetHarvestSize}
                          onChange={(e) =>
                            handleDestinationChange(index, 'targetHarvestSize', e.target.value)
                          }
                          placeholder="VD: 30"
                          className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                          Nuôi dự kiến (ngày)
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={dest.expectedDurationDays}
                          onChange={(e) =>
                            handleDestinationChange(index, 'expectedDurationDays', e.target.value)
                          }
                          placeholder="VD: 75"
                          className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Note */}
            <div>
              <input
                type="text"
                value={splitNote}
                onChange={(e) => setSplitNote(e.target.value)}
                placeholder="Ghi chú tách ao (tùy chọn)..."
                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:bg-white focus:outline-none focus:border-purple-500"
              />
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200/80 bg-slate-50/80 flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Progress */}
          <div className="w-full sm:w-auto flex-1 space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-600 font-medium">
                Đã chia:{' '}
                <strong className="text-slate-900 font-bold">{totalAllocated.toLocaleString()}</strong>
                {' / '}{actualHarvestNumber.toLocaleString()} con
              </span>
              <span
                className={`font-bold text-xs ${
                  isAllocationBalanced
                    ? 'text-emerald-600 flex items-center gap-1'
                    : isAllocationExceeded
                    ? 'text-rose-600'
                    : 'text-amber-600'
                }`}
              >
                {isAllocationBalanced
                  ? 'Đạt 100%'
                  : isAllocationExceeded
                  ? `Vượt: ${Math.abs(remainingShrimp).toLocaleString()} con`
                  : `Còn: ${remainingShrimp.toLocaleString()} con`}
              </span>
            </div>

            <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden">
              <div
                className={`h-full transition-all duration-300 rounded-full ${
                  isAllocationBalanced
                    ? 'bg-emerald-500'
                    : isAllocationExceeded
                    ? 'bg-rose-500'
                    : 'bg-amber-500'
                }`}
                style={{
                  width: `${
                    actualHarvestNumber > 0
                      ? Math.min(100, (totalAllocated / actualHarvestNumber) * 100)
                      : 0
                  }%`,
                }}
              />
            </div>
          </div>

          {/* Buttons */}
          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting || !isAllocationBalanced || availablePonds.length === 0}
              className="px-5 py-2.5 text-sm font-bold bg-purple-600 hover:bg-purple-700 text-white rounded-xl shadow-sm transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Đang xử lý...' : 'Xác nhận tách ao'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
