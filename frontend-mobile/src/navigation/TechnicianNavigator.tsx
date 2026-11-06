/**
 * TechnicianNavigator.tsx
 *
 * Dedicated navigator for TECHNICIAN role.
 * Business functions:
 *   - Tab 1: Môi trường nước  — Ghi nhận + xem lịch sử chất lượng nước
 *   - Tab 2: Tăng trưởng     — Ghi nhận theo dõi tăng trưởng
 *   - Tab 3: Sức khoẻ tôm    — Ghi nhận sức khoẻ tôm
 *   - Tab 4: Sự cố           — Báo cáo sự cố + xem list
 *   - Tab 5: Kho             — Xem kho vật tư
 *   - Tab 6: Cài đặt         — Hồ sơ, bảo mật, hỗ trợ
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
} from 'lucide-react-native';

import SettingsScreen from '../screens/SettingsScreen';
import ShrimpHealthScreen from '../screens/shrimp-health/ShrimpHealthScreen';
import GrowthTrackingScreen from '../screens/growth/GrowthTrackingScreen';
import InventoryScreen from '../screens/inventory/InventoryScreen';
import IncidentStackNavigator from './IncidentNavigator';
import { EnvironmentStackNavigator } from './MainNavigator';
import NotificationButton from '../components/NotificationButton';
import HeaderLogo from '../components/HeaderLogo';

const Tab = createBottomTabNavigator();
const RootStack = createNativeStackNavigator();

function TechnicianTabs() {
  const insets = useSafeAreaInsets();
  const bottomInset = insets.bottom > 0 ? insets.bottom : (Platform.OS === 'android' ? 10 : 8);
  const tabHeight = 58 + bottomInset;

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerLeft: () => <HeaderLogo size={32} showText={true} textColor="#312e81" />,
        headerRight: () => <NotificationButton color="#4f46e5" />,
        tabBarIcon: ({ color }) => {
          const iconSize = 22;
          if (route.name === 'Môi trường nước') return <Droplets color={color} size={iconSize} />;
          if (route.name === 'Tăng trưởng') return <TrendingUp color={color} size={iconSize} />;
          if (route.name === 'Sức khoẻ') return <HeartPulse color={color} size={iconSize} />;
          if (route.name === 'Sự cố') return <AlertTriangle color={color} size={iconSize} />;
          if (route.name === 'Kho') return <Package color={color} size={iconSize} />;
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
        headerStyle: {
          backgroundColor: '#ffffff',
          elevation: 0,
          shadowOpacity: 0,
          borderBottomWidth: 1,
          borderBottomColor: '#e0e7ff',
        },
        headerTitleStyle: {
          fontWeight: 'bold',
          color: '#312e81',
          fontSize: 16,
        },
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
        name="Cài đặt"
        component={SettingsScreen}
        options={{
          headerTitle: 'Cài đặt tài khoản',
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
