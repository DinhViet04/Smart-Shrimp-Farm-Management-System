/**
 * EnvironmentScreen.tsx
 *
 * Entry point for the Environment (Môi trường) tab.
 * Currently hosts the water quality recording feature (FE-23).
 *
 * Navigation: This screen is contained inside a Stack navigator
 * (see MainNavigator.tsx) so it can push sub-screens like
 * RecordWaterQualityScreen.
 */
import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';

export default function EnvironmentScreen({ navigation }: any) {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* ── Hero Card ───────────────────────────────────────────────── */}
      <View style={styles.heroCard}>
        <Text style={styles.heroEmoji}>🌊</Text>
        <Text style={styles.heroTitle}>Môi trường nước</Text>
        <Text style={styles.heroSubtitle}>
          Theo dõi và ghi nhận các thông số chất lượng nước ao nuôi
        </Text>
      </View>

      {/* ── Quick Actions ────────────────────────────────────────────── */}
      <Text style={styles.sectionLabel}>Hành động nhanh</Text>

      <TouchableOpacity
        style={styles.actionCard}
        onPress={() => navigation.navigate('RecordWaterQuality')}
        activeOpacity={0.85}
      >
        <View style={styles.actionIcon}>
          <Text style={styles.actionIconText}>➕</Text>
        </View>
        <View style={styles.actionBody}>
          <Text style={styles.actionTitle}>Ghi nhận thông số</Text>
          <Text style={styles.actionDesc}>
            pH, DO, Nhiệt độ, Độ mặn, Độ kiềm, NH3, NO2
          </Text>
        </View>
        <Text style={styles.chevron}>›</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.actionCard}
        onPress={() => navigation.navigate('RecordHistory')}
        activeOpacity={0.85}
      >
        <View style={styles.actionIcon}>
          <Text style={styles.actionIconText}>📈</Text>
        </View>
        <View style={styles.actionBody}>
          <Text style={styles.actionTitle}>Lịch sử chất lượng nước</Text>
          <Text style={styles.actionDesc}>Xem các thông số đo lường trong quá khứ</Text>
        </View>
        <Text style={styles.chevron}>›</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.actionCard, styles.actionCardDisabled]}
        activeOpacity={0.6}
        disabled
      >
        <View style={[styles.actionIcon, { backgroundColor: '#f1f5f9' }]}>
          <Text style={styles.actionIconText}>🔔</Text>
        </View>
        <View style={styles.actionBody}>
          <Text style={[styles.actionTitle, { color: '#94a3b8' }]}>
            Cảnh báo môi trường
          </Text>
          <Text style={styles.actionDesc}>Sắp ra mắt</Text>
        </View>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f9ff',
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },

  heroCard: {
    backgroundColor: '#0ea5e9',
    borderRadius: 24,
    padding: 28,
    alignItems: 'center',
    marginBottom: 28,
    shadowColor: '#0ea5e9',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 6,
  },
  heroEmoji: {
    fontSize: 48,
    marginBottom: 10,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: 6,
  },
  heroSubtitle: {
    fontSize: 13,
    color: '#e0f2fe',
    textAlign: 'center',
    lineHeight: 18,
  },

  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 12,
    marginLeft: 4,
  },

  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 18,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 2,
    gap: 14,
  },
  actionCardDisabled: {
    opacity: 0.65,
  },
  actionIcon: {
    width: 50,
    height: 50,
    borderRadius: 16,
    backgroundColor: '#e0f2fe',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionIconText: {
    fontSize: 22,
  },
  actionBody: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 3,
  },
  actionDesc: {
    fontSize: 12,
    color: '#64748b',
  },
  chevron: {
    fontSize: 22,
    color: '#94a3b8',
    fontWeight: '300',
  },
});
