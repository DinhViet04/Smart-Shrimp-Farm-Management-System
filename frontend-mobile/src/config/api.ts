import { Platform } from 'react-native';

/**
 * Global API Configuration for SSFM Mobile Application
 * Automatically switches between configured IP, Android Emulator (10.0.2.2),
 * and default development address.
 */

// If EXPO_PUBLIC_API_URL is configured in .env, use it first
const ENV_API_URL = process.env.EXPO_PUBLIC_API_URL;

const getDefaultBaseUrl = (): string => {
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

export const API_TIMEOUT_MS = 25000; // 25 seconds for AI inference & network operations
