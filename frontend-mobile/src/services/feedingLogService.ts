import { apiClient } from './apiClient';

export type FeedingSession =
  | 'SESSION_1'
  | 'SESSION_2'
  | 'SESSION_3'
  | 'SESSION_4'
  | 'SESSION_5'
  | 'SESSION_6'
  | 'SESSION_7';

export type FeedingMethod = 'MANUAL' | 'AUTO';
export type FeedingStatus = 'COMPLETED' | 'SKIPPED' | 'DELAYED';

export interface SingleSessionPayload {
  feedingSession: FeedingSession;
  feedingTime: string;
  feedProductId: string;
  feedAmount: number;
  feedingMethod: FeedingMethod;
  feedingStatus: FeedingStatus;
  note?: string;
}

export interface CreateDailyFeedingLogPayload {
  farmId: string;
  pondId: string;
  cropId: string;
  feedingDate: string; // YYYY-MM-DD
  sessions: SingleSessionPayload[];
}

export interface DailyFeedingGroup {
  feedingDate: string;
  farmId: string;
  farmName?: string;
  pondId: string;
  pondName?: string;
  cropId: string;
  totalFeedAmount: number;
  sessionCount: number;
  completedCount: number;
  skippedCount: number;
  feedProductNames?: string[];
  sessions?: any[];
}

export interface GroupedFeedingLogsResponse {
  data: DailyFeedingGroup[];
  total: number;
  page: number;
  size: number;
}

export const DEFAULT_FEEDING_PRESETS: { session: FeedingSession; label: string; defaultTime: string }[] = [
  { session: 'SESSION_1', label: 'Cữ 1', defaultTime: '06:00' },
  { session: 'SESSION_2', label: 'Cữ 2', defaultTime: '09:00' },
  { session: 'SESSION_3', label: 'Cữ 3', defaultTime: '12:00' },
  { session: 'SESSION_4', label: 'Cữ 4', defaultTime: '15:00' },
  { session: 'SESSION_5', label: 'Cữ 5', defaultTime: '18:00' },
  { session: 'SESSION_6', label: 'Cữ 6', defaultTime: '21:00' },
  { session: 'SESSION_7', label: 'Cữ 7', defaultTime: '00:00' },
];

export const PRESET_OPTIONS = [
  { id: '4_SESSIONS', label: '4 Cữ', count: 4, times: ['06:00', '10:00', '14:00', '18:00'] },
  { id: '5_SESSIONS', label: '5 Cữ', count: 5, times: ['06:00', '09:30', '13:00', '16:30', '20:00'] },
  { id: '6_SESSIONS', label: '6 Cữ', count: 6, times: ['05:00', '08:30', '12:00', '15:30', '19:00', '22:30'] },
  { id: '7_SESSIONS', label: '7 Cữ (5T)', count: 7, times: ['06:00', '09:00', '12:00', '15:00', '18:00', '21:00', '00:00'] },
];

export const feedingLogService = {
  /**
   * Save daily feeding log (batch of 1-7 sessions for a pond on a date)
   */
  async createOrUpdateDailyLog(payload: CreateDailyFeedingLogPayload) {
    return apiClient.post('/feeding-logs', payload);
  },

  /**
   * Fetch daily details for a pond on a specific date
   */
  async getDailyDetails(pondId: string, date: string): Promise<any[]> {
    return apiClient.get(`/feeding-logs/details?pondId=${pondId}&date=${date}`);
  },

  /**
   * Fetch feeding logs list
   */
  async getFeedingLogs(query?: { pondId?: string; startDate?: string; endDate?: string }) {
    const params = new URLSearchParams();
    if (query?.pondId) params.append('pondId', query.pondId);
    if (query?.startDate) params.append('startDate', query.startDate);
    if (query?.endDate) params.append('endDate', query.endDate);

    const qs = params.toString();
    return apiClient.get(`/feeding-logs${qs ? `?${qs}` : ''}`);
  },

  /**
   * Fetch all grouped daily feeding logs
   */
  async getAllGrouped(query?: {
    farmId?: string;
    pondId?: string;
    cropId?: string;
    size?: number;
    page?: number;
    search?: string;
  }): Promise<GroupedFeedingLogsResponse> {
    const params = new URLSearchParams();
    if (query?.farmId) params.append('farmId', query.farmId);
    if (query?.pondId) params.append('pondId', query.pondId);
    if (query?.cropId) params.append('cropId', query.cropId);
    if (query?.size) params.append('size', String(query.size));
    if (query?.page !== undefined) params.append('page', String(query.page));
    if (query?.search) params.append('search', query.search);

    const qs = params.toString();
    return apiClient.get(`/feeding-logs${qs ? `?${qs}` : ''}`);
  },

  /**
   * Delete daily feeding log and restore stock
   */
  async deleteDailyLog(farmId: string, pondId: string, cropId: string, date: string): Promise<any> {
    return apiClient.delete(`/feeding-logs/daily?farmId=${farmId}&pondId=${pondId}&cropId=${cropId}&date=${date}`);
  },
};
