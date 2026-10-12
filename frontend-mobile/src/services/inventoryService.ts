import { apiClient } from './apiClient';

export interface InventoryItem {
  id: string;
  itemName: string;
  category: 'FEED' | 'MEDICINE' | 'CHEMICAL';
  quantity: number;
  unit: string;
  packageType?: string;
  packageQty?: number;
  weightPerPkg?: number;
  minThreshold: number;
  supplierName?: string;
  description?: string;
  farmId: string;
  createdAt: string;
  updatedAt: string;
}

export interface InventoryListResponse {
  items: InventoryItem[];
  total: number;
  page?: number;
  totalPages?: number;
}

export const inventoryService = {
  /**
   * Get list of inventory items with optional category and search filters
   */
  async getInventory(
    category?: 'FEED' | 'MEDICINE' | 'CHEMICAL',
    search?: string,
    farmId?: string
  ): Promise<InventoryItem[]> {
    const params = new URLSearchParams();
    if (category) params.append('category', category);
    if (search && search.trim() !== '') params.append('search', search.trim());
    if (farmId) params.append('farmId', farmId);

    const queryString = params.toString();
    const endpoint = `/inventory${queryString ? `?${queryString}` : ''}`;

    const response = await apiClient.get<any>(endpoint);
    // Backend returns { data: InventoryItem[], total: number } or an array
    if (Array.isArray(response)) {
      return response;
    }
    if (response && Array.isArray(response.data)) {
      return response.data;
    }
    if (response && Array.isArray(response.items)) {
      return response.items;
    }
    return [];
  },

  /**
   * Get consumption summary (days: 7, 30, etc.)
   */
  async getConsumptionSummary(farmId?: string, days = 7) {
    const params = new URLSearchParams();
    if (farmId) params.append('farmId', farmId);
    params.append('days', days.toString());

    return apiClient.get(`/inventory/consumption-summary?${params.toString()}`);
  },

  /**
   * Record inventory usage (deduct stock for medicine, chemical, feed)
   */
  async recordUsage(
    id: string,
    payload: { quantityUsed: number; usageDate?: string; notes?: string; pondId?: string }
  ) {
    return apiClient.post(`/inventory/${id}/usage`, payload);
  },

  /**
   * Record inventory import (add stock)
   */
  async recordImport(
    id: string,
    payload: { packagesAdded?: number; quantityAdded?: number; importDate?: string; notes?: string }
  ) {
    return apiClient.post(`/inventory/${id}/import`, payload);
  },

  /**
   * Create new inventory item
   */
  async create(payload: {
    itemName: string;
    category: 'FEED' | 'MEDICINE' | 'CHEMICAL' | string;
    quantity: number;
    unit: string;
    farmId: string;
    minThreshold: number;
    packageType?: string;
    packageQty?: number;
    weightPerPkg?: number;
    pricePerPackage?: number;
    description?: string;
  }) {
    return apiClient.post<InventoryItem>('/inventory', payload);
  },

  /**
   * Update existing inventory item
   */
  async update(id: string, payload: Partial<InventoryItem>) {
    return apiClient.put<InventoryItem>(`/inventory/${id}`, payload);
  },

  /**
   * Delete inventory item
   */
  async delete(id: string) {
    return apiClient.delete(`/inventory/${id}`);
  },
};
