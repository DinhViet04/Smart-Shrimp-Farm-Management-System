import { apiFetch } from '../utils/api';

export interface TrajectoryPoint {
  doc: number;
  sr: number;
  loss: number;
  abw: number;
  /** Giá trị Y chuẩn hóa: abw_y = min(100, abw × 2). Vạch 50g = Y 100 */
  abw_y: number;
  biomass_kg: number;
  biomass_pct: number;
  fcr_raw: number | null;
  fcr_y: number | null;
  size: number | null;
}

export interface GrowthTrajectoryResponse {
  scopeName: string;
  farmName: string;
  pondName?: string;
  cropName?: string;
  kpis: {
    sr: number;
    loss: number;
    abw: number;
    biomass_kg: number;
    fcr_raw: number | null;
  };
  trajectory: TrajectoryPoint[];
}

export const growthService = {
  getGrowthTrajectory: async (params?: {
    farmId?: string;
    pondId?: string;
    cropId?: string;
    timeRange?: string;
    year?: string;
  }): Promise<GrowthTrajectoryResponse> => {
    try {
      const queryParams = new URLSearchParams();
      if (params?.farmId) queryParams.set('farmId', params.farmId);
      if (params?.pondId) queryParams.set('pondId', params.pondId);
      if (params?.cropId) queryParams.set('cropId', params.cropId);
      if (params?.timeRange) queryParams.set('timeRange', params.timeRange);
      if (params?.year) queryParams.set('year', params.year);

      const qs = queryParams.toString() ? `?${queryParams.toString()}` : '';
      const response = await apiFetch(`/api/crops/analytics/growth-trajectory${qs}`);

      if (!response.ok) {
        throw new Error('Không thể tải dữ liệu tăng trưởng từ máy chủ');
      }

      return await response.json();
    } catch (err) {
      console.warn('Backend growth trajectory API error:', err);
      return {
        scopeName: 'Chưa có dữ liệu thực tế',
        farmName: '',
        kpis: {
          sr: 0,
          loss: 0,
          abw: 0,
          biomass_kg: 0,
          fcr_raw: null,
        },
        trajectory: [],
      };
    }
  },
};
