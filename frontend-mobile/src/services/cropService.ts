import { apiClient } from './apiClient';

export interface Crop {
  id: string;
  pondId: string;
  startDate: string;
  initialShrimpCount: number;
  status: 'ACTIVE' | 'HARVESTED' | 'FAILED' | string;
  stage?: 'NURSERY' | 'GROW_OUT' | string;
  targetHarvestSize?: number;
  targetSurvivalRate?: number;
  targetTotalFeedKg?: number;
  expectedHarvestDate?: string;
  expectedTransferDate?: string;
  expectedDurationDays?: number;
  actualHarvestDate?: string;
  actualHarvestWeightKg?: number;
  survivalRate?: number;
  pond?: {
    id: string;
    name: string;
    areaSize: number;
    depth: number;
    farm?: {
      id: string;
      name: string;
    };
  };
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateCropPayload {
  pondId: string;
  startDate: string;
  initialShrimpCount: number;
  status?: string;
  stage?: string;
  targetHarvestSize?: number;
  targetSurvivalRate?: number;
  targetTotalFeedKg?: number;
  expectedHarvestDate?: string;
  expectedTransferDate?: string;
  expectedDurationDays?: number;
}

export const cropService = {
  async getAll(pondId?: string, status?: string): Promise<Crop[]> {
    const params = new URLSearchParams();
    if (pondId) params.append('pondId', pondId);
    if (status) params.append('status', status);
    const q = params.toString();
    return apiClient.get<Crop[]>(`/crops${q ? `?${q}` : ''}`);
  },

  async getById(id: string): Promise<Crop> {
    return apiClient.get<Crop>(`/crops/${id}`);
  },

  async create(data: CreateCropPayload): Promise<Crop> {
    return apiClient.post<Crop>('/crops', data);
  },

  async update(id: string, data: Partial<CreateCropPayload>): Promise<Crop> {
    return apiClient.put<Crop>(`/crops/${id}`, data);
  },

  async harvest(id: string, data: { actualHarvestDate: string; actualHarvestWeightKg: number; survivalRate?: number }): Promise<Crop> {
    return apiClient.patch<Crop>(`/crops/${id}/harvest`, data);
  },
};
