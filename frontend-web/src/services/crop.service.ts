/**
 * crop.service.ts
 *
 * API service for crops (Vụ nuôi).
 * Connects to NestJS backend /api/crops
 */

import { apiFetch } from '../utils/api';
import { invalidatePondOverviewCache } from './pond.service';

const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export interface SeedMarketPrice {
  code: string;
  name: string;
  species: string;
  sizeStage: string;
  price: number;
  unit: string;
  source: string;
  sourceUrl: string;
  updatedAt: string;
  isLive: boolean;
  note?: string;
}

export interface CommercialShrimpSize {
  code: string;
  size: number;
  name: string;
  price: number;
  unit: string;
  source: string;
  sourceUrl: string;
  updatedAt: string;
}

export interface ShrimpPriceCalculation {
  targetSize: number;
  price: number;
  unit: string;
  isInterpolated: boolean;
  lowerBound?: { size: number; price: number };
  upperBound?: { size: number; price: number };
  source: string;
  sourceUrl: string;
  updatedAt: string;
}

export const DEFAULT_COMMERCIAL_SIZES: CommercialShrimpSize[] = [
  { code: 'THE20', size: 20, price: 200000, name: 'Tôm thẻ 20 con/kg', unit: 'đ/KG', source: 'tepbac.com', sourceUrl: 'https://tepbac.com/gia-thuy-san/gia/tom#subcat-27', updatedAt: '' },
  { code: 'THE30', size: 30, price: 155000, name: 'Tôm thẻ 30 con/kg', unit: 'đ/KG', source: 'tepbac.com', sourceUrl: 'https://tepbac.com/gia-thuy-san/gia/tom#subcat-27', updatedAt: '' },
  { code: 'THE40', size: 40, price: 132000, name: 'Tôm thẻ 40 con/kg', unit: 'đ/KG', source: 'tepbac.com', sourceUrl: 'https://tepbac.com/gia-thuy-san/gia/tom#subcat-27', updatedAt: '' },
  { code: 'THE50', size: 50, price: 122000, name: 'Tôm thẻ 50 con/kg', unit: 'đ/KG', source: 'tepbac.com', sourceUrl: 'https://tepbac.com/gia-thuy-san/gia/tom#subcat-27', updatedAt: '' },
  { code: 'THE60', size: 60, price: 113000, name: 'Tôm thẻ 60 con/kg', unit: 'đ/KG', source: 'tepbac.com', sourceUrl: 'https://tepbac.com/gia-thuy-san/gia/tom#subcat-27', updatedAt: '' },
  { code: 'THE70', size: 70, price: 110000, name: 'Tôm thẻ 70 con/kg', unit: 'đ/KG', source: 'tepbac.com', sourceUrl: 'https://tepbac.com/gia-thuy-san/gia/tom#subcat-27', updatedAt: '' },
  { code: 'THE80', size: 80, price: 107000, name: 'Tôm thẻ 80 con/kg', unit: 'đ/KG', source: 'tepbac.com', sourceUrl: 'https://tepbac.com/gia-thuy-san/gia/tom#subcat-27', updatedAt: '' },
  { code: 'THE90', size: 90, price: 104000, name: 'Tôm thẻ 90 con/kg', unit: 'đ/KG', source: 'tepbac.com', sourceUrl: 'https://tepbac.com/gia-thuy-san/gia/tom#subcat-27', updatedAt: '' },
  { code: 'THE100', size: 100, price: 100000, name: 'Tôm thẻ 100 con/kg', unit: 'đ/KG', source: 'tepbac.com', sourceUrl: 'https://tepbac.com/gia-thuy-san/gia/tom#subcat-27', updatedAt: '' },
  { code: 'THE150', size: 150, price: 64000, name: 'Tôm thẻ 150 con/kg', unit: 'đ/KG', source: 'tepbac.com', sourceUrl: 'https://tepbac.com/gia-thuy-san/gia/tom#subcat-27', updatedAt: '' },
];

