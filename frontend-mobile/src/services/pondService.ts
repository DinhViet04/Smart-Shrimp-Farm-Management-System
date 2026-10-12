import { apiClient } from './apiClient';

export interface OverviewFarm {
  id: string;
  name: string;
  area: number;
  location?: string;
  farmingModel?: string;
}

export interface OverviewPond {
  id: string;
  name: string;
  areaSize: number;
  depth: number;
  farmId: string;
  farm?: OverviewFarm;
  createdAt: string;
  latestSizeSample?: {
    abwGram: number;
    sizePerKg: number;
    adgGramPerDay?: number;
    estimatedBiomassKg?: number;
    estimatedTotalShrimp?: number;
    doc?: number;
    samplingDate: string;
  } | null;
}

export interface OverviewCrop {
  id: string;
  pondId: string;
  startDate: string;
  initialShrimpCount: number;
  status: 'ACTIVE' | 'HARVESTED' | 'FAILED';
  targetHarvestSize?: number;
  targetSurvivalRate?: number;
  stage?: string;
  pond?: OverviewPond;
}

export interface PondsOverviewResponse {
  farms: OverviewFarm[];
  ponds: OverviewPond[];
  crops: OverviewCrop[];
}

export interface CreatePondPayload {
  name: string;
  areaSize: number;
  depth: number;
  farmId: string;
}

export const pondService = {
  /**
   * Get comprehensive overview of farms, ponds, and crops
   */
  async getOverview(): Promise<PondsOverviewResponse> {
    return apiClient.get<PondsOverviewResponse>('/ponds/overview');
  },

  /**
   * Get basic list of ponds
   */
  async getAllPonds(): Promise<OverviewPond[]> {
    return apiClient.get<OverviewPond[]>('/ponds');
  },

  /**
   * Create a new pond
   */
  async createPond(payload: CreatePondPayload): Promise<OverviewPond> {
    return apiClient.post<OverviewPond>('/ponds', payload);
  },
};
