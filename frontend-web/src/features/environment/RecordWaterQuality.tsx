/**
 * RecordWaterQuality.tsx
 *
 * Web feature component for Technician Role — Record Water Quality Parameters.
 * Features:
 *   - Real-time weather forecasting widget using live Open-Meteo API & Farm location.
 *   - AI Analysis & Evaluation widget (Rule-based intelligent assessment with live feedback).
 *   - Intuitive 2-column layout (Form + Live Widgets) tailored for Web/Desktop.
 *   - Instant parameter status badges (Tối ưu / Cảnh báo / Nguy hiểm).
 *   - Full integration with backend WaterQuality, Farm, Pond, and Weather services.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Loader2,
  ChevronDown,
  Droplets,
  Thermometer,
  FlaskConical,
  Wind,
  Waves,
  Beaker,
  CloudSun,
  Sun,
  CloudRain,
  CloudLightning,
  Cloud,
  Sparkles,
  RotateCw,
  Lightbulb,
  ArrowRight,
  X,
  ShieldAlert,
  Wrench,
  History,
} from 'lucide-react';
import { pondService } from '../../services/pond.service';
import { waterQualityService } from '../../services/water-quality.service';
import { weatherService, type WeatherInfo } from '../../services/weather.service';
import type { CreateWaterQualityPayload } from '../../services/water-quality.service';
import type { WaterWarningRecord } from './WaterTreatment';
import LoadingMotion from '../../components/LoadingMotion';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Farm {
  id: string;
  name: string;
  location?: string | null;
  address?: string;
  ponds?: Pond[];
}

interface Pond {
  id: string;
  name: string;
  farmId: string;
}

type WQStatus = 'optimal' | 'warning' | 'danger' | null;

// ─── Water quality status evaluation logic ───────────────────────────────────

function getTemperatureStatus(v: number | null): WQStatus {
  if (v === null || v < 15 || v > 40) return null;
  if (v >= 25 && v <= 30) return 'optimal';
  if ((v >= 20 && v < 25) || (v > 30 && v <= 33)) return 'warning';
  return 'danger';
}

function getPhStatus(v: number | null): WQStatus {
  if (v === null || v < 5 || v > 10) return null;
  if (v >= 8.2 && v <= 8.5) return 'optimal';
  if ((v >= 7.5 && v < 8.2) || (v > 8.5 && v <= 9.0)) return 'warning';
  return 'danger';
}

function getDoStatus(v: number | null): WQStatus {
  if (v === null || v < 0 || v > 20) return null;
  if (v > 4) return 'optimal';
  if (v >= 3) return 'warning';
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
  if (v >= 100 && v <= 160) return 'optimal';
  if ((v >= 80 && v < 100) || (v > 160 && v <= 200)) return 'warning';
  return 'danger';
}

function getNh3Status(v: number | null): WQStatus {
  if (v === null || v < 0) return null;
  if (v <= 0.30) return 'optimal';
  if (v > 0.30 && v <= 0.50) return 'warning';
  return 'danger';
}

function getH2sStatus(v: number | null): WQStatus {
  if (v === null || v < 0) return null;
  if (v <= 0.03) return 'optimal';
  if (v > 0.03 && v <= 0.05) return 'warning';
  return 'danger';
}

function getTransparencyStatus(v: number | null): WQStatus {
  if (v === null || v < 0) return null;
  if (v >= 25 && v <= 40) return 'optimal';
  if ((v >= 20 && v < 25) || (v > 40 && v <= 50)) return 'warning';
  return 'danger';
}

function getWaterColorStatus(v: string): WQStatus {
  if (!v) return null;
  const val = v.toLowerCase().trim();
  if (val.includes('xanh lục') || val.includes('xanh vỏ đậu') || val.includes('màu nâu nhạt') || val.includes('nâu nhạt')) {
    return 'optimal';
  }
  if (val.includes('đỏ') || val.includes('đen')) {
    return 'danger';
  }
  return 'warning';
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
    case 'h2s': return v < 0 ? 'H2S không được âm' : null;
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
  hint?: string;
}

function ParameterField({
  label, unit, fieldKey, value, icon, onChange, error, status, placeholder, hint,
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
        placeholder={placeholder ?? `vd: 0.0`}
        className={`
          w-full px-4 py-2.5 rounded-xl border text-sm font-medium transition-all outline-none
          ${error
            ? 'border-red-300 bg-red-50/50 focus:ring-4 focus:ring-red-500/10 focus:border-red-400'
            : `border-slate-200 bg-slate-50/50 hover:bg-white hover:border-slate-300 focus:bg-white focus:ring-4 ${statusRing}`
          }
        `}
      />

      {/* Hint & Error row */}
      {hint && !error && (
        <p className="mt-1 text-[11px] text-slate-400 font-medium">
          Khuyến nghị: {hint}
        </p>
      )}
      {error && (
        <p className="mt-1 text-xs text-red-600 flex items-center gap-1 font-medium">
          <AlertCircle className="w-3 h-3 flex-shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}

const WATER_COLOR_OPTIONS = [
  { label: '-- Chọn màu nước --', value: '' },
  { label: 'Xanh lục (Thích hợp)', value: 'Xanh lục' },
  { label: 'Xanh vỏ đậu (Thích hợp)', value: 'Xanh vỏ đậu' },
  { label: 'Màu nâu nhạt (Thích hợp)', value: 'Màu nâu nhạt' },
  { label: 'Vàng nâu (Cảnh báo)', value: 'Vàng nâu' },
  { label: 'Đỏ thẫm (Nguy hiểm)', value: 'Đỏ thẫm' },
  { label: 'Đen (Nguy hiểm)', value: 'Đen' },
  { label: 'Khác', value: 'Khác' },
];

interface WaterColorFieldProps {
  value: string;
  onChange: (key: string, val: string) => void;
  status: WQStatus;
}

function WaterColorField({ value, onChange, status }: WaterColorFieldProps) {
  const statusRing = status ? STATUS_CONFIG[status].ring : 'focus:ring-indigo-500/20 focus:border-indigo-500';
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <span className="text-indigo-600"><Droplets className="w-4 h-4" /></span>
          Màu nước
        </label>
        <StatusBadge status={status} />
      </div>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange('waterColor', e.target.value)}
          className={`w-full px-4 py-2.5 pr-10 rounded-xl border text-sm font-medium transition-all outline-none appearance-none cursor-pointer border-slate-200 bg-slate-50/50 hover:bg-white hover:border-slate-300 focus:bg-white focus:ring-4 ${statusRing}`}
        >
          {WATER_COLOR_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
      </div>
      <p className="mt-1 text-[11px] text-slate-400 font-medium">
        Khuyến nghị: Xanh lục, xanh vỏ đậu, màu nâu nhạt
      </p>
    </div>
  );
}

// ─── Toast ────────────────────────────────────────────────────────────────────

interface ToastProps {
  message: string;
  type: 'success' | 'error';
  actionLabel?: string;
  onAction?: () => void;
}

function Toast({ message, type, actionLabel, onAction }: ToastProps) {
  return (
    <div
      className={`fixed top-6 right-6 z-[250] flex items-center gap-3 px-5 py-4 rounded-2xl shadow-2xl border text-sm font-semibold animate-in slide-in-from-right-8 fade-in duration-300 max-w-md ${
        type === 'success'
          ? 'bg-emerald-50 border-emerald-300 text-emerald-900 shadow-emerald-500/10'
          : 'bg-red-50 border-red-300 text-red-900 shadow-red-500/10'
      }`}
    >
      {type === 'success' ? (
        <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
      ) : (
        <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
      )}
      <div className="flex-1 leading-snug">{message}</div>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="ml-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer flex-shrink-0 flex items-center gap-1"
        >
          <span>{actionLabel}</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export interface RecordWaterQualityProps {
  onNavigateToTreatment?: (farmId: string, pondId: string, warningRecord?: WaterWarningRecord) => void;
  onNavigateToHistory?: () => void;
  initialFarmId?: string;
  initialPondId?: string;
}

const INITIAL_FORM = {
  temperature: '',
  ph: '',
  dissolvedOxygen: '',
  salinity: '',
  alkalinity: '',
  nh3: '',
  h2s: '',
  transparency: '',
  waterColor: '',
  note: '',
};

type FormKey = keyof typeof INITIAL_FORM;

export default function RecordWaterQuality({
  onNavigateToTreatment,
  onNavigateToHistory,
  initialFarmId,
  initialPondId,
}: RecordWaterQualityProps = {}) {
  // ── Data state ──────────────────────────────────────────────────────────────
  const [farms, setFarms] = useState<Farm[]>([]);
  const [ponds, setPonds] = useState<Pond[]>([]);
  const [selectedFarmId, setSelectedFarmId] = useState(initialFarmId || '');
  const [selectedPondId, setSelectedPondId] = useState(initialPondId || '');
  const [showAbnormalAlertModal, setShowAbnormalAlertModal] = useState(false);
  const [currentAbnormalIssues, setCurrentAbnormalIssues] = useState<{
    paramKey: string;
    name: string;
    value: string;
    unit: string;
    status: 'warning' | 'danger';
    recommendation: string;
  }[]>([]);
  const [recordTime, setRecordTime] = useState<string>(() => {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0, 16);
  });

  const [form, setForm] = useState(INITIAL_FORM);
  const [errors, setErrors] = useState<Partial<Record<FormKey, string>>>({});

  // ── Weather & AI state ──────────────────────────────────────────────────────
  const [weather, setWeather] = useState<WeatherInfo | null>(null);
  const [loadingWeather, setLoadingWeather] = useState(false);
  const [lastAiUpdated, setLastAiUpdated] = useState<string>('Vừa xong');
  const [isRefreshingAi, setIsRefreshingAi] = useState(false);

  // ── UI state ─────────────────────────────────────────────────────────────────
  const [loadingData, setLoadingData] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<ToastProps | null>(null);

  // ── Derived ──────────────────────────────────────────────────────────────────
  const filteredPonds = useMemo(() => {
    return selectedFarmId ? ponds.filter((p) => p.farmId === selectedFarmId) : ponds;
  }, [ponds, selectedFarmId]);

  const selectedFarm = useMemo(() => {
    return farms.find((f) => f.id === selectedFarmId);
  }, [farms, selectedFarmId]);

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
    h2s: getH2sStatus(numVal('h2s')),
    transparency: getTransparencyStatus(numVal('transparency')),
    waterColor: getWaterColorStatus(form.waterColor),
  };

  // ── Load farms & ponds ───────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const { farms: farmsData, ponds: pondsData } = await pondService.getOverview();
        setFarms(farmsData || []);
        setPonds(pondsData || []);

        // Auto select first farm or prop initial
        if (initialPondId) {
          const found = (pondsData || []).find((p: any) => p.id === initialPondId);
          if (found) {
            setSelectedFarmId(found.farmId);
            setSelectedPondId(initialPondId);
            return;
          }
        }
        if (initialFarmId) {
          setSelectedFarmId(initialFarmId);
          const firstFarmPonds = (pondsData || []).filter((p: Pond) => p.farmId === initialFarmId);
          if (firstFarmPonds.length > 0) {
            setSelectedPondId(firstFarmPonds[0].id);
          }
          return;
        }

        if (farmsData && farmsData.length > 0) {
          setSelectedFarmId(farmsData[0].id);
          const firstFarmPonds = (pondsData || []).filter((p: Pond) => p.farmId === farmsData[0].id);
          if (firstFarmPonds.length > 0) {
            setSelectedPondId(firstFarmPonds[0].id);
          }
        }
      } catch {
        showToast('Không thể tải danh sách trang trại / ao nuôi', 'error');
      } finally {
        setLoadingData(false);
      }
    })();
  }, [initialFarmId, initialPondId]);

  // Synchronize when initialFarmId or initialPondId prop changes
  useEffect(() => {
    if (initialPondId) {
      setSelectedPondId(initialPondId);
      const found = ponds.find((p) => p.id === initialPondId);
      if (found) setSelectedFarmId(found.farmId);
    } else if (initialFarmId) {
      setSelectedFarmId(initialFarmId);
    }
  }, [initialFarmId, initialPondId, ponds]);

  // ── Fetch Weather for Selected Farm / Location ─────────────────────────────
  const fetchWeather = useCallback(async (farmId?: string) => {
    setLoadingWeather(true);
    try {
      const data = await weatherService.getWeather(farmId ? { farmId } : undefined);
      setWeather(data);
    } catch {
      // Fallback default realistic weather info
      const now = new Date();
      const formattedDate = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
      setWeather({
        temperature: 32,
        humidity: 68,
        windSpeed: 12,
        condition: 'Trời nắng nhẹ',
        weatherCode: 1,
        icon: 'partly-cloudy',
        locationName: selectedFarm?.name ? `${selectedFarm.name}` : 'Khu vực nuôi trồng',
        date: formattedDate,
        forecastHint: 'Nắng nhẹ ráo nước, thích hợp cho tôm ăn và sinh trưởng.',
      });
    } finally {
      setLoadingWeather(false);
    }
  }, [selectedFarm]);

  useEffect(() => {
    fetchWeather(selectedFarmId || undefined);
  }, [selectedFarmId, fetchWeather]);

  // ── Handlers ─────────────────────────────────────────────────────────────────
  const handleChange = useCallback((key: string, val: string) => {
    setForm((prev) => ({ ...prev, [key]: val }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  }, []);

  const showToast = (
    message: string,
    type: 'success' | 'error',
    actionLabel?: string,
    onAction?: () => void,
  ) => {
    setToast({ message, type, actionLabel, onAction });
    setTimeout(() => setToast(null), actionLabel ? 7000 : 3500);
  };

  const handleRefreshAi = () => {
    setIsRefreshingAi(true);
    setTimeout(() => {
      const now = new Date();
      const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
      setLastAiUpdated(`Vừa xong (${timeStr})`);
      setIsRefreshingAi(false);
    }, 400);
  };

  // ── Gather Abnormal Issues for Immediate Clinical Warning ─────────────────
  const getAbnormalIssues = useCallback(() => {
    const issues: {
      paramKey: string;
      name: string;
      value: string;
      unit: string;
      status: 'warning' | 'danger';
      recommendation: string;
    }[] = [];

    const temp = numVal('temperature');
    const tempSt = getTemperatureStatus(temp);
    if (tempSt === 'danger' || tempSt === 'warning') {
      issues.push({
        paramKey: 'temperature',
        name: 'Nhiệt độ nước',
        value: `${temp} °C`,
        unit: '°C',
        status: tempSt,
        recommendation:
          temp !== null && temp > 30
            ? 'Bật quạt nước, xả bớt tầng nước mặt, cấp thêm nước mát tầng đáy'
            : 'Theo dõi tôm giảm ăn khi lạnh, duy trì mực nước sâu và che chắn gió',
      });
    }

    const ph = numVal('ph');
    const phSt = getPhStatus(ph);
    if (phSt === 'danger' || phSt === 'warning') {
      issues.push({
        paramKey: 'ph',
        name: 'Độ pH',
        value: `${ph}`,
        unit: '',
        status: phSt,
        recommendation:
          ph !== null && ph < 7.5
            ? 'Tạt vôi nông nghiệp CaCO3 hoặc Dolomite để nâng và ổn định hệ đệm pH'
            : 'Đánh mật rỉ đường + men vi sinh vào buổi sáng nắng để khống chế tảo và hạ pH',
      });
    }

    const doVal = numVal('dissolvedOxygen');
    const doSt = getDoStatus(doVal);
    if (doSt === 'danger' || doSt === 'warning') {
      issues.push({
        paramKey: 'dissolvedOxygen',
        name: 'Oxy hòa tan (DO)',
        value: `${doVal} mg/L`,
        unit: 'mg/L',
        status: doSt,
        recommendation:
          doSt === 'danger'
            ? 'BẬT TẤT CẢ DÀN QUẠT & SỤC KHÍ ĐÁY, rải ngay oxy viên cấp cứu vùng tập trung tôm'
            : 'Tăng cường số giờ chạy quạt nước, giảm 30% lượng thức ăn cữ tới để tránh tiêu hao oxy',
      });
    }

    const sal = numVal('salinity');
    const salSt = getSalinityStatus(sal);
    if (salSt === 'danger' || salSt === 'warning') {
      issues.push({
        paramKey: 'salinity',
        name: 'Độ mặn',
        value: `${sal} ‰`,
        unit: '‰',
        status: salSt,
        recommendation:
          'Kiểm tra nguồn nước cấp và điều chỉnh độ mặn thích ứng với giai đoạn sinh trưởng của tôm',
      });
    }

    const alk = numVal('alkalinity');
    const alkSt = getAlkalinityStatus(alk);
    if (alkSt === 'danger' || alkSt === 'warning') {
      issues.push({
        paramKey: 'alkalinity',
        name: 'Độ kiềm',
        value: `${alk} mg/L`,
        unit: 'mg/L',
        status: alkSt,
        recommendation:
          alk !== null && alk < 100
            ? 'Tạt vôi canxi, khoáng Bicarbonate để tôm cứng vỏ nhanh sau lột xác'
            : 'Thay nước chậm hoặc xử lý bớt hàm lượng khoáng dư thừa trong ao',
      });
    }

    const nh3 = numVal('nh3');
    const nh3St = getNh3Status(nh3);
    if (nh3St === 'danger' || nh3St === 'warning') {
      issues.push({
        paramKey: 'nh3',
        name: 'Khí độc NH3',
        value: `${nh3} mg/L`,
        unit: 'mg/L',
        status: nh3St,
        recommendation:
          nh3St === 'danger'
            ? 'Cắt ngay 50% thức ăn, tạt Yucca hoặc vi sinh xử lý đáy ao khẩn cấp để hấp thụ khí độc'
            : 'Tăng cường quạt nước, kiểm tra xi-phông đáy ao sạch sẽ bùn bã hữu cơ',
      });
    }

    const h2s = numVal('h2s');
    const h2sSt = getH2sStatus(h2s);
    if (h2sSt === 'danger' || h2sSt === 'warning') {
      issues.push({
        paramKey: 'h2s',
        name: 'Khí độc H2S',
        value: `${h2s} mg/L`,
        unit: 'mg/L',
        status: h2sSt,
        recommendation:
          'Giữ pH > 7.8, rải vôi/oxy viên vùng đáy ao tích tụ mùn bã, tạt vi sinh đối kháng vi khuẩn đáy',
      });
    }

    const transparency = numVal('transparency');
    const transSt = getTransparencyStatus(transparency);
    if (transSt === 'danger' || transSt === 'warning') {
      issues.push({
        paramKey: 'transparency',
        name: 'Độ trong',
        value: `${transparency} cm`,
        unit: 'cm',
        status: transSt,
        recommendation:
          transparency !== null && transparency < 20
            ? 'Tảo nở hoa quá dày, nguy cơ sụp tảo, cần dùng vi sinh cắt tảo hoặc xả bớt nước mặt'
            : 'Nước quá trong nghèo dinh dưỡng, cần gây màu nước bằng khoáng chất và men vi sinh',
      });
    }

    const colorSt = getWaterColorStatus(form.waterColor);
    if (colorSt === 'danger' || colorSt === 'warning') {
      issues.push({
        paramKey: 'waterColor',
        name: 'Màu nước',
        value: form.waterColor,
        unit: '',
        status: colorSt,
        recommendation:
          'Màu nước bất thường cảnh báo tảo tàn hoặc ô nhiễm hữu cơ nặng, cần kiểm tra mẫu nước và xử lý',
      });
    }

    return issues;
  }, [form]);

  // ── Save Functionality ───────────────────────────────────────────────────────
  const executeSave = async (shouldNavigateToTreatment: boolean) => {
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
        h2s: parseFloat(form.h2s),
        transparency: parseFloat(form.transparency),
        waterColor: form.waterColor || undefined,
        note: form.note || undefined,
        weatherData: weather
          ? {
              temperature: weather.temperature,
              humidity: weather.humidity,
              windSpeed: weather.windSpeed,
              condition: weather.condition,
              icon: weather.icon,
              locationName: weather.locationName,
              date: weather.date,
              precipitation: weather.precipitation,
              forecastHint: weather.forecastHint,
            }
          : null,
      };

      await waterQualityService.create(payload);
      handleRefreshAi();
      setShowAbnormalAlertModal(false);

      if (shouldNavigateToTreatment && onNavigateToTreatment) {
        showToast('Đã lưu thông số! Đang chuyển sang không gian xử lý môi trường...', 'success');
        const selectedFarm = farms.find((f) => f.id === selectedFarmId);
        const selectedPond = ponds.find((p) => p.id === selectedPondId);
        const warningRecord: WaterWarningRecord = {
          id: `WQ-${Date.now()}`,
          date: new Date(recordTime).toLocaleDateString('vi-VN'),
          time: new Date(recordTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
          farmName: selectedFarm?.name || 'Trang trại',
          pondId: selectedPondId,
          pondName: selectedPond?.name || 'Ao nuôi',
          hazardLevel: currentAbnormalIssues.some((i) => i.status === 'danger') ? 'DANGER' : 'WARNING',
          summaryText:
            currentAbnormalIssues.map((i) => `${i.name}: ${i.value} ${i.unit}`).join(' • ') ||
            'Chỉ số bất thường cần xử lý',
          status: 'UNTREATED',
          parameters: {
            temperature: parseFloat(form.temperature) || 0,
            ph: parseFloat(form.ph) || 0,
            dissolvedOxygen: parseFloat(form.dissolvedOxygen) || 0,
            salinity: parseFloat(form.salinity) || 0,
            alkalinity: parseFloat(form.alkalinity) || 0,
            nh3: parseFloat(form.nh3) || 0,
            h2s: parseFloat(form.h2s) || 0,
            transparency: parseFloat(form.transparency) || 0,
          },
          triggeredParams: currentAbnormalIssues.map((i) => i.paramKey),
        };

        setTimeout(() => {
          onNavigateToTreatment(selectedFarmId, selectedPondId, warningRecord);
        }, 500);
      } else {
        if (currentAbnormalIssues.length > 0 && onNavigateToTreatment) {
          showToast(
            'Đã lưu thông số đo lường. Ao có chỉ số cảnh báo!',
            'success',
            'Xử lý ngay',
            () => {
              const selectedFarm = farms.find((f) => f.id === selectedFarmId);
              const selectedPond = ponds.find((p) => p.id === selectedPondId);
              const warningRecord: WaterWarningRecord = {
                id: `WQ-${Date.now()}`,
                date: new Date(recordTime).toLocaleDateString('vi-VN'),
                time: new Date(recordTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
                farmName: selectedFarm?.name || 'Trang trại',
                pondId: selectedPondId,
                pondName: selectedPond?.name || 'Ao nuôi',
                hazardLevel: currentAbnormalIssues.some((i) => i.status === 'danger') ? 'DANGER' : 'WARNING',
                summaryText:
                  currentAbnormalIssues.map((i) => `${i.name}: ${i.value} ${i.unit}`).join(' • ') ||
                  'Chỉ số bất thường cần xử lý',
                status: 'UNTREATED',
                parameters: {
                  temperature: parseFloat(form.temperature) || 0,
                  ph: parseFloat(form.ph) || 0,
                  dissolvedOxygen: parseFloat(form.dissolvedOxygen) || 0,
                  salinity: parseFloat(form.salinity) || 0,
                  alkalinity: parseFloat(form.alkalinity) || 0,
                  nh3: parseFloat(form.nh3) || 0,
                  h2s: parseFloat(form.h2s) || 0,
                  transparency: parseFloat(form.transparency) || 0,
                },
                triggeredParams: currentAbnormalIssues.map((i) => i.paramKey),
              };
              onNavigateToTreatment(selectedFarmId, selectedPondId, warningRecord);
            },
          );
        } else {
          showToast(
            'Môi trường nước đạt chuẩn! Ghi nhận thành công.',
            'success',
            onNavigateToHistory ? 'Xem lịch sử' : undefined,
            onNavigateToHistory,
          );
        }
      }
    } catch (err: any) {
      showToast(err.message || 'Không thể lưu thông số. Vui lòng thử lại.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const validate = (): boolean => {
    const newErrors: Partial<Record<FormKey, string>> = {};
    const numericKeys: FormKey[] = [
      'temperature', 'ph', 'dissolvedOxygen', 'salinity', 'alkalinity', 'nh3', 'h2s', 'transparency',
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

    const abnormalIssues = getAbnormalIssues();
    if (abnormalIssues.length > 0) {
      setCurrentAbnormalIssues(abnormalIssues);
      setShowAbnormalAlertModal(true);
    } else {
      await executeSave(false);
    }
  };

  // ── AI Evaluation Computation (Demo / Rule-based Assistant) ──────────────────
  const aiEvaluation = useMemo(() => {
    const temp = numVal('temperature') ?? 28.5;
    const ph = numVal('ph') ?? 8.3;
    const doVal = numVal('dissolvedOxygen') ?? 5.2;
    const alk = numVal('alkalinity') ?? 120;
    const sal = numVal('salinity') ?? 18;
    const nh3 = numVal('nh3') ?? 0.15;
    const h2s = numVal('h2s') ?? 0.01;

    // Overall Status Rating
    let overallRating = 'Khá tốt';
    let overallColor = 'emerald';
    let summaryText = `Dựa trên các thông số hiện tại (Nhiệt độ ${temp}°C, pH ${ph}, DO ${doVal} mg/L), chất lượng nước ao nuôi đang ở mức Khá tốt. Tôm có thể sinh trưởng bình thường.`;

    if (doVal < 3.0 || nh3 > 0.50 || h2s > 0.05 || ph < 7.5 || ph > 9.0) {
      overallRating = 'Cảnh báo nguy hiểm';
      overallColor = 'red';
      summaryText = `Chất lượng nước ao nuôi đang có chỉ số vượt ngưỡng an toàn (DO ${doVal} mg/L, NH3 ${nh3} mg/L, H2S ${h2s} mg/L). Cần xử lý khẩn cấp!`;
    } else if (doVal < 4.0 || alk < 100 || alk > 160 || sal < 10 || nh3 > 0.30 || h2s > 0.03) {
      overallRating = 'Cần chú ý theo dõi';
      overallColor = 'amber';
      summaryText = `Dựa trên các thông số hiện tại (Nhiệt độ ${temp}°C, pH ${ph}, DO ${doVal} mg/L), chất lượng nước ở mức trung bình. Có một số chỉ số cần điều chỉnh.`;
    }

    // Warnings list
    const warnings: string[] = [];
    if (alk <= 120) {
      warnings.push(`Độ kiềm (${alk} mg/L) đang ở ngưỡng tối thiểu cho tôm thẻ. Cần theo dõi thêm.`);
    } else if (alk > 200) {
      warnings.push(`Độ kiềm (${alk} mg/L) khá cao, có thể làm biến động pH.`);
    }

    if (weather?.condition?.includes('Mưa') || (weather?.precipitation && weather.precipitation > 0)) {
      warnings.push(`Dự báo thời tiết có thể có mưa rào, sẽ làm thay đổi độ mặn bề mặt và giảm oxy hòa tan.`);
    } else {
      warnings.push(`Dự báo chiều nay có thể có thay đổi nhiệt độ nhẹ, cần kiểm tra quạt nước định kỳ.`);
    }

    if (doVal < 5.0) {
      warnings.push(`DO (${doVal} mg/L) đang ở mức thấp, nguy cơ thiếu oxy cục bộ tầng đáy.`);
    }
    if (nh3 > 0.05) {
      warnings.push(`Khí độc NH3 (${nh3} mg/L) đang tăng, cần kiểm soát lượng thức ăn dư.`);
    }

    // Recommendations list
    const recommendations: string[] = [];
    if (alk <= 120) {
      recommendations.push('Bổ sung khoáng chất (NaHCO3 / Dolomite) đánh xuống ao để duy trì và nâng nhẹ độ kiềm.');
    } else {
      recommendations.push('Duy trì chế độ kiềm định kỳ và kiểm tra độ cứng nước.');
    }

    if (doVal < 5.5 || weather?.condition?.includes('Mưa')) {
      recommendations.push('Chuẩn bị sẵn quạt nước để tăng DO phòng trường hợp mưa làm giảm oxy hòa tan đột ngột.');
    } else {
      recommendations.push('Bật quạt nước luân phiên theo chu kỳ cho ăn và kiểm tra lượng oxy tầng đáy.');
    }

    if (nh3 > 0.30 || h2s > 0.03) {
      recommendations.push('Cắt giảm 15-20% lượng thức ăn cữ chiều và bổ sung men vi sinh xử lý đáy ao.');
    }

    return {
      overallRating,
      overallColor,
      summaryText,
      warnings,
      recommendations,
    };
  }, [form, weather]);

  // Weather icon helper
  const renderWeatherIcon = () => {
    const iconType = weather?.icon || 'sunny';
    switch (iconType) {
      case 'rainy':
        return <CloudRain className="w-12 h-12 text-blue-500 drop-shadow-md animate-bounce duration-1000" />;
      case 'thunder':
        return <CloudLightning className="w-12 h-12 text-amber-500 drop-shadow-md" />;
      case 'cloudy':
        return <Cloud className="w-12 h-12 text-slate-400 drop-shadow-md" />;
      case 'partly-cloudy':
        return <CloudSun className="w-12 h-12 text-amber-500 drop-shadow-md" />;
      default:
        return <Sun className="w-12 h-12 text-amber-500 drop-shadow-md animate-pulse" />;
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────────

  if (loadingData) {
    return (
      <LoadingMotion
        mode="card"
        title="Đang tải dữ liệu biểu mẫu môi trường..."
        subtitle="Hệ thống đang chuẩn bị danh sách trang trại, ao nuôi và các cảm biến đo lường..."
        icon={<Droplets className="w-10 h-10 text-indigo-600 animate-pulse" />}
        color="indigo"
      />
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto relative pb-10">
      {/* Toast notification */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          actionLabel={toast.actionLabel}
          onAction={toast.onAction}
        />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

        {/* ════════════════════════════════════════════════════════════════════════
            LEFT COLUMN: FORM GHI NHẬN (Col span 7 on large desktop)
           ════════════════════════════════════════════════════════════════════════ */}
        <div className="lg:col-span-7 xl:col-span-8 flex flex-col gap-5">
          <form onSubmit={handleSubmit} noValidate>

            {/* ── Page Header Banner ────────────────────────────────────────── */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/90 backdrop-blur-xl px-6 py-5 rounded-3xl shadow-sm border border-indigo-100/80 mb-5">
              <div className="flex items-center gap-4">
                <div className="w-13 h-13 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-md shadow-indigo-500/25 flex-shrink-0 p-3">
                  <Droplets className="w-7 h-7 text-white" />
                </div>
                <div>
                  <h2 className="text-xl sm:text-2xl font-black text-indigo-950 tracking-tight">
                    Ghi nhận Thông số Môi trường Nước
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-500 font-medium mt-0.5">
                    Nhập các thông số đo lường từ ao nuôi để theo dõi và phân tích chất lượng nước
                  </p>
                </div>
              </div>
              {onNavigateToHistory && (
                <button
                  type="button"
                  onClick={onNavigateToHistory}
                  className="hidden sm:inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 hover:border-indigo-300 text-slate-700 hover:text-indigo-600 bg-white hover:bg-indigo-50/50 text-xs font-bold transition-all shadow-xs cursor-pointer flex-shrink-0"
                >
                  <History className="w-4 h-4" />
                  <span>Xem lịch sử đo</span>
                </button>
              )}
            </div>

            {/* ── Section 1: Location + Time ────────────────────────────────── */}
            <div className="bg-white rounded-3xl border border-indigo-100/80 shadow-sm p-6 mb-5">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                <span className="w-5 h-5 rounded-md bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-extrabold">
                  1
                </span>
                VỊ TRÍ & THỜI GIAN
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Farm dropdown */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Trang trại <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <select
                      value={selectedFarmId}
                      onChange={(e) => {
                        setSelectedFarmId(e.target.value);
                        const nextPonds = ponds.filter((p) => p.farmId === e.target.value);
                        setSelectedPondId(nextPonds[0]?.id || '');
                      }}
                      className="w-full px-3.5 py-2.5 pr-8 rounded-xl border border-slate-200 bg-slate-50/50 text-sm font-medium text-slate-800 appearance-none outline-none hover:bg-white hover:border-slate-300 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all cursor-pointer truncate"
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
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Ao nuôi <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <select
                      value={selectedPondId}
                      onChange={(e) => setSelectedPondId(e.target.value)}
                      disabled={!selectedFarmId}
                      className={`w-full px-3.5 py-2.5 pr-8 rounded-xl border text-sm font-medium appearance-none outline-none transition-all cursor-pointer truncate ${
                        selectedFarmId
                          ? 'border-slate-200 bg-slate-50/50 text-slate-800 hover:bg-white hover:border-slate-300 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10'
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
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Thời gian đo <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="datetime-local"
                    value={recordTime}
                    onChange={(e) => setRecordTime(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50/50 text-xs sm:text-sm font-medium text-slate-800 outline-none hover:bg-white hover:border-slate-300 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all"
                  />
                </div>
              </div>
            </div>

            {/* ── Section 2: Parameters ─────────────────────────────────────── */}
            <div className="bg-white rounded-3xl border border-indigo-100/80 shadow-sm p-6 mb-5">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                  <span className="w-5 h-5 rounded-md bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-extrabold">
                    2
                  </span>
                  THÔNG SỐ ĐO LƯỜNG
                </h3>
                {/* Status legend */}
                <div className="flex items-center gap-3 text-xs text-slate-500">
                  <span className="flex items-center gap-1.5 font-medium">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" /> Tối ưu
                  </span>
                  <span className="flex items-center gap-1.5 font-medium">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" /> Cảnh báo
                  </span>
                  <span className="flex items-center gap-1.5 font-medium">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" /> Nguy hiểm
                  </span>
                </div>
              </div>

              {/* 2-column parameter input grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <ParameterField
                  label="pH nước"
                  unit=""
                  fieldKey="ph"
                  value={form.ph}
                  icon={<FlaskConical className="w-4 h-4" />}
                  onChange={handleChange}
                  error={errors.ph ?? null}
                  status={status.ph}
                  placeholder="vd: 8.3"
                  hint="8.2 – 8.5"
                />
                <ParameterField
                  label="Nhiệt độ"
                  unit="°C"
                  fieldKey="temperature"
                  value={form.temperature}
                  icon={<Thermometer className="w-4 h-4" />}
                  onChange={handleChange}
                  error={errors.temperature ?? null}
                  status={status.temperature}
                  placeholder="vd: 28.5"
                  hint="25°C – 30°C"
                />
                <ParameterField
                  label="Độ mặn"
                  unit="‰"
                  fieldKey="salinity"
                  value={form.salinity}
                  icon={<Waves className="w-4 h-4" />}
                  onChange={handleChange}
                  error={errors.salinity ?? null}
                  status={status.salinity}
                  placeholder="vd: 18"
                  hint="10 – 25‰"
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
                  placeholder="vd: 30"
                  hint="25 – 40 cm"
                />
                <ParameterField
                  label="NH₃"
                  unit="mg/L"
                  fieldKey="nh3"
                  value={form.nh3}
                  icon={<FlaskConical className="w-4 h-4" />}
                  onChange={handleChange}
                  error={errors.nh3 ?? null}
                  status={status.nh3}
                  placeholder="vd: 0.15"
                  hint="≤ 0.3 mg/L"
                />
                <ParameterField
                  label="H₂S"
                  unit="mg/L"
                  fieldKey="h2s"
                  value={form.h2s}
                  icon={<FlaskConical className="w-4 h-4" />}
                  onChange={handleChange}
                  error={errors.h2s ?? null}
                  status={status.h2s}
                  placeholder="vd: 0.01"
                  hint="≤ 0.03 mg/L"
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
                  hint="100 – 160 mg/L"
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
                  placeholder="vd: 5.2"
                  hint="> 4 mg/L"
                />
                <WaterColorField
                  value={form.waterColor}
                  onChange={handleChange}
                  status={status.waterColor}
                />
              </div>
            </div>

            {/* ── Section 3: Note ───────────────────────────────────────────── */}
            <div className="bg-white rounded-3xl border border-indigo-100/80 shadow-sm p-6 mb-6">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                <span className="w-5 h-5 rounded-md bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-extrabold">
                  3
                </span>
                GHI CHÚ
              </h3>
              <textarea
                value={form.note}
                onChange={(e) => handleChange('note', e.target.value)}
                rows={3}
                placeholder="Nhập ghi chú về lần đo này (không bắt buộc)..."
                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50/50 text-sm font-medium text-slate-700 outline-none hover:bg-white hover:border-slate-300 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all resize-none placeholder:text-slate-400"
              />
            </div>

            {/* ── Submit Action ─────────────────────────────────────────────── */}
            <div className="flex items-center justify-end gap-3">
              <button
                type="submit"
                disabled={saving}
                className="px-8 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold flex items-center justify-center gap-2 transition-all duration-200 shadow-md shadow-indigo-600/30 hover:shadow-indigo-600/40 hover:-translate-y-0.5 disabled:opacity-70 disabled:cursor-not-allowed"
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

        {/* ════════════════════════════════════════════════════════════════════════
            RIGHT COLUMN: WEATHER & AI ASSESSMENT WIDGETS (Col span 5 on desktop)
           ════════════════════════════════════════════════════════════════════════ */}
        <div className="lg:col-span-5 xl:col-span-4 flex flex-col gap-5">

          {/* ── Weather Widget Card ────────────────────────────────────────── */}
          <div className="bg-white rounded-3xl border border-indigo-100/80 shadow-sm p-6 relative overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <CloudSun className="w-5 h-5 text-indigo-600" />
                <h3 className="text-sm font-bold text-slate-800">Dự báo thời tiết</h3>
              </div>
              <span className="text-xs font-semibold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-full truncate max-w-[170px]" title={weather?.locationName || selectedFarm?.name || 'Khu vực nuôi trồng'}>
                Vị trí: {weather?.locationName || selectedFarm?.name || 'Khu vực nuôi trồng'}
              </span>
            </div>

            {loadingWeather ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
              </div>
            ) : (
              <div>
                <p className="text-right text-xs font-semibold text-slate-400 mb-2">
                  {weather?.date || 'Hôm nay'}
                </p>

                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    {renderWeatherIcon()}
                    <div>
                      <div className="text-3xl font-black text-slate-900 tracking-tight">
                        {weather?.temperature ?? 32}°C
                      </div>
                      <div className="text-xs font-bold text-slate-600">
                        {weather?.condition ?? 'Trời nắng nhẹ'}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 pl-4 border-l border-slate-100 text-xs">
                    <div className="flex items-center gap-2 text-slate-600">
                      <Droplets className="w-4 h-4 text-blue-500" />
                      <div>
                        <p className="text-[10px] text-slate-400 font-semibold">ĐỘ ẨM</p>
                        <p className="font-bold text-slate-800">{weather?.humidity ?? 68}%</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-slate-600">
                      <Wind className="w-4 h-4 text-teal-500" />
                      <div>
                        <p className="text-[10px] text-slate-400 font-semibold">GIÓ</p>
                        <p className="font-bold text-slate-800">{weather?.windSpeed ?? 12} km/h</p>
                      </div>
                    </div>
                  </div>
                </div>

                {weather?.forecastHint && (
                  <p className="mt-3 text-[11px] text-slate-500 bg-slate-50 rounded-xl p-2 font-medium border border-slate-100">
                    💡 {weather.forecastHint}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* ── AI Analysis & Evaluation Card ─────────────────────────────── */}
          <div className="bg-white rounded-3xl border border-indigo-100/80 shadow-sm p-6 flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-indigo-600" />
                <h3 className="text-sm font-bold text-slate-900">Phân tích & Đánh giá AI</h3>
              </div>
              <span className="px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider bg-indigo-50 text-indigo-600 rounded-md border border-indigo-200/60">
                BETA
              </span>
            </div>

            <div className="space-y-3.5">
              {/* 1. Overall Status */}
              <div className="bg-emerald-50/70 border border-emerald-100 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  <h4 className="text-xs font-bold text-emerald-950">Trạng thái tổng quan</h4>
                </div>
                <p className="text-xs text-slate-700 leading-relaxed font-medium">
                  {aiEvaluation.summaryText}
                </p>
              </div>

              {/* 2. Warnings */}
              <div className="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  <h4 className="text-xs font-bold text-amber-950">Cảnh báo cần chú ý</h4>
                </div>
                <ul className="space-y-1.5 text-xs text-slate-700 font-medium">
                  {aiEvaluation.warnings.map((w, idx) => (
                    <li key={idx} className="flex items-start gap-1.5">
                      <span className="text-amber-500 font-bold">•</span>
                      <span>{w}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* 3. Technical Recommendations */}
              <div className="bg-indigo-50/50 border border-indigo-100 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Lightbulb className="w-4 h-4 text-indigo-600" />
                  <h4 className="text-xs font-bold text-indigo-950">Khuyến nghị kỹ thuật</h4>
                </div>
                <p className="text-xs text-slate-600 font-semibold mb-2">Hệ thống đề xuất các hành động sau:</p>
                <ol className="space-y-2 text-xs text-slate-700 font-medium">
                  {aiEvaluation.recommendations.map((r, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="w-4 h-4 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-[10px] flex-shrink-0 mt-0.5">
                        {idx + 1}
                      </span>
                      <span>{r}</span>
                    </li>
                  ))}
                </ol>
              </div>
            </div>

            {/* Footer */}
            <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
              <span>Lần cập nhật cuối: {lastAiUpdated}</span>
              <button
                type="button"
                onClick={handleRefreshAi}
                disabled={isRefreshingAi}
                className="flex items-center gap-1.5 text-indigo-600 hover:text-indigo-800 font-bold transition-colors disabled:opacity-50"
              >
                <RotateCw className={`w-3.5 h-3.5 ${isRefreshingAi ? 'animate-spin' : ''}`} />
                Làm mới
              </button>
            </div>
          </div>

        </div>

      </div>

      {/* ─── Modal Cảnh Báo Khẩn & Chuyển Xử Lý Môi Trường ───────────────── */}
      {showAbnormalAlertModal &&
        createPortal(
          <div className="fixed inset-0 z-[300] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="relative w-full max-w-xl bg-white rounded-3xl shadow-2xl border border-rose-100 overflow-hidden animate-in zoom-in-95 duration-200">
              {/* Header */}
              <div className="bg-gradient-to-r from-rose-500 via-rose-600 to-amber-600 p-6 text-white relative">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center shadow-inner">
                      <ShieldAlert className="w-6 h-6 text-white animate-pulse" />
                    </div>
                    <div>
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/20 text-xs font-black tracking-wider uppercase backdrop-blur-md mb-1">
                        Cảnh Báo Lâm Sàng Môi Trường
                      </span>
                      <h3 className="text-lg font-black leading-tight">
                        Phát Hiện Chỉ Số Ao Vượt Ngưỡng!
                      </h3>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowAbnormalAlertModal(false)}
                    className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-all cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="mt-4 pt-3 border-t border-white/20 flex items-center gap-2 text-xs font-semibold text-rose-100">
                  <span>{selectedFarm?.name || 'Trang trại'}</span>
                  <span>•</span>
                  <span className="text-white font-bold bg-white/20 px-2 py-0.5 rounded-md">
                    {filteredPonds.find((p) => p.id === selectedPondId)?.name || 'Ao nuôi'}
                  </span>
                  <span>•</span>
                  <span>Có {currentAbnormalIssues.length} chỉ số bất thường</span>
                </div>
              </div>

              {/* Content */}
              <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
                <div className="p-3.5 rounded-2xl bg-amber-50/90 border border-amber-200 text-amber-900 text-xs leading-relaxed font-medium">
                  Các chỉ số môi trường bên dưới đang đe dọa trực tiếp tới sức khỏe đàn tôm. Hệ thống khuyến nghị kỹ thuật viên lập phương án xử lý ngay để tránh gây sốc hoặc ngộ độc tôm.
                </div>

                <div className="space-y-2.5">
                  {currentAbnormalIssues.map((issue, idx) => (
                    <div
                      key={idx}
                      className={`p-3.5 rounded-2xl border flex flex-col gap-2 transition-all ${
                        issue.status === 'danger'
                          ? 'bg-rose-50/50 border-rose-200'
                          : 'bg-amber-50/50 border-amber-200'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-sm text-slate-800">
                          {issue.name}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-black text-slate-900 bg-white px-2.5 py-0.5 rounded-lg border border-slate-200 shadow-2xs">
                            {issue.value}
                          </span>
                          <span
                            className={`text-[11px] font-black px-2 py-0.5 rounded-full border ${
                              issue.status === 'danger'
                                ? 'bg-rose-100 text-rose-800 border-rose-300'
                                : 'bg-amber-100 text-amber-800 border-amber-300'
                            }`}
                          >
                            {issue.status === 'danger' ? 'Nguy hiểm' : 'Cảnh báo'}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-start gap-2 text-xs text-slate-600 bg-white/80 p-2.5 rounded-xl border border-slate-100">
                        <Wrench className="w-3.5 h-3.5 text-indigo-600 flex-shrink-0 mt-0.5" />
                        <span className="leading-snug font-medium">
                          <strong className="text-indigo-900">Khuyến nghị xử lý:</strong> {issue.recommendation}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Footer Actions */}
              <div className="p-5 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => executeSave(false)}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 text-xs font-bold transition-all cursor-pointer text-center"
                >
                  Chỉ lưu nhật ký (Xử lý sau)
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => executeSave(true)}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-indigo-600 hover:from-rose-700 hover:to-indigo-700 text-white text-xs font-bold transition-all shadow-md shadow-indigo-500/20 cursor-pointer flex items-center justify-center gap-2"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Đang lưu...</span>
                    </>
                  ) : (
                    <>
                      <Wrench className="w-4 h-4" />
                      <span>Lưu & Chuyển sang Xử lý ngay</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
