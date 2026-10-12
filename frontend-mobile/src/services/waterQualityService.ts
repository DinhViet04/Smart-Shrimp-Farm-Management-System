/**
 * waterQualityService.ts
 *
 * API client for the water quality feature (FE-23).
 * All functions require a valid JWT token.
 *
 * Endpoints consumed:
 *  - POST   /api/water-quality
 *  - GET    /api/farms
 *  - GET    /api/ponds
 */

import { API_ENDPOINT } from '../config/api';

const BASE_URL = API_ENDPOINT;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Farm {
  id: string;
  name: string;
}

export interface Pond {
  id: string;
  name: string;
  farmId: string;
}

export interface CreateWaterQualityPayload {
  pondId: string;
  recordTime: string; // ISO 8601
  temperature: number;
  ph: number;
  dissolvedOxygen: number;
  salinity: number;
  alkalinity: number;
  nh3: number;
  h2s: number;
  no2?: number;
  transparency?: number;
  waterColor?: string;
  note?: string;
}

export interface WaterQualityCreateResponse {
  id: string;
  message: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Builds the standard Authorization + Content-Type headers.
 */
function authHeaders(token: string): HeadersInit {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

/**
 * Parses the response and throws a readable error on failure.
 */
async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      message = body?.message ?? JSON.stringify(body);
    } catch {
      // ignore parse errors
    }
    throw new Error(message);
  }
  return res.json() as Promise<T>;
}

import { apiClient } from './apiClient';

// ─── API Functions ────────────────────────────────────────────────────────────

/**
 * Fetches all farms owned by the authenticated user.
 */
export async function getFarms(_token?: string): Promise<Farm[]> {
  return apiClient.get<Farm[]>('/farms');
}

/**
 * Fetches all ponds owned by the authenticated user (across all farms).
 */
export async function getPonds(_token?: string): Promise<Pond[]> {
  return apiClient.get<Pond[]>('/ponds');
}

/**
 * Creates a new water quality record.
 */
export async function createWaterQualityRecord(
  _token: string | undefined,
  payload: CreateWaterQualityPayload,
): Promise<WaterQualityCreateResponse> {
  return apiClient.post<WaterQualityCreateResponse>('/water-quality', payload);
}

export interface WaterQualityHistoryRecord {
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
  h2s: number;
  no2?: number;
  transparency?: number;
  waterColor?: string;
  overallStatus: 'Optimal' | 'Warning' | 'Danger';
  note?: string;
  createdAt: string;
}

export interface WaterQualityHistoryResponse {
  content: WaterQualityHistoryRecord[];
  page: number;
  size: number;
  totalElements: number;
}

/**
 * Queries paginated and filtered water quality history from backend.
 */
export async function getWaterQualityHistory(
  _token: string | undefined,
  filters: {
    farmId?: string;
    pondId?: string;
    fromDate?: string;
    toDate?: string;
    page?: number;
    size?: number;
    sort?: 'asc' | 'desc';
  } = {},
): Promise<WaterQualityHistoryResponse> {
  const params = new URLSearchParams();
  if (filters.farmId) params.append('farmId', filters.farmId);
  if (filters.pondId) params.append('pondId', filters.pondId);
  if (filters.fromDate) params.append('fromDate', filters.fromDate);
  if (filters.toDate) params.append('toDate', filters.toDate);
  if (filters.page !== undefined) params.append('page', filters.page.toString());
  if (filters.size !== undefined) params.append('size', filters.size.toString());
  if (filters.sort) params.append('sort', filters.sort);

  return apiClient.get<WaterQualityHistoryResponse>(`/water-quality/history?${params.toString()}`);
}
