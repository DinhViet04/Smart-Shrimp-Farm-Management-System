import { apiClient } from './apiClient';

export type ShrimpHealthStatusType =
  | 'NORMAL'
  | 'LETHARGIC'
  | 'EDGE_GATHERING'
  | 'LOSS_OF_APPETITE';

export type ShrimpSeverityType = 'NORMAL' | 'MILD' | 'MODERATE' | 'SEVERE';

export interface CreateShrimpHealthPayload {
  farmId: string;
  pondId: string;
  cropId: string;
  recordTime: string;
  healthStatus: ShrimpHealthStatusType;
  severity: ShrimpSeverityType;
  affectedPercentage: number;
  note?: string;
}

export interface ShrimpHealthRecord {
  id: string;
  farmId: string;
  pondId: string;
  cropId: string;
  recordTime: string;
  healthStatus: ShrimpHealthStatusType;
  severity: ShrimpSeverityType;
  affectedPercentage: number;
  note?: string;
  createdAt: string;
  pond?: { name: string };
}

export interface CreateMortalityPayload {
  cropId: string;
  deadQuantityPcs: number;
  recordedDate?: string;
  cause?: string;
  note?: string;
}

export interface MortalityRecord {
  id: string;
  cropId: string;
  recordedDate: string;
  deadQuantityPcs: number;
  cause?: string;
  note?: string;
  createdAt: string;
}

export const shrimpHealthService = {
  /**
   * Record new shrimp health observation
   */
  async createHealthRecord(payload: CreateShrimpHealthPayload) {
    return apiClient.post('/shrimp-health', payload);
  },

  /**
   * Get shrimp health history
   */
  async getHistory(pondId?: string, farmId?: string): Promise<ShrimpHealthRecord[]> {
    const params = new URLSearchParams();
    if (pondId) params.append('pondId', pondId);
    if (farmId) params.append('farmId', farmId);
    const qs = params.toString();
    const response = await apiClient.get<any>(`/shrimp-health/history${qs ? `?${qs}` : ''}`);
    if (Array.isArray(response)) return response;
    if (response && Array.isArray(response.records)) return response.records;
    return [];
  },

  /**
   * Record dead shrimp / mortality
   */
  async createMortality(payload: CreateMortalityPayload) {
    return apiClient.post('/mortality-logs', payload);
  },

  /**
   * Get mortality logs for a crop
   */
  async getMortalityLogs(cropId: string): Promise<MortalityRecord[]> {
    const response = await apiClient.get<any>(`/mortality-logs/crop/${cropId}`);
    if (Array.isArray(response)) return response;
    return [];
  },
};
