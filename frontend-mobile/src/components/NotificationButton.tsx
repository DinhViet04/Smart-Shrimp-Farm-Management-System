import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  SafeAreaView,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Platform,
} from 'react-native';
import {
  Bell,
  X,
  CheckCheck,
  AlertTriangle,
  AlertCircle,
  Info,
  Trash2,
  Inbox,
} from 'lucide-react-native';
import {
  notificationService,
  AppNotification,
} from '../services/notificationService';

interface NotificationButtonProps {
  color?: string;
  size?: number;
}

export default function NotificationButton({
  color = '#312e81',
  size = 22,
}: NotificationButtonProps) {
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [isModalVisible, setIsModalVisible] = useState<boolean>(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Poll unread count periodically or on mount
  const checkUnreadCount = useCallback(async () => {
    const count = await notificationService.getUnreadCount();
    setUnreadCount(count);
  }, []);

  useEffect(() => {
    checkUnreadCount();
    const interval = setInterval(checkUnreadCount, 30000); // 30s poll
    return () => clearInterval(interval);
  }, [checkUnreadCount]);

  const loadNotifications = async () => {
    setIsLoading(true);
    try {
      const data = await notificationService.getNotifications();
      setNotifications(data);
    } catch (e) {
      console.warn('Error loading notifications:', e);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleOpenModal = () => {
    setIsModalVisible(true);
    loadNotifications();
  };

  const handleMarkAsRead = async (item: AppNotification) => {
    if (!item.isRead) {
      await notificationService.markAsRead(item.id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === item.id ? { ...n, isRead: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    }
  };

  const handleMarkAllRead = async () => {
    await notificationService.markAllAsRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);
  };

  const handleClearAll = async () => {
    await notificationService.clearAll();
    setNotifications([]);
    setUnreadCount(0);
  };

  const getLevelConfig = (level: string) => {
    switch (level) {
      case 'DANGER':
        return {
          icon: <AlertCircle size={18} color="#dc2626" />,
          bg: '#fef2f2',
          border: '#fecaca',
        };
      case 'WARNING':
        return {
          icon: <AlertTriangle size={18} color="#d97706" />,
          bg: '#fffbeb',
          border: '#fde68a',
        };
      default:
        return {
          icon: <Info size={18} color="#2563eb" />,
          bg: '#eff6ff',
          border: '#bfdbfe',
        };
    }
  };

  const renderItem = ({ item }: { item: AppNotification }) => {
    const config = getLevelConfig(item.level);

    return (
      <TouchableOpacity
        style={[
          styles.notificationItem,
          !item.isRead && styles.notificationItemUnread,
        ]}
        onPress={() => handleMarkAsRead(item)}
        activeOpacity={0.7}
      >
        <View style={[styles.iconWrapper, { backgroundColor: config.bg, borderColor: config.border }]}>
          {config.icon}
        </View>

        <View style={styles.notificationContent}>
          <View style={styles.itemHeaderRow}>
            <Text
              style={[
                styles.itemTitle,
                !item.isRead && styles.itemTitleUnread,
              ]}
              numberOfLines={1}
            >
              {item.title}
            </Text>
            {!item.isRead && <View style={styles.unreadDot} />}
          </View>

          <Text style={styles.itemMessage} numberOfLines={3}>
            {item.message}
          </Text>

          <Text style={styles.itemTime}>
            {new Date(item.createdAt).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}{' '}
            • {new Date(item.createdAt).toLocaleDateString('vi-VN')}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <>
      {/* Header Button on Top Right */}
      <TouchableOpacity
        style={styles.bellButton}
        onPress={handleOpenModal}
        accessibilityLabel="Thông báo"
        activeOpacity={0.7}
      >
        <Bell size={size} color={color} />
        {unreadCount > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              {unreadCount > 99 ? '99+' : unreadCount}
            </Text>
          </View>
        )}
      </TouchableOpacity>

      {/* Notifications Drawer/Modal */}
      <Modal
        visible={isModalVisible}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setIsModalVisible(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <View style={styles.modalHeaderLeft}>
              <View style={styles.modalHeaderIcon}>
                <Bell size={20} color="#4f46e5" />
              </View>
              <View>
                <Text style={styles.modalTitle}>Thông Báo</Text>
                <Text style={styles.modalSubtitle}>
                  {unreadCount > 0 ? `${unreadCount} thông báo mới` : 'Đã đọc tất cả'}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              onPress={() => setIsModalVisible(false)}
              style={styles.closeBtn}
            >
              <X size={20} color="#475569" />
            </TouchableOpacity>
          </View>

          {/* Action Bar */}
          {notifications.length > 0 && (
            <View style={styles.actionBar}>
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={handleMarkAllRead}
              >
                <CheckCheck size={14} color="#4f46e5" />
                <Text style={styles.actionBtnText}>Đọc tất cả</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionBtn}
                onPress={handleClearAll}
              >
                <Trash2 size={14} color="#dc2626" />
                <Text style={[styles.actionBtnText, { color: '#dc2626' }]}>
                  Xóa tất cả
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* List */}
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#4f46e5" />
              <Text style={styles.loadingText}>Đang tải thông báo...</Text>
            </View>
          ) : (
            <FlatList
              data={notifications}
              keyExtractor={(item) => item.id}
              renderItem={renderItem}
              contentContainerStyle={styles.listContent}
              refreshControl={
                <RefreshControl
                  refreshing={isRefreshing}
                  onRefresh={() => {
                    setIsRefreshing(true);
                    loadNotifications();
                  }}
                />
              }
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Inbox size={48} color="#cbd5e1" />
                  <Text style={styles.emptyTitle}>Chưa có thông báo nào</Text>
                  <Text style={styles.emptySubtitle}>
                    Các cảnh báo môi trường, nhắc lịch đo đạc và sự cố sẽ xuất hiện tại đây.
                  </Text>
                </View>
              }
            />
          )}
        </SafeAreaView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  bellButton: {
    padding: 8,
    marginRight: 6,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  badge: {
    position: 'absolute',
    top: 3,
    right: 3,
    backgroundColor: '#ef4444',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: '#ffffff',
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
  },

  // Modal
  modalContainer: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  modalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  modalHeaderIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#e0e7ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0f172a',
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 1,
  },
  closeBtn: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
  },
  actionBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#f8fafc',
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4f46e5',
  },
  listContent: {
    padding: 14,
    gap: 10,
  },
  notificationItem: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
    gap: 12,
  },
  notificationItemUnread: {
    backgroundColor: '#f0fdf4',
    borderColor: '#bbf7d0',
  },
  iconWrapper: {
    width: 38,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  notificationContent: {
    flex: 1,
  },
  itemHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
    flex: 1,
  },
  itemTitleUnread: {
    fontWeight: '800',
    color: '#0f172a',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#16a34a',
    marginLeft: 6,
  },
  itemMessage: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 18,
    marginBottom: 6,
  },
  itemTime: {
    fontSize: 11,
    color: '#94a3b8',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 13,
    color: '#64748b',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#475569',
    marginTop: 14,
  },
  emptySubtitle: {
    fontSize: 12,
    color: '#94a3b8',
    textAlign: 'center',
    marginTop: 4,
    paddingHorizontal: 30,
  },
});
