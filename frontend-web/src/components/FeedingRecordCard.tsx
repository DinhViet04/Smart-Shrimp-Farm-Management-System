/**
 * FeedingRecordCard.tsx
 *
 * Thẻ ghi NHẬT KÝ CHO ĂN ngay trong khung chat AI — chỉ dành cho Nông dân.
 * Cách dùng giống màn "Nhật ký cho ăn" thủ công:
 * - Chọn ao, ngày, loại thức ăn (AI gợi ý loại hợp cỡ tôm trong kho).
 * - Chọn số cử / ngày (2–7), nhập kg từng cử hoặc "Chia đều" / "Điền gợi ý AI".
 * - Bỏ cử, thêm / bớt cử → số kg tự chia lại cho các cử còn lại (cử tự gõ kg được giữ nguyên).
 * - Các cử đã ghi hôm nay hiện sẵn; bấm "Sửa" để ghi đè.
 * Lưu 1 lần qua trợ lý AI (cùng nghiệp vụ trừ / hoàn kho với form thủ công).
 */
import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Ban,
  Calculator,
  Check,
  CheckCircle2,
  ChevronDown,
  Loader2,
  Pencil,
  RefreshCw,
  RotateCcw,
  Save,
  Sparkles,
  Utensils,
} from "lucide-react";
import {
  chatbotService,
  type AgentActionDraft,
  type FeedingSessionKey,
  type FeedingSuggestion,
} from "../services/chatbot.service";
import { DEFAULT_FEEDING_SESSIONS, FEEDING_SESSION_PRESETS } from "../services/feeding-log.service";
import { localToday, sessionInfo, roundKg } from "../features/feeding-logs/feeding-utils";

type TodayLog = FeedingSuggestion["todayLogs"][number];

/** Trạng thái nhập của 1 cử trên thẻ */
interface Draft {
  active: boolean; // cử nằm trong lịch cho ăn
  skipped: boolean; // đánh dấu bỏ cử (sẽ lưu là "bỏ cử")
  editing: boolean; // đang sửa cử đã ghi hôm nay
  manual: boolean; // tự gõ kg → không bị tự chia lại
  time: string;
  amount: string;
}
type Drafts = Record<FeedingSessionKey, Draft>;
type State = "done" | "loggedSkip" | "pending" | "skip" | "off";

interface Distribution {
  totalKg: number;
  source: "AI" | "MANUAL";
}

interface FeedingRecordCardProps {
  draft: AgentActionDraft;
  executed: boolean;
  executing: boolean;
  /** Có giá trị -> thẻ chỉ xem (không phải Nông dân / thẻ cũ) */
  readOnlyReason?: string;
  onSubmit: (data: Record<string, unknown>) => void;
}

const SESSION_KEYS = DEFAULT_FEEDING_SESSIONS.map((s) => s.session as FeedingSessionKey);
const DEFAULT_PRESET = "7_SESSIONS";
const presetKey = (pondId: string) => `feeding_preset_${pondId}`;
const ABW_SOURCE_LABEL: Record<FeedingSuggestion["abwSource"], string> = {
  SAMPLE: "theo lần cân mẫu",
  PLAN: "theo kế hoạch tăng trưởng",
  DOC_CURVE: "ước tính theo ngày nuôi",
};

const parseKg = (raw: string) => {
  const n = Number(String(raw).replace(",", ".").trim());
  return String(raw).trim() === "" || !Number.isFinite(n) ? 0 : n;
};

function readPreset(pondId: string) {
  try {
    const id = localStorage.getItem(presetKey(pondId));
    return FEEDING_SESSION_PRESETS.find((p) => p.id === id) ?? FEEDING_SESSION_PRESETS.find((p) => p.id === DEFAULT_PRESET)!;
  } catch {
    return FEEDING_SESSION_PRESETS.find((p) => p.id === DEFAULT_PRESET)!;
  }
}

function splitKg(total: number, n: number): number[] {
  if (n <= 0) return [];
  const base = Math.floor((total / n) * 100) / 100;
  const last = Math.round((total - base * (n - 1)) * 100) / 100;
  return Array.from({ length: n }, (_, i) => (i === n - 1 ? last : base));
}

