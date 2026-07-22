import { apiFetch } from '../utils/api';

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
  feedingDate: string;
  sessions: SingleSessionPayload[];
}

export interface DailyFeedingGroup {
  id: string;
  feedingDate: string;
  farmId: string;
  farmName: string;
  pondId: string;
  pondName: string;
  cropId: string;
  cropStartDate: string;
  totalFeedKg: number;
  completedSessions: number;
  skippedSessions: number;
  delayedSessions: number;
  createdBy: string;
  createdAt: string;
  sessions: {
    id: string;
    feedingSession: FeedingSession;
    feedingTime: string;
    feedProductId: string;
    feedProductName: string;
    feedAmount: number;
    feedingMethod: FeedingMethod;
    feedingStatus: FeedingStatus;
    note?: string;
  }[];
}

export const DEFAULT_FEEDING_SESSIONS: { session: FeedingSession; label: string; defaultTime: string }[] = [
  { session: 'SESSION_1', label: 'Cử 1 (Sáng sớm)', defaultTime: '05:30' },
  { session: 'SESSION_2', label: 'Cử 2 (Sáng)', defaultTime: '08:00' },
  { session: 'SESSION_3', label: 'Cử 3 (Trưa)', defaultTime: '10:30' },
  { session: 'SESSION_4', label: 'Cử 4 (Đầu chiều)', defaultTime: '13:00' },
  { session: 'SESSION_5', label: 'Cử 5 (Chiều)', defaultTime: '15:30' },
  { session: 'SESSION_6', label: 'Cử 6 (Chiều tối)', defaultTime: '18:00' },
  { session: 'SESSION_7', label: 'Cử 7 (Tối)', defaultTime: '21:00' },
];

export interface SessionPreset {
  id: string;
  name: string;
  count: number;
  activeSessions: FeedingSession[];
  times: Record<FeedingSession, string>;
}

export const FEEDING_SESSION_PRESETS: SessionPreset[] = [
  {
    id: '2_SESSIONS',
    name: '2 Cử / ngày',
    count: 2,
    activeSessions: ['SESSION_2', 'SESSION_5'],
    times: {
      SESSION_1: '05:30',
      SESSION_2: '07:00',
      SESSION_3: '10:30',
      SESSION_4: '13:00',
      SESSION_5: '17:00',
      SESSION_6: '18:00',
      SESSION_7: '21:00',
    },
  },
  {
    id: '3_SESSIONS',
    name: '3 Cử / ngày',
    count: 3,
    activeSessions: ['SESSION_2', 'SESSION_3', 'SESSION_5'],
    times: {
      SESSION_1: '05:30',
      SESSION_2: '06:30',
      SESSION_3: '11:30',
      SESSION_4: '13:00',
      SESSION_5: '16:30',
      SESSION_6: '18:00',
      SESSION_7: '21:00',
    },
  },
  {
    id: '4_SESSIONS',
    name: '4 Cử / ngày',
    count: 4,
    activeSessions: ['SESSION_2', 'SESSION_3', 'SESSION_4', 'SESSION_5'],
    times: {
      SESSION_1: '05:30',
      SESSION_2: '06:00',
      SESSION_3: '10:00',
      SESSION_4: '14:00',
      SESSION_5: '18:00',
      SESSION_6: '19:30',
      SESSION_7: '21:00',
    },
  },
  {
    id: '5_SESSIONS',
    name: '5 Cử / ngày',
    count: 5,
    activeSessions: ['SESSION_1', 'SESSION_2', 'SESSION_3', 'SESSION_5', 'SESSION_6'],
    times: {
      SESSION_1: '06:00',
      SESSION_2: '09:30',
      SESSION_3: '13:00',
      SESSION_4: '14:30',
      SESSION_5: '16:30',
      SESSION_6: '20:00',
      SESSION_7: '21:00',
    },
  },
  {
    id: '6_SESSIONS',
    name: '6 Cử / ngày',
    count: 6,
    activeSessions: ['SESSION_1', 'SESSION_2', 'SESSION_3', 'SESSION_4', 'SESSION_5', 'SESSION_6'],
    times: {
      SESSION_1: '05:30',
      SESSION_2: '08:30',
      SESSION_3: '11:30',
      SESSION_4: '14:30',
      SESSION_5: '17:30',
      SESSION_6: '20:30',
      SESSION_7: '21:00',
    },
  },
  {
    id: '7_SESSIONS',
    name: '7 Cử / ngày (Mặc định)',
    count: 7,
    activeSessions: ['SESSION_1', 'SESSION_2', 'SESSION_3', 'SESSION_4', 'SESSION_5', 'SESSION_6', 'SESSION_7'],
    times: {
      SESSION_1: '05:30',
      SESSION_2: '08:00',
      SESSION_3: '10:30',
      SESSION_4: '13:00',
      SESSION_5: '15:30',
      SESSION_6: '18:00',
      SESSION_7: '21:00',
    },
  },
];

const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export const feedingLogService = {
  createDailyLog: async (payload: CreateDailyFeedingLogPayload) => {
    const res = await apiFetch(`${apiUrl}/api/feeding-logs`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const msg = Array.isArray(err.message) ? err.message.join(', ') : err.message;
      throw new Error(msg || 'Không thể ghi nhận nhật ký cho ăn');
    }
    return res.json();
  },

  getAllGrouped: async (params?: {
    farmId?: string;
    pondId?: string;
    cropId?: string;
    search?: string;
    page?: number;
    size?: number;
  }) => {
    const query = new URLSearchParams();
    if (params?.farmId) query.append('farmId', params.farmId);
    if (params?.pondId) query.append('pondId', params.pondId);
    if (params?.cropId) query.append('cropId', params.cropId);
    if (params?.search) query.append('search', params.search);
    if (params?.page !== undefined) query.append('page', params.page.toString());
    if (params?.size !== undefined) query.append('size', params.size.toString());

    const res = await apiFetch(`${apiUrl}/api/feeding-logs?${query.toString()}`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Không thể lấy danh sách nhật ký cho ăn');
    }
    return (await res.json()) as {
      data: DailyFeedingGroup[];
      total: number;
      page: number;
      size: number;
    };
  },

  getFeedProducts: async (farmId?: string) => {
    const query = new URLSearchParams();
    if (farmId) query.append('farmId', farmId);
    query.append('category', 'FEED');

    const res = await apiFetch(`${apiUrl}/api/inventory?${query.toString()}`);
    if (res.ok) {
      const data = await res.json();
      const list = Array.isArray(data) ? data : data.data || [];
      if (list.length > 0) return list;
    }

    // Fallback: Fetch all inventory items for farm if category=FEED returned empty
    const fallbackQuery = new URLSearchParams();
    if (farmId) fallbackQuery.append('farmId', farmId);
    const fallbackRes = await apiFetch(`${apiUrl}/api/inventory?${fallbackQuery.toString()}`);
    if (!fallbackRes.ok) return [];
    const fallbackData = await fallbackRes.json();
    const allList = Array.isArray(fallbackData) ? fallbackData : fallbackData.data || [];
    return allList.filter((item: any) => !item.category || item.category === 'FEED');
  },
};
