import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Platform } from 'react-native';
import { LogOut, Settings, User, Bell, Shield, CircleHelp } from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';

export default function SettingsScreen() {
  const { logout } = useAuth();

  const handleLogout = async () => {
    if (Platform.OS === 'web') {
      const confirmLogout = window.confirm("Bạn có chắc chắn muốn đăng xuất không?");
      if (confirmLogout) {
        await logout();
      }
    } else {
      Alert.alert(
        "Xác nhận đăng xuất",
        "Bạn có chắc chắn muốn đăng xuất không?",
        [
          { text: "Hủy", style: "cancel" },
          { 
            text: "Đăng xuất", 
            onPress: async () => {
              await logout();
            },
            style: "destructive"
          }
        ]
      );
    }
  };

  const menuItems = [
    { icon: <User size={24} color="#475569" />, title: 'Tài khoản của tôi', subtitle: 'Thay đổi thông tin, mật khẩu' },
    { icon: <Bell size={24} color="#475569" />, title: 'Thông báo', subtitle: 'Tùy chỉnh nhận cảnh báo hệ thống' },
    { icon: <Shield size={24} color="#475569" />, title: 'Bảo mật', subtitle: 'Quản lý phiên đăng nhập' },
    { icon: <CircleHelp size={24} color="#475569" />, title: 'Trợ giúp & Hỗ trợ', subtitle: 'Câu hỏi thường gặp, liên hệ' },
    { icon: <Settings size={24} color="#475569" />, title: 'Cài đặt chung', subtitle: 'Ngôn ngữ, giao diện' },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Cài đặt</Text>
      </View>

      <View style={styles.menuContainer}>
        {menuItems.map((item, index) => (
          <TouchableOpacity key={index} style={styles.menuItem}>
            <View style={styles.iconContainer}>
              {item.icon}
            </View>
            <View style={styles.menuTextContainer}>
              <Text style={styles.menuTitle}>{item.title}</Text>
              <Text style={styles.menuSubtitle}>{item.subtitle}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <LogOut color="#ef4444" size={20} />
        <Text style={styles.logoutText}>Đăng xuất</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  menuContainer: {
    marginTop: 16,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#e2e8f0',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  menuTextContainer: {
    flex: 1,
  },
  menuTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 4,
  },
  menuSubtitle: {
    fontSize: 13,
    color: '#64748b',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 32,
    marginHorizontal: 24,
    backgroundColor: '#fef2f2', // red-50
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fecaca', // red-200
  },
  logoutText: {
    color: '#ef4444', // red-500
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
});
