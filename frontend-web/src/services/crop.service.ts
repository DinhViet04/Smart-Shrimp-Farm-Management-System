/**
 * crop.service.ts
 *
 * API service for crops (Vụ nuôi).
 * Connects to NestJS backend /api/crops
 */

import { apiFetch } from '../utils/api';

const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export interface Crop {
  id: string;
  pondId: string;
  startDate: string;
  initialShrimpCount: number;
  status: 'ACTIVE' | 'HARVESTED' | 'FAILED';
  createdAt?: string;
  updatedAt?: string;
  pond: {
    id: string;
    name: string;
    farmId: string;
    farm?: {
      id: string;
      name: string;
    };
  };
}

export interface CreateCropPayload {
  pondId: string;
  startDate: string;
  initialShrimpCount: number;
  status?: string;
}

export interface UpdateCropPayload {
  startDate?: string;
  initialShrimpCount?: number;
  status?: string;
}

export const cropService = {
  /**
   * GET /api/crops
   */
  getAll: async (filters?: { pondId?: string; status?: string }): Promise<Crop[]> => {
    const params = new URLSearchParams();
    if (filters?.pondId) params.append('pondId', filters.pondId);
    if (filters?.status) params.append('status', filters.status);

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
    return data as Crop;
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
    return data;
  },
};
