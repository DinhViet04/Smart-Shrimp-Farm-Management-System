import { apiFetch } from '../utils/api';

const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export interface SurvivalRateStats {
  cropId: string;
  pondName: string;
  startDate: string;
  initialStocking: number;
  harvestCount: number;
  totalDead?: number;
  survivalRate: number;
  targetSurvivalRate: number;
  isHarvested: boolean;
  status: 'OPTIMAL' | 'WARNING' | 'DANGER';
}

export interface MortalityLog {
  id: string;
  cropId: string;
  recordedDate: string;
  deadQuantityPcs: number;
  cause?: string | null;
  note?: string | null;
  creator?: {
    id: string;
    fullName: string;
    role: string;
  };
  createdAt: string;
}

export interface CreateMortalityLogPayload {
  cropId: string;
  deadQuantityPcs: number;
  recordedDate?: string;
  cause?: string;
  note?: string;
}

export interface UpdateHarvestCountPayload {
  actualHarvestCount?: number;
  actualHarvestKg?: number;
  actualHarvestSize?: number;
}

export const survivalRateService = {
  getSurvivalRate: async (cropId: string): Promise<SurvivalRateStats> => {
    const res = await apiFetch(`${apiUrl}/api/survival-rate/crop/${cropId}`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Lỗi khi lấy thông số tỷ lệ sống');
    }
    return res.json();
  },

  updateHarvestCount: async (cropId: string, payload: UpdateHarvestCountPayload): Promise<SurvivalRateStats> => {
    const res = await apiFetch(`${apiUrl}/api/survival-rate/crop/${cropId}/harvest`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Lỗi khi cập nhật sản lượng thu hoạch');
    }
    return res.json();
  },

  getMortalityLogs: async (cropId: string): Promise<MortalityLog[]> => {
    const res = await apiFetch(`${apiUrl}/api/mortality-logs/crop/${cropId}`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Lỗi khi lấy nhật ký hao hụt');
    }
    return res.json();
  },

  createMortalityLog: async (payload: CreateMortalityLogPayload): Promise<MortalityLog> => {
    const res = await apiFetch(`${apiUrl}/api/mortality-logs`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Lỗi khi ghi nhận nhật ký hao hụt');
    }
    return res.json();
  },
};
