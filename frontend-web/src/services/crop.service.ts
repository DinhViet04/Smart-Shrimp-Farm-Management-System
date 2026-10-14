/**
 * crop.service.ts
 *
 * API service for crops (Vụ nuôi).
 * Connects to NestJS backend /api/crops
 */

import { apiFetch } from '../utils/api';
import { invalidatePondOverviewCache } from './pond.service';

const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';

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
    pond?: {
      id: string;
      name: string;
    };
  } | null;
  childCrops?: Array<{
    id: string;
    startDate: string;
    initialShrimpCount: number;
    status: string;
    stage?: string;
    pond?: {
      id: string;
      name: string;
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
