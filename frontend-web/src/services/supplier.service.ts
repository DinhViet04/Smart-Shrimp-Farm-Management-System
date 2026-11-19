import { apiFetch } from '../utils/api';

const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';

/** Nhà cung cấp (khớp model Prisma `Supplier`, kèm vài trường thống kê do API trả thêm). */
export interface Supplier {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  note?: string | null;
  farmId?: string;
  items: { itemName: string }[];
  itemCount: number;
  lowStockCount: number;
  categories: string[];
  latestUpdatedAt?: string;
}

export const supplierService = {
  getAll: async (farmId?: string, search?: string) => {
    const params = new URLSearchParams();
    if (farmId) params.append('farmId', farmId);
    if (search) params.append('search', search);

    const response = await apiFetch(`${apiUrl}/api/suppliers?${params.toString()}`);
    if (!response.ok) throw new Error('Không thể tải danh sách nhà cung cấp');
    return response.json();
  },

  create: async (data: object) => {
    const response = await apiFetch(`${apiUrl}/api/suppliers`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    const resData = await response.json();
    if (!response.ok) throw new Error(resData.message || 'Không thể tạo nhà cung cấp');
    return resData;
  },

  update: async (id: string, data: object) => {
    const response = await apiFetch(`${apiUrl}/api/suppliers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    const resData = await response.json();
    if (!response.ok) throw new Error(resData.message || 'Không thể cập nhật nhà cung cấp');
    return resData;
  },

  remove: async (id: string) => {
    const response = await apiFetch(`${apiUrl}/api/suppliers/${id}`, {
      method: 'DELETE',
    });
    const resData = await response.json();
    if (!response.ok) throw new Error(resData.message || 'Không thể xóa nhà cung cấp');
    return resData;
  },
};