/**
 * Thuật toán tính giá tôm theo size (hỗ trợ cả size chẵn và size lẻ như 32, 48,... qua nội suy tuyến tính)
 */
export function interpolateShrimpPrice(
  targetSize: number,
  sizesList?: CommercialShrimpSize[]
): ShrimpPriceCalculation {
  const size = Math.max(1, targetSize);
  const list = sizesList && sizesList.length > 0 ? sizesList : DEFAULT_COMMERCIAL_SIZES;
  const sorted = [...list].filter((s) => s.size > 0 && s.price > 0).sort((a, b) => a.size - b.size);

  const exact = sorted.find((s) => s.size === size);
  if (exact) {
    return {
      targetSize: size,
      price: exact.price,
      unit: 'đ/KG',
      isInterpolated: false,
      source: 'tepbac.com',
      sourceUrl: 'https://tepbac.com/gia-thuy-san/gia/tom#subcat-27',
      updatedAt: exact.updatedAt || new Date().toISOString(),
    };
  }

  // Size < 20
  if (size < sorted[0].size) {
    const s1 = sorted[0];
    const s2 = sorted[1] || s1;
    const slope = s2.size !== s1.size ? (s2.price - s1.price) / (s2.size - s1.size) : 0;
    const price = Math.max(s1.price, Math.round((s1.price + (size - s1.size) * slope) / 100) * 100);
    return {
      targetSize: size,
      price,
      unit: 'đ/KG',
      isInterpolated: true,
      lowerBound: s1,
      upperBound: s2,
      source: 'tepbac.com',
      sourceUrl: 'https://tepbac.com/gia-thuy-san/gia/tom#subcat-27',
      updatedAt: new Date().toISOString(),
    };
  }

  // Size > 150
  if (size > sorted[sorted.length - 1].size) {
    const last = sorted[sorted.length - 1];
    const prev = sorted[sorted.length - 2] || last;
    const slope = last.size !== prev.size ? (last.price - prev.price) / (last.size - prev.size) : 0;
    const price = Math.max(40000, Math.round((last.price + (size - last.size) * slope) / 100) * 100);
    return {
      targetSize: size,
      price,
      unit: 'đ/KG',
      isInterpolated: true,
      lowerBound: prev,
      upperBound: last,
      source: 'tepbac.com',
      sourceUrl: 'https://tepbac.com/gia-thuy-san/gia/tom#subcat-27',
      updatedAt: new Date().toISOString(),
    };
  }

  // Size lẻ nằm giữa 2 mốc
  for (let i = 0; i < sorted.length - 1; i++) {
    const s1 = sorted[i];
    const s2 = sorted[i + 1];
    if (size >= s1.size && size <= s2.size) {
      const t = (size - s1.size) / (s2.size - s1.size);
      const raw = s1.price + t * (s2.price - s1.price);
      const price = Math.round(raw / 100) * 100;
      return {
        targetSize: size,
        price,
        unit: 'đ/KG',
        isInterpolated: true,
        lowerBound: s1,
        upperBound: s2,
        source: 'tepbac.com',
        sourceUrl: 'https://tepbac.com/gia-thuy-san/gia/tom#subcat-27',
        updatedAt: new Date().toISOString(),
      };
    }
  }

  return {
    targetSize: size,
    price: sorted[0].price,
    unit: 'đ/KG',
    isInterpolated: false,
    source: 'tepbac.com',
    sourceUrl: 'https://tepbac.com/gia-thuy-san/gia/tom#subcat-27',
    updatedAt: new Date().toISOString(),
  };
}

export interface GrowthMilestone {
  day: number;
  weight: number;
}

