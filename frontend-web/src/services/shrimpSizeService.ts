const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export const shrimpSizeService = {
  createSample: async (pondId: string, data: { sampleCount: number; sampleWeightGram: number; sampleLengthCm?: number; notes?: string }) => {
    const token = localStorage.getItem('accessToken');
    const response = await fetch(`${API_URL}/api/ponds/${pondId}/size-samples`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    });
    const resData = await response.json();
    if (!response.ok) {
      throw new Error(resData.message || 'Failed to create shrimp size sample');
    }
    return resData;
  },

  getSamplesByPond: async (pondId: string) => {
    const token = localStorage.getItem('accessToken');
    const response = await fetch(`${API_URL}/api/ponds/${pondId}/size-samples`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error('Failed to fetch shrimp size samples');
    return response.json();
  },

  getLatestSample: async (pondId: string) => {
    const token = localStorage.getItem('accessToken');
    const response = await fetch(`${API_URL}/api/ponds/${pondId}/size-samples/latest`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      if (response.status === 404) return null;
      throw new Error('Failed to fetch latest sample');
    }
    return response.json();
  },

  deleteSample: async (pondId: string, sampleId: string) => {
    const token = localStorage.getItem('accessToken');
    const response = await fetch(`${API_URL}/api/ponds/${pondId}/size-samples/${sampleId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error('Failed to delete sample');
    return response.json();
  },
};
