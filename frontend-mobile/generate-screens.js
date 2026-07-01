const fs = require('fs');
const path = require('path');

const screensDir = path.join(__dirname, 'src', 'screens');
if (!fs.existsSync(screensDir)) {
  fs.mkdirSync(screensDir, { recursive: true });
}

const screens = [
  'Dashboard',
  'Ponds',
  'FiveTCare',
  'Environment',
  'Chatbot',
  'Settings'
];

screens.forEach(screen => {
  const content = `import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function ${screen}Screen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>${screen} (Đang phát triển)</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#334155',
  },
});
`;
  fs.writeFileSync(path.join(screensDir, `${screen}Screen.tsx`), content);
});

// Update DashboardScreen to look like the web dashboard
const dashboardContent = `import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Activity, TrendingUp, AlertCircle } from 'lucide-react-native';

export default function DashboardScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <Text style={styles.greeting}>Xin chào, Nông Dân A</Text>
      <Text style={styles.subtitle}>Trại tôm Bạc Liêu</Text>

      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <View style={styles.statHeader}>
            <View style={[styles.iconContainer, { backgroundColor: '#ecfdf5' }]}>
              <Activity color="#10b981" size={24} />
            </View>
            <Text style={styles.statusBadge}>Ổn định</Text>
          </View>
          <Text style={styles.statTitle}>Tỷ lệ sống ước tính</Text>
          <View style={styles.statValueContainer}>
            <Text style={styles.statValue}>89<Text style={styles.statUnit}>%</Text></Text>
            <Text style={styles.statTrend}>+2.4%</Text>
          </View>
        </View>

        <View style={styles.statCard}>
          <View style={styles.statHeader}>
            <View style={[styles.iconContainer, { backgroundColor: '#eff6ff' }]}>
              <TrendingUp color="#3b82f6" size={24} />
            </View>
            <Text style={[styles.statusBadge, { color: '#3b82f6', backgroundColor: '#eff6ff', borderColor: '#bfdbfe' }]}>Tốt</Text>
          </View>
          <Text style={styles.statTitle}>FCR Hiện tại</Text>
          <View style={styles.statValueContainer}>
            <Text style={styles.statValue}>1.12</Text>
            <Text style={styles.statTrend}>-0.05</Text>
          </View>
        </View>

        <View style={[styles.statCard, { backgroundColor: '#f59e0b', borderColor: '#fbbf24' }]}>
          <View style={styles.statHeader}>
            <View style={[styles.iconContainer, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
              <AlertCircle color="#ffffff" size={24} />
            </View>
          </View>
          <Text style={[styles.statTitle, { color: '#fef3c7' }]}>Trạng thái Môi trường</Text>
          <Text style={[styles.statValue, { color: '#ffffff', fontSize: 24 }]}>Cần hiệu chỉnh Oxy ao B2</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  contentContainer: {
    padding: 20,
  },
  greeting: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  subtitle: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 20,
  },
  statsContainer: {
    gap: 15,
  },
  statCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  statHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 15,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusBadge: {
    backgroundColor: '#ecfdf5',
    color: '#059669',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 'bold',
    borderWidth: 1,
    borderColor: '#d1fae5',
  },
  statTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
    marginBottom: 5,
  },
  statValueContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  statValue: {
    fontSize: 36,
    fontWeight: '900',
    color: '#0f172a',
  },
  statUnit: {
    fontSize: 20,
    color: '#94a3b8',
  },
  statTrend: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#10b981',
    marginBottom: 6,
  },
});
`;
fs.writeFileSync(path.join(screensDir, 'DashboardScreen.tsx'), dashboardContent);

console.log('Screens generated successfully.');