export interface Crop {
  id: string;
  pondId: string;
  startDate: string;
  initialShrimpCount: number;
  status: 'ACTIVE' | 'HARVESTED' | 'FAILED';
  targetHarvestSize?: number | null;
  growthMilestones?: GrowthMilestone[] | null;
  targetSurvivalRate?: number | null;
  targetTotalFeedKg?: number | null;
  expectedHarvestDate?: string | null;
  expectedDurationDays?: number | null;
  stage?: 'NURSERY' | 'COMMERCIAL' | null;
  expectedTransferDate?: string | null;
  parentCropId?: string | null;
  transferDate?: string | null;
  actualNurseryHarvest?: number | null;
  nurserySurvivalRate?: number | null;
  transferSize?: number | null;
  splitNote?: string | null;
  actualHarvestCount?: number | null;
  actualHarvestKg?: number | null;
  actualHarvestSize?: number | null;
  actualHarvestDate?: string | null;
  actualHarvestPricePerKg?: number | null;
  actualHarvestRevenue?: number | null;
  actualHarvestCost?: number | null;
  actualHarvestProfit?: number | null;
  actualHarvestFcr?: number | null;
  actualHarvestSurvivalRate?: number | null;
  harvestFeedCost?: number | null;
  harvestMedicineCost?: number | null;
  harvestChemicalCost?: number | null;
  seedUnitPrice?: number | null;
  seedCost?: number | null;
  seedType?: string | null;
  seedSource?: string | null;
  harvestSeedCost?: number | null;
  harvestElectricityCost?: number | null;
  harvestLaborCost?: number | null;
  harvestOtherCost?: number | null;
  harvestFeedKg?: number | null;
  harvestNote?: string | null;
  harvestEvaluation?: string | null;
  harvestLessonsLearned?: string | null;
  harvestNextRecommendation?: string | null;
  parentCrop?: {
    id: string;
    startDate: string;
    initialShrimpCount: number;
    stage?: string;
    status?: string;
    transferDate?: string | null;
    actualNurseryHarvest?: number | null;
    nurserySurvivalRate?: number | null;
    transferSize?: number | null;
    splitNote?: string | null;
    actualHarvestDate?: string | null;
    actualHarvestKg?: number | null;
    actualHarvestSize?: number | null;
    actualHarvestRevenue?: number | null;
    actualHarvestCost?: number | null;
    actualHarvestProfit?: number | null;
    actualHarvestFcr?: number | null;
    actualHarvestSurvivalRate?: number | null;
    seedUnitPrice?: number | null;
    seedCost?: number | null;
    seedType?: string | null;
    pond?: {
      id: string;
      name: string;
      areaSize?: number;
      depth?: number;
      farmId?: string;
    };
  } | null;
  childCrops?: Array<{
    id: string;
    startDate: string;
    initialShrimpCount: number;
    status: string;
    stage?: string;
    actualHarvestDate?: string | null;
    actualHarvestKg?: number | null;
    actualHarvestCount?: number | null;
    actualHarvestSize?: number | null;
    actualHarvestRevenue?: number | null;
    actualHarvestCost?: number | null;
    actualHarvestProfit?: number | null;
    actualHarvestFcr?: number | null;
    actualHarvestSurvivalRate?: number | null;
    expectedHarvestDate?: string | null;
    expectedDurationDays?: number | null;
    targetHarvestSize?: number | null;
    targetSurvivalRate?: number | null;
    targetTotalFeedKg?: number | null;
    pond?: {
      id: string;
      name: string;
      areaSize?: number;
      depth?: number;
      farmId?: string;
    };
  }> | null;
  createdAt?: string;
  updatedAt?: string;
  pond: {
    id: string;
    name: string;
    areaSize?: number;
    depth?: number;
    farmId: string;
    farm?: {
      id: string;
      name: string;
      farmingModel?: string;
    };
  };
}

export interface SplitDestinationPayload {
  pondId: string;
  shrimpCount: number;
  targetHarvestSize?: number;
  targetSurvivalRate?: number;
  targetTotalFeedKg?: number;
  expectedHarvestDate?: string;
  expectedDurationDays?: number;
}

export interface SplitCropPayload {
  transferDate: string;
  actualNurseryHarvest: number;
  transferSize?: number;
  splitNote?: string;
  destinations: SplitDestinationPayload[];
}

