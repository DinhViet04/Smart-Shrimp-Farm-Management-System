/**
 * Bộ ngưỡng đánh giá chất lượng nước dùng chung cho toàn hệ thống
 * (API môi trường nước, thông báo cảnh báo và Trợ lý AI).
 */
export type WaterStatus = 'Optimal' | 'Warning' | 'Danger';

export type WaterMetricKey =
  | 'temperature'
  | 'ph'
  | 'dissolvedOxygen'
  | 'salinity'
  | 'alkalinity'
  | 'nh3'
  | 'h2s'
  | 'transparency';

export interface WaterMetricsInput {
  temperature: unknown;
  ph: unknown;
  dissolvedOxygen: unknown;
  salinity: unknown;
  alkalinity: unknown;
  nh3: unknown;
  h2s: unknown;
  transparency: unknown;
  waterColor?: string | null;
}

export const WATER_METRIC_INFO: Record<
  WaterMetricKey,
  { label: string; unit: string; optimal: string; warning: string }
> = {
  temperature: {
    label: 'Nhiệt độ',
    unit: '°C',
    optimal: '25 - 30',
    warning: '20 - 25 hoặc 30 - 33',
  },
  ph: {
    label: 'pH',
    unit: '',
    optimal: '8.2 - 8.5',
    warning: '7.5 - 8.2 hoặc 8.5 - 9.0',
  },
  dissolvedOxygen: {
    label: 'Oxy hòa tan (DO)',
    unit: 'mg/L',
    optimal: '> 4',
    warning: '3 - 4',
  },
  salinity: {
    label: 'Độ mặn',
    unit: '‰',
    optimal: '10 - 25',
    warning: '5 - 10 hoặc 25 - 30',
  },
  alkalinity: {
    label: 'Độ kiềm',
    unit: 'mg/L',
    optimal: '100 - 160',
    warning: '80 - 100 hoặc 160 - 200',
  },
  nh3: { label: 'NH3', unit: 'mg/L', optimal: '≤ 0.3', warning: '0.3 - 0.5' },
  h2s: {
    label: 'H2S',
    unit: 'mg/L',
    optimal: '≤ 0.03',
    warning: '0.03 - 0.05',
  },
  transparency: {
    label: 'Độ trong',
    unit: 'cm',
    optimal: '25 - 40',
    warning: '20 - 25 hoặc 40 - 50',
  },
};

const STATUS_CHECKS: Record<WaterMetricKey, (v: number) => WaterStatus> = {
  temperature: (v) =>
    v >= 25 && v <= 30
      ? 'Optimal'
      : (v >= 20 && v < 25) || (v > 30 && v <= 33)
        ? 'Warning'
        : 'Danger',
  ph: (v) =>
    v >= 8.2 && v <= 8.5
      ? 'Optimal'
      : (v >= 7.5 && v < 8.2) || (v > 8.5 && v <= 9.0)
        ? 'Warning'
        : 'Danger',
  dissolvedOxygen: (v) => (v > 4 ? 'Optimal' : v >= 3 ? 'Warning' : 'Danger'),
  salinity: (v) =>
    v >= 10 && v <= 25
      ? 'Optimal'
      : (v >= 5 && v < 10) || (v > 25 && v <= 30)
        ? 'Warning'
        : 'Danger',
  alkalinity: (v) =>
    v >= 100 && v <= 160
      ? 'Optimal'
      : (v >= 80 && v < 100) || (v > 160 && v <= 200)
        ? 'Warning'
        : 'Danger',
  nh3: (v) => (v <= 0.3 ? 'Optimal' : v <= 0.5 ? 'Warning' : 'Danger'),
  h2s: (v) => (v <= 0.03 ? 'Optimal' : v <= 0.05 ? 'Warning' : 'Danger'),
  transparency: (v) =>
    v >= 25 && v <= 40
      ? 'Optimal'
      : (v >= 20 && v < 25) || (v > 40 && v <= 50)
        ? 'Warning'
        : 'Danger',
};

export function waterMetricStatus(
  key: WaterMetricKey,
  value: unknown,
): WaterStatus {
  return STATUS_CHECKS[key](Number(value));
}

export function waterColorStatus(color: string): WaterStatus {
  const val = color.toLowerCase().trim();
  if (
    val.includes('xanh lục') ||
    val.includes('xanh vỏ đậu') ||
    val.includes('nâu nhạt')
  ) {
    return 'Optimal';
  }
  if (val.includes('đỏ') || val.includes('đen')) return 'Danger';
  return 'Warning';
}

export function calculateOverallWaterStatus(
  metrics: WaterMetricsInput,
): WaterStatus {
  const statuses = (Object.keys(STATUS_CHECKS) as WaterMetricKey[]).map((k) =>
    waterMetricStatus(k, metrics[k]),
  );
  if (metrics.waterColor) statuses.push(waterColorStatus(metrics.waterColor));
  if (statuses.includes('Danger')) return 'Danger';
  if (statuses.includes('Warning')) return 'Warning';
  return 'Optimal';
}

export interface WaterMetricAssessment {
  key: WaterMetricKey;
  label: string;
  value: number;
  unit: string;
  status: WaterStatus;
  optimalRange: string;
}

/** Đánh giá chi tiết từng chỉ số; bỏ qua chỉ số không có giá trị. */
export function assessWaterMetrics(metrics: Partial<WaterMetricsInput>): {
  overall: WaterStatus;
  metrics: WaterMetricAssessment[];
  alerts: string[];
} {
  const assessed: WaterMetricAssessment[] = [];
  for (const key of Object.keys(STATUS_CHECKS) as WaterMetricKey[]) {
    const raw = metrics[key];
    if (raw === null || raw === undefined || raw === '') continue;
    const value = Number(raw);
    if (Number.isNaN(value)) continue;
    const info = WATER_METRIC_INFO[key];
    assessed.push({
      key,
      label: info.label,
      value,
      unit: info.unit,
      status: waterMetricStatus(key, value),
      optimalRange: info.optimal,
    });
  }
  const alerts = assessed
    .filter((m) => m.status !== 'Optimal')
    .map(
      (m) =>
        `${m.label} ${m.value}${m.unit ? ' ' + m.unit : ''} (${
          m.status === 'Danger' ? 'nguy hiểm' : 'cần chú ý'
        }, tối ưu ${m.optimalRange})`,
    );
  let overall: WaterStatus = 'Optimal';
  const statuses = assessed.map((m) => m.status);
  if (metrics.waterColor) {
    const colorStatus = waterColorStatus(metrics.waterColor);
    statuses.push(colorStatus);
    if (colorStatus !== 'Optimal') {
      alerts.push(`Màu nước "${metrics.waterColor}" (${colorStatus === 'Danger' ? 'nguy hiểm' : 'cần chú ý'})`);
    }
  }
  if (statuses.includes('Danger')) overall = 'Danger';
  else if (statuses.includes('Warning')) overall = 'Warning';
  return { overall, metrics: assessed, alerts };
}

export const WATER_STATUS_LABEL: Record<WaterStatus, string> = {
  Optimal: 'Tối ưu',
  Warning: 'Cần chú ý',
  Danger: 'Nguy hiểm',
};
