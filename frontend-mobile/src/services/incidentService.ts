const BASE_URL = 'http://localhost:3000/api';

export type IncidentStatus = 'OPEN' | 'TREATING' | 'RESOLVED';
export type IncidentEventType = 'REPORTED' | 'ASSIGNED' | 'STARTED' | 'TREATMENT' | 'RESOLVED' | 'REOPENED';

export interface IncidentUpdate {
  id: string;
  treatment: string;
  observation?: string | null;
  result?: string | null;
  eventType: IncidentEventType;
  createdAt: string;
  author: { fullName: string; role: string };
}

export interface Incident {
  id: string;
  title: string;
  description: string;
  status: IncidentStatus;
  assignedToId?: string | null;
  reporter?: { fullName: string; role: string } | null;
  assignedTo?: { fullName: string } | null;
  updatedAt: string;
  crop: { pond: { name: string; farm: { name: string } } };
  updates?: IncidentUpdate[];
  _count?: { updates: number };
}

export interface ActiveCrop {
  id: string;
  startDate: string;
  pond: { name: string; farm?: { name: string } };
}

async function request<T>(token: string, path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(Array.isArray(data?.message) ? data.message.join(', ') : data?.message || 'Không thể xử lý yêu cầu');
  }
  return data as T;
}

export const incidentService = {
  getAll: (token: string, status?: string, assignedToMe = false) => {
    const params = new URLSearchParams({ size: '100' });
    if (assignedToMe) params.set('assignedToMe', 'true');
    if (status) params.set('status', status);
    return request<{ content: Incident[] }>(token, `/incidents?${params.toString()}`);
  },
  getActiveCrops: (token: string) => request<ActiveCrop[]>(token, '/crops?status=ACTIVE'),
  create: (token: string, payload: { cropId: string; title: string; description: string }) =>
    request<Incident>(token, '/incidents', { method: 'POST', body: JSON.stringify(payload) }),
  getById: (token: string, id: string) => request<Incident>(token, `/incidents/${id}`),
  start: (token: string, id: string) => request(token, `/incidents/${id}/start-treatment`, { method: 'PATCH' }),
  addUpdate: (token: string, id: string, payload: { treatment: string; observation?: string; result?: string }) =>
    request(token, `/incidents/${id}/treatment-updates`, { method: 'POST', body: JSON.stringify(payload) }),
  resolve: (token: string, id: string, payload: { treatment: string; result?: string }) =>
    request(token, `/incidents/${id}/resolve`, { method: 'PATCH', body: JSON.stringify(payload) }),
  reopen: (token: string, id: string, reason: string) =>
    request(token, `/incidents/${id}/reopen`, { method: 'PATCH', body: JSON.stringify({ reason }) }),
};