export interface CreateCropPayload {
  pondId: string;
  startDate: string;
  initialShrimpCount: number;
  status?: string;
  targetHarvestSize?: number;
  growthMilestones?: GrowthMilestone[];
  targetSurvivalRate?: number;
  targetTotalFeedKg?: number;
  expectedHarvestDate?: string;
  expectedDurationDays?: number;
  stage?: 'NURSERY' | 'COMMERCIAL';
  expectedTransferDate?: string;
  seedUnitPrice?: number;
  seedCost?: number;
  seedType?: string;
  seedSource?: string;
}

export interface UpdateCropPayload {
  startDate?: string;
  initialShrimpCount?: number;
  status?: string;
  targetHarvestSize?: number;
  growthMilestones?: GrowthMilestone[];
  targetSurvivalRate?: number;
  targetTotalFeedKg?: number;
  expectedHarvestDate?: string;
  expectedDurationDays?: number;
  stage?: 'NURSERY' | 'COMMERCIAL';
  expectedTransferDate?: string;
  seedUnitPrice?: number;
  seedCost?: number;
  seedType?: string;
  seedSource?: string;
}

export interface HarvestCropPayload {
  actualHarvestKg: number;
  actualHarvestSize: number;
  actualHarvestPricePerKg: number;
  harvestFeedCost?: number;
  harvestMedicineCost?: number;
  harvestChemicalCost?: number;
  harvestSeedCost?: number;
  harvestElectricityCost?: number;
  harvestLaborCost?: number;
  harvestOtherCost?: number;
  harvestFeedKg?: number;
  actualHarvestDate?: string;
  harvestNote?: string;
}

export interface MaterialUsageItem {
  inventoryId: string;
  itemName: string;
  category: 'FEED' | 'MEDICINE' | 'CHEMICAL';
  quantityUsed: number;
  unit: string;
  unitPrice: number;
  totalCost: number;
}

export interface HarvestSummaryResponse {
  crop: Crop;
  doc: number;
  summary: {
    totalFeedKg: number;
    totalFeedCost: number;
    totalMedicineCost: number;
    totalChemicalCost: number;
    totalCost: number;
    feedLogs: MaterialUsageItem[];
    medicineLogs: MaterialUsageItem[];
    chemicalLogs: MaterialUsageItem[];
    availableInventory: any[];
  };
}

export interface FeedProductUsageSummary {
  productId: string;
  itemName: string;
  unit: string;
  unitPrice: number;
  totalKg: number;
  totalCost: number;
  sessionCount: number;
}

export interface DetailedFeedingLog {
  id: string;
  feedingDate: string;
  feedingSession: string;
  feedingTime: string;
  feedAmount: number;
  feedingMethod: 'MANUAL' | 'AUTO';
  feedingStatus: 'COMPLETED' | 'SKIPPED' | 'DELAYED';
  note?: string | null;
  feedProduct?: {
    id: string;
    itemName: string;
    unit: string;
    pricePerPackage?: number;
    weightPerPkg?: number;
  };
  creator?: {
    id: string;
    fullName: string;
    role: string;
  };
}

export interface DetailedWaterQualityRecord {
  id: string;
  recordTime: string;
  temperature: number;
  ph: number;
  dissolvedOxygen: number;
  salinity: number;
  alkalinity?: number | null;
  nh3: number;
  no2: number;
  h2s?: number | null;
  transparency?: number;
  waterColor?: string | null;
  note?: string | null;
  creator?: {
    id: string;
    fullName: string;
    role: string;
  };
}

export interface DetailedGrowthSample {
  id: string;
  samplingDate: string;
  doc?: number | null;
  sampleCount: number;
  sampleWeightGram: number;
  sampleLengthCm?: number | null;
  abwGram: number;
  sizePerKg: number;
  adgGramPerDay?: number | null;
  notes?: string | null;
  netAreaSqM?: number | null;
  estimatedTotalShrimp?: number | null;
  estimatedBiomassKg?: number | null;
}

