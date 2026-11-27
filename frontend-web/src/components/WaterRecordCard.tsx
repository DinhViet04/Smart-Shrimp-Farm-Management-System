/**
 * WaterRecordCard.tsx
 *
 * Thẻ nhập thông số môi trường nước ngay trong khung chat AI (dành cho Kỹ thuật viên).
 * - Tự chọn ao đã được nhắc trong cuộc trò chuyện, hiển thị bảng dữ liệu ao (diện tích,
 *   độ sâu, thể tích, DOC, lần đo trước) để đối chiếu.
 * - Validation đầy đủ khớp backend: bắt buộc, định dạng số, giới hạn, số chữ số thập phân,
 *   thời điểm đo (không ở tương lai), độ dài ghi chú.
 * - Đánh giá màu từng chỉ số ngay khi nhập (cùng ngưỡng với hệ thống).
 */
import { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Droplets, Loader2, RotateCcw, Save } from 'lucide-react';
import type { AgentActionDraft } from '../services/chatbot.service';

type Status = 'Optimal' | 'Warning' | 'Danger';

interface FieldDef {
  key: string;
  label: string;
  unit: string;
  required: boolean;
  min: number;
  max: number;
  decimals: number;
  optimal?: string;
  status?: (v: number) => Status;
}

const between = (v: number, a: number, b: number) => v >= a && v <= b;

/** Ngưỡng & giới hạn khớp backend (water-quality-status.ts, water-record-agent.service.ts) */
const FIELDS: FieldDef[] = [
  {
    key: 'temperature', label: 'Nhiệt độ', unit: '°C', required: true, min: 15, max: 40, decimals: 2, optimal: '25 - 30',
    status: (v) => (between(v, 25, 30) ? 'Optimal' : between(v, 20, 33) ? 'Warning' : 'Danger'),
  },
  {
    key: 'ph', label: 'pH', unit: '', required: true, min: 5, max: 10, decimals: 2, optimal: '8.2 - 8.5',
    status: (v) => (between(v, 8.2, 8.5) ? 'Optimal' : between(v, 7.5, 9) ? 'Warning' : 'Danger'),
  },
  {
    key: 'dissolvedOxygen', label: 'Oxy DO', unit: 'mg/L', required: true, min: 0, max: 20, decimals: 2, optimal: '> 4',
    status: (v) => (v > 4 ? 'Optimal' : v >= 3 ? 'Warning' : 'Danger'),
  },
  {
    key: 'salinity', label: 'Độ mặn', unit: '‰', required: true, min: 0, max: 50, decimals: 2, optimal: '10 - 25',
    status: (v) => (between(v, 10, 25) ? 'Optimal' : between(v, 5, 30) ? 'Warning' : 'Danger'),
  },
  {
    key: 'alkalinity', label: 'Độ kiềm', unit: 'mg/L', required: true, min: 0, max: 300, decimals: 2, optimal: '100 - 160',
    status: (v) => (between(v, 100, 160) ? 'Optimal' : between(v, 80, 200) ? 'Warning' : 'Danger'),
  },
  {
    key: 'nh3', label: 'NH3', unit: 'mg/L', required: true, min: 0, max: 100, decimals: 3, optimal: '≤ 0.3',
    status: (v) => (v <= 0.3 ? 'Optimal' : v <= 0.5 ? 'Warning' : 'Danger'),
  },
  {
    key: 'transparency', label: 'Độ trong', unit: 'cm', required: true, min: 0, max: 500, decimals: 2, optimal: '25 - 40',
    status: (v) => (between(v, 25, 40) ? 'Optimal' : between(v, 20, 50) ? 'Warning' : 'Danger'),
  },
  { key: 'no2', label: 'NO2', unit: 'mg/L', required: false, min: 0, max: 100, decimals: 3 },
  {
    key: 'h2s', label: 'H2S', unit: 'mg/L', required: false, min: 0, max: 100, decimals: 3, optimal: '≤ 0.03',
    status: (v) => (v <= 0.03 ? 'Optimal' : v <= 0.05 ? 'Warning' : 'Danger'),
  },
];

const WATER_COLORS = ['Xanh lục', 'Xanh vỏ đậu', 'Nâu nhạt', 'Vàng', 'Trong', 'Đục', 'Đỏ', 'Đen'];
const MAX_NOTE = 500;
const STALE_DAYS = 3;

