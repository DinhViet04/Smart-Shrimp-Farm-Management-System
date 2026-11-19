/**
 * CropCreateCard.tsx
 *
 * Thẻ nhập liệu tạo VỤ NUÔI ngay trong khung chat AI (chỉ dành cho Quản lý trang trại).
 * - AI điền sẵn những gì người dùng đã nói (ao, số giống, ngày thả, giống...), người dùng
 *   điền / sửa phần còn lại trực tiếp trên thẻ.
 * - Quy tắc khớp form tạo vụ thủ công (CropManagement) và backend (crops.service):
 *   chỉ chọn ao đang trống, mật độ > 250 con/m² bị chặn, trang trại Công nghệ cao bắt buộc
 *   bắt đầu Ương dưỡng, Truyền thống chỉ Thương phẩm, mốc tách ao / thu hoạch phải sau ngày thả.
 */
import { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, ExternalLink, Loader2, RotateCcw, Sprout, Tag } from 'lucide-react';
import type { AgentActionDraft, CropPondOption } from '../services/chatbot.service';

type Stage = 'NURSERY' | 'COMMERCIAL';

const DEFAULTS = {
  seedType: 'Tôm thẻ chân trắng Post 10',
  targetSurvivalRate: '85',
  targetHarvestSize: '30',
  transferDays: 25,
  harvestDays: 95,
};
const MAX_DENSITY = 250;
/** Giá giống mặc định khi chưa lấy được giá Tép Bạc (khớp backend) */
const DEFAULT_SEED_PRICE = 70;
/** Trang giá giống Tép Bạc (dự phòng khi backend không gửi kèm giá) — giống form tạo vụ thủ công */
const SEED_PRICE_URL = 'https://tepbac.com/gia-thuy-san/giong-tom-the-chan-trang-p10';

