import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Loader2,
  Utensils,
  Check,
  Ban,
  Pencil,
  Calculator,
  Package,
  Waves,
  Calendar,
  RotateCcw,
  Save,
  Clock,
  Sparkles,
  RefreshCw,
  ChevronDown,
  Trash2,
} from 'lucide-react';
import { pondService, type OverviewFarm, type OverviewPond } from '../../services/pond.service';
import type { Crop } from '../../services/crop.service';
import {
  feedingLogService,
  DEFAULT_FEEDING_SESSIONS,
  FEEDING_SESSION_PRESETS,
  type FeedingSession,
  type SingleSessionPayload,
} from '../../services/feeding-log.service';
import { useRealtimeRefresh } from '../../hooks/useRealtimeRefresh';
import { chatbotService, type FeedingSuggestion } from '../../services/chatbot.service';
import { getErrorMessage } from '../../utils/errors';
import { localToday, formatDayVN, sessionInfo, roundKg, isToday } from './feeding-utils';

interface FeedProduct {
  id: string;
  itemName: string;
  quantity: number;
  unit: string;
}

type DayLog = Awaited<ReturnType<typeof feedingLogService.getDailyDetails>>[number];

/** Trạng thái nhập liệu của 1 cử (chỉ ở trình duyệt) */
interface Draft {
  active: boolean; // cử có nằm trong lịch cho ăn hôm nay không
  time: string;
  amount: string;
  editing: boolean; // đang sửa lại cử đã ghi / đang "cho ăn lại" cử đã bỏ
  manual: boolean; // người dùng tự gõ số kg → không bị tự chia lại ghi đè
}
type Drafts = Record<FeedingSession, Draft>;

/** Kế hoạch chia đang áp dụng: thêm / bớt cử sẽ tự chia lại tổng này */
interface Distribution {
  totalKg: number;
  source: 'AI' | 'MANUAL';
}

/** Chia `total` kg thành `n` phần (2 chữ số lẻ), phần dư dồn vào cử cuối */
function splitKg(total: number, n: number): number[] {
  if (n <= 0) return [];
  const base = Math.floor((total / n) * 100) / 100;
  const last = Math.round((total - base * (n - 1)) * 100) / 100;
  return Array.from({ length: n }, (_, i) => (i === n - 1 ? last : base));
}

/**
 * Tự chia lại kế hoạch cho các cử CHƯA GHI đang bật:
 * còn lại = tổng − kg cử đã cho ăn − kg cử đang sửa / tự gõ tay → chia đều cho các cử còn lại.
 */
function applyDistribution(d: Drafts, logs: DayLog[], dist: Distribution | null): Drafts {
  if (!dist) return d;
  let fixedKg = 0;
  const targets: FeedingSession[] = [];
  for (const def of DEFAULT_FEEDING_SESSIONS) {
    const sKey = def.session;
    const log = logs.find((l) => l.feedingSession === sKey);
    const x = d[sKey];
    const isFedLog = !!log && log.feedingStatus !== 'SKIPPED';
    if (log && !x.editing) {
      if (isFedLog) fixedKg += Number(log.feedAmount) || 0; // đã cho ăn
      continue; // đã cho ăn / đã bỏ: không đụng tới
    }
    if (!x.active) continue; // không cho ăn cử này
    if (isFedLog || x.manual) {
      fixedKg += parseFloat(x.amount) || 0; // đang sửa cử đã ghi / tự gõ tay
      continue;
    }
    targets.push(sKey);
  }
  const parts = splitKg(Math.max(0, Math.round((dist.totalKg - fixedKg) * 100) / 100), targets.length);
  let changed = false;
  const out = { ...d };
  targets.forEach((sKey, i) => {
    const v = parts[i] > 0 ? String(parts[i]) : '';
    if (out[sKey].amount !== v) {
      out[sKey] = { ...out[sKey], amount: v };
      changed = true;
    }
  });
  return changed ? out : d;
}

/** Ao + ngày cần mở (khi bấm "Sửa ngày này" ở tab Lịch sử) */
export interface FeedingTarget {
  pondId: string;
  date: string;
  nonce: number;
}

type SessionState = 'done' | 'skipped' | 'pending' | 'off';

const ABW_SOURCE_LABEL: Record<FeedingSuggestion['abwSource'], string> = {
  SAMPLE: 'theo lần cân mẫu',
  PLAN: 'theo kế hoạch tăng trưởng',
  DOC_CURVE: 'ước tính theo ngày nuôi',
};

const DEFAULT_PRESET = '7_SESSIONS';
const presetKey = (pondId: string) => `feeding_preset_${pondId}`;
const LAST_POND_KEY = 'feeding_last_pond';

function readPreset(pondId: string) {
  try {
    const id = localStorage.getItem(presetKey(pondId));
    return id && FEEDING_SESSION_PRESETS.some((p) => p.id === id) ? id : DEFAULT_PRESET;
  } catch {
    return DEFAULT_PRESET;
  }
}

function buildDrafts(presetId: string, logs: DayLog[], prev?: Drafts): Drafts {
  const preset = FEEDING_SESSION_PRESETS.find((p) => p.id === presetId) ?? FEEDING_SESSION_PRESETS[FEEDING_SESSION_PRESETS.length - 1];
  const out = {} as Drafts;
  for (const def of DEFAULT_FEEDING_SESSIONS) {
    const s = def.session;
    const log = logs.find((l) => l.feedingSession === s);
    const p = prev?.[s];
    if (log && p?.editing) {
      // Đang sửa / đang "cho ăn lại": giữ nguyên những gì người dùng đang nhập
      out[s] = { ...p, active: true };
    } else if (log) {
      out[s] = {
        active: true,
        time: log.feedingTime || def.defaultTime,
        amount: log.feedingStatus !== 'SKIPPED' ? String(Number(log.feedAmount)) : '',
        editing: false,
        manual: false,
      };
    } else if (p) {
      out[s] = { ...p, editing: false };
    } else {
      out[s] = {
        active: preset.activeSessions.includes(s),
        time: preset.times[s] || def.defaultTime,
        amount: '',
        editing: false,
        manual: false,
      };
    }
  }
  return out;
}

