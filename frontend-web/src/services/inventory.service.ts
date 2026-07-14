import { apiFetch } from '../utils/api';

const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export const inventoryService = {
  getAll: async (search?: string, category?: string, farmId?: string) => {
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    if (category && category !== 'ALL') params.append('category', category);
    if (farmId) params.append('farmId', farmId);
    
    const response = await apiFetch(`${apiUrl}/api/inventory?${params.toString()}`);
    if (!response.ok) throw new Error('Failed to fetch inventory');
    return response.json();
  },

  getById: async (id: string) => {
    const response = await apiFetch(`${apiUrl}/api/inventory/${id}`);
    if (!response.ok) throw new Error('Failed to fetch inventory item');
    return response.json();
  },

  getConsumptionSummary: async (farmId?: string, days = 30) => {
    const params = new URLSearchParams();
    if (farmId) params.append('farmId', farmId);
    params.append('days', String(days));

    const response = await apiFetch(`${apiUrl}/api/inventory/consumption-summary?${params.toString()}`);
    if (!response.ok) throw new Error('Không thể tải tổng quan tiêu thụ');
    return response.json();
  },

  getUsageLogs: async (farmId?: string, inventoryId?: string) => {
    const params = new URLSearchParams();
    if (farmId) params.append('farmId', farmId);
    if (inventoryId) params.append('inventoryId', inventoryId);

    const response = await apiFetch(`${apiUrl}/api/inventory/usage-logs?${params.toString()}`);
    if (!response.ok) throw new Error('Không thể tải nhật ký tiêu thụ');
    return response.json();
  },

  create: async (data: any) => {
    const response = await apiFetch(`${apiUrl}/api/inventory`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    const resData = await response.json();
    if (!response.ok) throw new Error(resData.message || 'Failed to create inventory item');
    return resData;
  },

  update: async (id: string, data: any) => {
    const response = await apiFetch(`${apiUrl}/api/inventory/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    const resData = await response.json();
    if (!response.ok) throw new Error(resData.message || 'Failed to update inventory item');
    return resData;
  },

  recordUsage: async (id: string, data: any) => {
    const response = await apiFetch(`${apiUrl}/api/inventory/${id}/usage`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    const resData = await response.json();
    if (!response.ok) throw new Error(resData.message || 'Không thể ghi nhận tiêu thụ tồn kho');
    return resData;
  },

  remove: async (id: string) => {
    const response = await apiFetch(`${apiUrl}/api/inventory/${id}`, {
      method: 'DELETE',
    });
    const resData = await response.json();
    if (!response.ok) throw new Error(resData.message || 'Failed to delete inventory item');
    return resData;
  },
};