function stateOf(d: Draft, log?: TodayLog): State {
  if (log && !d.editing) return log.status === "SKIPPED" ? "loggedSkip" : "done";
  if (!d.active) return "off";
  return d.skipped ? "skip" : "pending";
}

/** Tự chia lại tổng kế hoạch cho các cử đang chờ (không tính cử tự gõ kg) */
function applyDistribution(d: Drafts, logs: Map<string, TodayLog>, dist: Distribution | null): Drafts {
  if (!dist) return d;
  let fixedKg = 0;
  const targets: FeedingSessionKey[] = [];
  for (const k of SESSION_KEYS) {
    const st = stateOf(d[k], logs.get(k));
    if (st === "done") fixedKg += logs.get(k)!.amountKg;
    if (st !== "pending") continue;
    if (d[k].manual) fixedKg += parseKg(d[k].amount);
    else targets.push(k);
  }
  const parts = splitKg(Math.max(0, roundKg(dist.totalKg - fixedKg)), targets.length);
  const out = { ...d };
  targets.forEach((k, i) => {
    out[k] = { ...out[k], amount: parts[i] > 0 ? String(parts[i]) : "" };
  });
  return out;
}

/** Dựng lịch cử: cử AI bóc tách từ câu nói ưu tiên; không có thì theo số cử quen dùng của ao */
function buildDrafts(
  prefill: Array<Record<string, unknown>>,
  logs: Map<string, TodayLog>,
  pondId: string,
): Drafts {
  const preset = readPreset(pondId);
  const fromChat = new Map(
    prefill
      .filter((r) => SESSION_KEYS.includes(r.session as FeedingSessionKey))
      .map((r) => [r.session as FeedingSessionKey, r]),
  );
  const fedLogged = SESSION_KEYS.filter((k) => logs.get(k) && logs.get(k)!.status !== "SKIPPED").length;
  const free = SESSION_KEYS.filter((k) => !logs.has(k));
  const ordered = [...free.filter((k) => preset.activeSessions.includes(k)), ...free.filter((k) => !preset.activeSessions.includes(k))];
  const turnOn = new Set(fromChat.size ? [] : ordered.slice(0, Math.max(0, preset.count - fedLogged)));

  const out = {} as Drafts;
  for (const k of SESSION_KEYS) {
    const chat = fromChat.get(k);
    const log = logs.get(k);
    const defTime = preset.times[k] || sessionInfo(k).defaultTime;
    if (chat) {
      const skipped = chat.status === "SKIPPED";
      const kg = typeof chat.amountKg === "number" && chat.amountKg > 0 ? String(chat.amountKg) : "";
      out[k] = {
        active: true,
        skipped,
        editing: !!log, // câu nói nhắc tới cử đã ghi → mở sẵn để ghi đè
        manual: !!kg,
        time: typeof chat.time === "string" && chat.time ? chat.time : log?.time || defTime,
        amount: skipped ? "" : kg,
      };
    } else if (log) {
      out[k] = { active: true, skipped: false, editing: false, manual: false, time: log.time || defTime, amount: log.status === "SKIPPED" ? "" : String(log.amountKg) };
    } else {
      out[k] = { active: turnOn.has(k), skipped: false, editing: false, manual: false, time: defTime, amount: "" };
    }
  }
  return out;
}

