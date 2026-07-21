/**
 * water-quality.service.ts
 *
 * API service for water quality records (FE-23).
 * Calls the NestJS backend via the shared apiFetch utility
 * (handles JWT auth + token refresh automatically).
 *
 * Reusable by:
 *   FE-24 View Water Quality History
 *   FE-25 Monitor Water Quality Trends
 *   FE-37 Detect Environmental Risks
 *   FE-38 Generate Water Quality Alerts
 *   FE-42 Analyze Water Quality
 *   FE-49 Water Quality Dashboard
 *   FE-51 Farming Reports
 */

import { apiFetch } from '../utils/api';

const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CreateWaterQualityPayload {
  pondId: string;
  recordTime: string; // ISO 8601
  temperature: number;
  ph: number;
  dissolvedOxygen: number;
  salinity: number;
  alkalinity: number;
  nh3: number;
  no2: number;
  transparency: number;
  note?: string;
}

export interface WaterQualityRecord {
  id: string;
  recordTime: string;
  farmName: string;
  pondName: string;
  temperature: number;
  ph: number;
  dissolvedOxygen: number;
  salinity: number;
  alkalinity: number;
  nh3: number;
  no2: number;
  transparency: number;
  overallStatus: 'Optimal' | 'Warning' | 'Danger';
  createdBy: string;
  createdAt: string;
}

export interface CreateWaterQualityResponse {
  id: string;
  message: string;
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const waterQualityService = {
  /**
   * POST /api/water-quality
   * Creates a new water quality record for an owned pond.
   */
  create: async (payload: CreateWaterQualityPayload): Promise<CreateWaterQualityResponse> => {
    const response = await apiFetch(`${apiUrl}/api/water-quality`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    if (!response.ok) {
      // Forward backend validation messages to the UI
      throw new Error(
        Array.isArray(data?.message)
          ? data.message.join(', ')
          : data?.message || 'Không thể lưu thông số môi trường',
      );
    }
    return data as CreateWaterQualityResponse;
  },

  /**
   * GET /api/water-quality/pond/:pondId
   * Returns all records for a pond ordered by recordTime desc.
   * Used by History, Trend, AI Analysis.
   */
  getByPond: async (pondId: string): Promise<WaterQualityRecord[]> => {
    const response = await apiFetch(`${apiUrl}/api/water-quality/pond/${pondId}`);
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data?.message || 'Không thể tải lịch sử chất lượng nước');
    }
    return data as WaterQualityRecord[];
  },

  /**
   * GET /api/water-quality/history
   * Returns paginated, sorted, and filtered history records.
   */
  getHistory: async (filters: {
    farmId?: string;
    pondId?: string;
    fromDate?: string;
    toDate?: string;
    page?: number;
    size?: number;
    sort?: 'asc' | 'desc';
  }): Promise<{
    content: {
      id: string;
      recordTime: string;
      farmName: string;
      pondName: string;
      temperature: number;
      ph: number;
      dissolvedOxygen: number;
      salinity: number;
      alkalinity: number;
      nh3: number;
      no2: number;
      transparency: number;
      overallStatus: 'Optimal' | 'Warning' | 'Danger';
      note?: string;
      createdAt: string;
    }[];
    page: number;
    size: number;
    totalElements: number;
  }> => {
    const params = new URLSearchParams();
    if (filters.farmId) params.append('farmId', filters.farmId);
    if (filters.pondId) params.append('pondId', filters.pondId);
    if (filters.fromDate) params.append('fromDate', filters.fromDate);
    if (filters.toDate) params.append('toDate', filters.toDate);
    if (filters.page !== undefined) params.append('page', filters.page.toString());
    if (filters.size !== undefined) params.append('size', filters.size.toString());
    if (filters.sort) params.append('sort', filters.sort);

    const response = await apiFetch(`${apiUrl}/api/water-quality/history?${params.toString()}`);
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data?.message || 'Không thể tải lịch sử chất lượng nước');
    }
    return data;
  },

  /**
   * GET /api/water-quality/trends
   * Returns unpaginated history for a pond ordered by recordTime asc for charts.
   */
  getTrends: async (pondId: string, fromDate?: string, toDate?: string): Promise<{
    id: string;
    recordTime: string;
    temperature: number;
    ph: number;
    dissolvedOxygen: number;
    salinity: number;
    alkalinity: number;
    nh3: number;
    no2: number;
    transparency: number;
    overallStatus: 'Optimal' | 'Warning' | 'Danger';
  }[]> => {
    const params = new URLSearchParams();
    params.append('pondId', pondId);
    if (fromDate) params.append('fromDate', fromDate);
    if (toDate) params.append('toDate', toDate);

    const response = await apiFetch(`${apiUrl}/api/water-quality/trends?${params.toString()}`);
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data?.message || 'Không thể tải xu hướng chất lượng nước');
    }
    return data;
  },
};
