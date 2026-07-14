import React, { useContext, useEffect, useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, ScrollView, Platform } from 'react-native';
import { Wrench, Droplets, History, User } from 'lucide-react-native';
import { AuthContext } from '../context/AuthContext';

interface TechnicianScreenProps {
  navigation: any;
}

export default function TechnicianScreen({ navigation }: TechnicianScreenProps) {
  const { userToken } = useContext(AuthContext);
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    // In a real application, you might fetch user info from context or API.
    // For now we will try to read token/user context or display generic greeting.
    // Let's assume we can get it or show 'Kỹ thuật viên'.
  }, [userToken]);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* ── Welcome Header ───────────────────────────────────────────── */}
        <View style={styles.header}>
          <View style={styles.avatarContainer}>
            <User color="#6366f1" size={28} />
          </View>
          <View>
            <Text style={styles.greeting}>Xin chào,</Text>
            <Text style={styles.userName}>Chuyên viên Kỹ thuật</Text>
          </View>
        </View>

        {/* ── Welcome Info Card ─────────────────────────────────────────── */}
        <View style={styles.welcomeCard}>
          <View style={styles.iconContainer}>
            <Wrench color="#ffffff" size={32} />
          </View>
          <View style={styles.welcomeTextContainer}>
            <Text style={styles.welcomeTitle}>Cổng Kỹ Thuật Viên</Text>
            <Text style={styles.welcomeSubtitle}>
              Hỗ trợ bà con ghi nhận và theo dõi các thông số môi trường nước ao nuôi tôm kịp thời và chính xác.
            </Text>
          </View>
        </View>

        {/* ── Quick Actions Section ────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Hành động nhanh</Text>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => navigation.navigate('Môi trường', { screen: 'RecordWaterQuality' })}
            activeOpacity={0.8}
          >
            <View style={[styles.actionIconContainer, { backgroundColor: '#e0f2fe' }]}>
              <Droplets color="#0ea5e9" size={24} />
            </View>
            <View style={styles.actionTextContainer}>
              <Text style={styles.actionTitle}>Ghi nhận thông số nước</Text>
              <Text style={styles.actionDesc}>Nhập các chỉ số pH, DO, độ kiềm, độ mặn...</Text>
            </View>
            <Text style={styles.actionArrow}>▶</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => navigation.navigate('Môi trường', { screen: 'RecordHistory' })}
            activeOpacity={0.8}
          >
            <View style={[styles.actionIconContainer, { backgroundColor: '#e0e7ff' }]}>
              <History color="#6366f1" size={24} />
            </View>
            <View style={styles.actionTextContainer}>
              <Text style={styles.actionTitle}>Lịch sử đo lường</Text>
              <Text style={styles.actionDesc}>Xem lại nhật ký thông số nước của ao nuôi</Text>
            </View>
            <Text style={styles.actionArrow}>▶</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.tipsBox}>
          <Text style={styles.tipsTitle}>💡 Lời khuyên kỹ thuật:</Text>
          <Text style={styles.tipsText}>
            Nên thực hiện đo môi trường nước 2 lần/ngày (sáng 5:00 - 7:00 và chiều 14:00 - 16:00) để theo dõi sự biến động pH và Oxy hòa tan chính xác nhất.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  scrollContent: {
    padding: 20,
    gap: 20,
  },
  
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 10,
    marginBottom: 5,
  },
  avatarContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#e0e7ff',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#c7d2fe',
  },
  greeting: {
    fontSize: 14,
    color: '#64748b',
  },
  userName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1e1b4b',
  },

  // Welcome Card
  welcomeCard: {
    backgroundColor: '#4f46e5', // Indigo 600
    borderRadius: 24,
    padding: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    shadowColor: '#4f46e5',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 4,
  },
  iconContainer: {
    width: 56,
    height: 56,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  welcomeTextContainer: {
    flex: 1,
  },
  welcomeTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: 4,
  },
  welcomeSubtitle: {
    fontSize: 13,
    color: '#e0e7ff',
    lineHeight: 18,
  },

  // Section
  section: {
    gap: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 4,
  },

  // Action Button
  actionButton: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  actionIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionTextContainer: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 2,
  },
  actionDesc: {
    fontSize: 12,
    color: '#64748b',
  },
  actionArrow: {
    fontSize: 10,
    color: '#94a3b8',
    paddingHorizontal: 4,
  },

  // Tips Box
  tipsBox: {
    backgroundColor: '#fffbeb',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#fde68a',
  },
  tipsTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#b45309',
    marginBottom: 6,
  },
  tipsText: {
    fontSize: 12,
    color: '#78350f',
    lineHeight: 18,
  },
});