export default function FeedingRecordCard({ draft, executed, executing, readOnlyReason, onSubmit }: FeedingRecordCardProps) {
  const ponds = useMemo(() => draft.feedingPondOptions || [], [draft.feedingPondOptions]);
  const locked = executed || executing || Boolean(readOnlyReason);
  const prefill = useMemo<Array<Record<string, unknown>>>(
    () => (Array.isArray(draft.collectedData?.sessions) ? draft.collectedData.sessions : []),
    [draft.collectedData],
  );
  const initialPond = String(draft.collectedData?.pondId || "");
  const initialDate = String(draft.collectedData?.date || localToday());

  const [pondId, setPondId] = useState(initialPond);
  const [date, setDate] = useState(initialDate);
  const [productId, setProductId] = useState<string>(
    () => String(prefill.find((r) => typeof r.feedProductId === "string" && r.feedProductId)?.feedProductId || ""),
  );
  const [drafts, setDrafts] = useState<Drafts>(() => buildDrafts(prefill, new Map(), initialPond));
  const [totalInput, setTotalInput] = useState("");
  const [distribution, setDistributionState] = useState<Distribution | null>(null);
  const distRef = useRef<Distribution | null>(null);
  const setDistribution = (d: Distribution | null) => {
    distRef.current = d;
    setDistributionState(d);
  };
  const [touched, setTouched] = useState(false);
  const [notice, setNotice] = useState("");

  const [suggestion, setSuggestion] = useState<FeedingSuggestion | null>(null);
  const [loadingSuggestion, setLoadingSuggestion] = useState(false);
  const [suggestionError, setSuggestionError] = useState("");
  const reqRef = useRef(0);

  const logs = useMemo(() => new Map((suggestion?.todayLogs || []).map((l) => [l.session, l])), [suggestion?.todayLogs]);

  /** Tải phân tích AI; `rebuild` = đổi ao / ngày → dựng lại lịch cử */
  const loadSuggestion = (pid: string, day: string, rebuild: boolean) => {
    const req = ++reqRef.current;
    if (!pid || readOnlyReason || executed) {
      setSuggestion(null);
      return;
    }
    setLoadingSuggestion(true);
    setSuggestionError("");
    chatbotService
      .getFeedingSuggestion(pid, day)
      .then((s) => {
        if (req !== reqRef.current) return;
        setSuggestion(s);
        const logMap = new Map(s.todayLogs.map((l) => [l.session, l]));
        if (rebuild) {
          // Chỉ dùng cử AI bóc tách từ câu nói cho đúng ao / ngày ban đầu
          const usePrefill = pid === initialPond && day === initialDate ? prefill : [];
          setDistribution(null);
          setDrafts(buildDrafts(usePrefill, logMap, pid));
        } else {
          setDrafts((prev) => applyDistribution(prev, logMap, distRef.current));
        }
        setProductId((cur) =>
          cur && s.feedOptions.some((f) => f.id === cur) ? cur : s.recommendedFeedProductId || s.feedOptions.find((f) => f.stock > 0)?.id || "",
        );
      })
      .catch((err: unknown) => {
        if (req === reqRef.current) setSuggestionError(err instanceof Error ? err.message : "Không tải được gợi ý cho ăn");
      })
      .finally(() => {
        if (req === reqRef.current) setLoadingSuggestion(false);
      });
  };

  // Lần đầu hiển thị thẻ: tải phân tích cho ao AI đã chọn sẵn
  const initialLoad = useEffectEvent(() => {
    if (initialPond) loadSuggestion(initialPond, initialDate, true);
  });
  useEffect(() => {
    initialLoad();
  }, []);

  const choosePond = (id: string) => {
    setPondId(id);
    setTotalInput("");
    if (id) loadSuggestion(id, date, true);
  };
  const chooseDate = (d: string) => {
    if (!d) return;
    setDate(d);
    setTotalInput("");
    if (pondId) loadSuggestion(pondId, d, true);
  };

  /** Mọi thay đổi lịch cử đi qua đây → tự chia lại nếu đang có kế hoạch chia */
  const change = (fn: (prev: Drafts) => Drafts) => setDrafts((prev) => applyDistribution(fn(prev), logs, distRef.current));
  const patch = (k: FeedingSessionKey, p: Partial<Draft>) => change((prev) => ({ ...prev, [k]: { ...prev[k], ...p } }));

  const feedOptions = suggestion?.feedOptions || [];
  const product = feedOptions.find((f) => f.id === productId);

  // ── Tổng hợp ──
  const summary = useMemo(() => {
    let doneKg = 0;
    let doneCount = 0;
    let pendingCount = 0;
    let pendingKg = 0;
    let skipCount = 0;
    let stockNeed = 0;
    for (const k of SESSION_KEYS) {
      const log = logs.get(k);
      const st = stateOf(drafts[k], log);
      if (st === "done") {
        doneCount++;
        doneKg += log!.amountKg;
      } else if (st === "pending") {
        pendingCount++;
        const kg = parseKg(drafts[k].amount);
        pendingKg += kg;
        // sửa cử đã ghi cùng loại thức ăn → kho chỉ trừ phần chênh lệch
        stockNeed += kg - (log && log.status !== "SKIPPED" && log.feedProductId === productId ? log.amountKg : 0);
      } else if (st === "skip" || st === "loggedSkip") skipCount++;
    }
    return {
      doneKg: roundKg(doneKg),
      doneCount,
      pendingCount,
      pendingKg: roundKg(pendingKg),
      skipCount,
      stockNeed: roundKg(stockNeed),
      feedCount: doneCount + pendingCount,
    };
  }, [drafts, logs, productId]);

  const notEnoughStock = !!product && summary.stockNeed > product.stock;
  const pendingKeys = SESSION_KEYS.filter((k) => stateOf(drafts[k], logs.get(k)) === "pending");

  // ── Thao tác ──
  const applyPreset = (count: number) => {
    const preset = FEEDING_SESSION_PRESETS.find((p) => p.count === count);
    if (!preset) return;
    try {
      localStorage.setItem(presetKey(pondId), preset.id);
    } catch {
      // ignore
    }
    change((prev) => {
      const next = { ...prev };
      const fedFixed = SESSION_KEYS.filter((k) => stateOf(prev[k], logs.get(k)) === "done").length;
      const free = SESSION_KEYS.filter((k) => {
        const log = logs.get(k);
        return !log || log.status === "SKIPPED" || prev[k].editing;
      });
      const ordered = [...free.filter((k) => preset.activeSessions.includes(k)), ...free.filter((k) => !preset.activeSessions.includes(k))];
      const on = new Set(ordered.slice(0, Math.max(0, count - fedFixed)));
      for (const k of free) {
        const log = logs.get(k);
        if (log) {
          // cử đã ghi "bỏ cử": bật = cho ăn lại; cử đã cho ăn đang sửa: giữ nguyên
          if (log.status === "SKIPPED") next[k] = { ...prev[k], editing: on.has(k), skipped: false, amount: on.has(k) ? prev[k].amount : "", manual: false };
          continue;
        }
        next[k] = { ...prev[k], active: on.has(k), skipped: false, time: preset.times[k] || prev[k].time };
      }
      return next;
    });
  };

  const distributeTotal = (total: number, source: Distribution["source"]) => {
    if (!(total > 0)) return setNotice("Nhập tổng số kg cả ngày (lớn hơn 0).");
    if (pendingKeys.length === 0) return setNotice("Không còn cử nào để chia.");
    const dist = { totalKg: roundKg(total), source };
    setDistribution(dist);
    setNotice("");
    setDrafts((prev) => {
      const next = { ...prev };
      for (const k of SESSION_KEYS) if (next[k].manual) next[k] = { ...next[k], manual: false };
      return applyDistribution(next, logs, dist);
    });
  };

  /** Bỏ cử → chia lại số kg cho các cử còn lại */
  const skip = (k: FeedingSessionKey) => {
    let dist = distRef.current;
    let reset = false;
    if (!dist) {
      const othersFilled = pendingKeys.some((x) => x !== k && parseKg(drafts[x].amount) > 0);
      if (othersFilled) {
        dist = { totalKg: roundKg(summary.doneKg + summary.pendingKg), source: "MANUAL" };
        setDistribution(dist);
        reset = true;
      }
    }
    setDrafts((prev) => {
      const next = { ...prev };
      if (reset) for (const x of SESSION_KEYS) if (next[x].manual) next[x] = { ...next[x], manual: false };
      const log = logs.get(k);
      // Cử đã ghi "bỏ cử" đang được cho ăn lại → quay về như cũ (không cần lưu gì)
      next[k] = log?.status === "SKIPPED" ? { ...next[k], editing: false, amount: "", manual: false } : { ...next[k], skipped: true, manual: false };
      return applyDistribution(next, logs, dist);
    });
  };

  // ── Lưu ──
  const rowsToSave = SESSION_KEYS.filter((k) => {
    const st = stateOf(drafts[k], logs.get(k));
    return st === "pending" || st === "skip";
  });
  const errors: string[] = [];
  if (!pondId) errors.push("Chọn ao.");
  if (!date || date > localToday()) errors.push("Ngày không hợp lệ.");
  if (!productId) errors.push(feedOptions.length ? "Chọn loại thức ăn." : "Kho trang trại chưa có thức ăn.");
  if (rowsToSave.length === 0) errors.push("Chưa có cử nào để lưu.");
  pendingKeys.forEach((k) => {
    if (!(parseKg(drafts[k].amount) > 0)) errors.push(`${sessionInfo(k).name}: nhập số kg.`);
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(drafts[k].time)) errors.push(`${sessionInfo(k).name}: giờ không hợp lệ.`);
  });

  const handleSubmit = () => {
    setTouched(true);
    if (locked || errors.length || notEnoughStock) return;
    onSubmit({
      pondId,
      date,
      sessions: rowsToSave.map((k) => {
        const st = stateOf(drafts[k], logs.get(k));
        const prefillRow = prefill.find((r) => r.session === k);
        return {
          session: k,
          time: drafts[k].time,
          feedProductId: productId,
          amountKg: st === "skip" ? 0 : parseKg(drafts[k].amount),
          status: st === "skip" ? "SKIPPED" : "COMPLETED",
          method: prefillRow?.method === "AUTO" ? "AUTO" : "MANUAL",
        };
      }),
    });
  };

  const selectedPond = ponds.find((p) => p.id === pondId);
  const multiFarm = new Set(ponds.map((p) => p.farmId)).size > 1;
  const btn = "h-7 px-2 rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer disabled:opacity-50 disabled:cursor-default";
  const recProduct = feedOptions.find((f) => f.id === suggestion?.recommendedFeedProductId);
  const remainingAi = suggestion ? roundKg(Math.max(0, suggestion.dailyKg - summary.doneKg)) : 0;

  return (
    <div className="mt-3 rounded-2xl border border-teal-200 bg-gradient-to-b from-teal-50/70 to-white p-3 shadow-sm space-y-2.5 text-xs">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-teal-100 pb-2">
        <div className="w-7 h-7 rounded-lg bg-teal-600 text-white flex items-center justify-center">
          <Utensils className="w-3.5 h-3.5" />
        </div>
        <h4 className="font-black text-slate-900">Nhật ký cho ăn</h4>
        {selectedPond && (
          <span className="ml-auto px-2 py-0.5 rounded-full text-[10px] font-bold border border-teal-200 bg-white text-teal-700">
            Ngày nuôi {suggestion?.doc ?? selectedPond.doc}
          </span>
        )}
      </div>

      {/* Ao */}
      {!selectedPond ? (
        <div className="space-y-1.5">
          <p className="text-[11px] font-bold text-slate-600">
            Chọn ao đang nuôi {touched && !pondId && <span className="text-rose-500">— chưa chọn</span>}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {ponds.map((p) => (
              <button
                key={p.id}
                type="button"
                disabled={locked}
                onClick={() => choosePond(p.id)}
                className="text-left rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 hover:border-teal-400 cursor-pointer disabled:cursor-default"
              >
                <span className="block font-black text-slate-800 truncate">{p.name}</span>
                <span className="block text-[10px] text-slate-500 truncate">
                  {multiFarm ? `${p.farmName} · ` : ""}
                  {p.todaySessions ? (
                    <span className="text-teal-700">
                      Hôm nay: {p.todaySessions} cử, {p.todayKg} kg
                    </span>
                  ) : (
                    <span className="text-rose-600">Hôm nay chưa cho ăn</span>
                  )}
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <div className="flex-1 min-w-0 rounded-xl border border-teal-200 bg-white px-2.5 py-1.5 flex items-center justify-between gap-2">
            <span className="font-black text-slate-800 truncate">
              {selectedPond.name}
              {multiFarm && <span className="font-medium text-slate-500"> · {selectedPond.farmName}</span>}
            </span>
            {!locked && ponds.length > 1 && (
              <button type="button" onClick={() => choosePond("")} className="text-[10.5px] font-bold text-teal-700 hover:underline cursor-pointer shrink-0">
                Đổi ao
              </button>
            )}
          </div>
          <input
            type="date"
            value={date}
            max={localToday()}
            onChange={(e) => chooseDate(e.target.value)}
            disabled={locked}
            aria-label="Ngày cho ăn"
            className="h-8 rounded-xl border border-slate-200 bg-white px-2 font-semibold text-slate-800 outline-none focus:border-teal-500"
          />
        </div>
      )}

      {selectedPond && (
        <>
          {/* AI gợi ý (1 dải) */}
          {!readOnlyReason && !executed && (
            <div className="rounded-xl border border-teal-200 bg-teal-50/70 px-2.5 py-1.5">
              {loadingSuggestion && !suggestion ? (
                <p className="flex items-center gap-1.5 text-teal-800 font-semibold">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> AI đang phân tích vụ nuôi...
                </p>
              ) : suggestionError ? (
                <p className="flex items-center gap-1.5 text-rose-700 font-semibold">
                  <AlertTriangle className="w-3.5 h-3.5" /> {suggestionError}
                </p>
              ) : suggestion ? (
                <details className="group">
                  <summary className="list-none flex flex-wrap items-center gap-x-2 gap-y-1">
                    <Sparkles className="w-3.5 h-3.5 text-teal-600" />
                    <span>
                      Tôm <b>≈ {suggestion.abwGram} g</b>
                    </span>
                    <span className="text-teal-300">|</span>
                    <span>
                      <b className="text-teal-700">{suggestion.dailyKg} kg</b>/ngày
                      {pendingKeys.length > 0 && remainingAi > 0 && <span className="text-slate-500"> · ≈ {roundKg(remainingAi / pendingKeys.length)} kg/cử</span>}
                    </span>
                    {!locked && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          setTotalInput(String(suggestion.dailyKg));
                          distributeTotal(suggestion.dailyKg, "AI");
                        }}
                        disabled={remainingAi <= 0 || pendingKeys.length === 0}
                        className={`${btn} bg-teal-600 hover:bg-teal-700 text-white h-6`}
                      >
                        Điền
                      </button>
                    )}
                    {suggestion.warnings.length > 0 && (
                      <span className="text-amber-700 flex items-center gap-0.5" title={suggestion.warnings.join("\n")}>
                        <AlertTriangle className="w-3 h-3" /> {suggestion.warnings.length}
                      </span>
                    )}
                    <span className="ml-auto flex items-center gap-1 text-[10.5px] font-semibold text-teal-700 cursor-pointer">
                      Chi tiết <ChevronDown className="w-3 h-3 transition-transform group-open:rotate-180" />
                      <button
                        type="button"
                        title="Phân tích lại"
                        aria-label="Phân tích lại"
                        onClick={(e) => {
                          e.preventDefault();
                          loadSuggestion(pondId, date, false);
                        }}
                        className="w-5 h-5 rounded flex items-center justify-center hover:bg-teal-100 cursor-pointer"
                      >
                        <RefreshCw className={`w-3 h-3 ${loadingSuggestion ? "animate-spin" : ""}`} />
                      </button>
                    </span>
                  </summary>
                  <div className="mt-1.5 pt-1.5 border-t border-teal-100 space-y-0.5 text-[10.5px] text-slate-600">
                    <p>
                      <b className="first-letter:uppercase">{suggestion.growthStage}</b> · {ABW_SOURCE_LABEL[suggestion.abwSource]} · nên dùng thức ăn{" "}
                      {suggestion.recommendedFeedSize}
                      {recProduct ? ` → ${recProduct.name}` : " (kho chưa có loại phù hợp)"}
                    </p>
                    {suggestion.warnings.map((w) => (
                      <p key={w} className="text-amber-800 font-semibold">
                        ⚠ {w}
                      </p>
                    ))}
                    <ul className="list-disc pl-4">
                      {suggestion.notes.map((n) => (
                        <li key={n}>{n}</li>
                      ))}
                    </ul>
                  </div>
                </details>
              ) : null}
            </div>
          )}

          {/* Loại thức ăn */}
          <label className="flex items-center gap-2">
            <span className="font-bold text-slate-600 shrink-0">Thức ăn</span>
            <select
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              disabled={locked || feedOptions.length === 0}
              className={`flex-1 min-w-0 h-8 rounded-xl border bg-white px-2 font-semibold text-slate-800 outline-none focus:border-teal-500 ${
                notEnoughStock ? "border-rose-300" : "border-slate-200"
              }`}
            >
              {feedOptions.length === 0 && <option value="">{loadingSuggestion ? "Đang tải..." : "Kho chưa có thức ăn"}</option>}
              {feedOptions.map((f) => (
                <option key={f.id} value={f.id} disabled={f.stock <= 0 && f.id !== productId}>
                  {f.recommended ? "★ " : ""}
                  {f.name} — còn {f.stock} {f.unit}
                </option>
              ))}
            </select>
          </label>
          {notEnoughStock && (
            <p className="text-rose-700 font-semibold flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> Kho chỉ còn {product!.stock} {product!.unit}, cần {summary.stockNeed} kg.
            </p>
          )}

          {/* Số cử + chia đều */}
          {!locked && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1 flex-wrap">
                <span className="font-bold text-slate-600 mr-1">Số cử</span>
                {FEEDING_SESSION_PRESETS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => applyPreset(p.count)}
                    aria-pressed={summary.feedCount === p.count}
                    className={`h-7 min-w-8 px-2 rounded-lg border font-black cursor-pointer ${
                      summary.feedCount === p.count ? "bg-teal-600 border-teal-600 text-white" : "bg-white border-slate-200 text-slate-700 hover:border-teal-400"
                    }`}
                  >
                    {p.count}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-1.5">
                <div className="relative flex-1">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={totalInput}
                    onChange={(e) => setTotalInput(e.target.value)}
                    placeholder="Tổng kg cả ngày"
                    className="w-full h-8 pl-2.5 pr-7 rounded-xl border border-slate-200 bg-white font-bold text-slate-800 outline-none focus:border-teal-500"
                  />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 font-semibold">kg</span>
                </div>
                <button
                  type="button"
                  onClick={() => distributeTotal(parseKg(totalInput), "MANUAL")}
                  className={`${btn} h-8 px-2.5 bg-teal-50 border border-teal-200 text-teal-800 hover:bg-teal-100`}
                >
                  <Calculator className="w-3.5 h-3.5" /> Chia đều
                </button>
              </div>
              {distribution && (
                <p className="flex items-center justify-between gap-2 text-[10.5px] text-teal-800 bg-teal-50 border border-teal-100 rounded-lg px-2 py-1">
                  <span>
                    Đang tự chia <b>{distribution.totalKg} kg</b> {distribution.source === "AI" ? "theo AI" : ""} — thêm / bớt / bỏ cử sẽ chia lại.
                  </span>
                  <button type="button" onClick={() => setDistribution(null)} className="font-bold hover:underline cursor-pointer shrink-0">
                    Ngừng
                  </button>
                </p>
              )}
              {notice && <p className="text-rose-600 font-semibold">{notice}</p>}
            </div>
          )}

          {/* Các cử */}
          <div className="space-y-1">
            {SESSION_KEYS.map((k) => {
              const d = drafts[k];
              const log = logs.get(k);
              const st = stateOf(d, log);
              const { name, period } = sessionInfo(k);
              const head = (
                <span className="flex items-center gap-1.5 min-w-0">
                  <span
                    className={`w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-black shrink-0 ${
                      st === "done" ? "bg-teal-600 text-white" : st === "pending" ? "bg-teal-50 text-teal-700 border border-teal-200" : "bg-slate-200 text-slate-500"
                    }`}
                  >
                    {st === "done" ? <Check className="w-3.5 h-3.5" /> : k.replace("SESSION_", "")}
                  </span>
                  <span className={`truncate ${st === "pending" || st === "done" ? "text-slate-900 font-bold" : "text-slate-500 font-semibold"}`}>
                    {name} <span className="font-normal text-slate-500">· {period}</span>
                  </span>
                </span>
              );

              if (st === "done" || st === "loggedSkip") {
                return (
                  <div key={k} className={`flex items-center justify-between gap-2 rounded-lg px-2 py-1 ${st === "done" ? "bg-teal-50 border border-teal-100" : "bg-slate-50 border border-dashed border-slate-200"}`}>
                    {head}
                    <span className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[10.5px] text-slate-500">
                        {st === "done" ? <b className="text-teal-800">{log!.amountKg} kg</b> : "Đã bỏ cử"} · đã ghi {log!.time}
                      </span>
                      {!locked && (
                        <button
                          type="button"
                          onClick={() => patch(k, { editing: true, active: true, skipped: false, manual: st === "done", amount: st === "done" ? String(log!.amountKg) : "" })}
                          className={`${btn} bg-white border border-slate-200 text-slate-600 hover:border-teal-400`}
                        >
                          {st === "done" ? <Pencil className="w-3 h-3" /> : <RotateCcw className="w-3 h-3" />}
                          {st === "done" ? "Sửa" : "Cho ăn lại"}
                        </button>
                      )}
                    </span>
                  </div>
                );
              }

              if (st === "off" || st === "skip") {
                return (
                  <div key={k} className="flex items-center justify-between gap-2 rounded-lg px-2 py-1 bg-slate-50 border border-dashed border-slate-200">
                    {head}
                    <span className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[10.5px] text-slate-500">{st === "skip" ? "Bỏ cử" : "Không cho ăn"}</span>
                      {!locked && (
                        <button
                          type="button"
                          onClick={() => patch(k, { active: true, skipped: false })}
                          className={`${btn} bg-white border border-slate-200 text-teal-700 hover:border-teal-400`}
                        >
                          <RotateCcw className="w-3 h-3" /> {st === "skip" ? "Cho ăn lại" : "Bật"}
                        </button>
                      )}
                    </span>
                  </div>
                );
              }

              const kgMissing = touched && !(parseKg(d.amount) > 0);
              return (
                <div key={k} className="flex items-center justify-between gap-1.5 rounded-lg px-2 py-1 bg-white border border-slate-200">
                  {head}
                  <span className="flex items-center gap-1 shrink-0">
                    <input
                      type="time"
                      value={d.time}
                      onChange={(e) => patch(k, { time: e.target.value })}
                      disabled={locked}
                      aria-label={`Giờ ${name}`}
                      className="h-7 w-[84px] rounded-lg border border-slate-200 px-1 font-semibold text-slate-800 outline-none focus:border-teal-500"
                    />
                    <span className="relative">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={d.amount}
                        onChange={(e) => patch(k, { amount: e.target.value, manual: true })}
                        disabled={locked}
                        placeholder="0"
                        aria-label={`Số kg ${name}`}
                        className={`h-7 w-16 rounded-lg border pl-1.5 pr-5 font-bold text-slate-900 outline-none focus:border-teal-500 ${kgMissing ? "border-rose-300" : "border-slate-200"}`}
                      />
                      <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400">kg</span>
                    </span>
                    {!locked &&
                      (d.editing && log?.status !== "SKIPPED" ? (
                        <button
                          type="button"
                          onClick={() => patch(k, { editing: false, manual: false, amount: String(log!.amountKg) })}
                          className={`${btn} text-slate-500 hover:bg-slate-100`}
                        >
                          Huỷ
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => skip(k)}
                          title="Bỏ cử này"
                          className={`${btn} bg-white border border-slate-200 text-slate-600 hover:border-rose-300 hover:text-rose-700`}
                        >
                          <Ban className="w-3 h-3" /> Bỏ
                        </button>
                      ))}
                  </span>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Hành động */}
      {executed ? (
        <div className="flex items-center gap-1.5 p-2 rounded-xl bg-teal-50 border border-teal-200 text-teal-800 font-bold">
          <CheckCircle2 className="w-4 h-4 text-teal-600" /> Đã lưu nhật ký cho ăn!
        </div>
      ) : readOnlyReason ? (
        <div className="p-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-500 font-semibold text-center">{readOnlyReason}</div>
      ) : (
        <div className="space-y-1.5 pt-1">
          {touched && errors.length > 0 && <p className="text-rose-600 font-semibold">{errors[0]}</p>}
          <div className="flex items-center justify-between gap-2">
            <span className="text-slate-600 font-semibold">
              {summary.pendingCount} cử cho ăn · <b className="text-slate-900">{summary.pendingKg} kg</b>
              {summary.skipCount > 0 && <span className="text-slate-400"> · bỏ {summary.skipCount}</span>}
              {summary.doneCount > 0 && <span className="text-slate-400"> · đã ghi {summary.doneKg} kg</span>}
            </span>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={executing || notEnoughStock || (touched && errors.length > 0)}
              className="py-1.5 px-3 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
            >
              {executing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              {executing ? "Đang lưu..." : "Lưu nhật ký"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
