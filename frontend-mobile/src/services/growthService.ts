import { apiClient } from './apiClient';

export interface ShrimpCast {
  count: number;
  weightGram: number;
  note?: string;
}

export interface CreateShrimpSizeSamplePayload {
  casts: ShrimpCast[]; // Exactly 5 casts
  netAreaSqM: number;
  sampleLengthCm?: number;
  samplingDate?: string;
  notes?: string;
}

export interface ShrimpSizeSample {
  id: string;
  pondId: string;
  samplingDate: string;
  doc?: number;
  sampleCount: number;
  sampleWeightGram: number;
  sampleLengthCm?: number;
  abwGram: number;
  sizePerKg: number;
  adgGramPerDay?: number;
  netAreaSqM?: number;
  estimatedTotalShrimp?: number;
  estimatedBiomassKg?: number;
  notes?: string;
  createdAt: string;
}

export interface TrajectoryPoint {
  doc: number;
  sr: number;
  loss: number;
  abw: number;
  /** Giá trị Y chuẩn hóa: abw_y = min(100, abw × 2). Vạch 50g = Y 100 */
  abw_y: number;
  biomass_kg: number;
  biomass_pct: number;
  fcr_raw: number | null;
  fcr_y: number | null;
  size: number | null;
}

export interface GrowthTrajectoryResponse {
  scopeName: string;
  farmName: string;
  pondName?: string;
  cropName?: string;
  kpis: {
    sr: number;
    loss: number;
    abw: number;
    biomass_kg: number;
    fcr_raw: number | null;
  };
  trajectory: TrajectoryPoint[];
}

export interface FcrAnalysisResponse {
  currentFcr: number;
  totalFeedKg: number;
  estimatedBiomassKg: number;
  targetFcr?: number;
  status: 'OPTIMAL' | 'WARNING' | 'DANGER' | 'NO_DATA';
  recommendation?: string;
}

export const growthService = {
  /**
   * Get size samples for a specific pond
   */
  async getSamplesByPond(pondId: string): Promise<ShrimpSizeSample[]> {
    const response = await apiClient.get<any>(`/ponds/${pondId}/size-samples`);
    if (Array.isArray(response)) return response;
    if (response && Array.isArray(response.samples)) return response.samples;
    return [];
  },

  /**
   * Get latest size sample for a pond
   */
  async getLatestSample(pondId: string): Promise<ShrimpSizeSample | null> {
    try {
      return await apiClient.get<ShrimpSizeSample>(`/ponds/${pondId}/size-samples/latest`);
    } catch {
      return null;
    }
  },

  /**
   * Get FCR analysis for a pond
   */
  async getFcrAnalysis(pondId: string): Promise<FcrAnalysisResponse | null> {
    try {
      return await apiClient.get<FcrAnalysisResponse>(`/ponds/${pondId}/size-samples/fcr`);
    } catch {
      return null;
    }
  },

  /**
   * Create new 5-cast size sample
   */
  async createSample(pondId: string, payload: CreateShrimpSizeSamplePayload): Promise<ShrimpSizeSample> {
    return apiClient.post<ShrimpSizeSample>(`/ponds/${pondId}/size-samples`, payload);
  },

  /**
   * Delete a sample
   */
  async deleteSample(pondId: string, sampleId: string): Promise<void> {
    return apiClient.delete(`/ponds/${pondId}/size-samples/${sampleId}`);
  },

  /**
   * Get survival rate by crop
   */
  async getSurvivalRate(cropId: string): Promise<any> {
    try {
      return await apiClient.get(`/survival-rate/crop/${cropId}`);
    } catch {
      return null;
    }
  },

  /**
   * Get 90-day standardized growth trajectory
   */
  async getGrowthTrajectory(params?: {
    farmId?: string;
    pondId?: string;
    cropId?: string;
    timeRange?: string;
    year?: string;
  }): Promise<GrowthTrajectoryResponse> {
    try {
      const queryParams = new URLSearchParams();
      if (params?.farmId) queryParams.set('farmId', params.farmId);
      if (params?.pondId) queryParams.set('pondId', params.pondId);
      if (params?.cropId) queryParams.set('cropId', params.cropId);
      if (params?.timeRange) queryParams.set('timeRange', params.timeRange);
      if (params?.year) queryParams.set('year', params.year);

      const qs = queryParams.toString() ? `?${queryParams.toString()}` : '';
      return await apiClient.get<GrowthTrajectoryResponse>(`/crops/analytics/growth-trajectory${qs}`);
    } catch (err) {
      return {
        scopeName: 'Chưa có dữ liệu thực tế',
        farmName: '',
        kpis: {
          sr: 0,
          loss: 0,
          abw: 0,
          biomass_kg: 0,
          fcr_raw: null,
        },
        trajectory: [],
      };
    }
  },
};
