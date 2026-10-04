import { apiFetch } from '../utils/api';
import type { Crop } from './crop.service';

const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export interface OverviewFarm {
  id: string;
  name: string;
  location?: string | null;
  address: string;
  area: number;
  description?: string | null;
  status: string;
  ownerId: string;
  farmingModel?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OverviewPond {
  id: string;
  name: string;
  areaSize: number;
  depth: number;
  farmId: string;
  createdAt: string;
  updatedAt: string;
  farm?: OverviewFarm;
}

export interface PondOverview {
  farms: OverviewFarm[];
  ponds: OverviewPond[];
  crops: Crop[];
}

const OVERVIEW_CACHE_TTL_MS = 15_000;
let overviewCache: { token: string | null; expiresAt: number; data: PondOverview } | null = null;
let overviewRequest: { token: string | null; promise: Promise<PondOverview> } | null = null;

export function invalidatePondOverviewCache() {
  overviewCache = null;
  overviewRequest = null;
}

async function getOverview(): Promise<PondOverview> {
  const token = localStorage.getItem('accessToken');
  if (overviewCache && overviewCache.token === token && overviewCache.expiresAt > Date.now()) {
    return overviewCache.data;
  }
  if (overviewRequest?.token === token) return overviewRequest.promise;

  const promise = (async () => {
    const response = await apiFetch(`${apiUrl}/api/ponds/overview`);
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data?.message || 'Không thể tải dữ liệu ao nuôi');
    }
    const overview = data as PondOverview;
    overviewCache = {
      token,
      expiresAt: Date.now() + OVERVIEW_CACHE_TTL_MS,
      data: overview,
    };
    return overview;
  })();

  overviewRequest = { token, promise };
  try {
    return await promise;
  } finally {
    if (overviewRequest?.promise === promise) overviewRequest = null;
  }
}

export const pondService = {
  getOverview,

  getAll: async () => {
    const response = await apiFetch(`${apiUrl}/api/ponds`);
    if (!response.ok) throw new Error('Failed to fetch ponds');
    return response.json();
  },

  getById: async (id: string) => {
    const response = await apiFetch(`${apiUrl}/api/ponds/${id}`);
    if (!response.ok) throw new Error('Failed to fetch pond');
    return response.json();
  },

  create: async (data: any) => {
    const response = await apiFetch(`${apiUrl}/api/ponds`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    const resData = await response.json();
    if (!response.ok) throw new Error(resData.message || 'Failed to create pond');
    invalidatePondOverviewCache();
    return resData;
  },

  update: async (id: string, data: any) => {
    const response = await apiFetch(`${apiUrl}/api/ponds/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    const resData = await response.json();
    if (!response.ok) throw new Error(resData.message || 'Failed to update pond');
    invalidatePondOverviewCache();
    return resData;
  },

  remove: async (id: string) => {
    const response = await apiFetch(`${apiUrl}/api/ponds/${id}`, {
      method: 'DELETE',
    });
    const resData = await response.json();
    if (!response.ok) throw new Error(resData.message || 'Failed to delete pond');
    invalidatePondOverviewCache();
    return resData;
  },
};

