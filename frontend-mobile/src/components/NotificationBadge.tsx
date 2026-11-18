import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Bell } from 'lucide-react-native';
import { notificationService } from '../services/notificationService';

import { useNavigation } from '@react-navigation/native';

export default function NotificationBadge({
  color = '#475569',
  size = 22,
}: { color?: string; size?: number }) {
  const [unreadCount, setUnreadCount] = useState<number>(0);

  const checkUnreadCount = useCallback(async () => {
    const count = await notificationService.getUnreadCount();
    setUnreadCount(count);
  }, []);

  useEffect(() => {
    checkUnreadCount();
    const interval = setInterval(checkUnreadCount, 30000); // poll every 30s
    return () => clearInterval(interval);
  }, [checkUnreadCount]);

  return (
    <TouchableOpacity style={styles.bellButton} activeOpacity={0.7} onPress={() => { /* future navigation to center */ }}>
      <Bell size={size} color={color} />
      {unreadCount > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  bellButton: {
    marginRight: 12,
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    right: -6,
    top: -4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#ef4444',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 2,
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
});
