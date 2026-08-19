import { apiFetch } from '../utils/api';

const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export interface WeatherInfo {
  temperature: number;
  humidity: number;
  windSpeed: number;
  condition: string;
  weatherCode: number;
  icon: 'sunny' | 'cloudy' | 'partly-cloudy' | 'rainy' | 'thunder';
  locationName: string;
  date: string;
  precipitation?: number;
  forecastHint?: string;
}

export const weatherService = {
  getWeather: async (params?: { farmId?: string; address?: string }): Promise<WeatherInfo> => {
    const query = new URLSearchParams();
    if (params?.farmId) query.append('farmId', params.farmId);
    if (params?.address) query.append('address', params.address);

    const qs = query.toString() ? `?${query.toString()}` : '';
    const res = await apiFetch(`${apiUrl}/api/weather${qs}`);
    if (!res.ok) {
      throw new Error('Không thể tải thông tin thời tiết');
    }
    return res.json();
  },
};
