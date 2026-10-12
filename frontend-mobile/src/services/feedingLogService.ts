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

export const DEFAULT_FEEDING_PRESETS: { session: FeedingSession; label: string; defaultTime: string }[] = [
  { session: 'SESSION_1', label: 'Cữ 1', defaultTime: '06:00' },
  { session: 'SESSION_2', label: 'Cữ 2', defaultTime: '09:00' },
  { session: 'SESSION_3', label: 'Cữ 3', defaultTime: '12:00' },
  { session: 'SESSION_4', label: 'Cữ 4', defaultTime: '15:00' },
  { session: 'SESSION_5', label: 'Cữ 5', defaultTime: '18:00' },
  { session: 'SESSION_6', label: 'Cữ 6', defaultTime: '21:00' },
  { session: 'SESSION_7', label: 'Cữ 7', defaultTime: '00:00' },
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
  async getDailyDetails(pondId: string, date: string) {
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
  async getAllGrouped(query?: { farmId?: string; pondId?: string; cropId?: string; size?: number }) {
    const params = new URLSearchParams();
    if (query?.farmId) params.append('farmId', query.farmId);
    if (query?.pondId) params.append('pondId', query.pondId);
    if (query?.cropId) params.append('cropId', query.cropId);
    if (query?.size) params.append('size', String(query.size));

    const qs = params.toString();
    return apiClient.get(`/feeding-logs${qs ? `?${qs}` : ''}`);
  },
};