/** Ngày hôm nay theo giờ máy người dùng (YYYY-MM-DD) */
function todayStr() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function addDays(date: string, days: number) {
  const d = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return '';
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function daysBetween(from: string, to: string) {
  const a = new Date(`${from}T00:00:00Z`).getTime();
  const b = new Date(`${to}T00:00:00Z`).getTime();
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.round((b - a) / 86_400_000);
}

/** Giai đoạn bắt buộc theo mô hình trang trại (null = được chọn) */
function forcedStage(model: string | null | undefined): Stage | null {
  if (model === 'HIGH_TECH') return 'NURSERY';
  if (model === 'TRADITIONAL') return 'COMMERCIAL';
  return null;
}

/** Số nguyên dương, chấp nhận "200.000", "200,000", "200 000" */
function parseCount(raw: string): number | null {
  const s = raw.replace(/[\s.,]/g, '');
  if (!/^\d+$/.test(s)) return null;
  const n = parseInt(s, 10);
  return n > 0 ? n : null;
}

function parseDecimal(raw: string): number | null {
  const s = raw.trim().replace(',', '.');
  if (!/^\d+(?:\.\d+)?$/.test(s)) return null;
  return Number(s);
}

const DENSITY_LEVELS = [
  { max: 100, label: 'Mật độ thấp / quảng canh', cls: 'border-sky-300 bg-sky-50/50 text-sky-700' },
  { max: 200, label: 'Mật độ an toàn, hiệu quả cao', cls: 'border-emerald-300 bg-emerald-50/50 text-emerald-700' },
  { max: 220, label: 'Mật độ cao — cần oxy đáy mạnh', cls: 'border-amber-300 bg-amber-50/60 text-amber-700' },
  { max: MAX_DENSITY, label: 'Mật độ báo động — cân nhắc giảm', cls: 'border-rose-300 bg-rose-50/60 text-rose-700' },
];

interface FormState {
  farmId: string;
  pondId: string;
  startDate: string;
  initialShrimpCount: string;
  stage: Stage;
  expectedTransferDate: string;
  expectedHarvestDate: string;
  seedType: string;
  targetSurvivalRate: string;
  targetHarvestSize: string;
  targetTotalFeedKg: string;
}

function initialForm(draft: AgentActionDraft, ponds: CropPondOption[]): FormState {
  const d = draft.collectedData || {};
  const pond = ponds.find((p) => p.id === d.pondId);
  const farmIds = [...new Set(ponds.map((p) => p.farmId))];
  const farmId = pond?.farmId || (farmIds.length === 1 ? farmIds[0] : '');
  const pondsInFarm = ponds.filter((p) => p.farmId === farmId);
  const pondId = pond?.id || (farmId && pondsInFarm.length === 1 ? pondsInFarm[0].id : '');
  const model = ponds.find((p) => p.id === pondId)?.farmingModel ?? pondsInFarm[0]?.farmingModel;
  const start = /^\d{4}-\d{2}-\d{2}$/.test(String(d.startDate || '')) ? String(d.startDate) : todayStr();
  const str = (v: unknown, fallback = '') => (v === undefined || v === null || v === '' ? fallback : String(v));

  return {
    farmId,
    pondId,
    startDate: start,
    initialShrimpCount: str(d.initialShrimpCount),
    stage: forcedStage(model) || (d.stage === 'NURSERY' ? 'NURSERY' : 'COMMERCIAL'),
    expectedTransferDate: str(d.expectedTransferDate, addDays(start, DEFAULTS.transferDays)),
    expectedHarvestDate: str(d.expectedHarvestDate, addDays(start, DEFAULTS.harvestDays)),
    seedType: str(d.seedType, DEFAULTS.seedType),
    targetSurvivalRate: str(d.targetSurvivalRate, DEFAULTS.targetSurvivalRate),
    targetHarvestSize: str(d.targetHarvestSize, DEFAULTS.targetHarvestSize),
    targetTotalFeedKg: str(d.targetTotalFeedKg),
  };
}

interface CropCreateCardProps {
  draft: AgentActionDraft;
  executed: boolean;
  executing: boolean;
  /** Thẻ cũ (đã có thẻ mới hơn) hoặc người dùng không phải Quản lý trang trại */
  readOnlyReason?: string;
  onSubmit: (data: Record<string, unknown>) => void;
}

export default function CropCreateCard({ draft, executed, executing, readOnlyReason, onSubmit }: CropCreateCardProps) {
  const ponds = useMemo(() => draft.cropPondOptions || [], [draft.cropPondOptions]);
  const market = draft.seedMarketPrice;
  /** Đơn giá giống chỉ lấy tự động theo Tép Bạc (backend gửi kèm), không có thì giá mặc định */
  const seedPrice = market?.price || DEFAULT_SEED_PRICE;
  const farms = useMemo(() => {
    const map = new Map<string, string>();
    ponds.forEach((p) => map.set(p.farmId, p.farmName));
    return [...map.entries()].map(([id, name]) => ({ id, name }));
  }, [ponds]);

  const [form, setForm] = useState<FormState>(() => initialForm(draft, ponds));
  // Mốc ngày tự dời theo ngày thả cho đến khi người dùng tự sửa
  const [datesTouched, setDatesTouched] = useState(false);
  const [touched, setTouched] = useState(false);

  const locked = executed || executing || Boolean(readOnlyReason);
  const pond = ponds.find((p) => p.id === form.pondId);
  const pondsInFarm = form.farmId ? ponds.filter((p) => p.farmId === form.farmId) : ponds;
  const stageLock = forcedStage(pond?.farmingModel ?? pondsInFarm[0]?.farmingModel);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }));

  const applyPond = (f: FormState, pondId: string): FormState => {
    const p = ponds.find((o) => o.id === pondId);
    const lock = forcedStage(p?.farmingModel);
    return { ...f, pondId, farmId: p?.farmId || f.farmId, stage: lock || f.stage };
  };

  const handleFarmChange = (farmId: string) => {
    setForm((f) => {
      const list = farmId ? ponds.filter((p) => p.farmId === farmId) : ponds;
      const keep = list.some((p) => p.id === f.pondId);
      const next = { ...f, farmId };
      return keep ? next : applyPond({ ...next, pondId: '' }, list.length === 1 ? list[0].id : '');
    });
  };

  const handleStartDateChange = (startDate: string) => {
    setForm((f) =>
      datesTouched || !startDate
        ? { ...f, startDate }
        : {
            ...f,
            startDate,
            expectedTransferDate: addDays(startDate, DEFAULTS.transferDays),
            expectedHarvestDate: addDays(startDate, DEFAULTS.harvestDays),
          },
    );
  };

  const ev = useMemo(() => {
    const errors: Record<string, string> = {};
    if (!form.farmId && farms.length > 1) errors.farmId = 'Chưa chọn trang trại';
    if (!form.pondId) errors.pondId = 'Chưa chọn ao nuôi';
    else if (!pond) errors.pondId = 'Ao không còn trống / ngoài phạm vi quản lý';
    if (!form.startDate) errors.startDate = 'Chưa chọn ngày thả giống';

    const count = parseCount(form.initialShrimpCount);
    let density: number | null = null;
    if (!form.initialShrimpCount.trim()) errors.initialShrimpCount = 'Chưa nhập số lượng giống';
    else if (count === null) errors.initialShrimpCount = 'Phải là số nguyên dương';
    else if (pond?.areaSize) {
      density = count / pond.areaSize;
      if (density > MAX_DENSITY) {
        errors.initialShrimpCount = `Mật độ ${density.toFixed(1)} con/m² vượt ngưỡng tối đa ${MAX_DENSITY} con/m²`;
      }
    }

    if (stageLock && form.stage !== stageLock) {
      errors.stage =
        stageLock === 'NURSERY'
          ? 'Trang trại Công nghệ cao: vụ mới bắt buộc bắt đầu Ương dưỡng'
          : 'Trang trại Truyền thống chỉ nuôi Thương phẩm';
    }

    const milestoneKey = form.stage === 'NURSERY' ? 'expectedTransferDate' : 'expectedHarvestDate';
    const milestone = form[milestoneKey];
    const milestoneDays = form.startDate && milestone ? daysBetween(form.startDate, milestone) : 0;
    if (!milestone) {
      errors[milestoneKey] = form.stage === 'NURSERY' ? 'Chưa chọn ngày tách ao' : 'Chưa chọn ngày thu hoạch dự kiến';
    } else if (form.startDate && milestoneDays < 1) {
      errors[milestoneKey] = 'Phải sau ngày thả giống ít nhất 1 ngày';
    }

    if (form.seedType.length > 100) errors.seedType = 'Tối đa 100 ký tự';
    const rate = form.targetSurvivalRate.trim() ? parseDecimal(form.targetSurvivalRate) : undefined;
    if (rate === null || (rate !== undefined && rate > 100)) errors.targetSurvivalRate = 'Từ 0 đến 100%';
    const size = form.targetHarvestSize.trim() ? parseDecimal(form.targetHarvestSize) : undefined;
    if (size === null || size === 0) errors.targetHarvestSize = 'Phải là số dương (con/kg)';
    const feed = form.targetTotalFeedKg.trim() ? parseDecimal(form.targetTotalFeedKg) : undefined;
    if (feed === null) errors.targetTotalFeedKg = 'Phải là số không âm';

    // Ước tính giống form thủ công
    const harvestCount = count && rate ? Math.round((count * rate) / 100) : 0;
    const biomassKg = harvestCount && size ? Math.round((harvestCount / size) * 10) / 10 : 0;
    const fcr = feed && biomassKg ? feed / biomassKg : null;

    return { errors, count, density, price: seedPrice, rate, size, feed, milestoneKey, milestoneDays, harvestCount, biomassKg, fcr };
  }, [form, pond, farms.length, stageLock, seedPrice]);

  const errorList = Object.values(ev.errors);
  const densityLevel = ev.density !== null ? DENSITY_LEVELS.find((l) => (ev.density as number) <= l.max) : undefined;

  const handleSubmit = () => {
    setTouched(true);
    if (locked || errorList.length > 0 || !ev.count) return;
    const nursery = form.stage === 'NURSERY';
    onSubmit({
      pondId: form.pondId,
      pondName: pond?.name,
      startDate: form.startDate,
      initialShrimpCount: ev.count,
      stage: form.stage,
      expectedTransferDate: nursery ? form.expectedTransferDate : undefined,
      expectedHarvestDate: nursery ? undefined : form.expectedHarvestDate,
      seedType: form.seedType.trim() || DEFAULTS.seedType,
      targetSurvivalRate: ev.rate,
      targetHarvestSize: ev.size,
      targetTotalFeedKg: ev.feed,
    });
  };

  const handleReset = () => {
    setForm(initialForm(draft, ponds));
    setDatesTouched(false);
    setTouched(false);
  };

  const inputBase =
    'w-full rounded-lg border px-2 py-1.5 text-xs font-semibold text-slate-800 outline-none transition-colors focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 disabled:opacity-70 disabled:cursor-not-allowed bg-white placeholder:text-[10px] placeholder:font-medium placeholder:text-slate-300';
  const border = (key: string) => (touched && ev.errors[key] ? 'border-rose-300 bg-rose-50/40' : 'border-slate-200');
  const fieldError = (key: string) =>
    touched && ev.errors[key] ? <span className="block text-[9.5px] font-semibold text-rose-500">{ev.errors[key]}</span> : null;
  const label = (text: string, required = false, hint?: string) => (
    <span className="block text-[10.5px] font-bold text-slate-600">
      {text}
      {hint && <span className="font-medium text-slate-400"> ({hint})</span>}
      {required && <span className="text-rose-500"> *</span>}
    </span>
  );
  const fmt = (n: number) => n.toLocaleString('vi-VN');

  return (
    <div className="mt-3 rounded-2xl border border-emerald-200 bg-gradient-to-b from-emerald-50/80 to-white p-3.5 shadow-sm space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 border-b border-emerald-100 pb-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center shadow-xs">
            <Sprout className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-black text-slate-900 uppercase tracking-wide">Thẻ tạo vụ nuôi</h4>
            <p className="text-[10px] text-slate-500 font-medium">
              {ponds.length} ao đang trống • các mục có dấu <span className="text-rose-500">*</span> là bắt buộc
            </p>
          </div>
        </div>
      </div>

      {/* 1. Ao thả giống */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <label className="space-y-1">
          {label('Trang trại', true)}
          <select
            value={form.farmId}
            onChange={(e) => handleFarmChange(e.target.value)}
            disabled={locked || farms.length <= 1}
            className={`${inputBase} ${border('farmId')}`}
          >
            <option value="">-- Chọn trang trại --</option>
            {farms.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
          {fieldError('farmId')}
        </label>
        <label className="space-y-1">
          {label('Ao thả giống (đang trống)', true)}
          <select
            value={form.pondId}
            onChange={(e) => setForm((f) => applyPond(f, e.target.value))}
            disabled={locked}
            className={`${inputBase} ${border('pondId')}`}
          >
            <option value="">-- Chọn ao --</option>
            {pondsInFarm.map((p) => (
              <option key={p.id} value={p.id}>
                {form.farmId ? p.name : `${p.name} (${p.farmName})`} — {fmt(p.areaSize)} m²
              </option>
            ))}
          </select>
          {fieldError('pondId')}
        </label>
      </div>

      {pond && (
        <div className="rounded-xl border border-slate-200 bg-white/90 grid grid-cols-3 text-center divide-x divide-slate-100">
          {[
            ['Diện tích', `${fmt(pond.areaSize)} m²`],
            ['Độ sâu', pond.depth ? `${pond.depth} m` : '—'],
            [
              'Mô hình',
              pond.farmingModel === 'HIGH_TECH' ? 'Công nghệ cao' : pond.farmingModel === 'TRADITIONAL' ? 'Truyền thống' : '—',
            ],
          ].map(([k, v]) => (
            <div key={k} className="px-1.5 py-1.5">
              <p className="text-[9.5px] font-semibold text-slate-400 uppercase">{k}</p>
              <p className="text-[11px] font-bold text-slate-800">{v}</p>
            </div>
          ))}
        </div>
      )}

      {/* 2. Thả giống */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <label className="space-y-1">
          {label('Ngày thả giống', true)}
          <input
            type="date"
            value={form.startDate}
            onChange={(e) => handleStartDateChange(e.target.value)}
            disabled={locked}
            className={`${inputBase} ${border('startDate')}`}
          />
          {fieldError('startDate')}
        </label>
        <label className="space-y-1">
          {label('Số lượng giống thả', true, 'con')}
          <input
            type="text"
            inputMode="numeric"
            value={form.initialShrimpCount}
            placeholder="Vd: 200000"
            onChange={(e) => set('initialShrimpCount', e.target.value)}
            disabled={locked}
            className={`${inputBase} ${
              touched && ev.errors.initialShrimpCount ? 'border-rose-300 bg-rose-50/40' : densityLevel ? densityLevel.cls : 'border-slate-200'
            }`}
          />
          {fieldError('initialShrimpCount') ||
            (densityLevel && ev.density !== null && (
              <span className={`block text-[9.5px] font-semibold ${densityLevel.cls.split(' ').pop()}`}>
                {ev.density.toFixed(1)} con/m² — {densityLevel.label}
              </span>
            ))}
        </label>
      </div>

      {/* 3. Giai đoạn + mốc ngày */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <label className="space-y-1">
          {label('Giai đoạn', true)}
          <select
            value={form.stage}
            onChange={(e) => set('stage', e.target.value as Stage)}
            disabled={locked || Boolean(stageLock)}
            className={`${inputBase} ${border('stage')}`}
          >
            <option value="NURSERY">Ương dưỡng (Nursery)</option>
            <option value="COMMERCIAL">Nuôi thương phẩm</option>
          </select>
          {fieldError('stage') ||
            (stageLock && (
              <span className="block text-[9.5px] font-medium text-slate-400">
                {stageLock === 'NURSERY' ? 'Công nghệ cao: bắt buộc bắt đầu Ương dưỡng' : 'Truyền thống: chỉ nuôi Thương phẩm'}
              </span>
            ))}
        </label>
        <label className="space-y-1">
          {form.stage === 'NURSERY' ? label('Ngày dự tính tách ao', true) : label('Ngày thu hoạch dự kiến', true)}
          <input
            type="date"
            value={form.stage === 'NURSERY' ? form.expectedTransferDate : form.expectedHarvestDate}
            min={form.startDate ? addDays(form.startDate, 1) : undefined}
            onChange={(e) => {
              setDatesTouched(true);
              set(form.stage === 'NURSERY' ? 'expectedTransferDate' : 'expectedHarvestDate', e.target.value);
            }}
            disabled={locked}
            className={`${inputBase} ${border(ev.milestoneKey)}`}
          />
          {fieldError(ev.milestoneKey) ||
            (ev.milestoneDays > 0 && (
              <span className="block text-[9.5px] font-medium text-slate-400">
                {form.stage === 'NURSERY' ? 'Ương' : 'Nuôi'} {ev.milestoneDays} ngày
              </span>
            ))}
        </label>
      </div>

      {/* 4. Con giống */}
      <label className="block space-y-1">
        {label('Loại giống')}
        <input
          type="text"
          value={form.seedType}
          onChange={(e) => set('seedType', e.target.value)}
          disabled={locked}
          className={`${inputBase} ${border('seedType')}`}
        />
        {fieldError('seedType')}
      </label>

      {/* 5. Giá giống — kết nối giá thị trường Tép Bạc (giống form tạo vụ thủ công) */}
      <div className="rounded-xl border border-blue-100 bg-gradient-to-br from-blue-50/80 to-indigo-50/40 p-2.5 space-y-1.5">
        <div className="flex items-center justify-between gap-2 text-[10.5px]">
          <span className="font-bold text-blue-900 flex items-center gap-1">
            <Tag className="w-3 h-3 text-blue-600" />
            Giá giống thị trường
          </span>
          <a
            href={market?.sourceUrl || SEED_PRICE_URL}
            target="_blank"
            rel="noopener noreferrer"
            title={
              market
                ? `${market.name} — cập nhật ${new Date(market.updatedAt).toLocaleString('vi-VN')}. Bấm để xem tại ${market.source}`
                : 'Bấm để xem giá tại tepbac.com'
            }
            className="font-bold text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1 bg-white px-2 py-0.5 rounded-md border border-blue-200"
          >
            <span>
              Tép Bạc: {fmt(seedPrice)} đ/con
              {!market || !market.isLive ? ' (mặc định)' : ''}
            </span>
            <ExternalLink className="w-3 h-3 text-blue-500" />
          </a>
        </div>
        <div className="grid grid-cols-2 gap-2 items-start">
          <div className="space-y-1">
            {label('Đơn giá giống', false, 'đ/con')}
            <div className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-bold text-slate-800 flex items-center justify-between gap-1">
              <span>{fmt(seedPrice)}</span>
              <span className="text-[9.5px] font-semibold text-emerald-600">Tự động</span>
            </div>
          </div>
          <div className="space-y-1">
            {label('Tổng tiền giống')}
            <div className="rounded-lg border border-blue-200/90 bg-white px-2 py-1.5 text-xs font-black text-blue-700 truncate">
              {ev.count ? `${fmt(Math.round(ev.count * ev.price))} đ` : '—'}
            </div>
          </div>
        </div>
        <p className="text-[10px] text-slate-500">
          {market
            ? `Tự động theo giá ${market.source}${market.isLive ? '' : ' (mặc định)'}, cập nhật ${new Date(market.updatedAt).toLocaleDateString('vi-VN')} — hệ thống áp giá Tép Bạc mới nhất khi lưu.`
            : 'Chưa lấy được giá Tép Bạc — đang hiển thị giá mặc định; hệ thống áp giá Tép Bạc mới nhất khi lưu.'}
        </p>
      </div>

      {/* 5. Mục tiêu vụ nuôi */}
      <div className="grid grid-cols-3 gap-2">
        <label className="space-y-1">
          {label('Tỷ lệ sống', false, '%')}
          <input
            type="text"
            inputMode="decimal"
            value={form.targetSurvivalRate}
            onChange={(e) => set('targetSurvivalRate', e.target.value)}
            disabled={locked}
            className={`${inputBase} ${border('targetSurvivalRate')}`}
          />
          {fieldError('targetSurvivalRate')}
        </label>
        <label className="space-y-1">
          {label('Size thu', false, 'con/kg')}
          <input
            type="text"
            inputMode="decimal"
            value={form.targetHarvestSize}
            onChange={(e) => set('targetHarvestSize', e.target.value)}
            disabled={locked}
            className={`${inputBase} ${border('targetHarvestSize')}`}
          />
          {fieldError('targetHarvestSize')}
        </label>
        <label className="space-y-1">
          {label('Thức ăn', false, 'kg')}
          <input
            type="text"
            inputMode="decimal"
            value={form.targetTotalFeedKg}
            placeholder="Không bắt buộc"
            onChange={(e) => set('targetTotalFeedKg', e.target.value)}
            disabled={locked}
            className={`${inputBase} ${border('targetTotalFeedKg')}`}
          />
          {fieldError('targetTotalFeedKg')}
        </label>
      </div>

      {ev.biomassKg > 0 && (
        <p className="rounded-lg bg-slate-50 border border-slate-200 px-2 py-1.5 text-[10px] font-medium text-slate-600">
          Ước tính: thu ~<b>{fmt(ev.harvestCount)}</b> con ≈ <b>{fmt(ev.biomassKg)} kg</b>
          {ev.fcr ? (
            <>
              {' '}
              • FCR dự kiến <b>{ev.fcr.toFixed(2)}</b>
            </>
          ) : null}
        </p>
      )}

      {/* Lỗi */}
      {touched && errorList.length > 0 && !locked && (
        <div className="rounded-xl border border-rose-200 bg-rose-50/70 px-2.5 py-1.5 text-[10.5px] font-semibold text-rose-700 space-y-0.5">
          <p className="flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" /> Vui lòng sửa {errorList.length} lỗi trước khi tạo vụ:
          </p>
          <ul className="list-disc pl-4 font-medium">
            {errorList.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Hành động */}
      {executed ? (
        <div className="flex items-center gap-1.5 p-2 rounded-xl bg-emerald-50 border border-emerald-200/80 text-emerald-800 text-xs font-bold">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>Đã tạo vụ nuôi vào hệ thống!</span>
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
            className="flex-1 py-2 px-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold text-xs shadow-xs transition-all hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            {executing ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Đang tạo...</span>
              </>
            ) : (
              <>
                <Sprout className="w-3.5 h-3.5" />
                <span>Tạo vụ nuôi</span>
              </>
            )}
          </button>
          <button
            type="button"
            onClick={handleReset}
            disabled={executing}
            title="Khôi phục giá trị AI đã điền"
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
