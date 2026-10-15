import { useState, useEffect, useMemo } from 'react';
import {
  CheckCircle2,
  AlertCircle,
  Loader2,
  ChevronDown,
  Utensils,
  Layers,
  Check,
  Ban,
  Sliders,
  Sparkles,
  Calculator,
  Scale,
} from 'lucide-react';
import { pondService } from '../../services/pond.service';
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
      className={`fixed top-6 right-6 z-[100] flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-xl border text-sm font-semibold animate-in slide-in-from-right-8 fade-in duration-300 ${type === 'success'
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

  // Bộ nhớ đệm lưu trữ lượng thức ăn đã set trước đó khi chuyển đổi giữa Bỏ cử và Hoàn thành
  const [cachedFeedAmounts, setCachedFeedAmounts] = useState<Record<FeedingSession, number>>(() => {
    const init: Record<FeedingSession, number> = {} as any;
    DEFAULT_FEEDING_SESSIONS.forEach((item) => {
      init[item.session] = 0;
    });
    return init;
  });

  const [loadingData, setLoadingData] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<ToastProps | null>(null);
  const [statusBanner, setStatusBanner] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setStatusBanner({ message, type });
    setTimeout(() => setToast(null), 5000);
  };

  // 1. Initial Load
  useEffect(() => {
    const loadInit = async () => {
      try {
        setLoadingData(true);
        const { farms: fList, ponds: pList, crops: cList } = await pondService.getOverview();
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

    // Update session times & status for inactive ones, preserving feed amounts
    setSessionData((prev) => {
      const next = { ...prev };
      DEFAULT_FEEDING_SESSIONS.forEach((item) => {
        const sKey = item.session;
        const isActive = nextActiveMap[sKey];
        next[sKey] = {
          ...next[sKey],
          feedingTime: preset.times[sKey] || item.defaultTime,
          feedingStatus: isActive ? 'COMPLETED' : 'SKIPPED',
          feedAmount: next[sKey].feedAmount,
        };
      });
      return next;
    });
  };

  // Handle setting session status (Hoàn thành / Bỏ cử)
  const setSessionStatus = (session: FeedingSession, status: FeedingStatus) => {
    setSelectedPresetId('CUSTOM');
    const isCompleted = status === 'COMPLETED';
    setActiveSessions((prev) => ({
      ...prev,
      [session]: isCompleted,
    }));
    setSessionData((prev) => {
      const current = prev[session];
      let newAmount = current.feedAmount;

      if (isCompleted) {
        // Khi bật lại "Hoàn thành", nếu lượng thức ăn đang bằng 0 thì khôi phục từ bộ nhớ đệm
        if ((!newAmount || newAmount <= 0) && cachedFeedAmounts[session] > 0) {
          newAmount = cachedFeedAmounts[session];
        }
      } else {
        // Khi chọn "Bỏ cử", lưu lại lượng thức ăn hiện tại vào bộ nhớ đệm để không bị mất
        if (newAmount > 0) {
          setCachedFeedAmounts((c) => ({ ...c, [session]: newAmount }));
        }
      }

      return {
        ...prev,
        [session]: {
          ...current,
          feedingStatus: status,
          feedAmount: newAmount,
        },
      };
    });
  };

  // Automatically propagate selected feed product to ALL sessions
  const handleSelectFeedProduct = (productId: string) => {
    setBatchFeedProductId(productId);
    if (!productId) return;
    setSessionData((prev) => {
      const next = { ...prev };
      DEFAULT_FEEDING_SESSIONS.forEach((item) => {
        next[item.session] = { ...next[item.session], feedProductId: productId };
      });
      return next;
    });
  };


  // Handle Session Data Change
  const updateSession = (session: FeedingSession, key: keyof SingleSessionPayload, val: any) => {
    setSessionData((prev) => {
      const current = prev[session];
      const updated = { ...current, [key]: val };

      return {
        ...prev,
        [session]: updated,
      };
    });

    if (key === 'feedAmount') {
      const parsed = parseFloat(val);
      if (!isNaN(parsed) && parsed > 0) {
        setCachedFeedAmounts((c) => ({ ...c, [session]: parsed }));
      }
    }
  };

  // ── BATCH TOOLS ──

  // 2. Batch distribute total daily feed kg evenly across ACTIVE sessions (exact remainder math)
  const batchDistributeFeedAmount = () => {
    const total = parseFloat(batchTotalFeedKg);
    if (isNaN(total) || total <= 0) {
      return showToast('Vui lòng nhập tổng lượng thức ăn hợp lệ (> 0 kg)', 'error');
    }

    const activeList = DEFAULT_FEEDING_SESSIONS.filter((item) => activeSessions[item.session]);
    const N = activeList.length;
    if (N === 0) {
      return showToast('Không có cử nào đang bật để chia thức ăn', 'error');
    }

    // Base amount rounded UP to 2 decimal places for the first (N - 1) sessions
    const basePerSession = Math.ceil((total / N) * 100) / 100;
    const sumFirst = basePerSession * (N - 1);
    // Remainder for the last active session (evening/night)
    const lastSessionAmount = parseFloat((total - sumFirst).toFixed(2));

    setSessionData((prev) => {
      const next = { ...prev };
      activeList.forEach((item, index) => {
        const amt = index < N - 1 ? basePerSession : lastSessionAmount;
        next[item.session] = {
          ...next[item.session],
          feedAmount: amt,
          feedingStatus: 'COMPLETED',
        };
      });
      return next;
    });

    // Also update cached feed amounts for all active sessions
    setCachedFeedAmounts((prev) => {
      const nextCache = { ...prev };
      activeList.forEach((item, index) => {
        const amt = index < N - 1 ? basePerSession : lastSessionAmount;
        nextCache[item.session] = amt;
      });
      return nextCache;
    });

    showToast(`Đã chia chính xác ${total} kg cho ${N} cử đang bật!`, 'success');
  };


  // Calculated Live Summary
  const summary = useMemo(() => {
    let totalFeedKg = 0;
    let completed = 0;
    let skipped = 0;
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
    });

    return { totalFeedKg, completed, skipped, activeCount };
  }, [sessionData, activeSessions]);

  // Real-time stock demand calculation and validation
  const stockValidation = useMemo(() => {
    const demands: Record<string, number> = {};
    DEFAULT_FEEDING_SESSIONS.forEach((item) => {
      const sKey = item.session;
      const s = sessionData[sKey];
      const isActive = activeSessions[sKey];
      if (isActive && s.feedingStatus !== 'SKIPPED' && s.feedProductId) {
        const amt = Number(s.feedAmount) || 0;
        demands[s.feedProductId] = (demands[s.feedProductId] || 0) + amt;
      }
    });

    // Total feed amount skipped and credited back to inventory
    let skippedFeedKg = 0;
    DEFAULT_FEEDING_SESSIONS.forEach((item) => {
      const sKey = item.session;
      const s = sessionData[sKey];
      const isActive = activeSessions[sKey];
      if (!isActive || s.feedingStatus === 'SKIPPED') {
        const amt = Number(s.feedAmount) || cachedFeedAmounts[sKey] || 0;
        if (amt > 0) skippedFeedKg += amt;
      }
    });

    // Check deficits
    const deficits: { productId: string; productName: string; available: number; needed: number; excess: number; unit: string }[] = [];
    feedProducts.forEach((prod) => {
      const needed = demands[prod.id] || 0;
      if (needed > prod.quantity) {
        deficits.push({
          productId: prod.id,
          productName: prod.itemName,
          available: prod.quantity,
          needed: Math.round(needed * 100) / 100,
          excess: Math.round((needed - prod.quantity) * 100) / 100,
          unit: prod.unit,
        });
      }
    });

    return {
      demands,
      skippedFeedKg,
      hasDeficit: deficits.length > 0,
      deficits,
    };
  }, [sessionData, activeSessions, feedProducts, cachedFeedAmounts]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusBanner(null);

    if (!selectedFarmId) return showToast('Vui lòng chọn trang trại', 'error');
    if (!selectedPondId) return showToast('Vui lòng chọn ao nuôi', 'error');
    if (!selectedCropId) return showToast('Không tìm thấy vụ nuôi ĐANG HOẠT ĐỘNG (ACTIVE) cho ao này. Hãy mở/tạo vụ nuôi mới trước!', 'error');
    if (!feedingDate) return showToast('Vui lòng chọn ngày cho ăn', 'error');
    if (feedProducts.length === 0) return showToast('Kho trang trại chưa có sản phẩm thức ăn nào. Vui lòng thêm thức ăn trong Kho vật tư trước!', 'error');

    // Build payload array for ALL 7 sessions so DB unique constraints pass
    const defaultProductFallback = feedProducts[0]?.id || '';

    // Auto-distribute if user entered total feed kg in the batch input box but hasn't clicked "Chia"
    const parsedBatchTotal = parseFloat(batchTotalFeedKg);
    let workingSessionData = { ...sessionData };
    if (!isNaN(parsedBatchTotal) && parsedBatchTotal > 0 && summary.totalFeedKg === 0) {
      const activeKeys = DEFAULT_FEEDING_SESSIONS.filter((it) => activeSessions[it.session]).map((it) => it.session);
      if (activeKeys.length > 0) {
        const perSession = parseFloat((parsedBatchTotal / activeKeys.length).toFixed(2));
        activeKeys.forEach((sKey) => {
          workingSessionData[sKey] = {
            ...workingSessionData[sKey],
            feedAmount: perSession,
            feedingStatus: workingSessionData[sKey].feedingStatus === 'SKIPPED' ? 'COMPLETED' : workingSessionData[sKey].feedingStatus,
          };
        });
        setSessionData(workingSessionData);
      }
    }

    const sessionList: SingleSessionPayload[] = DEFAULT_FEEDING_SESSIONS.map((item) => {
      const sKey = item.session;
      const s = workingSessionData[sKey];
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

    // Kiểm tra validation tồn kho theo từng sản phẩm
    if (stockValidation.hasDeficit) {
      const firstDeficit = stockValidation.deficits[0];
      return showToast(
        `Kho không đủ: Thức ăn "${firstDeficit.productName}" chỉ còn ${firstDeficit.available} ${firstDeficit.unit}, nhưng các cử hoàn thành cần ${firstDeficit.needed} ${firstDeficit.unit} (thiếu ${firstDeficit.excess} ${firstDeficit.unit}). Vui lòng giảm lượng ăn hoặc bấm "Bỏ cử" để cộng lại vào kho!`,
        'error',
      );
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

      setBatchTotalFeedKg('');
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
    <div className="max-w-[1050px] mx-auto relative pb-8">
      {toast && <Toast message={toast.message} type={toast.type} />}

      <form onSubmit={handleSubmit} noValidate>
        {/* ── Page Header with Top Save Action ─────────────────────────── */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 bg-white/90 backdrop-blur-xl px-6 py-5 rounded-3xl shadow-xl shadow-emerald-900/5 border border-white/60 mb-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/30 flex-shrink-0">
              <Utensils className="w-7 h-7 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-black bg-clip-text text-transparent bg-gradient-to-r from-emerald-800 to-teal-600 tracking-tight">
                Ghi Nhận Nhật Ký Cho Ăn Hàng Ngày
              </h2>

            </div>
          </div>

          {/* Top Actions & Summary */}
          <div className="flex flex-wrap items-center gap-3.5 justify-end border-t lg:border-t-0 pt-3 lg:pt-0 border-slate-100 flex-shrink-0">
            {/* Quick summary badges */}
            <div className="flex flex-wrap items-center gap-2 bg-slate-50 px-4 py-2.5 rounded-2xl border border-slate-200/70 text-xs">
              <span className="text-slate-500 font-semibold">Tổng ăn:</span>
              <span className="font-extrabold text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded-lg">
                {summary.totalFeedKg.toFixed(1)} kg
              </span>
              <span className="text-slate-300">•</span>
              <span className="font-bold text-slate-700">
                {summary.completed}/{summary.activeCount} cử bật
              </span>
              {stockValidation.skippedFeedKg > 0 && (
                <>
                  <span className="text-slate-300">•</span>
                  <span className="font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-lg border border-teal-200" title="Lượng thức ăn của các cử bỏ không bị trừ khỏi kho">
                    +{stockValidation.skippedFeedKg.toFixed(1)} kg hoàn kho
                  </span>
                </>
              )}
              {stockValidation.hasDeficit && (
                <>
                  <span className="text-slate-300">•</span>
                  <span className="font-black text-rose-700 bg-rose-100 px-2.5 py-0.5 rounded-lg border border-rose-300 flex items-center gap-1 animate-pulse">
                    <AlertCircle className="w-3.5 h-3.5 text-rose-600" /> Thiếu tồn kho
                  </span>
                </>
              )}
            </div>

            {/* Top Save button */}
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-black flex items-center gap-2 transition-all shadow-md shadow-emerald-600/20 hover:-translate-y-0.5 disabled:opacity-60 cursor-pointer"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Đang lưu...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" /> Lưu nhật ký cho ăn
                </>
              )}
            </button>
          </div>
        </div>

        {/* Inline Status Banner if any */}
        {statusBanner && (
          <div
            className={`mb-6 p-4 rounded-2xl text-xs font-bold flex items-center justify-between gap-2.5 animate-in fade-in duration-200 border ${statusBanner.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-red-50 text-red-800 border-red-200'
              }`}
          >
            <div className="flex items-center gap-2">
              {statusBanner.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
              )}
              <span>{statusBanner.message}</span>
            </div>
            <button
              type="button"
              onClick={() => setStatusBanner(null)}
              className="text-slate-400 hover:text-slate-600 p-1"
            >
              ✕
            </button>
          </div>
        )}

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
                  className={`w-full px-4 py-2.5 pr-10 rounded-xl border text-sm font-semibold appearance-none outline-none transition-all cursor-pointer ${selectedFarmId
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
                  className={`w-full px-4 py-2.5 pr-10 rounded-xl border text-sm font-semibold appearance-none outline-none transition-all cursor-pointer ${selectedPondId && activeCrops.length > 0
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
                  className={`py-2.5 px-3 rounded-2xl text-xs font-extrabold transition-all border flex flex-col items-center justify-center gap-1 ${isSelected
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

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-stretch">
              {/* Batch Apply Product */}
              <div className="lg:col-span-5 flex items-center gap-2.5 bg-white p-2.5 rounded-xl border border-slate-200 min-w-0 shadow-sm">
                <span className="text-xs font-bold text-slate-500 whitespace-nowrap">Thức ăn:</span>
                <select
                  value={batchFeedProductId}
                  onChange={(e) => handleSelectFeedProduct(e.target.value)}
                  className="flex-1 min-w-0 truncate px-2 py-1 text-xs font-semibold text-slate-700 bg-transparent border-none outline-none cursor-pointer"
                  title={feedProducts.find((p) => p.id === batchFeedProductId) ? formatProductLabel(feedProducts.find((p) => p.id === batchFeedProductId)!) : ''}
                >
                  <option value="">-- Chọn loại thức ăn chung cho các cử --</option>
                  {feedProducts.map((p) => (
                    <option key={p.id} value={p.id}>
                      {formatProductLabel(p)}
                    </option>
                  ))}
                </select>
                <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 whitespace-nowrap">
                  Tất cả cử
                </span>
              </div>

              {/* Ô Nhập số kg thức ăn + Nút Chia + Nút Lưu ngay bên cạnh */}
              <div className="lg:col-span-7 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                {/* Khung nhập kg thức ăn & Nút Chia */}
                <div className="flex-1 flex items-center gap-2 bg-white p-2.5 rounded-xl border border-slate-200 min-w-0 shadow-sm">
                  <Scale className="w-4 h-4 text-emerald-600 ml-1 flex-shrink-0" />
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    value={batchTotalFeedKg}
                    onChange={(e) => setBatchTotalFeedKg(e.target.value)}
                    placeholder="Tổng kg thức ăn (ví dụ: 500)..."
                    className="flex-1 min-w-0 px-2 py-1 text-xs font-bold text-slate-800 outline-none placeholder:font-normal placeholder:text-slate-400"
                  />
                  <button
                    type="button"
                    onClick={batchDistributeFeedAmount}
                    className="px-3 py-2 rounded-lg bg-teal-100 hover:bg-teal-200 text-teal-800 text-xs font-bold transition-all flex items-center gap-1 flex-shrink-0 cursor-pointer"
                    title="Chia đều lượng thức ăn cho các cử đang bật"
                  >
                    <Calculator className="w-3 h-3" /> Chia {summary.activeCount} cử
                  </button>
                </div>

                {/* NÚT LƯU NGAY BÊN CẠNH Ô NHẬP KG */}
                <button
                  type="submit"
                  disabled={saving}
                  className="px-6 py-2.5 min-h-[42px] rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs sm:text-sm font-extrabold flex items-center justify-center gap-2 transition-all duration-200 shadow-md shadow-emerald-500/25 hover:shadow-emerald-500/35 hover:-translate-y-0.5 disabled:opacity-60 cursor-pointer flex-shrink-0"
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

            {/* Real-time Inventory Stock & Credit Status Box */}
            {feedProducts.length > 0 && (
              <div className={`mt-3 p-3.5 rounded-xl border text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all ${
                stockValidation.hasDeficit
                  ? 'bg-rose-50/95 border-rose-200 text-rose-800 shadow-sm shadow-rose-200/40'
                  : 'bg-emerald-50/80 border-emerald-200/80 text-emerald-900'
              }`}>
                <div className="flex items-start sm:items-center gap-2.5">
                  {stockValidation.hasDeficit ? (
                    <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5 sm:mt-0" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5 sm:mt-0" />
                  )}
                  <div>
                    <div className="font-extrabold flex flex-wrap items-center gap-2">
                      {(() => {
                        const selProd = feedProducts.find((p) => p.id === batchFeedProductId) || feedProducts[0];
                        const demanded = stockValidation.demands[selProd?.id || ''] || 0;
                        const isEnough = (selProd?.quantity || 0) >= demanded;
                        return (
                          <>
                            <span className="font-black text-slate-800">{selProd ? selProd.itemName : 'Thức ăn'}:</span>
                            <span>Tồn kho: <strong>{selProd?.quantity || 0} {selProd?.unit || 'kg'}</strong></span>
                            <span className="text-slate-300">|</span>
                            <span>Xuất kho hôm nay: <strong>{demanded.toFixed(1)} {selProd?.unit || 'kg'}</strong></span>
                            <span className="text-slate-300">|</span>
                            <span>
                              {isEnough ? (
                                <span className="text-emerald-700">Tồn kho còn lại: <strong>{((selProd?.quantity || 0) - demanded).toFixed(1)} {selProd?.unit || 'kg'}</strong></span>
                              ) : (
                                <span className="text-rose-700 font-black">Thiếu hụt: <strong>{(demanded - (selProd?.quantity || 0)).toFixed(1)} {selProd?.unit || 'kg'}</strong></span>
                              )}
                            </span>
                          </>
                        );
                      })()}
                    </div>
                    {stockValidation.hasDeficit ? (
                      <p className="text-[11px] text-rose-600 font-semibold mt-1">
                        👉 Số lượng trong kho không đủ để xuất! Bạn hãy bấm <strong>"Bỏ cử"</strong> ở các cử phía dưới để cộng lại thức ăn vào kho, hoặc giảm số kg thức ăn.
                      </p>
                    ) : (
                      <p className="text-[11px] text-emerald-700/80 font-normal mt-0.5">
                        ✓ Lượng thức ăn của các cử hoàn thành được trừ kho hợp lệ. Cử bỏ sẽ tự động được cộng lại vào kho.
                      </p>
                    )}
                  </div>
                </div>

                {stockValidation.skippedFeedKg > 0 && (
                  <div className="flex items-center gap-1.5 bg-white/90 px-3 py-1.5 rounded-lg border border-slate-200/70 text-slate-700 font-bold whitespace-nowrap self-start sm:self-auto shadow-sm">
                    <Sparkles className="w-3.5 h-3.5 text-teal-600" />
                    <span>Đã cộng lại: <strong className="text-teal-700">+{stockValidation.skippedFeedKg.toFixed(1)} kg</strong> (do bỏ cử)</span>
                  </div>
                )}
              </div>
            )}
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

          {/* Detailed List for 7 Sessions (Chronological Vertical Stack) */}
          <div className="space-y-3">
            {DEFAULT_FEEDING_SESSIONS.map((defItem) => {
              const sKey = defItem.session;
              const isActive = activeSessions[sKey];
              const s = sessionData[sKey];
              const selectedProd = feedProducts.find((p) => p.id === s.feedProductId);
              const totalProductDemanded = selectedProd ? (stockValidation.demands[selectedProd.id] || 0) : 0;
              const isExcess = selectedProd && isActive && s.feedingStatus !== 'SKIPPED' && totalProductDemanded > selectedProd.quantity;
              const displayAmount = s.feedAmount > 0 ? s.feedAmount : (cachedFeedAmounts[sKey] > 0 ? cachedFeedAmounts[sKey] : 0);

              return (
                <div
                  key={sKey}
                  className={`bg-white/90 backdrop-blur-md rounded-2xl border p-3.5 sm:p-4 transition-all duration-200 ${
                    !isActive
                      ? 'border-slate-200 bg-slate-50/50 opacity-70'
                      : 'border-white/80 shadow-md shadow-slate-200/30 hover:shadow-lg hover:border-emerald-200'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    {/* Góc trái: Số cử + Tên cử + Giờ cho ăn */}
                    <div className="flex flex-wrap items-center gap-3">
                      {/* Số thứ tự cử */}
                      <span className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs flex-shrink-0 ${
                        isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-500'
                      }`}>
                        {sKey.replace('SESSION_', '')}
                      </span>

                      {/* Tên cử */}
                      <h4 className={`text-sm font-bold min-w-[120px] ${
                        isActive ? 'text-slate-800' : 'text-slate-400 line-through'
                      }`}>
                        {defItem.label}
                      </h4>

                      {/* Giờ cho ăn */}
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

                    {/* Góc phải: Nút Hoàn thành / Bỏ cử + Ô nhập số kg thức ăn */}
                    <div className="flex flex-wrap items-center gap-2.5 self-end sm:self-auto flex-shrink-0">
                      {/* Nút Hoàn thành / Bỏ cử */}
                      <div className="flex items-center gap-1 bg-slate-100/90 p-1 rounded-2xl border border-slate-200/70">
                        <button
                          type="button"
                          onClick={() => setSessionStatus(sKey, 'COMPLETED')}
                          className={`py-1.5 px-3 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                            isActive
                              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                              : 'text-slate-500 hover:text-slate-800'
                          }`}
                        >
                          <Check className="w-3.5 h-3.5" /> Hoàn thành
                        </button>
                        <button
                          type="button"
                          onClick={() => setSessionStatus(sKey, 'SKIPPED')}
                          className={`py-1.5 px-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                            !isActive
                              ? 'bg-slate-700 text-white shadow-sm'
                              : 'text-slate-400 hover:text-slate-700'
                          }`}
                        >
                          <Ban className="w-3 h-3" /> Bỏ cử
                        </button>
                      </div>

                      {/* Ô nhập số kg thức ăn */}
                      <div className="relative w-32 sm:w-36">
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          disabled={!isActive}
                          value={isActive ? (s.feedAmount > 0 ? s.feedAmount : '') : (displayAmount > 0 ? displayAmount : 0)}
                          onChange={(e) => updateSession(sKey, 'feedAmount', e.target.value)}
                          placeholder="0.0"
                          className={`w-full px-3 py-1.5 pr-9 rounded-xl border text-sm font-extrabold outline-none transition-all ${
                            !isActive
                              ? 'bg-slate-100 text-slate-500 border-slate-200 cursor-not-allowed font-bold'
                              : isExcess
                                ? 'bg-red-50 text-red-900 border-red-300 focus:border-red-500'
                                : 'bg-slate-50 text-slate-900 border-slate-200 hover:bg-white focus:border-emerald-500'
                          }`}
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-black text-slate-400 pointer-events-none">
                          kg
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Thông tin Bỏ cử: cộng lại lượng thức ăn vào kho & vẫn lưu lại lượng đã set */}
                  {!isActive && (
                    <div className="flex items-center gap-1.5 mt-2.5 pt-2 border-t border-slate-100 text-[11px] text-slate-500 font-semibold">
                      <span className="w-2 h-2 rounded-full bg-slate-400 flex-shrink-0" />
                      <span>
                        Đã bỏ cử — Lượng thức ăn <strong>({displayAmount} kg)</strong> được cộng lại vào kho (vẫn lưu lại để tự động khôi phục khi bạn chọn Hoàn thành lại).
                      </span>
                    </div>
                  )}

                  {/* Cảnh báo vượt tồn kho */}
                  {isActive && isExcess && (
                    <p className="text-[11px] text-red-600 font-bold flex items-center gap-1 mt-2.5 pt-2 border-t border-red-100">
                      <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" /> Cảnh báo: Tổng nhu cầu ({totalProductDemanded.toFixed(1)} kg) vượt tồn kho ({selectedProd?.quantity} kg)! Hãy giảm kg hoặc bấm "Bỏ cử".
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Summary & Actions Sticky Footer ─────────────────────────── */}
        <div className="sticky bottom-4 z-40 bg-slate-900/95 backdrop-blur-xl text-white rounded-3xl p-5 shadow-2xl border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4 mt-6">
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
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Bỏ Cử (Hoàn kho)</p>
              <p className="text-xl font-black text-teal-400">{summary.skipped} <span className="text-xs text-slate-400">cử</span></p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tình Trạng Kho</p>
              <p className={`text-xs font-black mt-1 ${stockValidation.hasDeficit ? 'text-rose-400' : 'text-emerald-400'}`}>
                {stockValidation.hasDeficit ? '⚠️ Thiếu hàng' : '✅ Đủ hàng'}
              </p>
            </div>
          </div>

          {/* Action buttons & inline status banner */}
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto justify-end">
            <button
              type="submit"
              disabled={saving}
              className="w-full sm:w-auto px-8 py-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white text-sm font-extrabold flex items-center justify-center gap-2 transition-all duration-200 shadow-lg shadow-emerald-500/30 hover:shadow-emerald-500/40 hover:-translate-y-0.5 disabled:opacity-70 cursor-pointer"
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

