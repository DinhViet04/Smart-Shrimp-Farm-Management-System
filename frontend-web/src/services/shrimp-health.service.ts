/**
 * shrimp-health.service.ts
 *
 * API service for shrimp health records (FE-21).
 * Calls the NestJS backend via the shared apiFetch utility.
 */

import { apiFetch } from '../utils/api';

const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// ─── Types ────────────────────────────────────────────────────────────────────

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
  recordTime: string; // ISO 8601
  healthStatus: ShrimpHealthStatusType;
  severity: ShrimpSeverityType;
  affectedPercentage: number;
  note?: string;
}

export interface ShrimpHealthHistoryRecord {
  id: string;
  recordTime: string;
  farmName: string;
  pondName: string;
  cropId: string;
  cropStartDate: string;
  healthStatus: ShrimpHealthStatusType;
  severity: ShrimpSeverityType;
  affectedPercentage: number;
  note?: string;
  recordedBy: string;
  createdAt: string;
}

export interface ShrimpHealthDetail {
  id: string;
  farmId: string;
  farmName: string;
  pondId: string;
  pondName: string;
  cropId: string;
  cropStartDate: string;
  recordTime: string;
  healthStatus: ShrimpHealthStatusType;
  severity: ShrimpSeverityType;
  affectedPercentage: number;
  note?: string;
  recordedBy: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const shrimpHealthService = {
  /**
   * POST /api/shrimp-health
   */
  create: async (
    payload: CreateShrimpHealthPayload,
  ): Promise<{ id: string; message: string }> => {
    const response = await apiFetch(`${apiUrl}/api/shrimp-health`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(
        Array.isArray(data?.message)
          ? data.message.join(', ')
          : data?.message || 'Không thể lưu bản ghi sức khỏe tôm',
      );
    }
    return data;
  },

  /**
   * GET /api/shrimp-health/history
   */
  getHistory: async (filters: {
    farmId?: string;
    pondId?: string;
    healthStatus?: string;
    fromDate?: string;
    toDate?: string;
    page?: number;
    size?: number;
    sort?: 'asc' | 'desc';
  }): Promise<{
    content: ShrimpHealthHistoryRecord[];
    page: number;
    size: number;
    totalElements: number;
  }> => {
    const params = new URLSearchParams();
    if (filters.farmId) params.append('farmId', filters.farmId);
    if (filters.pondId) params.append('pondId', filters.pondId);
    if (filters.healthStatus) params.append('healthStatus', filters.healthStatus);
    if (filters.fromDate) params.append('fromDate', filters.fromDate);
    if (filters.toDate) params.append('toDate', filters.toDate);
    if (filters.page !== undefined) params.append('page', filters.page.toString());
    if (filters.size !== undefined) params.append('size', filters.size.toString());
    if (filters.sort) params.append('sort', filters.sort);

    const response = await apiFetch(
      `${apiUrl}/api/shrimp-health/history?${params.toString()}`,
    );
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data?.message || 'Không thể tải lịch sử sức khỏe tôm');
    }
    return data;
  },

  /**
   * GET /api/shrimp-health/:id
   */
  getById: async (id: string): Promise<ShrimpHealthDetail> => {
    const response = await apiFetch(`${apiUrl}/api/shrimp-health/${id}`);
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data?.message || 'Không thể tải chi tiết bản ghi');
    }
    return data;
  },
};
