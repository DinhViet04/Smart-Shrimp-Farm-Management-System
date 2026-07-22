import { useState, useEffect, useMemo } from 'react';
import {
  CheckCircle2,
  AlertCircle,
  Loader2,
  ChevronDown,
  Utensils,
  Clock,
  Layers,
  Check,
  Ban,
  Sliders,
  Sparkles,
  ToggleLeft,
  ToggleRight,
  Calculator,
  Copy,
} from 'lucide-react';
import { farmService } from '../../services/farm.service';
import { pondService } from '../../services/pond.service';
import { cropService } from '../../services/crop.service';
import {
  feedingLogService,
  DEFAULT_FEEDING_SESSIONS,
  FEEDING_SESSION_PRESETS,
  type FeedingSession,
  type FeedingMethod,
  type FeedingStatus,
  type SingleSessionPayload,
} from '../../services/feeding-log.service';

interface Farm { id: string; name: string; }
interface Pond { id: string; name: string; farmId: string; }
interface Crop { id: string; pondId: string; startDate: string; status: string; }
interface FeedProduct {
  id: string;
  itemName: string;
  quantity: number;
  unit: string;
  packageQty?: number | null;
  packageType?: string | null;
  weightPerPkg?: number | null;
}

interface ToastProps {
  message: string;
  type: 'success' | 'error';
}

function Toast({ message, type }: ToastProps) {
  return (
    <div
      className={`fixed top-6 right-6 z-[100] flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-xl border text-sm font-semibold animate-in slide-in-from-right-8 fade-in duration-300 ${
        type === 'success'
          ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
          : 'bg-red-50 border-red-200 text-red-800'
      }`}
    >
      {type === 'success' ? (
        <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
      ) : (
        <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
      )}
      <span>{message}</span>
    </div>
  );
}

