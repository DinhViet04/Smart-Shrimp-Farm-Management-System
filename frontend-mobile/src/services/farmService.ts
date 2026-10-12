import { apiClient } from './apiClient';

export interface Farm {
  id: string;
  name: string;
  address: string;
  area: number;
  description?: string;
  farmingModel?: 'HIGH_TECH' | 'TRADITIONAL' | string;
  status?: 'ACTIVE' | 'INACTIVE' | string;
  ponds_count?: number;
  ownerId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateFarmPayload {
  name: string;
  address: string;
  area: number;
  description?: string;
  farmingModel?: string;
  status?: string;
}

export const farmService = {
  async getAll(search?: string): Promise<Farm[]> {
    const query = search ? `?search=${encodeURIComponent(search)}` : '';
    return apiClient.get<Farm[]>(`/farms${query}`);
  },

  async getMyFarms(): Promise<Farm[]> {
    return apiClient.get<Farm[]>('/farms/my');
  },

  async getById(id: string): Promise<Farm> {
    return apiClient.get<Farm>(`/farms/${id}`);
  },

  async create(data: CreateFarmPayload): Promise<Farm> {
    return apiClient.post<Farm>('/farms', data);
  },

  async update(id: string, data: Partial<CreateFarmPayload>): Promise<Farm> {
    return apiClient.put<Farm>(`/farms/${id}`, data);
  },

  async delete(id: string): Promise<any> {
    return apiClient.delete(`/farms/${id}`);
  },
};
