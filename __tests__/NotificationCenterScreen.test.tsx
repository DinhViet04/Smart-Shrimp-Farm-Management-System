// __tests__/NotificationCenterScreen.test.tsx
import React from 'react';
import { render, waitFor, fireEvent } from '@testing-library/react-native';
import NotificationCenterScreen from '../src/screens/NotificationCenterScreen';
import { notificationService } from '../src/services/notificationService';

// Mock data returned by the backend
const mockNotifications = [
  {
    id: '1',
    title: 'Oxygen Low',
    message: 'DO below 3.5 mg/L in Pond 1',
    level: 'DANGER',
    isRead: false,
    createdAt: new Date().toISOString(),
  },
  {
    id: '2',
    title: 'Feeding completed',
    message: 'Automatic feeder finished for Pond 2',
    level: 'INFO',
    isRead: true,
    createdAt: new Date().toISOString(),
  },
];

jest.mock('../src/services/notificationService', () => ({
  notificationService: {
    getNotifications: jest.fn().mockResolvedValue(mockNotifications),
    markAllAsRead: jest.fn().mockResolvedValue(undefined),
    getUnreadCount: jest.fn().mockResolvedValue(1),
    clearAll: jest.fn().mockResolvedValue(undefined),
  },
}));

describe('NotificationCenterScreen', () => {
  it('renders a list of notifications after load', async () => {
    const { getByText, queryByText } = render(<NotificationCenterScreen />);
    // Initially shows loading spinner (if any) – we just wait for data
    await waitFor(() => expect(notificationService.getNotifications).toHaveBeenCalled());
    // Verify each notification title appears
    expect(getByText('Oxygen Low')).toBeTruthy();
    expect(getByText('Feeding completed')).toBeTruthy();
    // Unread notification should have a distinct background color – check style prop indirectly
    const unreadItem = getByText('Oxygen Low').parent?.parent;
    expect(unreadItem?.props?.style?.some?.(s => s?.backgroundColor === '#F1F8FF')).toBeTruthy();
    // Read notification should not have the unread background
    const readItem = getByText('Feeding completed').parent?.parent;
    expect(readItem?.props?.style?.some?.(s => s?.backgroundColor === '#F1F8FF')).toBeFalsy();
  });

  it('marks all as read when the button is pressed', async () => {
    const { getByText } = render(<NotificationCenterScreen />);
    await waitFor(() => expect(notificationService.getNotifications).toHaveBeenCalled());
    const markAllBtn = getByText('Đánh dấu đã đọc hết');
    fireEvent.press(markAllBtn);
    await waitFor(() => expect(notificationService.markAllAsRead).toHaveBeenCalled());
    // After marking all as read, unread count should become 0 – we can check that getUnreadCount is called again if UI used it
  });
});
