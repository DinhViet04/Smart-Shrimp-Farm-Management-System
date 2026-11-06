import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import { TrendingUp, HeartPulse } from 'lucide-react-native';
import GrowthTrackingScreen from '../growth/GrowthTrackingScreen';
import ShrimpHealthScreen from '../shrimp-health/ShrimpHealthScreen';

type SubTab = 'GROWTH' | 'HEALTH';

const TABS: { key: SubTab; label: string; icon: any }[] = [
  { key: 'GROWTH', label: 'Tăng trưởng', icon: TrendingUp },
  { key: 'HEALTH', label: 'Sức khỏe tôm', icon: HeartPulse },
];

export default function ShrimpStatusScreen() {
  const [activeTab, setActiveTab] = useState<SubTab>('GROWTH');

  return (
    <SafeAreaView style={styles.container}>
      {/* Sub Tab Bar */}
      <View style={styles.tabBar}>
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          const Icon = tab.icon;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tabItem, isActive && styles.tabItemActive]}
              onPress={() => setActiveTab(tab.key)}
              activeOpacity={0.8}
            >
              <Icon size={16} color={isActive ? '#2563eb' : '#94a3b8'} />
              <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Content */}
      <View style={styles.tabContent}>
        {activeTab === 'GROWTH' ? (
          <GrowthTrackingScreen />
        ) : (
          <ShrimpHealthScreen />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  tabItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabItemActive: {
    borderBottomColor: '#2563eb',
  },
  tabLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#94a3b8',
  },
  tabLabelActive: {
    color: '#2563eb',
    fontWeight: '700',
  },
  tabContent: {
    flex: 1,
  },
});
