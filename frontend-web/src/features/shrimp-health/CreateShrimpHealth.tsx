/**
 * CreateShrimpHealth.tsx
 *
 * Form component for FE-21 — Record Shrimp Health Status.
 * Cascading dropdowns: Farm → Pond → Crop (ACTIVE only).
 * Indigo/Technician styled theme.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  CheckCircle2,
  AlertCircle,
  Loader2,
  ChevronDown,
  HeartPulse,
  Activity,
  Percent,
} from 'lucide-react';
import { farmService } from '../../services/farm.service';
import { pondService } from '../../services/pond.service';
import { cropService, type Crop } from '../../services/crop.service';
import { shrimpHealthService } from '../../services/shrimp-health.service';
import type {
  ShrimpHealthStatusType,
  ShrimpSeverityType,
} from '../../services/shrimp-health.service';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Farm {
  id: string;
  name: string;
}

interface Pond {
  id: string;
  name: string;
  farmId: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const HEALTH_STATUS_OPTIONS: { value: ShrimpHealthStatusType; label: string }[] = [
  { value: 'NORMAL', label: 'Bình thường' },
  { value: 'LETHARGIC', label: 'Lờ đờ' },
  { value: 'EDGE_GATHERING', label: 'Tấp mé bờ' },
  { value: 'LOSS_OF_APPETITE', label: 'Bỏ ăn' },
];

const SEVERITY_OPTIONS: { value: ShrimpSeverityType; label: string }[] = [
  { value: 'NORMAL', label: 'Bình thường' },
  { value: 'MILD', label: 'Nhẹ' },
  { value: 'MODERATE', label: 'Trung bình' },
  { value: 'SEVERE', label: 'Nặng' },
];

const HEALTH_STATUS_COLOR: Record<ShrimpHealthStatusType, string> = {
  NORMAL: 'text-emerald-700 bg-emerald-50 border-emerald-200',
  LETHARGIC: 'text-amber-700 bg-amber-50 border-amber-200',
  EDGE_GATHERING: 'text-orange-700 bg-orange-50 border-orange-200',
  LOSS_OF_APPETITE: 'text-red-700 bg-red-50 border-red-200',
};

const SEVERITY_COLOR: Record<ShrimpSeverityType, string> = {
  NORMAL: 'bg-emerald-500',
  MILD: 'bg-amber-400',
  MODERATE: 'bg-orange-500',
  SEVERE: 'bg-red-500',
};

// ─── Toast ────────────────────────────────────────────────────────────────────

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

// ─── Main Component ───────────────────────────────────────────────────────────

export default function CreateShrimpHealth() {
  // ── Data state ──────────────────────────────────────────────────────────────
  const [farms, setFarms] = useState<Farm[]>([]);
  const [ponds, setPonds] = useState<Pond[]>([]);
  const [crops, setCrops] = useState<Crop[]>([]);

  const [selectedFarmId, setSelectedFarmId] = useState('');
  const [selectedPondId, setSelectedPondId] = useState('');
  const [selectedCropId, setSelectedCropId] = useState('');
  const [recordTime, setRecordTime] = useState<string>(() => {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0, 16);
  });

  const [healthStatus, setHealthStatus] = useState<ShrimpHealthStatusType | ''>('');
  const [severity, setSeverity] = useState<ShrimpSeverityType | ''>('');
  const [affectedPercentage, setAffectedPercentage] = useState('');
  const [note, setNote] = useState('');

  // ── UI state ─────────────────────────────────────────────────────────────────
  const [loadingData, setLoadingData] = useState(true);
  const [loadingCrops, setLoadingCrops] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<ToastProps | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // ── Derived ──────────────────────────────────────────────────────────────────
  const filteredPonds = selectedFarmId
    ? ponds.filter((p) => p.farmId === selectedFarmId)
    : ponds;

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

  // ── Load active crops when pond changes ──────────────────────────────────────
  useEffect(() => {
    if (!selectedPondId) {
      setCrops([]);
      setSelectedCropId('');
      return;
    }
    (async () => {
      setLoadingCrops(true);
      setSelectedCropId('');
      try {
        const data = await cropService.getByPond(selectedPondId, 'ACTIVE');
        setCrops(data);
        if (data.length === 1) {
          setSelectedCropId(data[0].id);
        }
      } catch {
        showToast('Không thể tải danh sách vụ nuôi', 'error');
        setCrops([]);
      } finally {
        setLoadingCrops(false);
      }
    })();
  }, [selectedPondId]);

  // ── Handlers ─────────────────────────────────────────────────────────────────
  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const validate = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};

    if (!selectedFarmId) newErrors.farm = 'Vui lòng chọn trang trại';
    if (!selectedPondId) newErrors.pond = 'Vui lòng chọn ao nuôi';
    if (!selectedCropId) newErrors.crop = 'Vui lòng chọn vụ nuôi';
    if (!healthStatus) newErrors.healthStatus = 'Vui lòng chọn tình trạng sức khỏe';
    if (!severity) newErrors.severity = 'Vui lòng chọn mức độ nghiêm trọng';

    const pct = parseFloat(affectedPercentage);
    if (affectedPercentage === '' || isNaN(pct)) {
      newErrors.affectedPercentage = 'Vui lòng nhập tỷ lệ ảnh hưởng';
    } else if (pct < 0 || pct > 100) {
      newErrors.affectedPercentage = 'Tỷ lệ ảnh hưởng phải từ 0 đến 100';
    }

    if (note.length > 500) {
      newErrors.note = 'Ghi chú tối đa 500 ký tự';
    }

    const rt = new Date(recordTime);
    if (rt > new Date()) {
      newErrors.recordTime = 'Thời gian ghi nhận không được ở tương lai';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [selectedFarmId, selectedPondId, selectedCropId, healthStatus, severity, affectedPercentage, note, recordTime]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setSaving(true);
    try {
      await shrimpHealthService.create({
        farmId: selectedFarmId,
        pondId: selectedPondId,
        cropId: selectedCropId,
        recordTime: new Date(recordTime).toISOString(),
        healthStatus: healthStatus as ShrimpHealthStatusType,
        severity: severity as ShrimpSeverityType,
        affectedPercentage: parseFloat(affectedPercentage),
        note: note || undefined,
      });
      showToast('Ghi nhận tình trạng sức khỏe tôm thành công!', 'success');
      handleCancel();
    } catch (err: any) {
      showToast(err.message || 'Không thể lưu bản ghi. Vui lòng thử lại.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setSelectedFarmId('');
    setSelectedPondId('');
    setSelectedCropId('');
    setHealthStatus('');
    setSeverity('');
    setAffectedPercentage('');
    setNote('');
    setCrops([]);
    setErrors({});
  };

  const formatCropLabel = (crop: Crop) => {
    const d = new Date(crop.startDate);
    return `Vụ ${d.toLocaleDateString('vi-VN')} — ${crop.initialShrimpCount.toLocaleString()} con`;
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
      {toast && <Toast message={toast.message} type={toast.type} />}

      <form onSubmit={handleSubmit} noValidate>

        {/* ── Page Header (Indigo Theme) ──────────────────────────────── */}
        <div className="flex items-center gap-5 bg-white/80 backdrop-blur-xl px-6 py-5 rounded-3xl shadow-xl shadow-indigo-900/5 border border-white/60 mb-6">
          <div className="w-14 h-14 bg-gradient-to-br from-indigo-600 to-purple-500 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/30 flex-shrink-0">
            <HeartPulse className="w-7 h-7 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-black bg-clip-text text-transparent bg-gradient-to-r from-indigo-900 via-indigo-800 to-purple-600 tracking-tight">
              Ghi nhận Sức khỏe Tôm
            </h2>
            <p className="text-sm text-slate-500 font-medium mt-0.5">
              Theo dõi tình trạng sức khỏe tôm để phát hiện sớm các bất thường
            </p>
          </div>
        </div>

        {/* ── Section 1: Location + Time ──────────────────────────────── */}
        <div className="bg-white/90 backdrop-blur-lg rounded-3xl border border-white/60 shadow-lg shadow-slate-200/50 p-6 mb-5">
          <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-5 flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-extrabold">1</span>
            Vị trí & Thời gian
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                    setSelectedCropId('');
                    setCrops([]);
                    setErrors((prev) => ({ ...prev, farm: '' }));
                  }}
                  className={`w-full px-4 py-2.5 pr-10 rounded-xl border text-sm font-medium appearance-none outline-none transition-all cursor-pointer ${
                    errors.farm
                      ? 'border-red-300 bg-red-50/50 focus:ring-4 focus:ring-red-500/10 focus:border-red-400'
                      : 'border-slate-200 bg-slate-50/50 text-slate-700 hover:bg-white hover:border-slate-300 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/20'
                  }`}
                >
                  <option value="">-- Chọn trang trại --</option>
                  {farms.map((f) => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              </div>
              {errors.farm && (
                <p className="mt-1 text-xs text-red-600 flex items-center gap-1 font-medium">
                  <AlertCircle className="w-3 h-3 flex-shrink-0" />
                  {errors.farm}
                </p>
              )}
            </div>

            {/* Pond dropdown */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                Ao nuôi <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <select
                  value={selectedPondId}
                  onChange={(e) => {
                    setSelectedPondId(e.target.value);
                    setSelectedCropId('');
                    setErrors((prev) => ({ ...prev, pond: '' }));
                  }}
                  disabled={!selectedFarmId}
                  className={`w-full px-4 py-2.5 pr-10 rounded-xl border text-sm font-medium appearance-none outline-none transition-all cursor-pointer ${
                    !selectedFarmId
                      ? 'border-slate-100 bg-slate-50 text-slate-400 cursor-not-allowed'
                      : errors.pond
                        ? 'border-red-300 bg-red-50/50 focus:ring-4 focus:ring-red-500/10 focus:border-red-400'
                        : 'border-slate-200 bg-slate-50/50 text-slate-700 hover:bg-white hover:border-slate-300 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/20'
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
              {errors.pond && (
                <p className="mt-1 text-xs text-red-600 flex items-center gap-1 font-medium">
                  <AlertCircle className="w-3 h-3 flex-shrink-0" />
                  {errors.pond}
                </p>
              )}
            </div>

            {/* Crop dropdown */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                Vụ nuôi <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <select
                  value={selectedCropId}
                  onChange={(e) => {
                    setSelectedCropId(e.target.value);
                    setErrors((prev) => ({ ...prev, crop: '' }));
                  }}
                  disabled={!selectedPondId || loadingCrops}
                  className={`w-full px-4 py-2.5 pr-10 rounded-xl border text-sm font-medium appearance-none outline-none transition-all cursor-pointer ${
                    !selectedPondId || loadingCrops
                      ? 'border-slate-100 bg-slate-50 text-slate-400 cursor-not-allowed'
                      : errors.crop
                        ? 'border-red-300 bg-red-50/50 focus:ring-4 focus:ring-red-500/10 focus:border-red-400'
                        : 'border-slate-200 bg-slate-50/50 text-slate-700 hover:bg-white hover:border-slate-300 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/20'
                  }`}
                >
                  <option value="">
                    {loadingCrops
                      ? 'Đang tải vụ nuôi...'
                      : !selectedPondId
                        ? '-- Chọn ao nuôi trước --'
                        : crops.length === 0
                          ? '-- Không có vụ nuôi đang hoạt động --'
                          : '-- Chọn vụ nuôi --'}
                  </option>
                  {crops.map((c) => (
                    <option key={c.id} value={c.id}>{formatCropLabel(c)}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              </div>
              {errors.crop && (
                <p className="mt-1 text-xs text-red-600 flex items-center gap-1 font-medium">
                  <AlertCircle className="w-3 h-3 flex-shrink-0" />
                  {errors.crop}
                </p>
              )}
            </div>

            {/* Record time */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                Thời gian ghi nhận <span className="text-red-500">*</span>
              </label>
              <input
                type="datetime-local"
                value={recordTime}
                onChange={(e) => {
                  setRecordTime(e.target.value);
                  setErrors((prev) => ({ ...prev, recordTime: '' }));
                }}
                className={`w-full px-4 py-2.5 rounded-xl border text-sm font-medium outline-none transition-all ${
                  errors.recordTime
                    ? 'border-red-300 bg-red-50/50 focus:ring-4 focus:ring-red-500/10 focus:border-red-400'
                    : 'border-slate-200 bg-slate-50/50 text-slate-700 hover:bg-white hover:border-slate-300 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/20'
                }`}
              />
              {errors.recordTime && (
                <p className="mt-1 text-xs text-red-600 flex items-center gap-1 font-medium">
                  <AlertCircle className="w-3 h-3 flex-shrink-0" />
                  {errors.recordTime}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* ── Section 2: Health Status ────────────────────────────────── */}
        <div className="bg-white/90 backdrop-blur-lg rounded-3xl border border-white/60 shadow-lg shadow-slate-200/50 p-6 mb-5">
          <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-5 flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-extrabold">2</span>
            Tình trạng sức khỏe
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {/* Health Status dropdown */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <span className="text-indigo-600"><HeartPulse className="w-4 h-4" /></span>
                  Tình trạng <span className="text-red-500">*</span>
                </label>
                {healthStatus && (
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-bold rounded-full border ${HEALTH_STATUS_COLOR[healthStatus as ShrimpHealthStatusType]}`}>
                    {HEALTH_STATUS_OPTIONS.find((o) => o.value === healthStatus)?.label}
                  </span>
                )}
              </div>
              <div className="relative">
                <select
                  value={healthStatus}
                  onChange={(e) => {
                    setHealthStatus(e.target.value as ShrimpHealthStatusType | '');
                    setErrors((prev) => ({ ...prev, healthStatus: '' }));
                  }}
                  className={`w-full px-4 py-2.5 pr-10 rounded-xl border text-sm font-medium appearance-none outline-none transition-all cursor-pointer ${
                    errors.healthStatus
                      ? 'border-red-300 bg-red-50/50 focus:ring-4 focus:ring-red-500/10 focus:border-red-400'
                      : 'border-slate-200 bg-slate-50/50 text-slate-700 hover:bg-white hover:border-slate-300 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/20'
                  }`}
                >
                  <option value="">-- Chọn tình trạng --</option>
                  {HEALTH_STATUS_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              </div>
              {errors.healthStatus && (
                <p className="mt-1 text-xs text-red-600 flex items-center gap-1 font-medium">
                  <AlertCircle className="w-3 h-3 flex-shrink-0" />
                  {errors.healthStatus}
                </p>
              )}
            </div>

            {/* Severity dropdown */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <span className="text-indigo-600"><Activity className="w-4 h-4" /></span>
                  Mức độ nghiêm trọng <span className="text-red-500">*</span>
                </label>
                {severity && (
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-bold rounded-full border border-slate-200 bg-slate-50 text-slate-700">
                    <span className={`w-2 h-2 rounded-full ${SEVERITY_COLOR[severity as ShrimpSeverityType]}`} />
                    {SEVERITY_OPTIONS.find((o) => o.value === severity)?.label}
                  </span>
                )}
              </div>
              <div className="relative">
                <select
                  value={severity}
                  onChange={(e) => {
                    setSeverity(e.target.value as ShrimpSeverityType | '');
                    setErrors((prev) => ({ ...prev, severity: '' }));
                  }}
                  className={`w-full px-4 py-2.5 pr-10 rounded-xl border text-sm font-medium appearance-none outline-none transition-all cursor-pointer ${
                    errors.severity
                      ? 'border-red-300 bg-red-50/50 focus:ring-4 focus:ring-red-500/10 focus:border-red-400'
                      : 'border-slate-200 bg-slate-50/50 text-slate-700 hover:bg-white hover:border-slate-300 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/20'
                  }`}
                >
                  <option value="">-- Chọn mức độ --</option>
                  {SEVERITY_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              </div>
              {errors.severity && (
                <p className="mt-1 text-xs text-red-600 flex items-center gap-1 font-medium">
                  <AlertCircle className="w-3 h-3 flex-shrink-0" />
                  {errors.severity}
                </p>
              )}
            </div>

            {/* Affected Percentage */}
            <div className="sm:col-span-2">
              <div className="flex items-center justify-between mb-1.5">
                <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <span className="text-indigo-600"><Percent className="w-4 h-4" /></span>
                  Tỷ lệ ảnh hưởng (%) <span className="text-red-500">*</span>
                </label>
                {affectedPercentage !== '' && !isNaN(parseFloat(affectedPercentage)) && (
                  <span className="text-sm font-bold text-slate-700">
                    {parseFloat(affectedPercentage).toFixed(1)}%
                  </span>
                )}
              </div>
              <input
                type="number"
                inputMode="decimal"
                step="0.1"
                min="0"
                max="100"
                value={affectedPercentage}
                onChange={(e) => {
                  setAffectedPercentage(e.target.value);
                  setErrors((prev) => ({ ...prev, affectedPercentage: '' }));
                }}
                placeholder="Nhập tỷ lệ phần trăm tôm bị ảnh hưởng (0–100)"
                className={`w-full px-4 py-2.5 rounded-xl border text-sm font-medium outline-none transition-all ${
                  errors.affectedPercentage
                    ? 'border-red-300 bg-red-50/50 focus:ring-4 focus:ring-red-500/10 focus:border-red-400'
                    : 'border-slate-200 bg-slate-50/50 text-slate-700 hover:bg-white hover:border-slate-300 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/20'
                }`}
              />
              {/* Visual bar */}
              {affectedPercentage !== '' && !isNaN(parseFloat(affectedPercentage)) && parseFloat(affectedPercentage) >= 0 && (
                <div className="mt-2 h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      parseFloat(affectedPercentage) <= 25
                        ? 'bg-emerald-500'
                        : parseFloat(affectedPercentage) <= 50
                          ? 'bg-amber-400'
                          : parseFloat(affectedPercentage) <= 75
                            ? 'bg-orange-500'
                            : 'bg-red-500'
                    }`}
                    style={{ width: `${Math.min(parseFloat(affectedPercentage), 100)}%` }}
                  />
                </div>
              )}
              {errors.affectedPercentage && (
                <p className="mt-1 text-xs text-red-600 flex items-center gap-1 font-medium">
                  <AlertCircle className="w-3 h-3 flex-shrink-0" />
                  {errors.affectedPercentage}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* ── Section 3: Note ───────────────────────────────────────────── */}
        <div className="bg-white/90 backdrop-blur-lg rounded-3xl border border-white/60 shadow-lg shadow-slate-200/50 p-6 mb-6">
          <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-extrabold">3</span>
            Ghi chú
          </h3>
          <textarea
            value={note}
            onChange={(e) => {
              setNote(e.target.value);
              setErrors((prev) => ({ ...prev, note: '' }));
            }}
            rows={3}
            maxLength={500}
            placeholder="Nhập ghi chú về tình trạng sức khỏe tôm (không bắt buộc, tối đa 500 ký tự)..."
            className={`w-full px-4 py-3 rounded-xl border text-sm font-medium outline-none transition-all resize-none placeholder:text-slate-400 ${
              errors.note
                ? 'border-red-300 bg-red-50/50 focus:ring-4 focus:ring-red-500/10 focus:border-red-400'
                : 'border-slate-200 bg-slate-50/50 text-slate-700 hover:bg-white hover:border-slate-300 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/20'
            }`}
          />
          <div className="flex items-center justify-between mt-1.5">
            {errors.note ? (
              <p className="text-xs text-red-600 flex items-center gap-1 font-medium">
                <AlertCircle className="w-3 h-3 flex-shrink-0" />
                {errors.note}
              </p>
            ) : (
              <span />
            )}
            <span className={`text-xs font-medium ${note.length > 450 ? 'text-amber-600' : 'text-slate-400'}`}>
              {note.length}/500
            </span>
          </div>
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
                Lưu bản ghi
              </>
            )}
          </button>
        </div>

      </form>
    </div>
  );
}
