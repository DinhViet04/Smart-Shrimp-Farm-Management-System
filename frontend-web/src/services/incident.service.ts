import { apiFetch } from '../utils/api';

const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export type IncidentStatus = 'OPEN' | 'TREATING' | 'RESOLVED';
export type IncidentEventType = 'REPORTED' | 'ASSIGNED' | 'STARTED' | 'TREATMENT' | 'RESOLVED' | 'REOPENED';

export interface IncidentUpdate {
  id: string;
  treatment: string;
  observation?: string | null;
  result?: string | null;
  status: IncidentStatus;
  eventType: IncidentEventType;
  createdAt: string;
  author: { id: string; fullName: string; role: string };
}

export interface Incident {
  id: string;
  title: string;
  description: string;
  treatment?: string | null;
  status: IncidentStatus;
  assignedToId?: string | null;
  reporter?: { id: string; fullName: string; role: string } | null;
  assignedTo?: { id: string; fullName: string; email: string } | null;
  startedAt?: string | null;
  resolvedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  crop: {
    id: string;
    startDate: string;
    pond: { id: string; name: string; farm: { id: string; name: string } };
  };
  updates?: IncidentUpdate[];
  _count?: { updates: number };
}

export interface IncidentTechnician {
  id: string;
  fullName: string;
  email: string;
}

async function handleResponse<T>(response: Response): Promise<T> {
  const data = await response.json();
  if (!response.ok) {
    throw new Error(Array.isArray(data?.message) ? data.message.join(', ') : data?.message || 'Không thể xử lý yêu cầu');
  }
  return data as T;
}

export const incidentService = {
  create: async (payload: { cropId: string; title: string; description: string }) => {
    const response = await apiFetch(`${apiUrl}/api/incidents`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return handleResponse<Incident>(response);
  },

  getAll: async (filters: { status?: string; assignedToMe?: boolean; search?: string } = {}) => {
    const params = new URLSearchParams();
    if (filters.status) params.set('status', filters.status);
    if (filters.assignedToMe) params.set('assignedToMe', 'true');
    if (filters.search) params.set('search', filters.search);
    params.set('size', '100');
    const response = await apiFetch(`${apiUrl}/api/incidents?${params.toString()}`);
    return handleResponse<{ content: Incident[]; totalElements: number }>(response);
  },

  getById: async (id: string) => {
    const response = await apiFetch(`${apiUrl}/api/incidents/${id}`);
    return handleResponse<Incident>(response);
  },

  getTechnicians: async (farmId: string) => {
    const response = await apiFetch(`${apiUrl}/api/farm-staffs?farmId=${encodeURIComponent(farmId)}`);
    const staff = await handleResponse<Array<{
      role: string;
      isActive: boolean;
      user: IncidentTechnician & { role: string; isActive: boolean };
    }>>(response);
    return staff
      .filter((entry) => entry.user.role === 'TECHNICIAN' && entry.isActive && entry.user.isActive)
      .map((entry) => ({ id: entry.user.id, fullName: entry.user.fullName, email: entry.user.email }));
  },

  assign: async (id: string, assignedToId: string) => {
    const response = await apiFetch(`${apiUrl}/api/incidents/${id}/assignment`, {
      method: 'PATCH',
      body: JSON.stringify({ assignedToId }),
    });
    return handleResponse<Incident>(response);
  },

  startTreatment: async (id: string) => {
    const response = await apiFetch(`${apiUrl}/api/incidents/${id}/start-treatment`, { method: 'PATCH' });
    return handleResponse<Incident>(response);
  },

  addUpdate: async (
    id: string,
    payload: { treatment: string; observation?: string; result?: string },
  ) => {
    const response = await apiFetch(`${apiUrl}/api/incidents/${id}/treatment-updates`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return handleResponse<IncidentUpdate>(response);
  },

  resolve: async (id: string, payload: { treatment: string; result?: string }) => {
    const response = await apiFetch(`${apiUrl}/api/incidents/${id}/resolve`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
    return handleResponse<IncidentUpdate>(response);
  },

  reopen: async (id: string, reason: string) => {
    const response = await apiFetch(`${apiUrl}/api/incidents/${id}/reopen`, {
      method: 'PATCH',
      body: JSON.stringify({ reason }),
    });
    return handleResponse<IncidentUpdate>(response);
  },
};
