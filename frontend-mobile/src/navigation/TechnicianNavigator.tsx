/**
 * TechnicianNavigator.tsx
 *
 * Dedicated navigator for TECHNICIAN role.
 * Business functions:
 *   - Tab 1: Môi trường nước  — Ghi nhận + xem lịch sử chất lượng nước
 *   - Tab 2: Tăng trưởng     — Ghi nhận theo dõi tăng trưởng
 *   - Tab 3: Sức khoẻ tôm    — Ghi nhận sức khoẻ tôm
 *   - Tab 4: Sự cố           — Báo cáo sự cố + xem list
 *   - Tab 5: Kho             — Xem tồn kho và ghi nhận sử dụng vật tư
 *   - Tab 6: Cài đặt        — Hồ sơ, bảo mật và hỗ trợ
 */
import React from 'react';
import { Platform } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Droplets,
  TrendingUp,
  HeartPulse,
  AlertTriangle,
  Package,
  Settings,
  MessageSquare,
} from 'lucide-react-native';

import SettingsScreen from '../screens/SettingsScreen';
import ChatGroupScreen from '../screens/ChatGroupScreen';
import { useUnreadChatConversations } from '../hooks/useUnreadChatConversations';
import ShrimpHealthScreen from '../screens/shrimp-health/ShrimpHealthScreen';
import GrowthTrackingScreen from '../screens/growth/GrowthTrackingScreen';
import InventoryScreen from '../screens/inventory/InventoryScreen';
import EnvironmentScreen from '../screens/EnvironmentScreen';
import RecordWaterQualityScreen from '../screens/water-quality/RecordWaterQualityScreen';
import RecordHistoryScreen from '../screens/water-quality/RecordHistoryScreen';
import IncidentStackNavigator from './IncidentNavigator';
import BusinessHeader from '../components/BusinessHeader';

const Tab = createBottomTabNavigator();
const RootStack = createNativeStackNavigator();
const EnvironmentStack = createNativeStackNavigator();

/**
 * Technician's Environment Stack: includes RecordWaterQuality & RecordHistory
 */
function EnvironmentStackNavigator() {
  return (
    <EnvironmentStack.Navigator>
      <EnvironmentStack.Screen
        name="EnvironmentHome"
        component={EnvironmentScreen}
        options={{ headerShown: false }}
      />
      <EnvironmentStack.Screen
        name="RecordWaterQuality"
        component={RecordWaterQualityScreen}
        options={{
          title: 'Ghi nhận thông số',
          headerStyle: { backgroundColor: '#ffffff' },
          headerTitleStyle: { fontWeight: 'bold', color: '#0f172a' },
          headerTintColor: '#2563eb',
        }}
      />
      <EnvironmentStack.Screen
        name="RecordHistory"
        component={RecordHistoryScreen}
        options={{
          title: 'Lịch sử chất lượng nước',
          headerStyle: { backgroundColor: '#ffffff' },
          headerTitleStyle: { fontWeight: 'bold', color: '#0f172a' },
          headerTintColor: '#2563eb',
        }}
      />
    </EnvironmentStack.Navigator>
  );
}

function TechnicianTabs() {
  const { unreadConversationCount, setChatOpen } = useUnreadChatConversations();
  const insets = useSafeAreaInsets();
  const bottomInset = insets.bottom > 0 ? insets.bottom : (Platform.OS === 'android' ? 10 : 8);
  const tabHeight = 58 + bottomInset;

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        header: () => <BusinessHeader title={route.name} />,
        tabBarIcon: ({ color }) => {
          const iconSize = 22;
          if (route.name === 'Môi trường nước') return <Droplets color={color} size={iconSize} />;
          if (route.name === 'Tăng trưởng') return <TrendingUp color={color} size={iconSize} />;
          if (route.name === 'Sức khoẻ') return <HeartPulse color={color} size={iconSize} />;
          if (route.name === 'Sự cố') return <AlertTriangle color={color} size={iconSize} />;
          if (route.name === 'Kho') return <Package color={color} size={iconSize} />;
          if (route.name === 'Nhóm Chat') return <MessageSquare color={color} size={iconSize} />;
          if (route.name === 'Cài đặt') return <Settings color={color} size={iconSize} />;
          return <Droplets color={color} size={iconSize} />;
        },
        tabBarShowLabel: true,
        tabBarActiveTintColor: '#4f46e5',
        tabBarInactiveTintColor: '#94a3b8',
        tabBarLabelStyle: {
          fontSize: 9.5,
          fontWeight: '600',
        },
        tabBarStyle: {
          height: tabHeight,
          paddingBottom: bottomInset,
          paddingTop: 6,
          backgroundColor: '#ffffff',
          borderTopWidth: 1,
          borderTopColor: '#e0e7ff',
          elevation: 8,
          shadowColor: '#000000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.05,
          shadowRadius: 4,
        },
        headerShown: true,
      })}
    >
      <Tab.Screen
        name="Môi trường nước"
        component={EnvironmentStackNavigator}
        options={{
          headerShown: false,
          tabBarLabel: 'Môi trường',
        }}
      />
      <Tab.Screen
        name="Tăng trưởng"
        component={GrowthTrackingScreen}
        options={{
          headerShown: false,
          tabBarLabel: 'Tăng trưởng',
        }}
      />
      <Tab.Screen
        name="Sức khoẻ"
        component={ShrimpHealthScreen}
        options={{
          headerShown: false,
          tabBarLabel: 'Sức khoẻ',
        }}
      />
      <Tab.Screen
        name="Sự cố"
        component={IncidentStackNavigator}
        options={{
          headerShown: false,
          tabBarLabel: 'Sự cố',
        }}
      />
      <Tab.Screen
        name="Kho"
        component={InventoryScreen}
        options={{
          headerShown: false,
          tabBarLabel: 'Kho',
        }}
      />
      <Tab.Screen
        name="Nhóm Chat"
        component={ChatGroupScreen}
        options={{
          headerTitle: 'Nhóm Chat Trang Trại',
          tabBarLabel: 'Nhóm Chat',
          tabBarBadge: unreadConversationCount > 0 ? unreadConversationCount : undefined,
        }}
        listeners={{
          focus: () => setChatOpen(true),
          blur: () => setChatOpen(false),
        }}
      />
      <Tab.Screen
        name="Cài đặt"
        component={SettingsScreen}
        options={{
          headerTitle: 'Cài đặt',
          tabBarLabel: 'Cài đặt',
        }}
      />
    </Tab.Navigator>
  );
}

export default function TechnicianNavigator() {
  return (
    <RootStack.Navigator screenOptions={{ headerShown: false }}>
      <RootStack.Screen name="TechnicianTabs" component={TechnicianTabs} />
    </RootStack.Navigator>
  );
}
