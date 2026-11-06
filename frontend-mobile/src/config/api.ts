import { Platform } from 'react-native';

/**
 * Global API Configuration for SSFM Mobile Application
 *
 * Rules:
 * 1. Web browser (Platform.OS === 'web'): Always connects to http://localhost:3000
 *    because the browser runs directly on the host machine.
 * 2. Mobile / Physical Device / Emulator: Uses EXPO_PUBLIC_API_URL if configured,
 *    otherwise defaults to 10.0.2.2 for Android emulator or localhost.
 */

const ENV_API_URL = process.env.EXPO_PUBLIC_API_URL;

const getDefaultBaseUrl = (): string => {
  // If running in Web browser (expo start --web), always use localhost
  if (Platform.OS === 'web') {
    return 'http://localhost:3000';
  }

  // If EXPO_PUBLIC_API_URL is configured in .env for physical device
  if (ENV_API_URL && ENV_API_URL.trim() !== '') {
    return ENV_API_URL.replace(/\/+$/, '');
  }

  // Android emulator routes host machine loopback through 10.0.2.2
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:3000';
  }

  return 'http://localhost:3000';
};

export const API_BASE_URL = getDefaultBaseUrl();
export const API_ENDPOINT = `${API_BASE_URL}/api`;

export const API_TIMEOUT_MS = 25000;
