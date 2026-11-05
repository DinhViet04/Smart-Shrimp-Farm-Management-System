import { apiFetch } from '../utils/api';
import { invalidatePondOverviewCache } from './pond.service';

const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export const farmService = {
  getAll: async (
    search?: string,
    status?: string,
    workspaceId = localStorage.getItem('active_workspace_id') || '',
  ) => {
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    if (status) params.append('status', status);
    if (workspaceId) params.append('workspaceId', workspaceId);
    
    const response = await apiFetch(`${apiUrl}/api/farms?${params.toString()}`);
    if (!response.ok) throw new Error('Failed to fetch farms');
    return response.json();
  },

  getMy: async (workspaceId = localStorage.getItem('active_workspace_id') || '') => {
    const params = new URLSearchParams();
    if (workspaceId) params.append('workspaceId', workspaceId);
    const query = params.toString();
    const response = await apiFetch(`${apiUrl}/api/farms/my${query ? `?${query}` : ''}`);
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
    invalidatePondOverviewCache();
    return resData;
  },

  update: async (id: string, data: any) => {
    const response = await apiFetch(`${apiUrl}/api/farms/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    const resData = await response.json();
    if (!response.ok) throw new Error(resData.message || 'Failed to update farm');
    invalidatePondOverviewCache();
    return resData;
  },

  remove: async (id: string) => {
    const response = await apiFetch(`${apiUrl}/api/farms/${id}`, {
      method: 'DELETE',
    });
    const resData = await response.json();
    if (!response.ok) throw new Error(resData.message || 'Failed to delete farm');
    invalidatePondOverviewCache();
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

  getWorkspaceManagers: async (workspaceId: string) => {
    const response = await apiFetch(`${apiUrl}/api/workspaces/${workspaceId}/members`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Không thể tải quản lý workspace');
    return (data as Array<{ role: string; isActive: boolean; user: { id: string; fullName: string; email: string; role: string; isActive: boolean } }>)
      .filter((member) => member.isActive && member.user.isActive && member.user.role === 'FARM_MANAGER')
      .map((member) => member.user);
  },

  transferOwnership: async (farmId: string, newOwnerId: string) => {
    const response = await apiFetch(`${apiUrl}/api/farms/${farmId}/owner`, { method: 'PATCH', body: JSON.stringify({ newOwnerId }) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Không thể chuyển quyền quản lý');
    return data;
  },

  getCandidates: async () => {
    const response = await apiFetch(`${apiUrl}/api/users/candidates`);
    if (!response.ok) throw new Error('Failed to fetch candidates');
    return response.json();
  },

  lookupStaff: async (email: string, expectedRole?: string) => {
    const params = new URLSearchParams({ email });
    if (expectedRole) params.append('expectedRole', expectedRole);
    const response = await apiFetch(`${apiUrl}/api/users/lookup?${params.toString()}`);
    const resData = await response.json();
    if (!response.ok) throw new Error(resData.message || 'Không tìm thấy tài khoản nhân sự');
    return resData;
  },

  /**
   * Mời nhân sự bằng email. Người nhận phải đăng nhập/đăng ký rồi chấp nhận lời mời.
   */
  inviteByEmail: async (
    farmId: string,
    email: string,
    role: 'FARMER' | 'TECHNICIAN',
  ): Promise<{ status: 'invited'; message: string; email: string }> => {
    const response = await apiFetch(`${apiUrl}/api/farms/${farmId}/invite-by-email`, {
      method: 'POST',
      body: JSON.stringify({ email, role }),
    });
    const resData = await response.json();
    if (!response.ok) throw new Error(resData.message || 'Không thể gửi lời mời');
    return resData;
  },

  acceptInvite: async (token: string) => {
    return acceptInviteToken(token);
  },
};

/**
 * Xác thực invitation token.
 * Frontend gọi khi URL chứa ?inviteToken=xxx để lấy thông tin farm/role.
 */
export const verifyInviteToken = async (token: string) => {
  const response = await fetch(`${apiUrl}/api/auth/verify-invite?token=${encodeURIComponent(token)}`);
  const resData = await response.json();
  return resData as {
    valid: boolean;
    reason?: string;
    email?: string;
    farmId?: string;
    farmName?: string;
    managerName?: string;
    role?: string;
  };
};

/**
 * Chấp nhận lời mời tham gia trang trại bằng inviteToken.
 */
export const acceptInviteToken = async (token: string) => {
  const tokenHeader = localStorage.getItem('accessToken');
  const response = await fetch(`${apiUrl}/api/auth/accept-invite`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(tokenHeader ? { Authorization: `Bearer ${tokenHeader}` } : {}),
    },
    body: JSON.stringify({ token }),
  });
  const resData = await response.json();
  if (!response.ok) {
    throw new Error(resData.message || 'Không thể chấp nhận lời mời');
  }
  return resData as {
    success: boolean;
    farm: { id: string; name: string };
    role: string;
    user: any;
    message: string;
  };
};