export interface DetailedHealthRecord {
  id: string;
  recordTime: string;
  healthStatus: 'NORMAL' | 'LETHARGIC' | 'EDGE_GATHERING' | 'LOSS_OF_APPETITE';
  severity: 'NORMAL' | 'MILD' | 'MODERATE' | 'SEVERE';
  affectedPercentage: number;
  note?: string | null;
  recorder?: {
    id: string;
    fullName: string;
    role: string;
  };
}

export interface DetailedIncidentUpdate {
  id: string;
  treatment: string;
  observation?: string | null;
  result?: string | null;
  status: string;
  eventType: string;
  createdAt: string;
  author?: {
    id: string;
    fullName: string;
  };
}

export interface DetailedIncident {
  id: string;
  title: string;
  description: string;
  treatment?: string | null;
  status: 'OPEN' | 'TREATING' | 'RESOLVED';
  startedAt?: string | null;
  resolvedAt?: string | null;
  createdAt: string;
  reporter?: {
    id: string;
    fullName: string;
  };
  assignedTo?: {
    id: string;
    fullName: string;
  };
  updates?: DetailedIncidentUpdate[];
}

export interface DetailedTreatmentItem {
  id: string;
  inventoryId: string;
  itemName: string;
  category: 'FEED' | 'MEDICINE' | 'CHEMICAL';
  quantityUsed: number;
  unit: string;
  unitPrice: number;
  totalCost: number;
  usageDate: string;
  notes?: string | null;
  creatorName: string;
}

export interface DetailedMortalityLog {
  id: string;
  recordedDate: string;
  deadQuantityPcs: number;
  cause?: string | null;
  note?: string | null;
  creator?: {
    id: string;
    fullName: string;
  };
}

export interface CropDetailedReportResponse {
  crop: Crop;
  doc: number;
  transferInfo: {
    isNursery: boolean;
    splitFromParent: {
      parentCropId: string;
      pondId?: string;
      pondName: string;
      transferDate: string;
      transferSize?: number | null;
      initialCountReceived: number;
      splitNote?: string | null;
    } | null;
    splitToChildren: {
      totalChildPonds: number;
      transferDate?: string;
      actualNurseryHarvest?: number;
      nurserySurvivalRate?: number;
      transferSize?: number;
      splitNote?: string;
      children: Array<{
        id: string;
        pondId?: string;
        pondName: string;
        startDate: string;
        initialShrimpCount: number;
        status: string;
      }>;
    } | null;
  };
  feeding: {
    totalFeedKg: number;
    totalFeedCost: number;
    totalSessions: number;
    completedSessions: number;
    skippedSessions: number;
    delayedSessions: number;
    productsSummary: FeedProductUsageSummary[];
    recentLogs: DetailedFeedingLog[];
  };
  waterQuality: {
    totalMeasurements: number;
    averages: {
      ph: number;
      dissolvedOxygen: number;
      salinity: number;
      temperature: number;
      alkalinity: number | null;
      nh3: number;
      no2: number;
    } | null;
    alerts: {
      ph: number;
      dissolvedOxygen: number;
      nh3: number;
      no2: number;
      total: number;
    };
    recentRecords: DetailedWaterQualityRecord[];
  };
  growth: {
    totalSamples: number;
    initialSample: DetailedGrowthSample | null;
    latestSample: DetailedGrowthSample | null;
    samples: DetailedGrowthSample[];
  };
  health: {
    totalInspections: number;
    summary: {
      normal: number;
      lethargic: number;
      edgeGathering: number;
      lossOfAppetite: number;
    };
    records: DetailedHealthRecord[];
    totalDeadShrimp: number;
    mortalityLogs: DetailedMortalityLog[];
  };
  treatmentsAndSupplies: {
    totalMaterialsUsed: number;
    totalMedicineCost: number;
    totalChemicalCost: number;
    totalTreatmentCost: number;
    items: DetailedTreatmentItem[];
  };
  incidents: {
    total: number;
    open: number;
    treating: number;
    resolved: number;
    list: DetailedIncident[];
  };
  financial: {
    actualKg: number;
    actualSize: number;
    actualRevenue: number;
    costs: {
      feed: number;
      medicine: number;
      chemical: number;
      seed: number;
      electricity: number;
      labor: number;
      other: number;
      total: number;
    };
    profit: number;
    fcr: number | null;
    survivalRate: number | null;
  };
}

