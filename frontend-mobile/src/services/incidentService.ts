import { apiClient } from './apiClient';

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
  author: { id?: string; fullName: string; role: string };
}

export interface Incident {
  id: string;
  title: string;
  description: string;
  treatment?: string | null;
  status: IncidentStatus;
  assignedToId?: string | null;
  reporter?: { id?: string; fullName: string; role: string } | null;
  assignedTo?: { id?: string; fullName: string; email?: string; role?: string } | null;
  startedAt?: string | null;
  resolvedAt?: string | null;
  createdAt?: string;
  updatedAt: string;
  crop: {
    id?: string;
    startDate?: string;
    pond: { id?: string; name: string; farm?: { id?: string; name: string } };
  };
  updates?: IncidentUpdate[];
  _count?: { updates: number };
}

export interface ActiveCrop {
  id: string;
  startDate: string;
  pond: { id?: string; name: string; farm?: { id?: string; name: string } };
}

export interface IncidentStaff {
  id: string;
  fullName: string;
  email: string;
  role: 'TECHNICIAN' | 'FARMER' | string;
}

export type IncidentTechnician = IncidentStaff;

export interface IncidentFilters {
  status?: string;
  assignedToMe?: boolean;
  activeOnly?: boolean;
  search?: string;
  size?: string;
}

export const incidentService = {
  /**
   * Lấy danh sách sự cố. Hỗ trợ cả object filters hoặc tham số vị trí.
   */
  getAll: (
    arg1?: string | IncidentFilters,
    status?: string,
    assignedToMe = false,
    search?: string
  ) => {
    const params = new URLSearchParams({ size: '100' });

    if (arg1 && typeof arg1 === 'object') {
      const filters = arg1 as IncidentFilters;
      if (filters.assignedToMe) params.set('assignedToMe', 'true');
      if (filters.activeOnly) params.set('activeOnly', 'true');
      if (filters.status) params.set('status', filters.status);
      if (filters.search && filters.search.trim()) params.set('search', filters.search.trim());
      if (filters.size) params.set('size', filters.size);
    } else {
      if (assignedToMe) params.set('assignedToMe', 'true');
      if (status) params.set('status', status);
      if (search && search.trim()) params.set('search', search.trim());
    }

    return apiClient.get<{ content: Incident[]; totalElements?: number }>(`/incidents?${params.toString()}`);
  },

  /**
   * Lấy danh sách vụ nuôi đang hoạt động
   */
  getActiveCrops: (_token?: string) => apiClient.get<ActiveCrop[]>('/crops?status=ACTIVE'),

  /**
   * Tạo báo cáo sự cố mới
   */
  create: (
    arg1: any,
    arg2?: { cropId: string; title: string; description: string }
  ) => {
    const payload = arg2 !== undefined ? arg2 : arg1;
    return apiClient.post<Incident>('/incidents', payload);
  },

  /**
   * Lấy chi tiết sự cố theo ID
   */
  getById: (arg1?: string, arg2?: string) => {
    const id = arg2 || arg1;
    return apiClient.get<Incident>(`/incidents/${id}`);
  },

  /**
   * Lấy danh sách nhân sự của trang trại để phân công (cả TECHNICIAN và FARMER)
   */
  getStaff: (farmId: string) =>
    apiClient
      .get<
        Array<{
          role: string;
          isActive: boolean;
          user: { id: string; fullName: string; email: string; role: string; isActive: boolean };
        }>
      >(`/farm-staffs?farmId=${encodeURIComponent(farmId)}`)
      .then((staff) => {
        if (!Array.isArray(staff)) return [];
        return staff
          .filter(
            (entry) =>
              (entry.role === 'TECHNICIAN' ||
                entry.role === 'FARMER' ||
                entry.user?.role === 'TECHNICIAN' ||
                entry.user?.role === 'FARMER') &&
              entry.isActive &&
              (entry.user?.isActive ?? true)
          )
          .map((entry) => ({
            id: entry.user?.id || (entry as any).userId,
            fullName: entry.user?.fullName || 'Nhân sự',
            email: entry.user?.email || '',
            role: entry.user?.role || entry.role,
          }));
      }),

  /**
   * Backward-compatibility wrapper for getStaff
   */
  getTechnicians: (farmId: string) => incidentService.getStaff(farmId),

  /**
   * Phân công nhân sự phụ trách (Dành cho Quản lý trang trại)
   */
  assign: (id: string, assignedToId: string) =>
    apiClient.patch(`/incidents/${id}/assignment`, { assignedToId }),

  /**
   * Bắt đầu sửa chữa / xử lý sự cố (Chuyển sang TREATING)
   */
  start: (arg1?: string, arg2?: string) => {
    const id = arg2 || arg1;
    return apiClient.patch<Incident>(`/incidents/${id}/start-treatment`);
  },
  startTreatment: (id: string) => apiClient.patch<Incident>(`/incidents/${id}/start-treatment`),

  /**
   * Thêm cập nhật nhật ký khắc phục
   */
  addUpdate: (
    arg1?: string,
    arg2?: any,
    arg3?: { treatment: string; observation?: string; result?: string }
  ) => {
    const id = arg3 !== undefined ? arg2 : arg1;
    const payload = arg3 !== undefined ? arg3 : arg2;
    return apiClient.post<IncidentUpdate>(`/incidents/${id}/treatment-updates`, payload);
  },

  /**
   * Đánh dấu hoàn tất khắc phục và nghiệm thu sự cố (RESOLVED)
   */
  resolve: (
    arg1?: string,
    arg2?: any,
    arg3?: { treatment: string; result?: string }
  ) => {
    const id = arg3 !== undefined ? arg2 : arg1;
    const payload = arg3 !== undefined ? arg3 : arg2;
    return apiClient.patch<IncidentUpdate>(`/incidents/${id}/resolve`, payload);
  },

  /**
   * Mở lại sự cố đã đóng khi có dấu hiệu tái phát
   */
  reopen: (arg1?: string, arg2?: any, arg3?: any) => {
    const id = arg3 !== undefined ? arg2 : arg1;
    const rawReason = arg3 !== undefined ? arg3 : (arg2 || '');
    const reason = typeof rawReason === 'object' && rawReason?.reason ? rawReason.reason : rawReason;
    return apiClient.patch<IncidentUpdate>(`/incidents/${id}/reopen`, { reason });
  },
};
