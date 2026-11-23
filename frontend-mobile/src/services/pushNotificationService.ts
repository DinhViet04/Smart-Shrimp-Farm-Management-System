import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { apiRequest } from './apiClient';

const PUSH_TOKEN_STORAGE_KEY = 'expoPushToken';

// Hiển thị banner + âm thanh ngay cả khi người dùng đang mở app
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

async function ensureAndroidChannels() {
  if (Platform.OS !== 'android') return;

  await Notifications.setNotificationChannelAsync('alerts-default', {
    name: 'Cảnh báo & Thông báo',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#2563eb',
    sound: 'default',
  });

  await Notifications.setNotificationChannelAsync('alerts-danger', {
    name: 'Cảnh báo khẩn cấp',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 500, 250, 500],
    lightColor: '#dc2626',
    sound: 'default',
  });
}

function getEasProjectId(): string | undefined {
  return (
    Constants.expoConfig?.extra?.eas?.projectId ||
    (Constants as any).easConfig?.projectId ||
    process.env.EXPO_PUBLIC_EAS_PROJECT_ID
  );
}

/**
 * Xin quyền nhận thông báo, lấy Expo Push Token và gửi lên backend.
 * An toàn khi chạy trên web, emulator hoặc Expo Go (tự bỏ qua, không crash).
 */
export async function registerForPushNotificationsAsync(): Promise<string | null> {
  if (Platform.OS === 'web') return null;

  try {
    await ensureAndroidChannels();

    if (!Device.isDevice) {
      return null;
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      return null;
    }

    const projectId = getEasProjectId();
    const tokenResponse = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    const token = tokenResponse.data;
    if (!token) return null;

    await AsyncStorage.setItem(PUSH_TOKEN_STORAGE_KEY, token);
    await apiRequest('/notifications/push-token', {
      method: 'POST',
      body: JSON.stringify({
        token,
        platform: Platform.OS,
      }),
    });

    return token;
  } catch (err) {
    console.warn(
      '[push] Registration skipped:',
      err instanceof Error ? err.message : String(err),
    );
    return null;
  }
}

/**
 * Hủy đăng ký push token khi người dùng đăng xuất để không nhận nhầm thông báo.
 */
export async function unregisterPushNotificationsAsync(): Promise<void> {
  if (Platform.OS === 'web') return;

  try {
    const token = await AsyncStorage.getItem(PUSH_TOKEN_STORAGE_KEY);
    if (!token) return;

    await apiRequest('/notifications/push-token', {
      method: 'DELETE',
      body: JSON.stringify({ token }),
    }).catch(() => {});

    await AsyncStorage.removeItem(PUSH_TOKEN_STORAGE_KEY);
  } catch {
    // ignore cleanup errors on logout
  }
}
