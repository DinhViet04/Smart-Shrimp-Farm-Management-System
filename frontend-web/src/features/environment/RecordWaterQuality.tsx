/**
 * RecordWaterQuality.tsx
 *
 * Web feature component for FE-23 — Record Water Quality Parameters.
 *
 * Responsive layout:
 *   < 640px   → single column
 *   640–1024px → two columns for parameter fields
 *   > 1024px  → centered container, max-width 900px, two columns
 *
 * Uses the same apiFetch utility (JWT-aware) as the rest of the web app.
 * Reusable by FE-24, FE-25, FE-37, FE-38, FE-42, FE-49, FE-51.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  CheckCircle2,
  AlertCircle,
  Loader2,
  ChevronDown,
  Droplets,
  Thermometer,
  FlaskConical,
  Wind,
  Waves,
  Beaker,
} from 'lucide-react';
import { farmService } from '../../services/farm.service';
import { pondService } from '../../services/pond.service';
import { waterQualityService } from '../../services/water-quality.service';
import type { CreateWaterQualityPayload } from '../../services/water-quality.service';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Farm {
  id: string;
  name: string;
  ponds?: Pond[];
}

interface Pond {
  id: string;
  name: string;
  farmId: string;
}

type WQStatus = 'optimal' | 'warning' | 'danger' | null;

// ─── Water quality status logic ───────────────────────────────────────────────

function getTemperatureStatus(v: number | null): WQStatus {
  if (v === null || v < 15 || v > 40) return null;
  if (v >= 28 && v <= 32) return 'optimal';
  if ((v >= 25 && v < 28) || (v > 32 && v <= 34)) return 'warning';
  return 'danger';
}

function getPhStatus(v: number | null): WQStatus {
  if (v === null || v < 5 || v > 10) return null;
  if (v >= 7.5 && v <= 8.5) return 'optimal';
  if ((v >= 7.0 && v < 7.5) || (v > 8.5 && v <= 9.0)) return 'warning';
  return 'danger';
}

function getDoStatus(v: number | null): WQStatus {
  if (v === null || v < 0 || v > 20) return null;
  if (v > 5) return 'optimal';
  if (v >= 4) return 'warning';
  return 'danger';
}

function getSalinityStatus(v: number | null): WQStatus {
  if (v === null || v < 0 || v > 50) return null;
  if (v >= 10 && v <= 25) return 'optimal';
  if ((v >= 5 && v < 10) || (v > 25 && v <= 30)) return 'warning';
  return 'danger';
}

function getAlkalinityStatus(v: number | null): WQStatus {
  if (v === null || v < 0 || v > 300) return null;
  if (v >= 80 && v <= 200) return 'optimal';
  if ((v >= 60 && v < 80) || (v > 200 && v <= 250)) return 'warning';
  return 'danger';
}

function getNh3Status(v: number | null): WQStatus {
  if (v === null || v < 0) return null;
  if (v <= 0.10) return 'optimal';
  if (v > 0.10 && v <= 0.30) return 'warning';
  return 'danger';
}

function getNo2Status(v: number | null): WQStatus {
  if (v === null || v < 0) return null;
  if (v <= 0.30) return 'optimal';
  if (v > 0.30 && v <= 1.00) return 'warning';
  return 'danger';
}

function getTransparencyStatus(v: number | null): WQStatus {
  if (v === null || v < 0) return null;
  if (v >= 30 && v <= 40) return 'optimal';
  if ((v >= 20 && v < 30) || (v > 40 && v <= 50)) return 'warning';
  return 'danger';
}

function validateField(name: string, v: number | null): string | null {
  if (v === null || isNaN(v as number)) return 'Vui lòng nhập giá trị hợp lệ';
  switch (name) {
    case 'temperature': return v < 15 || v > 40 ? 'Nhiệt độ phải từ 15–40°C' : null;
    case 'ph': return v < 5 || v > 10 ? 'pH phải từ 5–10' : null;
    case 'dissolvedOxygen': return v < 0 || v > 20 ? 'DO phải từ 0–20 mg/L' : null;
    case 'salinity': return v < 0 || v > 50 ? 'Độ mặn phải từ 0–50 ppt' : null;
    case 'alkalinity': return v < 0 || v > 300 ? 'Độ kiềm phải từ 0–300 mg/L' : null;
    case 'nh3': return v < 0 ? 'NH3 không được âm' : null;
    case 'no2': return v < 0 ? 'NO2 không được âm' : null;
    case 'transparency': return v < 0 ? 'Độ trong không được âm' : null;
    default: return null;
  }
}

const STATUS_CONFIG = {
  optimal: {
    badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    ring: 'focus:ring-emerald-500/20 focus:border-emerald-500',
    dot: 'bg-emerald-500',
    label: 'Tối ưu',
  },
  warning: {
    badge: 'bg-amber-50 text-amber-700 border-amber-200',
    ring: 'focus:ring-amber-500/20 focus:border-amber-500',
    dot: 'bg-amber-400',
    label: 'Cảnh báo',
  },
  danger: {
    badge: 'bg-red-50 text-red-700 border-red-200',
    ring: 'focus:ring-red-500/20 focus:border-red-500',
    dot: 'bg-red-500',
    label: 'Nguy hiểm',
  },
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: WQStatus }) {
  if (!status) return null;
  const cfg = STATUS_CONFIG[status];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-bold rounded-full border ${cfg.badge}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

interface ParameterFieldProps {
  label: string;
  unit: string;
  fieldKey: string;
  value: string;
  icon: React.ReactNode;
  onChange: (key: string, val: string) => void;
  error: string | null;
  status: WQStatus;
  placeholder?: string;
}

function ParameterField({
  label, unit, fieldKey, value, icon, onChange, error, status, placeholder,
}: ParameterFieldProps) {
  const statusRing = status ? STATUS_CONFIG[status].ring : 'focus:ring-indigo-500/20 focus:border-indigo-500';
  return (
    <div>
      {/* Label row */}
      <div className="flex items-center justify-between mb-1.5">
        <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <span className="text-indigo-600">{icon}</span>
          {label}
          {unit && <span className="text-slate-400 font-normal">({unit})</span>}
        </label>
        <StatusBadge status={status} />
      </div>

      {/* Input */}
      <input
        type="number"
        inputMode="decimal"
        step="any"
        value={value}
        onChange={(e) => onChange(fieldKey, e.target.value)}
        placeholder={placeholder ?? `Nhập ${label.toLowerCase()}`}
        className={`
          w-full px-4 py-2.5 rounded-xl border text-sm font-medium transition-all outline-none
          ${error
            ? 'border-red-300 bg-red-50/50 focus:ring-4 focus:ring-red-500/10 focus:border-red-400'
            : `border-slate-200 bg-slate-50/50 hover:bg-white hover:border-slate-300 focus:bg-white focus:ring-4 ${statusRing}`
          }
        `}
      />

      {/* Validation message */}
      {error && (
        <p className="mt-1 text-xs text-red-600 flex items-center gap-1 font-medium">
          <AlertCircle className="w-3 h-3 flex-shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}

// ─── Toast ────────────────────────────────────────────────────────────────────

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
      {type === 'success'
        ? <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
        : <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />}
      <span>{message}</span>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

const INITIAL_FORM = {
  temperature: '',
  ph: '',
  dissolvedOxygen: '',
  salinity: '',
  alkalinity: '',
  nh3: '',
  no2: '',
  transparency: '',
  note: '',
};

type FormKey = keyof typeof INITIAL_FORM;

export default function RecordWaterQuality() {
  // ── Data state ──────────────────────────────────────────────────────────────
  const [farms, setFarms] = useState<Farm[]>([]);
  const [ponds, setPonds] = useState<Pond[]>([]);
  const [selectedFarmId, setSelectedFarmId] = useState('');
  const [selectedPondId, setSelectedPondId] = useState('');
  const [recordTime, setRecordTime] = useState<string>(() => {
    // Default to current local datetime-local string
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0, 16);
  });

  const [form, setForm] = useState(INITIAL_FORM);
  const [errors, setErrors] = useState<Partial<Record<FormKey, string>>>({});

  // ── UI state ─────────────────────────────────────────────────────────────────
  const [loadingData, setLoadingData] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<ToastProps | null>(null);

  // ── Derived ──────────────────────────────────────────────────────────────────
  const filteredPonds = selectedFarmId
    ? ponds.filter((p) => p.farmId === selectedFarmId)
    : ponds;

  const numVal = (key: FormKey): number | null => {
    const n = parseFloat(form[key]);
    return isNaN(n) ? null : n;
  };

  const status = {
    temperature: getTemperatureStatus(numVal('temperature')),
    ph: getPhStatus(numVal('ph')),
    dissolvedOxygen: getDoStatus(numVal('dissolvedOxygen')),
    salinity: getSalinityStatus(numVal('salinity')),
    alkalinity: getAlkalinityStatus(numVal('alkalinity')),
    nh3: getNh3Status(numVal('nh3')),
    no2: getNo2Status(numVal('no2')),
    transparency: getTransparencyStatus(numVal('transparency')),
  };

  // ── Load farms & ponds ───────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const [farmsData, pondsData] = await Promise.all([
          farmService.getAll(),
          pondService.getAll(),
        ]);
        setFarms(farmsData);
        setPonds(pondsData);
      } catch {
        showToast('Không thể tải danh sách trang trại / ao nuôi', 'error');
      } finally {
        setLoadingData(false);
      }
    })();
  }, []);

  // ── Handlers ─────────────────────────────────────────────────────────────────
  const handleChange = useCallback((key: string, val: string) => {
    setForm((prev) => ({ ...prev, [key]: val }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  }, []);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const validate = (): boolean => {
    const newErrors: Partial<Record<FormKey, string>> = {};
    const numericKeys: FormKey[] = [
      'temperature', 'ph', 'dissolvedOxygen', 'salinity', 'alkalinity', 'nh3', 'no2', 'transparency',
    ];
    numericKeys.forEach((k) => {
      const err = validateField(k, numVal(k));
      if (err) newErrors[k] = err;
    });
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedPondId) {
      showToast('Vui lòng chọn ao nuôi trước khi lưu', 'error');
      return;
    }
    if (!validate()) return;

    setSaving(true);
    try {
      const payload: CreateWaterQualityPayload = {
        pondId: selectedPondId,
        recordTime: new Date(recordTime).toISOString(),
        temperature: parseFloat(form.temperature),
        ph: parseFloat(form.ph),
        dissolvedOxygen: parseFloat(form.dissolvedOxygen),
        salinity: parseFloat(form.salinity),
        alkalinity: parseFloat(form.alkalinity),
        nh3: parseFloat(form.nh3),
        no2: parseFloat(form.no2),
        transparency: parseFloat(form.transparency),
        note: form.note || undefined,
      };

      await waterQualityService.create(payload);
      showToast('Ghi nhận thông số môi trường nước thành công!', 'success');

      // Reset form after successful save
      setForm(INITIAL_FORM);
      setSelectedPondId('');
      setErrors({});
    } catch (err: any) {
      showToast(err.message || 'Không thể lưu thông số. Vui lòng thử lại.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setForm(INITIAL_FORM);
    setSelectedPondId('');
    setSelectedFarmId('');
    setErrors({});
  };

  // ─── Render ───────────────────────────────────────────────────────────────────

  if (loadingData) {
    return (
      <div className="flex items-center justify-center h-80">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-slate-200 border-t-indigo-600 rounded-full animate-spin" />
          <p className="text-sm font-medium text-slate-500">Đang tải dữ liệu...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[900px] mx-auto relative">
      {/* Toast notification */}
      {toast && <Toast message={toast.message} type={toast.type} />}

      <form onSubmit={handleSubmit} noValidate>

        {/* ── Page Header ──────────────────────────────────────────────── */}
        <div className="flex items-center gap-5 bg-white/80 backdrop-blur-xl px-6 py-5 rounded-3xl shadow-xl shadow-indigo-900/5 border border-white/60 mb-6">
          <div className="w-14 h-14 bg-gradient-to-br from-indigo-600 to-purple-500 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/30 flex-shrink-0">
            <Droplets className="w-7 h-7 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-black bg-clip-text text-transparent bg-gradient-to-r from-indigo-900 via-indigo-800 to-purple-600 tracking-tight">
              Ghi nhận Thông số Môi trường Nước
            </h2>
            <p className="text-sm text-slate-500 font-medium mt-0.5">
              Nhập các thông số đo lường từ ao nuôi để theo dõi và phân tích chất lượng nước
            </p>
          </div>
        </div>

        {/* ── Section 1: Location + Time ──────────────────────────────── */}
        <div className="bg-white/90 backdrop-blur-lg rounded-3xl border border-white/60 shadow-lg shadow-slate-200/50 p-6 mb-5">
          <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-5 flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-extrabold">1</span>
            Vị trí & Thời gian
          </h3>

          {/* Responsive grid: 1 col mobile, 3 cols md+ */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Farm dropdown */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                Trang trại <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <select
                  value={selectedFarmId}
                  onChange={(e) => {
                    setSelectedFarmId(e.target.value);
                    setSelectedPondId('');
                  }}
                  className="w-full px-4 py-2.5 pr-10 rounded-xl border border-slate-200 bg-slate-50/50 text-sm font-medium text-slate-700 appearance-none outline-none hover:bg-white hover:border-slate-300 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/20 transition-all cursor-pointer"
                >
                  <option value="">-- Chọn trang trại --</option>
                  {farms.map((f) => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              </div>
            </div>

            {/* Pond dropdown */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                Ao nuôi <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <select
                  value={selectedPondId}
                  onChange={(e) => setSelectedPondId(e.target.value)}
                  disabled={!selectedFarmId}
                  className={`w-full px-4 py-2.5 pr-10 rounded-xl border text-sm font-medium appearance-none outline-none transition-all cursor-pointer ${selectedFarmId
                      ? 'border-slate-200 bg-slate-50/50 text-slate-700 hover:bg-white hover:border-slate-300 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/20'
                      : 'border-slate-100 bg-slate-50 text-slate-400 cursor-not-allowed'
                    }`}
                >
                  <option value="">
                    {selectedFarmId ? '-- Chọn ao nuôi --' : '-- Chọn trang trại trước --'}
                  </option>
                  {filteredPonds.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              </div>
            </div>

            {/* Record time */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                Thời gian đo <span className="text-red-500">*</span>
              </label>
              <input
                type="datetime-local"
                value={recordTime}
                onChange={(e) => setRecordTime(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 text-sm font-medium text-slate-700 outline-none hover:bg-white hover:border-slate-300 focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 transition-all"
              />
            </div>
          </div>
        </div>

        {/* ── Section 2: Parameters ─────────────────────────────────────── */}
        <div className="bg-white/90 backdrop-blur-lg rounded-3xl border border-white/60 shadow-lg shadow-slate-200/50 p-6 mb-5">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center text-xs">2</span>
              Thông số đo lường
            </h3>
            {/* Status legend */}
            <div className="hidden sm:flex items-center gap-3 text-xs text-slate-500">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500" /> Tối ưu
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-amber-400" /> Cảnh báo
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-red-500" /> Nguy hiểm
              </span>
            </div>
          </div>

          {/* Responsive 2-column grid for parameters */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <ParameterField
              label="Nhiệt độ"
              unit="°C"
              fieldKey="temperature"
              value={form.temperature}
              icon={<Thermometer className="w-4 h-4" />}
              onChange={handleChange}
              error={errors.temperature ?? null}
              status={status.temperature}
              placeholder="vd: 29.5"
            />
            <ParameterField
              label="pH"
              unit=""
              fieldKey="ph"
              value={form.ph}
              icon={<FlaskConical className="w-4 h-4" />}
              onChange={handleChange}
              error={errors.ph ?? null}
              status={status.ph}
              placeholder="vd: 7.9"
            />
            <ParameterField
              label="Oxy hòa tan (DO)"
              unit="mg/L"
              fieldKey="dissolvedOxygen"
              value={form.dissolvedOxygen}
              icon={<Wind className="w-4 h-4" />}
              onChange={handleChange}
              error={errors.dissolvedOxygen ?? null}
              status={status.dissolvedOxygen}
              placeholder="vd: 5.6"
            />
            <ParameterField
              label="Độ mặn"
              unit="ppt"
              fieldKey="salinity"
              value={form.salinity}
              icon={<Waves className="w-4 h-4" />}
              onChange={handleChange}
              error={errors.salinity ?? null}
              status={status.salinity}
              placeholder="vd: 18"
            />
            <ParameterField
              label="Độ kiềm"
              unit="mg/L"
              fieldKey="alkalinity"
              value={form.alkalinity}
              icon={<Beaker className="w-4 h-4" />}
              onChange={handleChange}
              error={errors.alkalinity ?? null}
              status={status.alkalinity}
              placeholder="vd: 120"
            />
            <ParameterField
              label="NH3"
              unit="mg/L"
              fieldKey="nh3"
              value={form.nh3}
              icon={<FlaskConical className="w-4 h-4" />}
              onChange={handleChange}
              error={errors.nh3 ?? null}
              status={status.nh3}
              placeholder="vd: 0.02"
            />
            <ParameterField
              label="NO2"
              unit="mg/L"
              fieldKey="no2"
              value={form.no2}
              icon={<FlaskConical className="w-4 h-4" />}
              onChange={handleChange}
              error={errors.no2 ?? null}
              status={status.no2}
              placeholder="vd: 0.03"
            />
            <ParameterField
              label="Độ trong"
              unit="cm"
              fieldKey="transparency"
              value={form.transparency}
              icon={<Beaker className="w-4 h-4" />}
              onChange={handleChange}
              error={errors.transparency ?? null}
              status={status.transparency}
              placeholder="vd: 35"
            />
          </div>
        </div>

        {/* ── Section 3: Note ───────────────────────────────────────────── */}
        <div className="bg-white/90 backdrop-blur-lg rounded-3xl border border-white/60 shadow-lg shadow-slate-200/50 p-6 mb-6">
          <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-extrabold">2</span>
            Ghi chú
          </h3>
          <textarea
            value={form.note}
            onChange={(e) => handleChange('note', e.target.value)}
            rows={3}
            placeholder="Nhập ghi chú về lần đo này (không bắt buộc)..."
            className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50/50 text-sm font-medium text-slate-700 outline-none hover:bg-white hover:border-slate-300 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/20 transition-all resize-none placeholder:text-slate-400"
          />
        </div>

        {/* ── Actions ───────────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row items-center justify-end gap-3">
          <button
            type="button"
            onClick={handleCancel}
            disabled={saving}
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 text-sm font-semibold hover:bg-slate-50 hover:border-slate-300 transition-all disabled:opacity-50"
          >
            Hủy bỏ
          </button>
          <button
            type="submit"
            disabled={saving}
            className="w-full sm:w-auto px-8 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white text-sm font-bold flex items-center justify-center gap-2 transition-all duration-200 shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/40 hover:-translate-y-0.5 disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:translate-y-0"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Đang lưu...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                Lưu thông số
              </>
            )}
          </button>
        </div>

      </form>
    </div>
  );
}
