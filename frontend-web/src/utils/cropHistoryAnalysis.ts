import type { Crop } from '../services/crop.service';

export type HistoryMetricKey = 'profit' | 'fcr' | 'survival' | 'harvest';

export interface CropHistoryAnalysis {
  overallBestIds: string[];
  scores: Record<string, number>;
  winners: Record<HistoryMetricKey, string[]>;
  insights: string[];
}

const metricDefinitions: Array<{
  key: HistoryMetricKey;
  weight: number;
  direction: 'min' | 'max';
  value: (crop: Crop) => number | null;
}> = [
  { key: 'profit', weight: 40, direction: 'max', value: (crop) => crop.actualHarvestProfit ?? null },
  { key: 'fcr', weight: 25, direction: 'min', value: (crop) => crop.actualHarvestFcr ?? null },
  { key: 'survival', weight: 20, direction: 'max', value: (crop) => crop.actualHarvestSurvivalRate ?? null },
  { key: 'harvest', weight: 15, direction: 'max', value: (crop) => crop.actualHarvestKg ?? null },
];

const isUsableValue = (key: HistoryMetricKey, value: number | null): value is number => {
  if (value === null || !Number.isFinite(value)) return false;
  return key === 'profit' ? true : value > 0;
};

const formatPercent = (value: number) => new Intl.NumberFormat('vi-VN', {
  maximumFractionDigits: 1,
}).format(Math.abs(value));

const formatMoney = (value: number) => new Intl.NumberFormat('vi-VN', {
  maximumFractionDigits: 0,
}).format(Math.abs(value));

export function analyzeCropHistory(crops: Crop[]): CropHistoryAnalysis {
  const scores: Record<string, number> = Object.fromEntries(crops.map((crop) => [crop.id, 0]));
  const winners = {} as Record<HistoryMetricKey, string[]>;

  for (const metric of metricDefinitions) {
    const available = crops
      .map((crop) => ({ id: crop.id, value: metric.value(crop) }))
      .filter((item): item is { id: string; value: number } => isUsableValue(metric.key, item.value));

    if (available.length === 0) {
      winners[metric.key] = [];
      continue;
    }

    const values = available.map((item) => item.value);
    const minimum = Math.min(...values);
    const maximum = Math.max(...values);
    const best = metric.direction === 'max' ? maximum : minimum;
    winners[metric.key] = available
      .filter((item) => Math.abs(item.value - best) < 0.0001)
      .map((item) => item.id);

    for (const item of available) {
      const normalized = maximum === minimum
        ? 1
        : metric.direction === 'max'
          ? (item.value - minimum) / (maximum - minimum)
          : (maximum - item.value) / (maximum - minimum);
      scores[item.id] += normalized * metric.weight;
    }
  }

  for (const id of Object.keys(scores)) scores[id] = Number(scores[id].toFixed(1));
  const highestScore = Math.max(...Object.values(scores), 0);
  const overallBestIds = crops.length === 0
    ? []
    : crops.filter((crop) => Math.abs(scores[crop.id] - highestScore) < 0.05).map((crop) => crop.id);

  const insights: string[] = [];
  const [latest, previous] = crops;
  if (latest && previous) {
    const latestProfit = latest.actualHarvestProfit;
    const previousProfit = previous.actualHarvestProfit;
    if (latestProfit !== null && latestProfit !== undefined && previousProfit !== null && previousProfit !== undefined) {
      const difference = latestProfit - previousProfit;
      if (Math.abs(difference) >= 1) {
        if (previousProfit > 0) {
          insights.push(`Lợi nhuận vụ gần nhất ${difference > 0 ? 'tăng' : 'giảm'} ${formatPercent((difference / previousProfit) * 100)}% so với vụ trước.`);
        } else {
          insights.push(`Lợi nhuận vụ gần nhất ${difference > 0 ? 'tăng' : 'giảm'} ${formatMoney(difference)} đ so với vụ trước.`);
        }
      }
    }

    const latestFcr = latest.actualHarvestFcr;
    const previousFcr = previous.actualHarvestFcr;
    if (latestFcr && previousFcr && Math.abs(latestFcr - previousFcr) >= 0.005) {
      insights.push(`FCR ${latestFcr < previousFcr ? 'cải thiện' : 'tăng'} ${Math.abs(latestFcr - previousFcr).toFixed(2)} so với vụ trước${latestFcr < previousFcr ? ', cho thấy hiệu quả sử dụng thức ăn tốt hơn.' : ', cần rà soát hiệu quả sử dụng thức ăn.'}`);
    }

    const latestSurvival = latest.actualHarvestSurvivalRate;
    const previousSurvival = previous.actualHarvestSurvivalRate;
    if (latestSurvival !== null && latestSurvival !== undefined && previousSurvival !== null && previousSurvival !== undefined && Math.abs(latestSurvival - previousSurvival) >= 0.05) {
      const difference = latestSurvival - previousSurvival;
      insights.push(`Tỷ lệ sống ${difference > 0 ? 'tăng' : 'giảm'} ${formatPercent(difference)} điểm phần trăm so với vụ trước.`);
    }
  }

  return { overallBestIds, scores, winners, insights };
}
