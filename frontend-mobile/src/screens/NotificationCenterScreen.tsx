import React, { useEffect, useState } from 'react';
import { SafeAreaView, View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { notificationService, AppNotification } from '../services/notificationService';
// Icon components for mobile – lucide-react-native provides React Native versions of the icons
import { AlertCircle, AlertTriangle, Info } from 'lucide-react-native';

export default function NotificationCenterScreen() {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  const loadNotifications = async () => {
    setLoading(true);
    try {
      const data = await notificationService.getNotifications();
      setNotifications(data ?? []);
    } catch (e) {
      console.error('Failed to load notifications', e);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadNotifications();
    // TODO: add navigation focus listener if needed to refresh on screen focus
  }, []);

  const markAllRead = async () => {
    await notificationService.markAllAsRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  };

  /**
   * Returns the icon component and background/border colours for a given notification level.
   * The icons are the same as used in the web version (AlertCircle, AlertTriangle, Info).
   */
  const getLevelConfig = (level: string) => {
    switch (level) {
      case 'DANGER':
        return { icon: <AlertCircle size={18} color="#dc2626" />, bg: '#fef2f2', border: '#fecaca' };
      case 'WARNING':
        return { icon: <AlertTriangle size={18} color="#d97706" />, bg: '#fffbeb', border: '#fde68a' };
      default:
        return { icon: <Info size={18} color="#2563eb" />, bg: '#eff6ff', border: '#bfdbfe' };
    }
  };

  // Render each notification item in the FlatList
  const renderItem = ({ item }: { item: AppNotification }) => {
    const { icon, bg, border } = getLevelConfig(item.level);
    const backgroundColor = item.isRead ? '#fff' : '#F1F8FF';
    const borderColor = item.isRead ? '#E9ECEF' : '#007BFF';
    return (
      <View style={[styles.card, { backgroundColor, borderColor }] }>
        <View style={styles.headerRow}>
          {icon}
          <Text style={styles.title}>{item.title}</Text>
          <Text style={styles.time}>{new Date(item.createdAt).toLocaleDateString('vi-VN')}</Text>
        </View>
        <Text style={styles.message}>{item.message}</Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <Text style={styles.header}>Thông báo</Text>
        <TouchableOpacity onPress={markAllRead}>
          <Text style={styles.markAll}>Đánh dấu đã đọc hết</Text>
        </TouchableOpacity>
      </View>
      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={styles.empty}>Không có thông báo.</Text>}
        refreshing={loading}
        onRefresh={loadNotifications}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#E9ECEF' },
  header: { fontSize: 20, fontWeight: 'bold', color: '#212529' },
  markAll: { fontSize: 14, color: '#007BFF', fontWeight: '600' },
  list: { padding: 16 },
  card: { backgroundColor: '#fff', padding: 16, borderRadius: 8, marginBottom: 12, borderWidth: 1 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  title: { flex: 1, fontSize: 16, fontWeight: '600', color: '#343A40', marginLeft: 8 },
  time: { fontSize: 12, color: '#6C757D' },
  message: { fontSize: 14, color: '#495057' },
  empty: { textAlign: 'center', marginTop: 40, color: '#6C757D' },
});
