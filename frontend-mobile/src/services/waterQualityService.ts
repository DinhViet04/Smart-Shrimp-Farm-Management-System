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

const BASE_URL = 'http://localhost:3000/api';

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
  no2: number;
  transparency: number;
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

// ─── API Functions ────────────────────────────────────────────────────────────

/**
 * Fetches all farms owned by the authenticated user.
 */
export async function getFarms(token: string): Promise<Farm[]> {
  const res = await fetch(`${BASE_URL}/farms`, {
    headers: authHeaders(token),
  });
  return handleResponse<Farm[]>(res);
}

/**
 * Fetches all ponds owned by the authenticated user (across all farms).
 */
export async function getPonds(token: string): Promise<Pond[]> {
  const res = await fetch(`${BASE_URL}/ponds`, {
    headers: authHeaders(token),
  });
  return handleResponse<Pond[]>(res);
}

/**
 * Creates a new water quality record.
 *
 * @param token   - JWT access token.
 * @param payload - The measurement data.
 * @returns       - { id, message } on success.
 * @throws        - Error with a human-readable message on failure.
 */
export async function createWaterQualityRecord(
  token: string,
  payload: CreateWaterQualityPayload,
): Promise<WaterQualityCreateResponse> {
  const res = await fetch(`${BASE_URL}/water-quality`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
  return handleResponse<WaterQualityCreateResponse>(res);
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
  no2: number;
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
  token: string,
  filters: {
    farmId?: string;
    pondId?: string;
    fromDate?: string;
    toDate?: string;
    page?: number;
    size?: number;
    sort?: 'asc' | 'desc';
  },
): Promise<WaterQualityHistoryResponse> {
  const params = new URLSearchParams();
  if (filters.farmId) params.append('farmId', filters.farmId);
  if (filters.pondId) params.append('pondId', filters.pondId);
  if (filters.fromDate) params.append('fromDate', filters.fromDate);
  if (filters.toDate) params.append('toDate', filters.toDate);
  if (filters.page !== undefined) params.append('page', filters.page.toString());
  if (filters.size !== undefined) params.append('size', filters.size.toString());
  if (filters.sort) params.append('sort', filters.sort);

  const res = await fetch(`${BASE_URL}/water-quality/history?${params.toString()}`, {
    headers: authHeaders(token),
  });
  return handleResponse<WaterQualityHistoryResponse>(res);
}
