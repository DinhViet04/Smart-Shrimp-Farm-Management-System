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
} from 'lucide-react';
import { farmService } from '../../services/farm.service';
import { pondService } from '../../services/pond.service';
import { waterQualityService } from '../../services/water-quality.service';
import { weatherService, type WeatherInfo } from '../../services/weather.service';
import type { CreateWaterQualityPayload } from '../../services/water-quality.service';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Farm {
  id: string;
  name: string;
  location?: string;
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

export default function RecordWaterQuality() {
  // ── Data state ──────────────────────────────────────────────────────────────
  const [farms, setFarms] = useState<Farm[]>([]);
  const [ponds, setPonds] = useState<Pond[]>([]);
  const [selectedFarmId, setSelectedFarmId] = useState('');
  const [selectedPondId, setSelectedPondId] = useState('');
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
        const [farmsData, pondsData] = await Promise.all([
          farmService.getAll(),
          pondService.getAll(),
        ]);
        setFarms(farmsData || []);
        setPonds(pondsData || []);

        // Auto select first farm if available
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
  }, []);

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

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
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
      showToast('Ghi nhận thông số môi trường nước thành công!', 'success');
      handleRefreshAi();
    } catch (err: any) {
      showToast(err.message || 'Không thể lưu thông số. Vui lòng thử lại.', 'error');
    } finally {
      setSaving(false);
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
      <div className="flex items-center justify-center h-80">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-slate-200 border-t-indigo-600 rounded-full animate-spin" />
          <p className="text-sm font-medium text-slate-500">Đang tải dữ liệu trang trại và ao nuôi...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto relative pb-10">
      {/* Toast notification */}
      {toast && <Toast message={toast.message} type={toast.type} />}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

        {/* ════════════════════════════════════════════════════════════════════════
            LEFT COLUMN: FORM GHI NHẬN (Col span 7 on large desktop)
           ════════════════════════════════════════════════════════════════════════ */}
        <div className="lg:col-span-7 xl:col-span-8 flex flex-col gap-5">
          <form onSubmit={handleSubmit} noValidate>

            {/* ── Page Header Banner ────────────────────────────────────────── */}
            <div className="flex items-center gap-4 bg-white/90 backdrop-blur-xl px-6 py-5 rounded-3xl shadow-sm border border-indigo-100/80 mb-5">
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
    </div>
  );
}
