import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_ENDPOINT, API_TIMEOUT_MS } from '../config/api';

export interface ApiResponse<T = any> {
  data: T;
  status: number;
  message?: string;
}

export class ApiError extends Error {
  status: number;
  data: any;

  constructor(message: string, status: number, data?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

// Singleton promise to prevent concurrent duplicate refresh requests
let refreshRequestPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (!refreshRequestPromise) {
    refreshRequestPromise = (async () => {
      try {
        const storedRefreshToken = await AsyncStorage.getItem('refreshToken');
        if (!storedRefreshToken) return null;

        const res = await fetch(`${API_ENDPOINT}/auth/refresh`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({ refreshToken: storedRefreshToken }),
        });

        if (!res.ok) {
          // Token is invalid/revoked
          await AsyncStorage.removeItem('userToken');
          await AsyncStorage.removeItem('refreshToken');
          return null;
        }

        const data = await res.json();
        if (data?.accessToken) {
          await AsyncStorage.setItem('userToken', data.accessToken);
          if (data?.refreshToken) {
            await AsyncStorage.setItem('refreshToken', data.refreshToken);
          }
          return data.accessToken as string;
        }
        return null;
      } catch {
        return null;
      } finally {
        refreshRequestPromise = null;
      }
    })();
  }
  return refreshRequestPromise;
}

/**
 * Universal Mobile API Client for SSFM with Transparent Auto-Refresh on 401
 */
export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestInit = {},
  isRetry = false
): Promise<T> {
  const token = await AsyncStorage.getItem('userToken');

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const url = endpoint.startsWith('http')
    ? endpoint
    : `${API_ENDPOINT}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      ...options,
      headers,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    // Handle 401 Unauthorized by attempting to refresh the token once
    if (response.status === 401 && !isRetry && !endpoint.includes('/auth/login') && !endpoint.includes('/auth/refresh')) {
      const nextAccessToken = await refreshAccessToken();
      if (nextAccessToken) {
        // Retry with refreshed token
        return apiRequest<T>(endpoint, options, true);
      } else {
        // Clear expired auth data
        await AsyncStorage.removeItem('userToken');
        await AsyncStorage.removeItem('refreshToken');
        throw new ApiError('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.', 401);
      }
    }

    const contentType = response.headers.get('content-type');
    let responseData: any = null;

    if (contentType && contentType.includes('application/json')) {
      responseData = await response.json();
    } else {
      responseData = await response.text();
    }

    if (!response.ok) {
      const errorMessage =
        (typeof responseData === 'object' && responseData?.message) ||
        (typeof responseData === 'string' && responseData) ||
        `Lỗi hệ thống (${response.status})`;

      throw new ApiError(
        Array.isArray(errorMessage) ? errorMessage.join(', ') : errorMessage,
        response.status,
        responseData
      );
    }

    return responseData as T;
  } catch (error: any) {
    clearTimeout(timeoutId);

    if (error.name === 'AbortError') {
      throw new ApiError('Kết nối máy chủ bị quá thời gian (Timeout). Vui lòng thử lại.', 408);
    }

    if (error instanceof ApiError) {
      throw error;
    }

    throw new ApiError(
      error.message || 'Không thể kết nối đến máy chủ. Vui lòng kiểm tra mạng.',
      0
    );
  }
}

export const apiClient = {
  get: <T = any>(endpoint: string, options?: RequestInit) =>
    apiRequest<T>(endpoint, { ...options, method: 'GET' }),

  post: <T = any>(endpoint: string, body?: any, options?: RequestInit) =>
    apiRequest<T>(endpoint, {
      ...options,
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    }),

  put: <T = any>(endpoint: string, body?: any, options?: RequestInit) =>
    apiRequest<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    }),

  patch: <T = any>(endpoint: string, body?: any, options?: RequestInit) =>
    apiRequest<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    }),

  delete: <T = any>(endpoint: string, options?: RequestInit) =>
    apiRequest<T>(endpoint, { ...options, method: 'DELETE' }),
};
