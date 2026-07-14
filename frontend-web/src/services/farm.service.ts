import { apiFetch } from '../utils/api';

const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export const farmService = {
  getAll: async (search?: string, status?: string) => {
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    if (status) params.append('status', status);
    
    const response = await apiFetch(`${apiUrl}/api/farms?${params.toString()}`);
    if (!response.ok) throw new Error('Failed to fetch farms');
    return response.json();
  },

  getMy: async () => {
    const response = await apiFetch(`${apiUrl}/api/farms/my`);
    if (!response.ok) throw new Error('Failed to fetch my farms');
    return response.json();
  },

  getById: async (id: string) => {
    const response = await apiFetch(`${apiUrl}/api/farms/${id}`);
    if (!response.ok) throw new Error('Failed to fetch farm');
    return response.json();
  },

  create: async (data: any) => {
    const response = await apiFetch(`${apiUrl}/api/farms`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    const resData = await response.json();
    if (!response.ok) throw new Error(resData.message || 'Failed to create farm');
    return resData;
  },

  update: async (id: string, data: any) => {
    const response = await apiFetch(`${apiUrl}/api/farms/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    const resData = await response.json();
    if (!response.ok) throw new Error(resData.message || 'Failed to update farm');
    return resData;
  },

  remove: async (id: string) => {
    const response = await apiFetch(`${apiUrl}/api/farms/${id}`, {
      method: 'DELETE',
    });
    const resData = await response.json();
    if (!response.ok) throw new Error(resData.message || 'Failed to delete farm');
    return resData;
  },

  getStaff: async (farmId: string) => {
    const response = await apiFetch(`${apiUrl}/api/farms/${farmId}/staff`);
    if (!response.ok) throw new Error('Failed to fetch farm staff');
    return response.json();
  },

  assignStaff: async (farmId: string, userId: string) => {
    const response = await apiFetch(`${apiUrl}/api/farms/${farmId}/staff`, {
      method: 'POST',
      body: JSON.stringify({ userId }),
    });
    const resData = await response.json();
    if (!response.ok) throw new Error(resData.message || 'Failed to assign staff');
    return resData;
  },

  unassignStaff: async (farmId: string, userId: string) => {
    const response = await apiFetch(`${apiUrl}/api/farms/${farmId}/staff/${userId}`, {
      method: 'DELETE',
    });
    const resData = await response.json();
    if (!response.ok) throw new Error(resData.message || 'Failed to unassign staff');
    return resData;
  },

  getCandidates: async () => {
    const response = await apiFetch(`${apiUrl}/api/users/candidates`);
    if (!response.ok) throw new Error('Failed to fetch candidates');
    return response.json();
  },
};