export interface ManagerHarvestSummary {
  year: number;
  quarter: number | null;
  totals: {
    harvestedCrops: number;
    revenue: number;
    cost: number;
    profit: number;
    harvestKg: number;
    profitMargin: number;
    averageFcr: number | null;
    averageSurvivalRate: number | null;
    targetMet: number;
  };
  comparison: {
    revenuePercent: number | null;
    profitPercent: number | null;
    harvestKgPercent: number | null;
  };
  farmSummaries: Array<{
    farmId: string;
    farmName: string;
    totals: ManagerHarvestSummary['totals'];
    ponds: Array<{
      pondId: string;
      pondName: string;
      totals: ManagerHarvestSummary['totals'];
    }>;
  }>;
  recentHarvests: Array<{
    id: string;
    pondId: string;
    pondName: string;
    farmId: string;
    farmName: string;
    actualHarvestDate: string;
    actualHarvestKg: number;
    actualHarvestRevenue: number;
    actualHarvestCost: number;
    actualHarvestProfit: number;
    actualHarvestFcr: number | null;
    actualHarvestSurvivalRate: number | null;
    targetMet: boolean | null;
  }>;
}

export const cropService = {
  /**
   * GET /api/crops
   */
  getAll: async (filters?: {
    pondId?: string;
    status?: string;
    summary?: boolean;
  }): Promise<Crop[]> => {
    const params = new URLSearchParams();
    if (filters?.pondId) params.append('pondId', filters.pondId);
    if (filters?.status) params.append('status', filters.status);
    if (filters?.summary) params.append('summary', 'true');

    const response = await apiFetch(`${apiUrl}/api/crops?${params.toString()}`);
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data?.message || 'Không thể tải danh sách vụ nuôi');
    }
    return Array.isArray(data) ? (data as Crop[]) : [];
  },

  /**
   * GET /api/crops?pondId=xxx&status=yyy
   */
  getByPond: async (pondId: string, status?: string): Promise<Crop[]> => {
    return cropService.getAll({ pondId, status });
  },

  /**
   * POST /api/crops
   */
  create: async (payload: CreateCropPayload): Promise<Crop> => {
    const response = await apiFetch(`${apiUrl}/api/crops`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(
        Array.isArray(data?.message)
          ? data.message.join(', ')
          : data?.message || 'Không thể tạo vụ nuôi mới',
      );
    }
    invalidatePondOverviewCache();
    return data as Crop;
  },

  /**
   * PUT /api/crops/:id
   */
  update: async (id: string, payload: UpdateCropPayload): Promise<Crop> => {
    const response = await apiFetch(`${apiUrl}/api/crops/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(
        Array.isArray(data?.message)
          ? data.message.join(', ')
          : data?.message || 'Không thể cập nhật vụ nuôi',
      );
    }
    invalidatePondOverviewCache();
    return data as Crop;
  },

  /**
   * POST /api/crops/:id/split
   */
  split: async (id: string, payload: SplitCropPayload): Promise<{ message: string; sourceCrop: Crop; newCrops: Crop[] }> => {
    const response = await apiFetch(`${apiUrl}/api/crops/${id}/split`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(
        Array.isArray(data?.message)
          ? data.message.join(', ')
          : data?.message || 'Không thể tách ao nuôi',
      );
    }
    invalidatePondOverviewCache();
    return data;
  },

  harvest: async (id: string, payload: HarvestCropPayload): Promise<Crop> => {
    const response = await apiFetch(`${apiUrl}/api/crops/${id}/harvest`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data?.message || 'Không thể đóng vụ nuôi');
    }
    invalidatePondOverviewCache();
    return data as Crop;
  },

  /**
   * GET /api/crops/:id/harvest-summary
   */
  getHarvestSummary: async (id: string): Promise<HarvestSummaryResponse> => {
    const response = await apiFetch(`${apiUrl}/api/crops/${id}/harvest-summary`);
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data?.message || 'Không thể tải thông tin thu hoạch');
    }
    return data as HarvestSummaryResponse;
  },

  /**
   * GET /api/crops/:id/detailed-report
   */
  getDetailedReport: async (id: string): Promise<CropDetailedReportResponse> => {
    const response = await apiFetch(`${apiUrl}/api/crops/${id}/detailed-report`);
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data?.message || 'Không thể tải báo cáo chi tiết vụ nuôi');
    }
    return data as CropDetailedReportResponse;
  },

  getManagerSummary: async (filters: { farmId?: string; year?: number; quarter?: number } = {}): Promise<ManagerHarvestSummary> => {
    const params = new URLSearchParams();
    if (filters.farmId) params.set('farmId', filters.farmId);
    if (filters.year) params.set('year', String(filters.year));
    if (filters.quarter) params.set('quarter', String(filters.quarter));
    const response = await apiFetch(`${apiUrl}/api/crops/analytics/manager-summary?${params.toString()}`);
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data?.message || 'Không thể tải tổng kết vụ nuôi');
    }
    return data as ManagerHarvestSummary;
  },

  /**
   * DELETE /api/crops/:id
   */
  /**
   * GET /api/market-prices/shrimp-seed
   * Lấy giá tôm giống thị trường hiện tại (Tôm thẻ chân trắng Post 10 từ Tép Bạc)
   */
  getMarketSeedPrice: async (): Promise<SeedMarketPrice> => {
    try {
      const response = await apiFetch(`${apiUrl}/api/market-prices/shrimp-seed`);
      if (response.ok) {
        const data = await response.json();
        return data as SeedMarketPrice;
      }
    } catch (e) {
      console.warn('Failed fetching market seed price:', e);
    }
    return {
      code: 'THEP10',
      name: 'Giống tôm thẻ chân trắng Post 10',
      species: 'Tôm thẻ chân trắng',
      sizeStage: 'Post 10 (P10)',
      price: 70,
      unit: 'đ/CON',
      source: 'tepbac.com',
      sourceUrl: 'https://tepbac.com/gia-thuy-san/giong-tom-the-chan-trang-p10',
      updatedAt: new Date().toISOString(),
      isLive: false,
    };
  },
  /**
   * GET /api/market-prices/commercial-sizes
   * Lấy danh sách giá tôm thương phẩm theo mốc size từ Tép Bạc
   */
  getCommercialShrimpSizes: async (): Promise<CommercialShrimpSize[]> => {
    try {
      const response = await apiFetch(`${apiUrl}/api/market-prices/commercial-sizes`);
      if (response.ok) {
        return (await response.json()) as CommercialShrimpSize[];
      }
    } catch (e) {
      console.warn('Failed fetching commercial shrimp sizes:', e);
    }
    return DEFAULT_COMMERCIAL_SIZES;
  },

  /**
   * GET /api/market-prices/calculate-harvest-price?size=...
   * Tính giá tôm 1kg theo size thu hoạch từ backend
   */
  calculateHarvestPrice: async (size: number): Promise<ShrimpPriceCalculation> => {
    try {
      const response = await apiFetch(`${apiUrl}/api/market-prices/calculate-harvest-price?size=${size}`);
      if (response.ok) {
        return (await response.json()) as ShrimpPriceCalculation;
      }
    } catch (e) {
      console.warn('Failed calculating harvest price from backend:', e);
    }
    return interpolateShrimpPrice(size);
  },
  remove: async (id: string): Promise<{ message: string }> => {
    const response = await apiFetch(`${apiUrl}/api/crops/${id}`, {
      method: 'DELETE',
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data?.message || 'Không thể xóa vụ nuôi');
    }
    invalidatePondOverviewCache();
    return data;
  },
};
