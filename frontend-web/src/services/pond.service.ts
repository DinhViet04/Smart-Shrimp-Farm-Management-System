import { apiFetch } from '../utils/api';

const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export const pondService = {
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
    return resData;
  },

  update: async (id: string, data: any) => {
    const response = await apiFetch(`${apiUrl}/api/ponds/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    const resData = await response.json();
    if (!response.ok) throw new Error(resData.message || 'Failed to update pond');
    return resData;
  },

  remove: async (id: string) => {
    const response = await apiFetch(`${apiUrl}/api/ponds/${id}`, {
      method: 'DELETE',
    });
    const resData = await response.json();
    if (!response.ok) throw new Error(resData.message || 'Failed to delete pond');
    return resData;
  },
};

