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

  remove: async (id: string) => {
    const response = await apiFetch(`${apiUrl}/api/inventory/${id}`, {
      method: 'DELETE',
    });
    const resData = await response.json();
    if (!response.ok) throw new Error(resData.message || 'Failed to delete inventory item');
    return resData;
  },
};