const STATUS_STYLE: Record<Status, { input: string; text: string; label: string }> = {
  Optimal: { input: 'border-emerald-300 bg-emerald-50/40', text: 'text-emerald-600', label: 'Tối ưu' },
  Warning: { input: 'border-amber-300 bg-amber-50/50', text: 'text-amber-600', label: 'Cần chú ý' },
  Danger: { input: 'border-rose-300 bg-rose-50/50', text: 'text-rose-600', label: 'Nguy hiểm' },
};

/** Kiểm tra 1 ô chỉ số; trả về { value } nếu hợp lệ, { error } nếu sai, {} nếu trống */
function checkField(f: FieldDef, raw: string): { value?: number; error?: string } {
  const s = raw.trim();
  if (!s) return f.required ? { error: 'Chưa nhập' } : {};
  if (!/^-?\d+(?:[.,]\d+)?$/.test(s)) return { error: 'Không phải số hợp lệ' };
  const v = Number(s.replace(',', '.'));
  if (v < f.min || v > f.max) return { error: `Hợp lệ ${f.min} - ${f.max}` };
  const dot = s.replace(',', '.').indexOf('.');
  if (dot !== -1 && s.length - dot - 1 > f.decimals) return { error: `Tối đa ${f.decimals} số thập phân` };
  return { value: v };
}

/** ISO -> giá trị cho <input type="datetime-local"> theo giờ máy người dùng */
function toLocalInput(iso?: string) {
  const d = iso ? new Date(iso) : new Date();
  if (Number.isNaN(d.getTime())) return toLocalInput();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Lỗi/cảnh báo của thời điểm đo (chỉ gọi trong event handler vì dùng Date.now) */
function checkTime(value: string): { error?: string; warning?: string } {
  if (!value) return { error: 'Chưa nhập thời điểm đo' };
  const t = new Date(value).getTime();
  if (Number.isNaN(t)) return { error: 'Thời điểm đo không hợp lệ' };
  if (t > Date.now() + 10 * 60 * 1000) return { error: 'Thời điểm đo không được ở tương lai' };
  if (Date.now() - t > STALE_DAYS * 86_400_000) {
    return { warning: `Thời điểm đo đã cách đây hơn ${STALE_DAYS} ngày — kiểm tra lại nếu không phải nhập bù` };
  }
  return {};
}

function formatTime(iso?: string) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())} ${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
}

function initialValues(data: Record<string, unknown>) {
  const values: Record<string, string> = {};
  for (const f of FIELDS) {
    const v = data[f.key];
    values[f.key] = v === undefined || v === null ? '' : String(v);
  }
  return values;
}

interface WaterRecordCardProps {
  draft: AgentActionDraft;
  executed: boolean;
  executing: boolean;
  /** Thẻ cũ (đã có thẻ mới hơn) hoặc người dùng không phải Kỹ thuật viên */
  readOnlyReason?: string;
  onSubmit: (data: Record<string, unknown>) => void;
}

