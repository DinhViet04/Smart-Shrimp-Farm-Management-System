import { apiFetch } from '../utils/api';

export interface CastDto {
  count: number;
  weightGram: number;
  note?: string;
}

export const shrimpSizeService = {
  createSample: async (pondId: string, data: { casts: CastDto[]; netAreaSqM: number; sampleLengthCm?: number; notes?: string }) => {
    const response = await apiFetch(`/api/ponds/${pondId}/size-samples`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    const resData = await response.json();
    if (!response.ok) {
      throw new Error(resData.message || 'Lỗi khi ghi nhận mẫu kích cỡ');
    }
    return resData;
  },

  getSamplesByPond: async (pondId: string) => {
    const response = await apiFetch(`/api/ponds/${pondId}/size-samples`);
    if (!response.ok) throw new Error('Không thể tải danh sách mẫu kích cỡ');
    return response.json();
  },

  getLatestSample: async (pondId: string) => {
    const response = await apiFetch(`/api/ponds/${pondId}/size-samples/latest`);
    if (!response.ok) {
      if (response.status === 404) return null;
      throw new Error('Không thể tải mẫu kích cỡ mới nhất');
    }
    return response.json();
  },

  deleteSample: async (pondId: string, sampleId: string) => {
    const response = await apiFetch(`/api/ponds/${pondId}/size-samples/${sampleId}`, {
      method: 'DELETE',
    });
    const resData = await response.json();
    if (!response.ok) {
      throw new Error(resData.message || 'Không thể xóa mẫu đo kích cỡ');
    }
    return resData;
  },

  getFCRAnalysis: async (pondId: string) => {
    const response = await apiFetch(`/api/ponds/${pondId}/size-samples/fcr`);
    if (!response.ok) {
      const err = await response.json().catch(() => null);
      throw new Error(err?.message || 'Không thể tải phân tích FCR');
    }
    return response.json();
  },
};