export default function CreateFeedingLog({ target }: { target?: FeedingTarget | null }) {
  // ── Dữ liệu nền ──
  const [farms, setFarms] = useState<OverviewFarm[]>([]);
  const [ponds, setPonds] = useState<OverviewPond[]>([]);
  const [crops, setCrops] = useState<Crop[]>([]);
  const [loading, setLoading] = useState(true);

  // ── Lựa chọn ──
  const [pondId, setPondId] = useState('');
  const [selectedCropId, setSelectedCropId] = useState('');
  const [date, setDate] = useState(localToday);
  const [products, setProducts] = useState<FeedProduct[]>([]);
  const [selectedProductId, setSelectedProductId] = useState('');

  // ── Dữ liệu trong ngày ──
  const [dayLogs, setDayLogs] = useState<DayLog[]>([]);
  const [dayLoading, setDayLoading] = useState(false);
  const presetRef = useRef(DEFAULT_PRESET);
  const [drafts, setDrafts] = useState<Drafts>(() => buildDrafts(DEFAULT_PRESET, []));
  const [totalInput, setTotalInput] = useState('');
  const dayLogsRef = useRef<DayLog[]>([]);
  const distributionRef = useRef<Distribution | null>(null);
  const [distribution, setDistributionState] = useState<Distribution | null>(null);
  const setDistribution = (dist: Distribution | null) => {
    distributionRef.current = dist;
    setDistributionState(dist);
  };
  /** Mọi thay đổi cử đều đi qua đây → tự chia lại nếu đang có kế hoạch chia */
  const changeDrafts = (fn: (prev: Drafts) => Drafts) =>
    setDrafts((prev) => applyDistribution(fn(prev), dayLogsRef.current, distributionRef.current));

  const [busy, setBusy] = useState<FeedingSession | 'ALL' | null>(null);
  const [confirmSkip, setConfirmSkip] = useState<DayLog | null>(null);
  const [confirmClearAll, setConfirmClearAll] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  };

  // ── 1. Tải trang trại / ao / vụ ──
  const loadOverview = useCallback(async () => {
    try {
      const overview = await pondService.getOverview();
      setFarms(overview.farms || []);
      setPonds(overview.ponds || []);
      setCrops(overview.crops || []);
    } catch (err) {
      console.error('Không tải được danh sách ao:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  // Vụ đang nuôi theo ao
  const activeCropsByPond = useMemo(() => {
    const map = new Map<string, Crop[]>();
    crops
      .filter((c) => c.status === 'ACTIVE')
      .forEach((c) => {
        const pid = c.pondId || c.pond?.id;
        if (!pid) return;
        map.set(pid, [...(map.get(pid) || []), c]);
      });
    return map;
  }, [crops]);

  // Chỉ ao đang có vụ nuôi mới ghi được nhật ký cho ăn
  const feedablePonds = useMemo(() => {
    const farmName = (id: string) => farms.find((f) => f.id === id)?.name || '';
    return ponds
      .filter((p) => activeCropsByPond.has(p.id))
      .sort((a, b) => farmName(a.farmId).localeCompare(farmName(b.farmId), 'vi') || a.name.localeCompare(b.name, 'vi', { numeric: true }));
  }, [ponds, farms, activeCropsByPond]);

  const showFarmName = new Set(feedablePonds.map((p) => p.farmId)).size > 1;

  // Chọn ao mặc định: ao vừa dùng lần trước, nếu không thì ao đầu tiên
  useEffect(() => {
    if (feedablePonds.length === 0) return;
    if (pondId && feedablePonds.some((p) => p.id === pondId)) return;
    let last = '';
    try {
      last = localStorage.getItem(LAST_POND_KEY) || '';
    } catch {
      // ignore
    }
    setPondId(feedablePonds.some((p) => p.id === last) ? last : feedablePonds[0].id);
  }, [feedablePonds, pondId]);

  // Mở đúng ao + ngày khi được chuyển từ tab Lịch sử
  useEffect(() => {
    if (!target) return;
    setPondId(target.pondId);
    setDate(target.date.slice(0, 10));
  }, [target]);

  const pond = ponds.find((p) => p.id === pondId);
  const farmId = pond?.farmId || '';
  const cropOptions = activeCropsByPond.get(pondId) || [];
  const cropId = cropOptions.some((c) => c.id === selectedCropId) ? selectedCropId : cropOptions[0]?.id || '';
  const crop = cropOptions.find((c) => c.id === cropId);
  // Ngày nuôi thứ mấy, tính theo ngày đang ghi (không phải hôm nay)
  const doc = (() => {
    if (!crop) return null;
    const [y, m, d] = date.split('-').map(Number);
    const start = new Date(crop.startDate);
    const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    return Math.max(0, Math.round((new Date(y, m - 1, d).getTime() - startDay.getTime()) / 86400000));
  })();

  const choosePond = (id: string) => {
    setPondId(id);
    setSelectedCropId('');
    setTotalInput('');
    try {
      localStorage.setItem(LAST_POND_KEY, id);
    } catch {
      // ignore
    }
  };

  // ── 2. Thức ăn trong kho của trang trại ──
  const loadProducts = useCallback(async () => {
    if (!farmId) {
      setProducts([]);
      return;
    }
    try {
      setProducts(await feedingLogService.getFeedProducts(farmId));
    } catch (err) {
      console.error('Không tải được thức ăn trong kho:', err);
    }
  }, [farmId]);

  useEffect(() => {
    void loadProducts();
  }, [loadProducts]);

  // ── AI gợi ý: giai đoạn tôm → loại thức ăn trong kho + số kg ──
  const [suggestion, setSuggestion] = useState<FeedingSuggestion | null>(null);
  const [suggestionLoading, setSuggestionLoading] = useState(false);
  const [suggestionError, setSuggestionError] = useState('');
  const suggestionRequest = useRef(0);
  const loadSuggestion = useCallback(async () => {
    const req = ++suggestionRequest.current;
    if (!pondId) {
      setSuggestion(null);
      return;
    }
    setSuggestionLoading(true);
    try {
      const res = await chatbotService.getFeedingSuggestion(pondId, date);
      if (req !== suggestionRequest.current) return;
      setSuggestion(res);
      setSuggestionError('');
      const cur = distributionRef.current;
      if (cur?.source === 'AI' && cur.totalKg !== res.dailyKg) {
        const next: Distribution = { totalKg: res.dailyKg, source: 'AI' };
        distributionRef.current = next;
        setDistributionState(next);
        setDrafts((prev) => applyDistribution(prev, dayLogsRef.current, next));
      }
    } catch (err) {
      if (req !== suggestionRequest.current) return;
      setSuggestion(null);
      setSuggestionError(getErrorMessage(err) || 'Không phân tích được ao này');
    } finally {
      if (req === suggestionRequest.current) setSuggestionLoading(false);
    }
  }, [pondId, date]);

  useEffect(() => {
    void loadSuggestion();
  }, [loadSuggestion]);

  // Đổi ao → để AI chọn lại loại thức ăn phù hợp
  useEffect(() => {
    setSelectedProductId('');
  }, [pondId]);

  // Ưu tiên: loại người dùng chọn → loại AI gợi ý → loại còn hàng → loại đầu tiên
  const product =
    products.find((p) => p.id === selectedProductId) ||
    products.find((p) => p.id === suggestion?.recommendedFeedProductId && p.quantity > 0) ||
    products.find((p) => p.quantity > 0) ||
    products[0];
  const productId = product?.id || '';
  const productName = (id: string) => products.find((p) => p.id === id)?.itemName || 'Thức ăn';

  // ── 3. Các cử đã ghi trong ngày ──
  const dayRequest = useRef(0);
  const loadDay = useCallback(
    async (fresh: boolean) => {
      const req = ++dayRequest.current;
      if (!pondId || !cropId) {
        setDayLogs([]);
        return;
      }
      if (fresh) {
        setDayLoading(true);
        const pid = readPreset(pondId);
        presetRef.current = pid;
        distributionRef.current = null;
        setDistributionState(null);
      }
      try {
        const logs = (await feedingLogService.getDailyDetails(pondId, date)).filter((l) => l.cropId === cropId);
        if (req !== dayRequest.current) return;
        setDayLogs(logs);
        dayLogsRef.current = logs;
        setDrafts((prev) =>
          applyDistribution(buildDrafts(presetRef.current, logs, fresh ? undefined : prev), logs, distributionRef.current),
        );
      } catch (err) {
        if (req === dayRequest.current) showToast(getErrorMessage(err) || 'Không tải được nhật ký trong ngày', 'error');
      } finally {
        if (req === dayRequest.current) setDayLoading(false);
      }
    },
    [pondId, cropId, date],
  );

  useEffect(() => {
    void loadDay(true);
  }, [loadDay]);

  useRealtimeRefresh(['feeding-logs'], () => void loadDay(false));
  useRealtimeRefresh(['inventory', 'water-quality', 'shrimp-size', 'shrimp-health', 'crops'], () => void loadSuggestion());
  useRealtimeRefresh(['inventory'], () => void loadProducts());
  useRealtimeRefresh(['crops', 'ponds', 'farm-staffs'], () => void loadOverview());

  const logMap = useMemo(() => new Map(dayLogs.map((l) => [l.feedingSession, l])), [dayLogs]);

  const stateOf = (s: FeedingSession): SessionState => {
    const log = logMap.get(s);
    const d = drafts[s];
    if (log && !d.editing) return log.feedingStatus === 'SKIPPED' ? 'skipped' : 'done';
    if (!d.active) return 'off';
    return 'pending';
  };

  const updateDraft = (s: FeedingSession, patch: Partial<Draft>) =>
    changeDrafts((prev) => ({ ...prev, [s]: { ...prev[s], ...patch } }));

  // ── Tổng hợp ──
  const summary = useMemo(() => {
    let doneCount = 0;
    let doneKg = 0;
    // Tổng số cử trong lịch hôm nay — GỒM cả cử đã bỏ, để con số không bị nhảy khi bấm "Bỏ cử"
    let plannedCount = 0;
    let skippedCount = 0;
    let pendingKg = 0; // lượng sẽ xuất thêm từ kho (cử chưa ghi + chênh lệch khi sửa)
    let pendingFilled = 0;
    for (const def of DEFAULT_FEEDING_SESSIONS) {
      const s = def.session;
      const log = logMap.get(s);
      const d = drafts[s];
      const state = (() => {
        if (log && !d.editing) return log.feedingStatus === 'SKIPPED' ? 'skipped' : 'done';
        return d.active ? 'pending' : 'off';
      })();
      if (state === 'done') {
        doneCount++;
        doneKg += Number(log!.feedAmount) || 0;
      }
      if (state === 'skipped') skippedCount++;
      if (state !== 'off') plannedCount++;
      if (state === 'pending') {
        const amt = parseFloat(d.amount) || 0;
        if (!log || log.feedingStatus === 'SKIPPED') {
          // cử chưa ghi, hoặc "cho ăn lại" cử đã bỏ → xuất kho toàn bộ
          pendingKg += amt;
          if (amt > 0) pendingFilled++;
        } else if (log.feedProductId === productId) {
          pendingKg += amt - (Number(log.feedAmount) || 0); // sửa cử đã cho ăn → chỉ tính chênh lệch
        }
      }
    }
    return { doneCount, doneKg: roundKg(doneKg), plannedCount, skippedCount, pendingKg: roundKg(pendingKg), pendingFilled };
  }, [drafts, logMap, productId]);

  const stockLeft = product ? roundKg(product.quantity) : 0;
  const notEnoughStock = !!product && summary.pendingKg > stockLeft;

  // ── Thao tác ──
  /**
   * Chọn "N cử / ngày": bật đúng N cử CHO ĂN (đã cho ăn + chưa cho ăn, không tính cử đã bỏ).
   * Thiếu cử trống thì mở lại các cử đã bỏ (chỉ trên màn hình, bấm "Đã cho ăn" mới ghi).
   * Cử đã cho ăn giữ nguyên. Đang có kế hoạch chia → tự chia lại số kg.
   */
  const applyPreset = (id: string) => {
    const preset = FEEDING_SESSION_PRESETS.find((p) => p.id === id);
    if (!preset) return;
    presetRef.current = id;
    try {
      localStorage.setItem(presetKey(pondId), id);
    } catch {
      // ignore
    }
    changeDrafts((prev) => {
      const next = { ...prev };
      const all = DEFAULT_FEEDING_SESSIONS.map((d) => d.session);
      const fedCount = all.filter((x) => {
        const log = logMap.get(x);
        return log && log.feedingStatus !== 'SKIPPED';
      }).length;
      const free = all.filter((x) => !logMap.has(x));
      const skipped = all.filter((x) => logMap.get(x)?.feedingStatus === 'SKIPPED');
      // Ưu tiên: cử trống theo mẫu → cử trống khác → mở lại cử đã bỏ
      const ordered = [
        ...free.filter((x) => preset.activeSessions.includes(x)),
        ...free.filter((x) => !preset.activeSessions.includes(x)),
        ...skipped,
      ];
      const turnOn = new Set(ordered.slice(0, Math.max(0, preset.count - fedCount)));
      for (const def of DEFAULT_FEEDING_SESSIONS) {
        const x = def.session;
        const log = logMap.get(x);
        if (log && log.feedingStatus !== 'SKIPPED') continue; // đã cho ăn: giữ nguyên
        if (log) {
          // cử đã bỏ: bật = "cho ăn lại", tắt = quay về "đã bỏ cử"
          const on = turnOn.has(x);
          if (on !== prev[x].editing) next[x] = { ...prev[x], editing: on, amount: '', manual: false };
          continue;
        }
        next[x] = { ...prev[x], active: turnOn.has(x), time: preset.times[x] || def.defaultTime };
      }
      return next;
    });
  };

  /** Chia đều phần còn lại của tổng kg cho các cử chưa ghi */
  // Các cử chưa ghi đang bật → nơi điền số kg chia đều / gợi ý
  const fillTargets = DEFAULT_FEEDING_SESSIONS.filter((d) => {
    const log = logMap.get(d.session);
    return stateOf(d.session) === 'pending' && (!log || log.feedingStatus === 'SKIPPED');
  });

  const distribute = () => distributeTotal(parseFloat(totalInput));

  /** Điền đúng số kg AI gợi ý cả ngày vào các cử còn lại */
  const applySuggestedKg = () => {
    if (!suggestion) return;
    setTotalInput(String(suggestion.dailyKg));
    distributeTotal(suggestion.dailyKg, 'AI');
  };

  const distributeTotal = (total: number, source: Distribution['source'] = 'MANUAL') => {
    if (isNaN(total) || total <= 0) return showToast('Nhập tổng số kg thức ăn cả ngày (lớn hơn 0)', 'error');
    if (fillTargets.length === 0) return showToast('Không còn cử nào chưa cho ăn để chia', 'error');
    const remaining = roundKg(total - summary.doneKg);
    if (remaining <= 0) return showToast(`Các cử đã cho ăn đã dùng ${summary.doneKg} kg, không còn để chia`, 'error');

    const dist: Distribution = { totalKg: roundKg(total), source };
    setDistribution(dist);
    // Chia lại từ đầu: bỏ các số tự gõ tay trước đó
    setDrafts((prev) => {
      const next = { ...prev };
      for (const def of DEFAULT_FEEDING_SESSIONS) {
        if (next[def.session].manual) next[def.session] = { ...next[def.session], manual: false };
      }
      return applyDistribution(next, dayLogsRef.current, dist);
    });
    showToast(`Đã chia ${remaining} kg cho ${fillTargets.length} cử còn lại`, 'success');
  };

  const buildPayload = (s: FeedingSession, amount: number, prodId: string): SingleSessionPayload => ({
    feedingSession: s,
    feedingTime: drafts[s].time || sessionInfo(s).defaultTime,
    feedProductId: prodId,
    feedAmount: amount,
    feedingMethod: 'MANUAL',
    feedingStatus: 'COMPLETED',
  });

  const send = async (sessions: SingleSessionPayload[]) => {
    await feedingLogService.createDailyLog({ farmId, pondId, cropId, feedingDate: date, sessions });
    await Promise.all([loadDay(false), loadProducts(), loadSuggestion()]);
  };

  const saveSession = async (s: FeedingSession) => {
    if (busy) return;
    const log = logMap.get(s);
    const amount = parseFloat(drafts[s].amount);
    const { name } = sessionInfo(s);
    if (!amount || amount <= 0) return showToast(`Nhập số kg thức ăn cho ${name}`, 'error');
    const prodId = log && log.feedingStatus !== 'SKIPPED' ? log.feedProductId : productId;
    if (!prodId) return showToast('Kho trang trại chưa có thức ăn. Hãy nhập thức ăn vào kho trước.', 'error');

    try {
      setBusy(s);
      await send([buildPayload(s, amount, prodId)]);
      updateDraft(s, { editing: false, manual: false });
      showToast(`${name}: đã ghi ${amount} kg và trừ kho`, 'success');
    } catch (err) {
      showToast(getErrorMessage(err) || 'Không ghi được cử cho ăn', 'error');
    } finally {
      setBusy(null);
    }
  };

  const saveAll = async () => {
    if (busy) return;
    const list = DEFAULT_FEEDING_SESSIONS.filter(
      (d) => {
        const log = logMap.get(d.session);
        // cử chưa ghi + cử đang "cho ăn lại" (cử đang sửa số kg đã ghi thì bấm Lưu riêng)
        return (
          stateOf(d.session) === 'pending' &&
          (!log || log.feedingStatus === 'SKIPPED') &&
          parseFloat(drafts[d.session].amount) > 0
        );
      },
    );
    if (list.length === 0) return showToast('Chưa có cử nào được nhập số kg', 'error');
    if (!productId) return showToast('Kho trang trại chưa có thức ăn. Hãy nhập thức ăn vào kho trước.', 'error');
    if (notEnoughStock) return showToast(`Kho chỉ còn ${stockLeft} ${product?.unit || 'kg'}, không đủ ${summary.pendingKg} kg`, 'error');

    try {
      setBusy('ALL');
      await send(list.map((d) => buildPayload(d.session, parseFloat(drafts[d.session].amount), productId)));
      // Các cử vừa ghi (kể cả cử "cho ăn lại") chuyển sang trạng thái đã cho ăn
      changeDrafts((prev) => {
        const next = { ...prev };
        list.forEach((d) => {
          next[d.session] = { ...next[d.session], editing: false, manual: false };
        });
        return next;
      });
      showToast(`Đã ghi ${list.length} cử cho ăn và trừ kho`, 'success');
    } catch (err) {
      showToast(getErrorMessage(err) || 'Không ghi được nhật ký cho ăn', 'error');
    } finally {
      setBusy(null);
    }
  };

  /** Bỏ 1 cử chưa cho ăn → ghi nhận "bỏ cử" (0 kg, không trừ kho) */
  /**
   * Bỏ cử khi các cử đã có số kg → chia lại số kg cho các cử còn lại NGAY trên màn hình.
   * - Đang có kế hoạch chia: giữ tổng của kế hoạch.
   * - Chưa có (số kg tự gõ): lấy tổng hiện tại của ngày (đã cho ăn + đang nhập) làm kế hoạch
   *   rồi chia đều cho các cử còn lại.
   * `hide`: cử chưa ghi bị bỏ → tạm ẩn ngay, không chờ server.
   */
  const redistributeOnSkip = (skipped: FeedingSession, hide: boolean) => {
    let dist = distributionRef.current;
    let resetManual = false;
    if (!dist) {
      const pendingKg = fillTargets.reduce((sum, d) => sum + (parseFloat(drafts[d.session].amount) || 0), 0);
      const othersFilled = fillTargets.some((d) => d.session !== skipped && parseFloat(drafts[d.session].amount) > 0);
      if (!othersFilled) {
        if (hide) updateDraft(skipped, { active: false, amount: '', manual: false });
        return;
      }
      dist = { totalKg: roundKg(summary.doneKg + pendingKg), source: 'MANUAL' };
      setDistribution(dist);
      resetManual = true;
    }
    const next = { ...drafts };
    if (resetManual) {
      for (const def of DEFAULT_FEEDING_SESSIONS) {
        if (next[def.session].manual) next[def.session] = { ...next[def.session], manual: false };
      }
    }
    if (hide) next[skipped] = { ...next[skipped], active: false, amount: '', manual: false };
    setDrafts(applyDistribution(next, dayLogsRef.current, dist));
  };

  const skipPendingSession = async (s: FeedingSession) => {
    if (busy) return;
    const { name } = sessionInfo(s);
    redistributeOnSkip(s, true);
    // Server bắt buộc có mã thức ăn; kho chưa có thức ăn thì chỉ đánh dấu trên màn hình
    if (!productId) return; // kho chưa có thức ăn: chỉ đánh dấu trên màn hình (đã làm ở trên)
    try {
      setBusy(s);
      await send([
        {
          feedingSession: s,
          feedingTime: drafts[s].time || sessionInfo(s).defaultTime,
          feedProductId: productId,
          feedAmount: 0,
          feedingMethod: 'MANUAL',
          feedingStatus: 'SKIPPED',
        },
      ]);
      showToast(`${name}: đã ghi nhận bỏ cử`, 'success');
    } catch (err) {
      updateDraft(s, { active: true });
      showToast(getErrorMessage(err) || 'Không ghi nhận được bỏ cử', 'error');
    } finally {
      setBusy(null);
    }
  };

  /**
   * Xoá tất cả các cử trong ngày của ao:
   * - Cử đã ghi trên server → xoá nhật ký cả ngày, thức ăn đã dùng được hoàn lại kho.
   * - Số kg đang nhập dở → xoá trắng, lịch cử trở về mặc định, ngừng tự chia.
   */
  const clearAllSessions = async () => {
    setConfirmClearAll(false);
    if (busy) return;
    try {
      setBusy('ALL');
      if (dayLogs.length > 0) {
        await feedingLogService.deleteDailyLog(farmId, pondId, cropId, date);
      }
      setDistribution(null);
      setTotalInput('');
      dayLogsRef.current = [];
      setDayLogs([]);
      setDrafts(buildDrafts(presetRef.current, []));
      await Promise.all([loadDay(false), loadProducts(), loadSuggestion()]);
      showToast(
        dayLogs.length > 0
          ? `Đã xoá tất cả các cử, ${summary.doneKg} kg thức ăn được hoàn lại kho`
          : 'Đã xoá số kg đang nhập ở tất cả các cử',
        'success',
      );
    } catch (err) {
      showToast(getErrorMessage(err) || 'Không xoá được các cử', 'error');
    } finally {
      setBusy(null);
    }
  };

  /** Bỏ 1 cử đã ghi → lượng thức ăn được hoàn lại kho */
  const skipSavedSession = async (log: DayLog) => {
    setConfirmSkip(null);
    redistributeOnSkip(log.feedingSession, false);
    try {
      setBusy(log.feedingSession);
      await send([
        {
          feedingSession: log.feedingSession,
          feedingTime: log.feedingTime || sessionInfo(log.feedingSession).defaultTime,
          feedProductId: log.feedProductId,
          feedAmount: 0,
          feedingMethod: log.feedingMethod || 'MANUAL',
          feedingStatus: 'SKIPPED',
        },
      ]);
      showToast(`${sessionInfo(log.feedingSession).name}: đã bỏ cử, ${Number(log.feedAmount)} kg được hoàn lại kho`, 'success');
    } catch (err) {
      showToast(getErrorMessage(err) || 'Không bỏ được cử này', 'error');
    } finally {
      setBusy(null);
    }
  };

  // ── Giao diện ──
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-80 gap-3">
        <Loader2 className="w-10 h-10 text-teal-600 animate-spin" />
        <p className="text-base font-medium text-slate-600">Đang tải danh sách ao...</p>
      </div>
    );
  }

  if (feedablePonds.length === 0) {
    return (
      <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center">
        <Waves className="w-14 h-14 text-slate-300 mx-auto mb-3" />
        <p className="text-lg font-bold text-slate-700">Chưa có ao nào đang nuôi tôm</p>
        <p className="text-base text-slate-500 mt-1">Chỉ ghi được nhật ký cho ăn khi ao đã có vụ nuôi.</p>
      </div>
    );
  }

  const progressPct = summary.plannedCount > 0 ? (summary.doneCount / summary.plannedCount) * 100 : 0;
  // Số cử thật sự cho ăn hôm nay (không tính cử đã bỏ) → nút "N cử" tự khớp theo
  const feedCount = summary.plannedCount - summary.skippedCount;
  const skippedPct = summary.plannedCount > 0 ? (summary.skippedCount / summary.plannedCount) * 100 : 0;
  const today = localToday();

  return (
    <div className="w-full space-y-5 pb-28">
      {toast && (
        <div
          role="status"
          className={`fixed top-6 right-6 z-[100] flex items-center gap-3 px-5 py-4 rounded-2xl shadow-xl border text-base font-semibold animate-in slide-in-from-right-8 fade-in duration-300 max-w-md ${
            toast.type === 'success' ? 'bg-teal-50 border-teal-200 text-teal-900' : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          {toast.type === 'success' ? <CheckCircle2 className="w-6 h-6 text-teal-600 shrink-0" /> : <AlertCircle className="w-6 h-6 text-rose-600 shrink-0" />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* ── 1. Chọn ao & ngày ── */}
      <section className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5 sm:p-6 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
            <Waves className="w-5 h-5 text-teal-600" /> Chọn ao cho ăn
          </h3>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 bg-slate-50 border-2 border-slate-200 rounded-2xl px-3 py-2 focus-within:border-teal-500">
              <Calendar className="w-5 h-5 text-teal-600" />
              <span className="sr-only">Ngày cho ăn</span>
              <input
                type="date"
                value={date}
                max={today}
                onChange={(e) => e.target.value && setDate(e.target.value)}
                className="bg-transparent text-base font-bold text-slate-800 outline-none"
              />
            </label>
            {date !== today && (
              <button
                type="button"
                onClick={() => setDate(today)}
                className="px-4 py-2.5 rounded-2xl bg-teal-50 text-teal-700 font-bold text-base hover:bg-teal-100 cursor-pointer"
              >
                Hôm nay
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2.5">
          {feedablePonds.map((p) => {
            const selected = p.id === pondId;
            const farm = farms.find((f) => f.id === p.farmId);
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => choosePond(p.id)}
                aria-pressed={selected}
                className={`px-5 py-3 rounded-2xl border-2 text-left transition-all cursor-pointer ${
                  selected
                    ? 'bg-teal-600 border-teal-600 text-white shadow-md shadow-teal-600/25'
                    : 'bg-white border-slate-200 text-slate-800 hover:border-teal-400'
                }`}
              >
                <span className="block text-base font-black">{p.name}</span>
                {showFarmName && (
                  <span className={`block text-sm ${selected ? 'text-teal-50' : 'text-slate-500'}`}>{farm?.name}</span>
                )}
              </button>
            );
          })}
        </div>

        {cropOptions.length > 1 && (
          <label className="flex items-center gap-3 text-base">
            <span className="font-bold text-slate-700">Vụ nuôi:</span>
            <select
              value={cropId}
              onChange={(e) => setSelectedCropId(e.target.value)}
              className="px-4 py-2.5 rounded-xl border-2 border-slate-200 bg-white font-semibold text-slate-800 outline-none focus:border-teal-500"
            >
              {cropOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  Thả ngày {new Date(c.startDate).toLocaleDateString('vi-VN')}
                  {c.stage === 'NURSERY' ? ' (ương giống)' : ''}
                </option>
              ))}
            </select>
          </label>
        )}
      </section>

      {/* ── 2. Tiến độ trong ngày + thức ăn ── */}
      <section className="grid grid-cols-1 lg:grid-cols-[1.3fr_1fr] gap-4">
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5 sm:p-6">
          <p className="text-base font-semibold text-slate-500">
            {pond?.name} · {isToday(date) ? 'Hôm nay' : formatDayVN(date)}
            {doc !== null && <> · Ngày nuôi thứ {doc}</>}
          </p>
          <div className="flex items-end justify-between gap-3 mt-1">
            <p className="text-2xl font-black text-slate-900">
              Đã cho ăn {summary.doneCount}
              <span className="text-lg font-bold text-slate-400">/{summary.plannedCount} cử</span>
            </p>
            <p className="text-right">
              <span className="block text-sm text-slate-500">Tổng đã cho ăn</span>
              <span className="text-xl font-black text-teal-700">{summary.doneKg} kg</span>
            </p>
          </div>
          <div className="mt-3 h-3 rounded-full bg-slate-100 overflow-hidden flex">
            <div className="h-full bg-teal-500 transition-all duration-500" style={{ width: `${progressPct}%` }} />
            <div className="h-full bg-slate-300 transition-all duration-500" style={{ width: `${skippedPct}%` }} />
          </div>
          {summary.skippedCount > 0 && (
            <p className="mt-2 text-sm text-slate-500 flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-300" /> Đã bỏ {summary.skippedCount} cử
            </p>
          )}
          {summary.plannedCount > 0 && summary.doneCount + summary.skippedCount === summary.plannedCount && (
            <p className="mt-2 flex items-center gap-2 text-base font-bold text-teal-700">
              <CheckCircle2 className="w-5 h-5" /> Đã xong các cử trong ngày
            </p>
          )}
        </div>

        <div className={`rounded-3xl border-2 shadow-sm p-5 sm:p-6 ${notEnoughStock ? 'bg-rose-50 border-rose-200' : 'bg-white border-slate-200'}`}>
          <label className="block">
            <span className="flex items-center gap-2 text-base font-bold text-slate-700 mb-2">
              <Package className="w-5 h-5 text-teal-600" /> Loại thức ăn
            </span>
            {products.length === 0 ? (
              <p className="text-base font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                Kho của trang trại chưa có thức ăn.
              </p>
            ) : (
              <select
                value={productId}
                onChange={(e) => setSelectedProductId(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 bg-white text-base font-semibold text-slate-800 outline-none focus:border-teal-500"
              >
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.id === suggestion?.recommendedFeedProductId ? '★ ' : ''}
                    {p.itemName} — còn {roundKg(p.quantity)} {p.unit}
                    {p.quantity <= 0 ? ' (HẾT)' : ''}
                    {p.id === suggestion?.recommendedFeedProductId ? ' (AI gợi ý)' : ''}
                  </option>
                ))}
              </select>
            )}
          </label>
          {product && (
            <div className="mt-3 flex items-center justify-between text-base">
              <span className="text-slate-600">
                Còn trong kho: <b className="text-slate-900">{stockLeft} {product.unit}</b>
              </span>
              {summary.pendingKg > 0 && (
                <span className={notEnoughStock ? 'text-rose-700 font-bold' : 'text-slate-600'}>
                  Sắp dùng: <b>{summary.pendingKg} kg</b>
                </span>
              )}
            </div>
          )}
          {notEnoughStock && (
            <p className="mt-2 flex items-start gap-2 text-sm font-semibold text-rose-700">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              Kho không đủ thức ăn. Hãy giảm số kg hoặc chọn loại thức ăn khác.
            </p>
          )}
        </div>
      </section>

      {/* ── AI gợi ý theo giai đoạn tôm (1 dải ngang) ── */}
      <section className="rounded-xl border border-teal-200 bg-teal-50/60 px-3 py-2 text-sm">
        {!suggestion ? (
          <div className="flex items-center gap-2 text-slate-600">
            <Sparkles className="w-4 h-4 text-teal-600 shrink-0" />
            {suggestionLoading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin text-teal-600" /> AI đang phân tích...
              </>
            ) : (
              <>
                <span className="text-amber-700">{suggestionError || 'Chưa có gợi ý cho ao này.'}</span>
                <button
                  type="button"
                  onClick={() => void loadSuggestion()}
                  className="ml-auto text-xs font-bold text-teal-700 hover:underline cursor-pointer"
                >
                  Thử lại
                </button>
              </>
            )}
          </div>
        ) : (
          (() => {
            const recId = suggestion.recommendedFeedProductId;
            const recProduct = products.find((p) => p.id === recId);
            const recIsExactSize = !!suggestion.matchingFeeds?.some((f) => f.id === recId);
            const remaining = roundKg(Math.max(0, suggestion.dailyKg - summary.doneKg));
            const perSession = fillTargets.length > 0 ? roundKg(remaining / fillTargets.length) : 0;
            const sep = <span className="hidden md:inline text-teal-300">|</span>;
            const smallBtn =
              'h-6 px-2 rounded-md bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed';
            return (
              <details className="group">
                <summary className="list-none flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="font-black text-teal-800 flex items-center gap-1">
                    <Sparkles className="w-4 h-4 text-teal-600" /> AI
                  </span>

                  <span className="text-slate-700" title={`${suggestion.growthStage || ''} · ${ABW_SOURCE_LABEL[suggestion.abwSource]}`}>
                    Tôm <b>≈ {suggestion.abwGram} g/con</b>
                  </span>
                  {sep}

                  <span className="flex items-center gap-1.5 min-w-0">
                    <span className="text-slate-700 truncate max-w-[220px]" title={recProduct?.itemName}>
                      {recProduct ? (
                        <>
                          Dùng <b>{recProduct.itemName}</b>
                        </>
                      ) : (
                        <span className="text-amber-700">Kho chưa có thức ăn {suggestion.recommendedFeedSize}</span>
                      )}
                    </span>
                    {recProduct && !recIsExactSize && <span className="text-xs text-amber-700">(gần cỡ)</span>}
                    {recProduct &&
                      (recProduct.id === productId ? (
                        <Check className="w-3.5 h-3.5 text-teal-600 shrink-0" aria-label="Đang dùng" />
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            setSelectedProductId(recProduct.id);
                          }}
                          className={smallBtn}
                        >
                          Dùng
                        </button>
                      ))}
                  </span>
                  {sep}

                  <span className="flex items-center gap-1.5">
                    <span className="text-slate-700">
                      <b className="text-teal-700">{suggestion.dailyKg} kg</b>/ngày
                      {fillTargets.length > 0 && remaining > 0 && <span className="text-slate-500"> · ≈ {perSession} kg/cử</span>}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        applySuggestedKg();
                      }}
                      disabled={remaining <= 0 || fillTargets.length === 0}
                      title={`Chia ${remaining} kg vào ${fillTargets.length} cử còn lại`}
                      className={smallBtn}
                    >
                      Điền
                    </button>
                  </span>

                  {suggestion.warnings.length > 0 && (
                    <span className="text-amber-700 flex items-center gap-1" title={suggestion.warnings.join('\n')}>
                      <AlertTriangle className="w-3.5 h-3.5" /> {suggestion.warnings.length} lưu ý
                    </span>
                  )}

                  <span className="ml-auto flex items-center gap-1">
                    <span className="text-xs font-semibold text-teal-700 cursor-pointer flex items-center gap-0.5">
                      Chi tiết <ChevronDown className="w-3.5 h-3.5 transition-transform group-open:rotate-180" />
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        void loadSuggestion();
                      }}
                      disabled={suggestionLoading}
                      title="Phân tích lại"
                      aria-label="Phân tích lại"
                      className="w-6 h-6 rounded-md text-teal-700 hover:bg-teal-100 flex items-center justify-center cursor-pointer"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${suggestionLoading ? 'animate-spin' : ''}`} />
                    </button>
                  </span>
                </summary>

                <div className="mt-2 pt-2 border-t border-teal-100 space-y-1 text-xs text-slate-600">
                  <p>
                    <b className="first-letter:uppercase">{suggestion.growthStage}</b> · {ABW_SOURCE_LABEL[suggestion.abwSource]} · sinh khối ≈{' '}
                    {suggestion.biomassKg.toLocaleString('vi-VN')} kg · nên dùng thức ăn {suggestion.recommendedFeedSize}
                    {recProduct && ` (kho còn ${roundKg(recProduct.quantity)} ${recProduct.unit})`}
                  </p>
                  {suggestion.warnings.map((w) => (
                    <p key={w} className="text-amber-800 font-semibold flex items-start gap-1">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {w}
                    </p>
                  ))}
                  <ul className="list-disc pl-4 space-y-0.5">
                    {suggestion.notes.map((n) => (
                      <li key={n}>{n}</li>
                    ))}
                  </ul>
                </div>
              </details>
            );
          })()
        )}
      </section>

      {/* ── 3. Số cử & chia nhanh ── */}
      <section className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5 sm:p-6 flex flex-col xl:flex-row xl:items-end gap-5">
        <div className="flex-1">
          <p className="text-base font-bold text-slate-700 mb-2">Số cử cho ăn trong ngày</p>
          <div className="flex flex-wrap gap-2">
            {FEEDING_SESSION_PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => applyPreset(p.id)}
                aria-pressed={feedCount === p.count}
                className={`min-w-14 h-12 px-4 rounded-xl border-2 text-base font-black transition-all cursor-pointer ${
                  feedCount === p.count
                    ? 'bg-teal-600 border-teal-600 text-white'
                    : 'bg-white border-slate-200 text-slate-700 hover:border-teal-400'
                }`}
              >
                {p.count} cử
              </button>
            ))}
          </div>
        </div>

        <div className="xl:w-[420px]">
          <p className="text-base font-bold text-slate-700 mb-2">Chia đều tổng thức ăn cả ngày</p>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="0.5"
                value={totalInput}
                onChange={(e) => setTotalInput(e.target.value)}
                placeholder="Ví dụ: 20"
                className="w-full h-12 pl-4 pr-12 rounded-xl border-2 border-slate-200 text-lg font-bold text-slate-900 outline-none focus:border-teal-500"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-base font-bold text-slate-400">kg</span>
            </div>
            <button
              type="button"
              onClick={distribute}
              className="h-12 px-5 rounded-xl bg-teal-50 border-2 border-teal-200 text-teal-800 text-base font-bold hover:bg-teal-100 flex items-center gap-2 cursor-pointer"
            >
              <Calculator className="w-5 h-5" /> Chia đều
            </button>
          </div>
        </div>
      </section>

      {/* ── Đang tự chia: thêm / bớt cử sẽ chia lại số kg ── */}
      {distribution && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-2xl bg-teal-50 border border-teal-200 px-4 py-3">
          <p className="text-sm text-teal-900 flex items-start gap-2">
            <Sparkles className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
            <span>
              Đang tự chia <b>{distribution.totalKg} kg</b> {distribution.source === 'AI' ? 'theo gợi ý AI' : 'theo tổng bạn nhập'}.
              Thêm / bớt cử sẽ tự chia lại; cử bạn tự sửa số kg được giữ nguyên.
            </span>
          </p>
          <button
            type="button"
            onClick={() => setDistribution(null)}
            className="h-9 px-3 rounded-lg text-sm font-bold text-teal-800 hover:bg-teal-100 shrink-0 cursor-pointer"
          >
            Ngừng tự chia
          </button>
        </div>
      )}

      {/* ── 4. Các cử trong ngày ── */}
      <section className="space-y-2.5" aria-busy={dayLoading}>
        <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
          <Utensils className="w-5 h-5 text-teal-600" /> Các cử cho ăn
          {dayLoading && <Loader2 className="w-4 h-4 text-teal-500 animate-spin" />}
          {(dayLogs.length > 0 || DEFAULT_FEEDING_SESSIONS.some((d) => drafts[d.session].amount)) && (
            <button
              type="button"
              onClick={() => setConfirmClearAll(true)}
              disabled={!!busy}
              className="ml-auto h-9 px-3 rounded-lg bg-white border border-slate-200 text-sm font-bold text-slate-600 hover:border-rose-300 hover:text-rose-700 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {busy === 'ALL' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />} Xoá tất cả các cử
            </button>
          )}
        </h3>

        {DEFAULT_FEEDING_SESSIONS.map((def) => {
          const s = def.session;
          const state = stateOf(s);
          const log = logMap.get(s);
          const d = drafts[s];
          const { name, period } = sessionInfo(s);
          const isBusy = busy === s;
          const btn =
            'h-9 px-3 rounded-lg text-sm font-bold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50';
          const title = (
            <div className="flex items-center gap-3 min-w-0">
              <span
                className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-sm font-black ${
                  state === 'done'
                    ? 'bg-teal-600 text-white'
                    : state === 'pending'
                    ? 'bg-teal-50 text-teal-700 border border-teal-200'
                    : 'bg-slate-200 text-slate-500'
                }`}
              >
                {state === 'done' ? <Check className="w-5 h-5" /> : s.replace('SESSION_', '')}
              </span>
              <div className="min-w-0">
                <p className={`text-sm font-bold ${state === 'off' || state === 'skipped' ? 'text-slate-500' : 'text-slate-900'}`}>
                  {name} <span className="font-medium text-slate-500">· {period}</span>
                </p>
                <p className="text-xs text-slate-500 flex items-center gap-1">
                  <Clock className="w-3 h-3" /> {d.time}
                </p>
              </div>
            </div>
          );

          if (state === 'done' && log) {
            return (
              <div key={s} className="bg-teal-50/60 border border-teal-200 rounded-2xl px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                {title}
                <div className="flex items-center gap-2 flex-wrap justify-end">
                  <div className="text-right mr-1">
                    <p className="text-base font-black text-teal-800 leading-tight">{Number(log.feedAmount)} kg</p>
                    <p className="text-xs text-slate-500">{productName(log.feedProductId)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => updateDraft(s, { editing: true, amount: String(Number(log.feedAmount)) })}
                    disabled={!!busy}
                    className={`${btn} bg-white border border-slate-200 text-slate-700 hover:border-teal-400`}
                  >
                    <Pencil className="w-3.5 h-3.5" /> Sửa
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmSkip(log)}
                    disabled={!!busy}
                    className={`${btn} bg-white border border-slate-200 text-slate-600 hover:border-rose-300 hover:text-rose-700`}
                  >
                    {isBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Ban className="w-3.5 h-3.5" />} Bỏ cử
                  </button>
                </div>
              </div>
            );
          }

          if (state === 'skipped' || state === 'off') {
            return (
              <div key={s} className="bg-slate-50 border border-dashed border-slate-300 rounded-2xl px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                {title}
                <div className="flex items-center gap-2.5">
                  <span className="text-sm font-semibold text-slate-500">
                    {state === 'skipped' ? 'Đã bỏ cử' : 'Không cho ăn cử này'}
                  </span>
                  <button
                    type="button"
                    onClick={() => updateDraft(s, state === 'skipped' ? { editing: true, active: true } : { active: true })}
                    disabled={!!busy}
                    className={`${btn} bg-white border border-slate-200 text-teal-700 hover:border-teal-400`}
                  >
                    {isBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                    {state === 'skipped' ? 'Cho ăn lại' : 'Bật cử này'}
                  </button>
                </div>
              </div>
            );
          }

          // pending: chưa cho ăn, hoặc đang sửa cử đã ghi
          // Chỉ cử ĐÃ CHO ĂN mới mở giao diện sửa (Lưu / Huỷ).
          // "Cho ăn lại" cử đã bỏ dùng y hệt giao diện cử chưa cho ăn (Đã cho ăn / Bỏ cử).
          const isEditingSaved = !!log && d.editing && log.feedingStatus !== 'SKIPPED';
          const isRefeeding = !!log && d.editing && log.feedingStatus === 'SKIPPED';
          return (
            <div key={s} className="bg-white border border-slate-200 rounded-2xl px-4 py-3 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
              {title}
              <div className="flex items-center gap-2 flex-wrap justify-end">
                <input
                  type="time"
                  value={d.time}
                  onChange={(e) => updateDraft(s, { time: e.target.value })}
                  aria-label={`Giờ cho ăn ${name}`}
                  className="h-9 px-2.5 rounded-lg border border-slate-200 text-sm font-semibold text-slate-800 outline-none focus:border-teal-500"
                />
                <div className="relative">
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.1"
                    value={d.amount}
                    onChange={(e) => updateDraft(s, { amount: e.target.value, manual: true })}
                    onKeyDown={(e) => e.key === 'Enter' && void saveSession(s)}
                    placeholder="0"
                    aria-label={`Số kg thức ăn ${name}`}
                    className="w-28 h-9 pl-3 pr-9 rounded-lg border border-slate-200 text-sm font-bold text-slate-900 outline-none focus:border-teal-500"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-400">kg</span>
                </div>
                <button
                  type="button"
                  onClick={() => void saveSession(s)}
                  disabled={!!busy}
                  className={`${btn} bg-teal-600 hover:bg-teal-700 text-white shadow-sm`}
                >
                  {isBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : isEditingSaved ? <Save className="w-4 h-4" /> : <Check className="w-4 h-4" />}
                  {isEditingSaved ? 'Lưu' : 'Đã cho ăn'}
                </button>
                {isEditingSaved ? (
                  <button
                    type="button"
                    onClick={() =>
                      updateDraft(s, {
                        editing: false,
                        amount: log.feedingStatus !== 'SKIPPED' ? String(Number(log.feedAmount)) : '',
                        time: log.feedingTime || d.time,
                      })
                    }
                    className={`${btn} text-slate-600 hover:bg-slate-100`}
                  >
                    Huỷ
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() =>
                      // Cử này đã được ghi "bỏ cử" trên server → chỉ cần quay lại trạng thái đã bỏ
                      isRefeeding ? updateDraft(s, { editing: false, amount: '', manual: false }) : void skipPendingSession(s)
                    }
                    disabled={!!busy}
                    title="Ghi nhận hôm nay bỏ cử này (không trừ kho)"
                    className={`${btn} bg-white border border-slate-200 text-slate-600 hover:border-rose-300 hover:text-rose-700`}
                  >
                    <Ban className="w-3.5 h-3.5" /> Bỏ cử
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </section>

      {/* ── Thanh lưu nhanh (khi đã nhập kg cho nhiều cử) ── */}
      {summary.pendingFilled > 1 && (
        <div className="sticky bottom-4 z-30 bg-slate-900 text-white rounded-3xl p-4 sm:p-5 shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-base">
            Đã nhập <b className="text-teal-300">{summary.pendingFilled} cử</b> chưa lưu · tổng <b className="text-teal-300">{summary.pendingKg} kg</b>
          </p>
          <button
            type="button"
            onClick={() => void saveAll()}
            disabled={!!busy || notEnoughStock}
            className="w-full sm:w-auto h-12 px-6 rounded-2xl bg-teal-500 hover:bg-teal-400 text-white text-base font-black flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
          >
            {busy === 'ALL' ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
            Ghi tất cả {summary.pendingFilled} cử
          </button>
        </div>
      )}

      {/* ── Xác nhận xoá tất cả các cử ── */}
      {confirmClearAll && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60" role="dialog" aria-modal="true">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 text-center">
            <div className="w-16 h-16 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-black text-slate-900 mb-2">Xoá tất cả các cử?</h3>
            <p className="text-base text-slate-600 mb-6">
              {pond?.name} · {isToday(date) ? 'Hôm nay' : formatDayVN(date)}
              <br />
              {dayLogs.length > 0 ? (
                <>
                  Xoá <b>{dayLogs.length} cử đã ghi</b>
                  {summary.doneKg > 0 && (
                    <>
                      , <b>{summary.doneKg} kg</b> thức ăn sẽ được <b>hoàn lại vào kho</b>
                    </>
                  )}
                  . Số kg đang nhập cũng bị xoá.
                </>
              ) : (
                'Xoá số kg đang nhập ở tất cả các cử.'
              )}
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setConfirmClearAll(false)}
                className="flex-1 h-12 rounded-xl border-2 border-slate-200 text-slate-700 text-base font-bold hover:bg-slate-50 cursor-pointer"
              >
                Không
              </button>
              <button
                type="button"
                onClick={() => void clearAllSessions()}
                className="flex-1 h-12 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-base font-bold flex items-center justify-center gap-2 cursor-pointer"
              >
                <Trash2 className="w-5 h-5" /> Xoá tất cả
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Xác nhận bỏ cử đã ghi ── */}
      {confirmSkip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60" role="dialog" aria-modal="true">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 text-center">
            <div className="w-16 h-16 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mx-auto mb-4">
              <Ban className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-black text-slate-900 mb-2">Bỏ {sessionInfo(confirmSkip.feedingSession).name}?</h3>
            <p className="text-base text-slate-600 mb-6">
              Cử này đã ghi <b>{Number(confirmSkip.feedAmount)} kg</b>. Khi bỏ cử, số thức ăn này sẽ được <b>hoàn lại vào kho</b>.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setConfirmSkip(null)}
                className="flex-1 h-12 rounded-xl border-2 border-slate-200 text-slate-700 text-base font-bold hover:bg-slate-50 cursor-pointer"
              >
                Không
              </button>
              <button
                type="button"
                onClick={() => void skipSavedSession(confirmSkip)}
                className="flex-1 h-12 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-base font-bold cursor-pointer"
              >
                Bỏ cử
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
