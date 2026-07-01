const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const getHeaders = () => {
  const token = localStorage.getItem('accessToken');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

export const farmService = {
  getAll: async (search?: string, status?: string) => {
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    if (status) params.append('status', status);
    
    const response = await fetch(`${apiUrl}/api/farms?${params.toString()}`, {
      headers: getHeaders(),
    });
    if (!response.ok) throw new Error('Failed to fetch farms');
    return response.json();
  },

  getById: async (id: string) => {
    const response = await fetch(`${apiUrl}/api/farms/${id}`, {
      headers: getHeaders(),
    });
    if (!response.ok) throw new Error('Failed to fetch farm');
    return response.json();
  },

  create: async (data: any) => {
    const response = await fetch(`${apiUrl}/api/farms`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    const resData = await response.json();
    if (!response.ok) throw new Error(resData.message || 'Failed to create farm');
    return resData;
  },

  update: async (id: string, data: any) => {
    const response = await fetch(`${apiUrl}/api/farms/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    const resData = await response.json();
    if (!response.ok) throw new Error(resData.message || 'Failed to update farm');
    return resData;
  },

  remove: async (id: string) => {
    const response = await fetch(`${apiUrl}/api/farms/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    const resData = await response.json();
    if (!response.ok) throw new Error(resData.message || 'Failed to delete farm');
    return resData;
  },
};