export default function CreateFeedingLog() {
  const [farms, setFarms] = useState<Farm[]>([]);
  const [ponds, setPonds] = useState<Pond[]>([]);
  const [crops, setCrops] = useState<Crop[]>([]);
  const [feedProducts, setFeedProducts] = useState<FeedProduct[]>([]);

  const [selectedFarmId, setSelectedFarmId] = useState('');
  const [selectedPondId, setSelectedPondId] = useState('');
  const [selectedCropId, setSelectedCropId] = useState('');
  const [feedingDate, setFeedingDate] = useState<string>(() => {
    return new Date().toISOString().slice(0, 10);
  });

  // Session Preset State ('7_SESSIONS' is default)
  const [selectedPresetId, setSelectedPresetId] = useState<string>('7_SESSIONS');

  // Active state map for each of the 7 sessions
  const [activeSessions, setActiveSessions] = useState<Record<FeedingSession, boolean>>(() => {
    const map: any = {};
    DEFAULT_FEEDING_SESSIONS.forEach((item) => {
      map[item.session] = true;
    });
    return map;
  });

  // Batch action state: Total daily feed kg for auto-distribution
  const [batchTotalFeedKg, setBatchTotalFeedKg] = useState<string>('');
  const [batchFeedProductId, setBatchFeedProductId] = useState<string>('');

  // 7 Session data states
  const [sessionData, setSessionData] = useState<Record<FeedingSession, SingleSessionPayload>>(() => {
    const init: any = {};
    DEFAULT_FEEDING_SESSIONS.forEach((item) => {
      init[item.session] = {
        feedingSession: item.session,
        feedingTime: item.defaultTime,
        feedProductId: '',
        feedAmount: 0,
        feedingMethod: 'MANUAL' as FeedingMethod,
        feedingStatus: 'COMPLETED' as FeedingStatus,
        note: '',
      };
    });
    return init;
  });

  const [loadingData, setLoadingData] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<ToastProps | null>(null);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // 1. Initial Load
  useEffect(() => {
    const loadInit = async () => {
      try {
        setLoadingData(true);
        const [fList, pList, cList] = await Promise.all([
          farmService.getAll(),
          pondService.getAll(),
          cropService.getAll(),
        ]);
        setFarms(fList);
        setPonds(pList);
        setCrops(cList);
        if (fList.length > 0) setSelectedFarmId(fList[0].id);
      } catch (err) {
        console.error('Error loading initial data:', err);
      } finally {
        setLoadingData(false);
      }
    };
    loadInit();
  }, []);

  // Format product option string with quantity & package info
  const formatProductLabel = (p: FeedProduct) => {
    const stockInfo = p.packageQty !== null && p.packageQty !== undefined && p.packageQty > 0
      ? `Tồn: ${Math.round(p.quantity * 100) / 100} ${p.unit} (${Math.ceil(p.packageQty)} ${p.packageType || 'bao'})`
      : `Tồn: ${Math.round(p.quantity * 100) / 100} ${p.unit}`;
    const outStr = p.quantity <= 0 ? ' - [HẾT HÀNG]' : '';
    return `${p.itemName} (${stockInfo})${outStr}`;
  };

  // 2. Fetch Feed Products when Farm changes
  const loadProducts = async () => {
    if (!selectedFarmId) {
      setFeedProducts([]);
      return;
    }
    try {
      const prods = await feedingLogService.getFeedProducts(selectedFarmId);
      setFeedProducts(prods);
      if (prods.length > 0) {
        setBatchFeedProductId((prev) => prev || prods[0].id);
        setSessionData((prev) => {
          const next = { ...prev };
          DEFAULT_FEEDING_SESSIONS.forEach((s) => {
            if (!next[s.session].feedProductId) {
              next[s.session] = { ...next[s.session], feedProductId: prods[0].id };
            }
          });
          return next;
        });
      }
    } catch (err) {
      console.error('Error loading feed products:', err);
    }
  };

  useEffect(() => {
    loadProducts();
  }, [selectedFarmId]);

  // Derived Ponds & Active Crops
  const filteredPonds = useMemo(() => {
    return ponds.filter((p) => p.farmId === selectedFarmId);
  }, [ponds, selectedFarmId]);

  const activeCrops = useMemo(() => {
    return crops.filter((c) => c.pondId === selectedPondId && c.status === 'ACTIVE');
  }, [crops, selectedPondId]);

  // Auto select first pond when filteredPonds changes
  useEffect(() => {
    if (filteredPonds.length > 0 && (!selectedPondId || !filteredPonds.some((p) => p.id === selectedPondId))) {
      setSelectedPondId(filteredPonds[0].id);
    }
  }, [filteredPonds, selectedPondId]);

  // Auto select active crop when pond changes
  useEffect(() => {
    if (activeCrops.length > 0) {
      setSelectedCropId(activeCrops[0].id);
    } else {
      setSelectedCropId('');
    }
  }, [activeCrops]);

  // Handler: Apply Preset (e.g. 2, 3, 4, 5, 6, 7 sessions)
  const applyPreset = (presetId: string) => {
    setSelectedPresetId(presetId);
    const preset = FEEDING_SESSION_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;

    // Update active map
    const nextActiveMap: Record<FeedingSession, boolean> = {
      SESSION_1: false,
      SESSION_2: false,
      SESSION_3: false,
      SESSION_4: false,
      SESSION_5: false,
      SESSION_6: false,
      SESSION_7: false,
    };

    preset.activeSessions.forEach((s) => {
      nextActiveMap[s] = true;
    });

    setActiveSessions(nextActiveMap);

    // Update session times & status for inactive ones
    setSessionData((prev) => {
      const next = { ...prev };
      DEFAULT_FEEDING_SESSIONS.forEach((item) => {
        const sKey = item.session;
        const isActive = nextActiveMap[sKey];
        next[sKey] = {
          ...next[sKey],
          feedingTime: preset.times[sKey] || item.defaultTime,
          feedingStatus: isActive ? 'COMPLETED' : 'SKIPPED',
          feedAmount: isActive ? next[sKey].feedAmount : 0,
        };
      });
      return next;
    });
  };

  // Toggle single session active status
  const toggleSessionActive = (session: FeedingSession) => {
    setSelectedPresetId('CUSTOM');
    setActiveSessions((prev) => {
      const isCurrentlyActive = prev[session];
      const nextActive = !isCurrentlyActive;

      // Update session status & amount accordingly
      setSessionData((sdPrev) => ({
        ...sdPrev,
        [session]: {
          ...sdPrev[session],
          feedingStatus: nextActive ? 'COMPLETED' : 'SKIPPED',
          feedAmount: nextActive ? sdPrev[session].feedAmount : 0,
        },
      }));

      return {
        ...prev,
        [session]: nextActive,
      };
    });
  };

  // Handle Session Data Change
  const updateSession = (session: FeedingSession, key: keyof SingleSessionPayload, val: any) => {
    setSessionData((prev) => {
      const current = prev[session];
      let updated = { ...current, [key]: val };

      // Business Rule: If SKIPPED, amount MUST equal 0
      if (key === 'feedingStatus' && val === 'SKIPPED') {
        updated.feedAmount = 0;
      }

      return {
        ...prev,
        [session]: updated,
      };
    });
  };

  // ── BATCH TOOLS ──
  // 1. Batch apply selected feed product to all ACTIVE sessions
  const batchApplyFeedProduct = () => {
    if (!batchFeedProductId) return showToast('Vui lòng chọn sản phẩm thức ăn trước', 'error');
    setSessionData((prev) => {
      const next = { ...prev };
      DEFAULT_FEEDING_SESSIONS.forEach((item) => {
        if (activeSessions[item.session]) {
          next[item.session] = { ...next[item.session], feedProductId: batchFeedProductId };
        }
      });
      return next;
    });
    showToast('Đã áp dụng mã thức ăn cho tất cả các cử đang bật!', 'success');
  };

  // 2. Batch distribute total daily feed kg evenly across ACTIVE sessions
  const batchDistributeFeedAmount = () => {
    const total = parseFloat(batchTotalFeedKg);
    if (isNaN(total) || total <= 0) {
      return showToast('Vui lòng nhập tổng lượng thức ăn hợp lệ (> 0 kg)', 'error');
    }

    const activeList = DEFAULT_FEEDING_SESSIONS.filter((item) => activeSessions[item.session]);
    if (activeList.length === 0) {
      return showToast('Không có cử nào đang bật để chia thức ăn', 'error');
    }

    const perSession = parseFloat((total / activeList.length).toFixed(2));

    setSessionData((prev) => {
      const next = { ...prev };
      activeList.forEach((item) => {
        next[item.session] = {
          ...next[item.session],
          feedAmount: perSession,
          feedingStatus: next[item.session].feedingStatus === 'SKIPPED' ? 'COMPLETED' : next[item.session].feedingStatus,
        };
      });
      return next;
    });

    showToast(`Đã chia đều ${total} kg cho ${activeList.length} cử đang bật (${perSession} kg/cử)!`, 'success');
  };

  // 3. Mark all active sessions COMPLETED
  const batchMarkAllCompleted = () => {
    setSessionData((prev) => {
      const next = { ...prev };
      DEFAULT_FEEDING_SESSIONS.forEach((item) => {
        if (activeSessions[item.session]) {
          next[item.session] = { ...next[item.session], feedingStatus: 'COMPLETED' };
        }
      });
      return next;
    });
    showToast('Đã đánh dấu HOÀN THÀNH cho tất cả cử đang bật!', 'success');
  };

  // Calculated Live Summary
  const summary = useMemo(() => {
    let totalFeedKg = 0;
    let completed = 0;
    let skipped = 0;
    let delayed = 0;
    let activeCount = 0;

    DEFAULT_FEEDING_SESSIONS.forEach((item) => {
      const sKey = item.session;
      const s = sessionData[sKey];
      const isActive = activeSessions[sKey];

      if (isActive) activeCount++;

      const amt = Number(s.feedAmount) || 0;
      if (s.feedingStatus !== 'SKIPPED' && isActive) {
        totalFeedKg += amt;
      }
      if (s.feedingStatus === 'COMPLETED' && isActive) completed++;
      if (s.feedingStatus === 'SKIPPED' || !isActive) skipped++;
      if (s.feedingStatus === 'DELAYED' && isActive) delayed++;
    });

    return { totalFeedKg, completed, skipped, delayed, activeCount };
  }, [sessionData, activeSessions]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedFarmId) return showToast('Vui lòng chọn trang trại', 'error');
    if (!selectedPondId) return showToast('Vui lòng chọn ao nuôi', 'error');
    if (!selectedCropId) return showToast('Không tìm thấy vụ nuôi ĐANG HOẠT ĐỘNG (ACTIVE) cho ao này. Hãy mở/tạo vụ nuôi mới trước!', 'error');
    if (!feedingDate) return showToast('Vui lòng chọn ngày cho ăn', 'error');
    if (feedProducts.length === 0) return showToast('Kho trang trại chưa có sản phẩm thức ăn nào. Vui lòng thêm thức ăn trong Kho vật tư trước!', 'error');

    // Build payload array for ALL 7 sessions so DB unique constraints pass
    const defaultProductFallback = feedProducts[0].id;

    const sessionList: SingleSessionPayload[] = DEFAULT_FEEDING_SESSIONS.map((item) => {
      const sKey = item.session;
      const s = sessionData[sKey];
      const isActive = activeSessions[sKey];

      return {
        feedingSession: sKey,
        feedingTime: s.feedingTime || item.defaultTime,
        feedProductId: s.feedProductId || defaultProductFallback,
        feedAmount: isActive && s.feedingStatus !== 'SKIPPED' ? Number(s.feedAmount) || 0 : 0,
        feedingMethod: s.feedingMethod || 'MANUAL',
        feedingStatus: isActive ? s.feedingStatus : 'SKIPPED',
        note: s.note?.trim() || undefined,
      };
    });

    // Check that every active session has a selected feed product
    for (const s of sessionList) {
      if (activeSessions[s.feedingSession] && s.feedingStatus !== 'SKIPPED') {
        if (!s.feedProductId) {
          return showToast(`Vui lòng chọn sản phẩm thức ăn cho cử ${s.feedingSession.replace('SESSION_', '')}`, 'error');
        }
      }
    }

    try {
      setSaving(true);
      await feedingLogService.createDailyLog({
        farmId: selectedFarmId,
        pondId: selectedPondId,
        cropId: selectedCropId,
        feedingDate,
        sessions: sessionList,
      });

      showToast('Ghi nhận nhật ký cho ăn và trừ kho thành công!', 'success');
      await loadProducts();
    } catch (err: any) {
      showToast(err.message || 'Không thể ghi nhận nhật ký cho ăn', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loadingData) {
    return (
      <div className="flex items-center justify-center h-80">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-slate-200 border-t-emerald-600 rounded-full animate-spin" />
          <p className="text-sm font-medium text-slate-500">Đang tải dữ liệu trang trại...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1050px] mx-auto relative pb-20">
      {toast && <Toast message={toast.message} type={toast.type} />}

      <form onSubmit={handleSubmit} noValidate>
        {/* ── Page Header ──────────────────────────────────────────────── */}
        <div className="flex items-center gap-5 bg-white/90 backdrop-blur-xl px-6 py-5 rounded-3xl shadow-xl shadow-emerald-900/5 border border-white/60 mb-6">
          <div className="w-14 h-14 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/30 flex-shrink-0">
            <Utensils className="w-7 h-7 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-black bg-clip-text text-transparent bg-gradient-to-r from-emerald-800 to-teal-600 tracking-tight">
              Ghi Nhận Nhật Ký Cho Ăn Hàng Ngày
            </h2>
            <p className="text-sm text-slate-500 font-medium mt-0.5">
              Tùy chỉnh linh hoạt số cử cho ăn trong ngày (2, 3, 4, 5, 6, 7 cử) theo đúng quy trình nuôi thực tế của ao
            </p>
          </div>
        </div>

        {/* ── Section 1: Location & Date Selection ────────────────────── */}
        <div className="bg-white/90 backdrop-blur-lg rounded-3xl border border-white/60 shadow-lg shadow-slate-200/40 p-6 mb-6">
          <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-black">1</span>
            Vị Trí & Ngày Cho Ăn
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Farm select */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase">
                Trang trại <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <select
                  value={selectedFarmId}
                  onChange={(e) => {
                    setSelectedFarmId(e.target.value);
                    setSelectedPondId('');
                    setSelectedCropId('');
                  }}
                  className="w-full px-4 py-2.5 pr-10 rounded-xl border border-slate-200 bg-slate-50/50 text-sm font-semibold text-slate-800 appearance-none outline-none hover:bg-white hover:border-slate-300 focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/20 transition-all cursor-pointer"
                >
                  <option value="">-- Chọn trang trại --</option>
                  {farms.map((f) => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              </div>
            </div>

            {/* Pond select */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase">
                Ao nuôi <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <select
                  value={selectedPondId}
                  onChange={(e) => setSelectedPondId(e.target.value)}
                  disabled={!selectedFarmId}
                  className={`w-full px-4 py-2.5 pr-10 rounded-xl border text-sm font-semibold appearance-none outline-none transition-all cursor-pointer ${
                    selectedFarmId
                      ? 'border-slate-200 bg-slate-50/50 text-slate-800 hover:bg-white hover:border-slate-300 focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/20'
                      : 'border-slate-100 bg-slate-50 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  <option value="">{selectedFarmId ? '-- Chọn ao nuôi --' : '-- Chọn trang trại trước --'}</option>
                  {filteredPonds.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              </div>
            </div>

            {/* Crop Select (Active only) */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase">
                Vụ nuôi hoạt động <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <select
                  value={selectedCropId}
                  onChange={(e) => setSelectedCropId(e.target.value)}
                  disabled={!selectedPondId || activeCrops.length === 0}
                  className={`w-full px-4 py-2.5 pr-10 rounded-xl border text-sm font-semibold appearance-none outline-none transition-all cursor-pointer ${
                    selectedPondId && activeCrops.length > 0
                      ? 'border-emerald-300 bg-emerald-50/30 text-emerald-900 hover:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/20'
                      : 'border-slate-100 bg-slate-50 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  {activeCrops.length === 0 ? (
                    <option value="">Không có vụ ACTIVE</option>
                  ) : (
                    activeCrops.map((c) => (
                      <option key={c.id} value={c.id}>
                        Vụ nuôi ngày thả {new Date(c.startDate).toLocaleDateString('vi-VN')}
                      </option>
                    ))
                  )}
                </select>
                <Layers className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              </div>
            </div>

            {/* Date picker */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase">
                Ngày cho ăn <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={feedingDate}
                  onChange={(e) => setFeedingDate(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 text-sm font-semibold text-slate-800 outline-none hover:bg-white hover:border-slate-300 focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/20 transition-all"
                />
              </div>
            </div>
          </div>
        </div>

        {/* ── Section 2: Session Presets & Batch Actions Toolbar ───────── */}
        <div className="bg-white/90 backdrop-blur-lg rounded-3xl border border-white/60 shadow-lg shadow-slate-200/40 p-6 mb-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
            <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-black">2</span>
              Chọn Nhanh Số Cử Cho Ăn
            </h3>
            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" /> Đang bật {summary.activeCount}/7 cử cho ăn
            </span>
          </div>

          {/* Preset Buttons Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2.5 mb-5">
            {FEEDING_SESSION_PRESETS.map((preset) => {
              const isSelected = selectedPresetId === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => applyPreset(preset.id)}
                  className={`py-2.5 px-3 rounded-2xl text-xs font-extrabold transition-all border flex flex-col items-center justify-center gap-1 ${
                    isSelected
                      ? 'bg-gradient-to-br from-emerald-600 to-teal-600 text-white border-emerald-600 shadow-md shadow-emerald-500/25 scale-[1.02]'
                      : 'bg-slate-50/70 border-slate-200 text-slate-600 hover:bg-white hover:border-slate-300'
                  }`}
                >
                  <span>{preset.name}</span>
                </button>
              );
            })}
          </div>

          {/* Batch Tools Bar */}
          <div className="bg-slate-50/80 p-4 rounded-2xl border border-slate-200/70 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-600 uppercase tracking-wider">
              <Sliders className="w-3.5 h-3.5 text-emerald-600" /> Công cụ hỗ trợ nhập liệu nhanh (Batch Tools)
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Batch Apply Product */}
              <div className="flex items-center gap-2 bg-white p-2.5 rounded-xl border border-slate-200">
                <select
                  value={batchFeedProductId}
                  onChange={(e) => setBatchFeedProductId(e.target.value)}
                  className="flex-1 px-2 py-1 text-xs font-semibold text-slate-700 bg-transparent border-none outline-none"
                >
                  <option value="">-- Thức ăn mẫu --</option>
                  {feedProducts.map((p) => (
                    <option key={p.id} value={p.id}>
                      {formatProductLabel(p)}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={batchApplyFeedProduct}
                  className="px-3 py-1.5 rounded-lg bg-emerald-100 hover:bg-emerald-200 text-emerald-800 text-xs font-bold transition-all flex items-center gap-1 flex-shrink-0"
                  title="Áp dụng mã thức ăn này cho tất cả cử đang bật"
                >
                  <Copy className="w-3 h-3" /> Gán tất cả cử
                </button>
              </div>

              {/* Batch Distribute Total Feed Amount */}
              <div className="flex items-center gap-2 bg-white p-2.5 rounded-xl border border-slate-200">
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  value={batchTotalFeedKg}
                  onChange={(e) => setBatchTotalFeedKg(e.target.value)}
                  placeholder="Tổng kg thức ăn..."
                  className="flex-1 w-20 px-2 py-1 text-xs font-bold text-slate-800 outline-none placeholder:font-normal placeholder:text-slate-400"
                />
                <button
                  type="button"
                  onClick={batchDistributeFeedAmount}
                  className="px-3 py-1.5 rounded-lg bg-teal-100 hover:bg-teal-200 text-teal-800 text-xs font-bold transition-all flex items-center gap-1 flex-shrink-0"
                  title="Chia đều lượng thức ăn cho các cử đang bật"
                >
                  <Calculator className="w-3 h-3" /> Chia đều {summary.activeCount} cử
                </button>
              </div>

              {/* Batch Mark All Completed */}
              <div className="flex items-center justify-end">
                <button
                  type="button"
                  onClick={batchMarkAllCompleted}
                  className="w-full py-2.5 px-4 rounded-xl bg-white hover:bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-sm"
                >
                  <Check className="w-3.5 h-3.5 text-emerald-600" /> Đánh dấu Hoàn thành tất cả cử đang bật
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ── Section 3: Detailed Cards for 7 Sessions ─────────────────── */}
        <div className="mb-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-black">3</span>
              Chi Tiết Các Cử Cho Ăn
            </h3>
            {feedProducts.length === 0 && selectedFarmId && (
              <span className="text-xs text-amber-600 font-bold bg-amber-50 px-3 py-1 rounded-lg border border-amber-200 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" /> Chưa có sản phẩm Thức ăn trong kho của trang trại này!
              </span>
            )}
          </div>

          {/* Timeline Bar */}
          <div className="bg-white/80 backdrop-blur-md p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between overflow-x-auto gap-2">
            {DEFAULT_FEEDING_SESSIONS.map((defItem) => {
              const sKey = defItem.session;
              const isActive = activeSessions[sKey];
              const s = sessionData[sKey];

              return (
                <button
                  key={sKey}
                  type="button"
                  onClick={() => toggleSessionActive(sKey)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all border flex-shrink-0 ${
                    !isActive
                      ? 'bg-slate-100 border-slate-200 text-slate-400 opacity-60'
                      : s.feedingStatus === 'COMPLETED'
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      : s.feedingStatus === 'DELAYED'
                      ? 'bg-amber-50 border-amber-200 text-amber-800'
                      : 'bg-slate-100 border-slate-200 text-slate-600'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${!isActive ? 'bg-slate-300' : s.feedingStatus === 'COMPLETED' ? 'bg-emerald-500' : s.feedingStatus === 'DELAYED' ? 'bg-amber-400' : 'bg-slate-400'}`} />
                  <span>Cử {sKey.replace('SESSION_', '')}</span>
                  <span className="text-[10px] font-normal text-slate-400">({s.feedingTime})</span>
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {DEFAULT_FEEDING_SESSIONS.map((defItem) => {
              const sKey = defItem.session;
              const isActive = activeSessions[sKey];
              const s = sessionData[sKey];

              return (
                <div
                  key={sKey}
                  className={`bg-white/90 backdrop-blur-md rounded-2xl border p-5 transition-all duration-200 ${
                    !isActive
                      ? 'border-slate-200 bg-slate-50/50 opacity-60'
                      : s.feedingStatus === 'SKIPPED'
                      ? 'border-slate-200 bg-slate-50/70'
                      : s.feedingStatus === 'DELAYED'
                      ? 'border-amber-200 bg-amber-50/20'
                      : 'border-white/80 shadow-md shadow-slate-200/40 hover:shadow-lg hover:border-emerald-200'
                  }`}
                >
                  {/* Header row with ON/OFF Toggle */}
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                    <div className="flex items-center gap-2.5">
                      <button
                        type="button"
                        onClick={() => toggleSessionActive(sKey)}
                        className="text-slate-400 hover:text-emerald-600 transition-colors focus:outline-none"
                        title={isActive ? 'Tắt cử này' : 'Bật cử này'}
                      >
                        {isActive ? (
                          <ToggleRight className="w-7 h-7 text-emerald-600" />
                        ) : (
                          <ToggleLeft className="w-7 h-7 text-slate-300" />
                        )}
                      </button>

                      <div className="flex items-center gap-2">
                        <span className={`w-7 h-7 rounded-xl flex items-center justify-center font-black text-xs ${isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-500'}`}>
                          {sKey.replace('SESSION_', '')}
                        </span>
                        <h4 className={`text-sm font-bold ${isActive ? 'text-slate-800' : 'text-slate-400 line-through'}`}>
                          {defItem.label}
                        </h4>
                      </div>
                    </div>

                    {/* Time Input */}
                    <input
                      type="time"
                      disabled={!isActive}
                      value={s.feedingTime}
                      onChange={(e) => updateSession(sKey, 'feedingTime', e.target.value)}
                      className={`px-2.5 py-1.5 rounded-xl border text-xs font-bold outline-none transition-all ${
                        isActive
                          ? 'border-slate-200 bg-slate-50 text-slate-800 focus:bg-white focus:border-emerald-500'
                          : 'border-slate-100 bg-slate-100 text-slate-400 cursor-not-allowed'
                      }`}
                    />
                  </div>

                  {/* Form fields */}
                  {isActive ? (
                    <div className="space-y-3">
                      {/* Row 1: Status Buttons & Feed Amount */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 items-center">
                        <div className="sm:col-span-2 flex items-center gap-1.5">
                          {(['COMPLETED', 'DELAYED', 'SKIPPED'] as FeedingStatus[]).map((st) => (
                            <button
                              key={st}
                              type="button"
                              onClick={() => updateSession(sKey, 'feedingStatus', st)}
                              className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-extrabold transition-all border flex items-center justify-center gap-1 ${
                                s.feedingStatus === st
                                  ? st === 'COMPLETED'
                                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-600/20'
                                    : st === 'DELAYED'
                                    ? 'bg-amber-500 text-white border-amber-500 shadow-md shadow-amber-500/20'
                                    : 'bg-slate-700 text-white border-slate-700 shadow-md shadow-slate-700/20'
                                  : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-white'
                              }`}
                            >
                              {st === 'COMPLETED' && <Check className="w-3.5 h-3.5" />}
                              {st === 'SKIPPED' && <Ban className="w-3 h-3" />}
                              {st === 'COMPLETED' ? 'Hoàn thành' : st === 'DELAYED' ? 'Trễ cử' : 'Bỏ cử'}
                            </button>
                          ))}
                        </div>

                        {(() => {
                          const selectedProd = feedProducts.find((p) => p.id === s.feedProductId);
                          const isExcess = selectedProd && s.feedAmount > selectedProd.quantity && s.feedingStatus !== 'SKIPPED';

                          return (
                            <div className="relative">
                              <input
                                type="number"
                                step="0.1"
                                min="0"
                                disabled={s.feedingStatus === 'SKIPPED'}
                                value={s.feedAmount}
                                onChange={(e) => updateSession(sKey, 'feedAmount', e.target.value)}
                                placeholder="0.0"
                                className={`w-full px-3 py-1.5 pr-8 rounded-xl border text-xs font-extrabold outline-none transition-all ${
                                  s.feedingStatus === 'SKIPPED'
                                    ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                                    : isExcess
                                    ? 'bg-red-50 text-red-900 border-red-300 focus:border-red-500'
                                    : 'bg-slate-50 text-slate-900 border-slate-200 hover:bg-white focus:border-emerald-500'
                                }`}
                              />
                              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-extrabold text-slate-400 pointer-events-none">
                                kg
                              </span>
                            </div>
                          );
                        })()}
                      </div>

                      {/* Stock Warning if excess */}
                      {(() => {
                        const selectedProd = feedProducts.find((p) => p.id === s.feedProductId);
                        const isExcess = selectedProd && s.feedAmount > selectedProd.quantity && s.feedingStatus !== 'SKIPPED';

                        if (!isExcess) return null;
                        return (
                          <p className="text-[11px] text-red-600 font-bold flex items-center gap-1">
                            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" /> Cảnh báo: Lượng ăn ({s.feedAmount} kg) vượt tồn kho ({selectedProd.quantity} kg)!
                          </p>
                        );
                      })()}

                      {/* Row 2: Feed Product & Note */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <select
                          value={s.feedProductId}
                          onChange={(e) => updateSession(sKey, 'feedProductId', e.target.value)}
                          className="w-full px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-700 outline-none hover:bg-white focus:border-emerald-500"
                        >
                          <option value="">-- Chọn thức ăn --</option>
                          {feedProducts.map((p) => (
                            <option key={p.id} value={p.id}>
                              {formatProductLabel(p)}
                            </option>
                          ))}
                        </select>

                        <input
                          type="text"
                          maxLength={500}
                          value={s.note || ''}
                          onChange={(e) => updateSession(sKey, 'note', e.target.value)}
                          placeholder="Ghi chú cử ăn (tùy chọn)..."
                          className="w-full px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-medium text-slate-700 outline-none hover:bg-white focus:border-emerald-500 placeholder:text-slate-400"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="py-2 text-center text-xs font-semibold text-slate-400 bg-slate-100/60 rounded-xl border border-dashed border-slate-200">
                      Cử này hiện đang TẮT (Không cho ăn). Click nút công tắc để bật lại cử này.
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Summary & Actions Sticky Footer ─────────────────────────── */}
        <div className="sticky bottom-4 z-40 bg-slate-900/90 backdrop-blur-xl text-white rounded-3xl p-5 shadow-2xl border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Summary counters */}
          <div className="grid grid-cols-4 gap-4 w-full md:w-auto text-center md:text-left">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tổng Thức Ăn</p>
              <p className="text-xl font-black text-emerald-400">{summary.totalFeedKg.toFixed(1)} <span className="text-xs text-emerald-200">kg</span></p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Hoàn Thành</p>
              <p className="text-xl font-black text-emerald-400">{summary.completed} <span className="text-xs text-slate-400">/ {summary.activeCount} cử</span></p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Trễ Cử</p>
              <p className="text-xl font-black text-amber-400">{summary.delayed} <span className="text-xs text-slate-400">cử</span></p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Bỏ / Tắt Cử</p>
              <p className="text-xl font-black text-slate-400">{summary.skipped} <span className="text-xs text-slate-400">cử</span></p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-3 w-full md:w-auto justify-end">
            <button
              type="submit"
              disabled={saving}
              className="w-full md:w-auto px-8 py-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white text-sm font-extrabold flex items-center justify-center gap-2 transition-all duration-200 shadow-lg shadow-emerald-500/30 hover:shadow-emerald-500/40 hover:-translate-y-0.5 disabled:opacity-70"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Đang lưu...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Lưu Nhật Ký Cho Ăn ({summary.activeCount} Cử)
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