export default function WaterRecordCard({
  draft,
  executed,
  executing,
  readOnlyReason,
  onSubmit,
}: WaterRecordCardProps) {
  const initial = draft.collectedData || {};
  const ponds = useMemo(() => draft.pondOptions || [], [draft.pondOptions]);
  // Khóa trang trại: ưu tiên farmId, dự phòng tên trại (dữ liệu cũ chưa có farmId)
  const farmKey = (p: { farmId?: string; farmName: string }) => p.farmId || p.farmName;

  const farms = useMemo(() => {
    const map = new Map<string, string>();
    ponds.forEach((p) => map.set(farmKey(p), p.farmName));
    return [...map.entries()].map(([key, name]) => ({ key, name }));
  }, [ponds]);

  const initialPond = ponds.find((p) => p.id === initial.pondId);
  const initialFarmKey =
    (initialPond && farmKey(initialPond)) ||
    farms.find((f) => f.key === initial.farmId || f.name === initial.farmName)?.key ||
    (farms.length === 1 ? farms[0].key : '');
  const defaultPondId =
    initialPond?.id ||
    (() => {
      const inFarm = ponds.filter((p) => farmKey(p) === initialFarmKey);
      return initialFarmKey && inFarm.length === 1 ? inFarm[0].id : '';
    })();

  const [farmSel, setFarmSel] = useState<string>(initialFarmKey);
  const [pondId, setPondId] = useState<string>(defaultPondId);
  const [recordTime, setRecordTime] = useState<string>(toLocalInput(initial.recordTime));
  const [timeCheck, setTimeCheck] = useState<{ error?: string; warning?: string }>({});
  const [values, setValues] = useState<Record<string, string>>(() => initialValues(initial));
  const [waterColor, setWaterColor] = useState<string>(initial.waterColor || '');
  const [note, setNote] = useState<string>(initial.note || '');
  const [touched, setTouched] = useState(false);

  const locked = executed || executing || Boolean(readOnlyReason);
  const pond = ponds.find((p) => p.id === pondId);
  const last = pond?.lastRecord || null;

  const pondsInFarm = useMemo(
    () => (farmSel ? ponds.filter((p) => farmKey(p) === farmSel) : ponds),
    [ponds, farmSel],
  );

  const handleFarmChange = (key: string) => {
    setFarmSel(key);
    const list = key ? ponds.filter((p) => farmKey(p) === key) : ponds;
    // Ao đang chọn không thuộc trại mới -> bỏ; trại chỉ có 1 ao -> chọn luôn
    if (!list.some((p) => p.id === pondId)) setPondId(list.length === 1 ? list[0].id : '');
  };

  const handlePondChange = (id: string) => {
    setPondId(id);
    const p = ponds.find((o) => o.id === id);
    if (p) setFarmSel(farmKey(p));
  };

  const evaluation = useMemo(() => {
    const perField: Record<string, { value?: number; error?: string; status?: Status }> = {};
    const statuses: Status[] = [];
    for (const f of FIELDS) {
      const res = checkField(f, values[f.key] || '');
      const status = res.value !== undefined ? f.status?.(res.value) : undefined;
      perField[f.key] = { ...res, status };
      if (status) statuses.push(status);
    }
    const errors: string[] = [];
    if (!farmSel && farms.length > 1) errors.push('Chưa chọn trang trại');
    if (!pondId) errors.push('Chưa chọn ao nuôi');
    else if (!ponds.some((p) => p.id === pondId)) errors.push('Ao nuôi không thuộc phạm vi của bạn');
    else if (farmSel && !ponds.some((p) => p.id === pondId && farmKey(p) === farmSel)) {
      errors.push('Ao nuôi không thuộc trang trại đã chọn');
    }
    FIELDS.forEach((f) => {
      const e = perField[f.key].error;
      if (e) errors.push(`${f.label}: ${e.toLowerCase()}`);
    });
    if (note.length > MAX_NOTE) errors.push(`Ghi chú tối đa ${MAX_NOTE} ký tự`);
    const filled = FIELDS.filter((f) => f.required && perField[f.key].value !== undefined).length;
    const overall: Status | null = statuses.length
      ? statuses.includes('Danger')
        ? 'Danger'
        : statuses.includes('Warning')
          ? 'Warning'
          : 'Optimal'
      : null;
    return { perField, errors, overall, filled };
  }, [values, pondId, ponds, note, farmSel, farms.length]);

  const requiredCount = FIELDS.filter((f) => f.required).length;

  const handleTimeChange = (value: string) => {
    setRecordTime(value);
    setTimeCheck(checkTime(value));
  };

  const handleSubmit = () => {
    setTouched(true);
    const tc = checkTime(recordTime);
    setTimeCheck(tc);
    if (locked || evaluation.errors.length > 0 || tc.error) return;
    const data: Record<string, unknown> = {
      pondId,
      recordTime: new Date(recordTime).toISOString(),
      waterColor: waterColor || undefined,
      note: note.trim() || undefined,
    };
    for (const f of FIELDS) {
      const v = evaluation.perField[f.key].value;
      if (v !== undefined) data[f.key] = v;
    }
    onSubmit(data);
  };

  const handleReset = () => {
    setValues(initialValues(initial));
    setFarmSel(initialFarmKey);
    setPondId(defaultPondId);
    setRecordTime(toLocalInput(initial.recordTime));
    setTimeCheck({});
    setWaterColor(initial.waterColor || '');
    setNote(initial.note || '');
    setTouched(false);
  };

  const allErrors = [...evaluation.errors, ...(timeCheck.error ? [timeCheck.error] : [])];

  const inputBase =
    'w-full rounded-lg border px-2 py-1.5 text-xs font-semibold text-slate-800 outline-none transition-colors focus:border-sky-500 focus:ring-2 focus:ring-sky-500/10 disabled:opacity-70 disabled:cursor-not-allowed';

  return (
    <div className="mt-3 rounded-2xl border border-sky-200 bg-gradient-to-b from-sky-50/80 to-white p-3.5 shadow-sm space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 border-b border-sky-100 pb-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-sky-600 to-cyan-500 text-white flex items-center justify-center shadow-xs">
            <Droplets className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-black text-slate-900 uppercase tracking-wide">Thẻ thông số nước</h4>
            <p className="text-[10px] text-slate-500 font-medium">
              Đã nhập hợp lệ {evaluation.filled}/{requiredCount} chỉ số bắt buộc
            </p>
          </div>
        </div>
        {evaluation.overall && (
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${STATUS_STYLE[evaluation.overall].input} ${STATUS_STYLE[evaluation.overall].text}`}
          >
            {STATUS_STYLE[evaluation.overall].label}
          </span>
        )}
      </div>

      {/* Trang trại + ao */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <label className="space-y-1">
          <span className="text-[10.5px] font-bold text-slate-600">
            Trang trại <span className="text-rose-500">*</span>
          </span>
          <select
            value={farmSel}
            onChange={(e) => handleFarmChange(e.target.value)}
            disabled={locked || farms.length <= 1}
            className={`${inputBase} bg-white ${touched && !farmSel && farms.length > 1 ? 'border-rose-300' : 'border-slate-200'}`}
          >
            <option value="">-- Chọn trang trại --</option>
            {farms.map((f) => (
              <option key={f.key} value={f.key}>
                {f.name}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className="text-[10.5px] font-bold text-slate-600">
            Ao nuôi <span className="text-rose-500">*</span>
          </span>
          <select
            value={pondId}
            onChange={(e) => handlePondChange(e.target.value)}
            disabled={locked}
            className={`${inputBase} bg-white ${touched && !pondId ? 'border-rose-300' : 'border-slate-200'}`}
          >
            <option value="">{farmSel ? '-- Chọn ao --' : '-- Chọn trang trại trước hoặc chọn ao --'}</option>
            {pondsInFarm.map((p) => (
              <option key={p.id} value={p.id}>
                {farmSel ? p.name : `${p.name} (${p.farmName})`}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Thời điểm đo */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <label className="space-y-1">
          <span className="text-[10.5px] font-bold text-slate-600">
            Thời điểm đo <span className="text-rose-500">*</span>
          </span>
          <input
            type="datetime-local"
            value={recordTime}
            onChange={(e) => handleTimeChange(e.target.value)}
            disabled={locked}
            className={`${inputBase} bg-white ${timeCheck.error ? 'border-rose-300' : 'border-slate-200'}`}
          />
        </label>
      </div>
      {timeCheck.warning && !locked && (
        <p className="flex items-center gap-1 text-[10px] font-semibold text-amber-600">
          <AlertTriangle className="w-3 h-3" /> {timeCheck.warning}
        </p>
      )}

      {/* Bảng dữ liệu ao */}
      {pond && (
        <div className="rounded-xl border border-slate-200 bg-white/90 overflow-hidden">
          <div className="grid grid-cols-4 text-center divide-x divide-slate-100">
            {[
              ['Diện tích', pond.areaSize ? `${pond.areaSize.toLocaleString('vi-VN')} m²` : '—'],
              ['Độ sâu', pond.depth ? `${pond.depth} m` : '—'],
              ['Thể tích', pond.waterVolume ? `${pond.waterVolume.toLocaleString('vi-VN')} m³` : '—'],
              ['Ngày nuôi', pond.doc ? `DOC ${pond.doc}` : 'Chưa thả'],
            ].map(([k, v]) => (
              <div key={k} className="px-1.5 py-1.5">
                <p className="text-[9.5px] font-semibold text-slate-400 uppercase">{k}</p>
                <p className="text-[11px] font-bold text-slate-800">{v}</p>
              </div>
            ))}
          </div>
          <div className="border-t border-slate-100 px-2 py-1 text-[10px] text-slate-500 font-medium">
            {last
              ? `Lần đo trước: ${formatTime(last.recordTime)}${last.waterColor ? ` • Màu nước: ${last.waterColor}` : ''} — giá trị cũ hiển thị dưới từng ô để so sánh`
              : 'Ao này chưa có lần đo nào trước đó'}
          </div>
        </div>
      )}

      {/* Chỉ số */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {FIELDS.map((f) => {
          const ev = evaluation.perField[f.key];
          const style = ev.status ? STATUS_STYLE[ev.status] : null;
          const showError = Boolean(ev.error) && (touched || (values[f.key]?.trim() ?? '') !== '');
          const prev = last?.[f.key];
          return (
            <label key={f.key} className="space-y-1">
              <span className="block text-[10.5px] font-bold text-slate-600">
                {f.label}
                {f.unit && <span className="font-medium text-slate-400"> ({f.unit})</span>}
                {f.required && <span className="text-rose-500"> *</span>}
              </span>
              <input
                type="text"
                inputMode="decimal"
                value={values[f.key]}
                placeholder={f.required ? 'Nhập số đo' : 'Không bắt buộc'}
                onChange={(e) => setValues((p) => ({ ...p, [f.key]: e.target.value }))}
                disabled={locked}
                aria-invalid={showError}
                className={`${inputBase} ${
                  showError ? 'border-rose-300 bg-rose-50/40' : style ? style.input : 'border-slate-200 bg-white'
                } placeholder:text-[10px] placeholder:font-medium placeholder:text-slate-300`}
              />
              {/* Ngưỡng tối ưu luôn hiển thị (kể cả khi đang nhập / có lỗi) */}
              {f.optimal && (
                <span className="block text-[9.5px] font-semibold leading-none text-emerald-700/80">
                  Tối ưu: {f.optimal}
                  {f.unit ? ` ${f.unit}` : ''}
                </span>
              )}
              <span className="flex justify-between gap-1 text-[9.5px] font-semibold leading-none min-h-[10px]">
                <span className={showError ? 'text-rose-500' : style ? style.text : 'text-slate-400'}>
                  {showError ? ev.error : style ? style.label : ''}
                </span>
                {prev !== undefined && prev !== null && (
                  <span className="text-slate-400 font-medium">Trước: {String(prev)}</span>
                )}
              </span>
            </label>
          );
        })}
      </div>

      {/* Màu nước + ghi chú */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <label className="space-y-1">
          <span className="text-[10.5px] font-bold text-slate-600">Màu nước</span>
          <select
            value={waterColor}
            onChange={(e) => setWaterColor(e.target.value)}
            disabled={locked}
            className={`${inputBase} bg-white border-slate-200`}
          >
            <option value="">-- Không ghi --</option>
            {WATER_COLORS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
            {waterColor && !WATER_COLORS.includes(waterColor) && <option value={waterColor}>{waterColor}</option>}
          </select>
        </label>
        <label className="space-y-1">
          <span className="flex justify-between text-[10.5px] font-bold text-slate-600">
            <span>Ghi chú quan sát</span>
            <span className={`font-medium ${note.length > MAX_NOTE ? 'text-rose-500' : 'text-slate-400'}`}>
              {note.length}/{MAX_NOTE}
            </span>
          </span>
          <input
            type="text"
            value={note}
            placeholder="Vd: tôm nổi đầu, nước có bọt..."
            onChange={(e) => setNote(e.target.value)}
            disabled={locked}
            className={`${inputBase} bg-white ${note.length > MAX_NOTE ? 'border-rose-300' : 'border-slate-200'} placeholder:font-medium placeholder:text-slate-300`}
          />
        </label>
      </div>

      {/* Lỗi */}
      {touched && allErrors.length > 0 && !locked && (
        <div className="rounded-xl border border-rose-200 bg-rose-50/70 px-2.5 py-1.5 text-[10.5px] font-semibold text-rose-700 space-y-0.5">
          <p>Vui lòng sửa {allErrors.length} lỗi trước khi lưu:</p>
          <ul className="list-disc pl-4 font-medium">
            {allErrors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Hành động */}
      {executed ? (
        <div className="flex items-center gap-1.5 p-2 rounded-xl bg-emerald-50 border border-emerald-200/80 text-emerald-800 text-xs font-bold">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>Đã lưu số đo vào hệ thống!</span>
        </div>
      ) : readOnlyReason ? (
        <div className="p-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-500 text-[11px] font-semibold text-center">
          {readOnlyReason}
        </div>
      ) : (
        <div className="flex items-center gap-2 pt-0.5">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={executing}
            className="flex-1 py-2 px-3 rounded-xl bg-gradient-to-r from-sky-600 to-cyan-600 hover:from-sky-700 hover:to-cyan-700 text-white font-bold text-xs shadow-xs transition-all hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            {executing ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Đang lưu...</span>
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5" />
                <span>Lưu số đo</span>
              </>
            )}
          </button>
          <button
            type="button"
            onClick={handleReset}
            disabled={executing}
            title="Khôi phục giá trị AI đã đọc"
            className="py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition-colors cursor-pointer flex items-center gap-1"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Điền lại
          </button>
        </div>
      )}
    </div>
  );
}
