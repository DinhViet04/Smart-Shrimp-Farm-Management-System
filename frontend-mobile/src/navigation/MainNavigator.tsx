/**
 * MainNavigator.tsx
 *
 * Root navigator for Farm Managers and Administrators.
 * Architecture:
 *   RootStack (Native Stack)
 *    ├── MainTabs (Bottom Tab Navigator)
 *    │     ├── Dashboard (Tổng quan)
 *    │     ├── Ao/Vụ (Ao & Vụ nuôi)
 *    │     ├── Môi trường (EnvironmentStackNavigator)
 *    │     │     ├── EnvironmentHome (EnvironmentScreen)
 *    │     │     ├── RecordWaterQuality (RecordWaterQualityScreen)
 *    │     │     └── RecordHistory (RecordHistoryScreen)
 *    │     ├── Theo dõi tăng trưởng (GrowthTrackingScreen)
 *    │     ├── Sự cố (IncidentStackNavigator)
 *    │     ├── Kho vật tư (InventoryScreen)
 *    │     └── Cài đặt (SettingsScreen)
 *    ├── FeedingLog (FeedingLogScreen - Full screen log)
 *    └── ShrimpHealth (ShrimpHealthScreen - Full screen health check)
 */
import React from 'react';
import { Platform } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  LayoutDashboard,
  Waves,
  Thermometer,
  TrendingUp,
  AlertTriangle,
  Package,
  Settings,
} from 'lucide-react-native';

import DashboardScreen from '../screens/DashboardScreen';
import PondsScreen from '../screens/PondsScreen';
import EnvironmentScreen from '../screens/EnvironmentScreen';
import GrowthTrackingScreen from '../screens/growth/GrowthTrackingScreen';
import InventoryScreen from '../screens/inventory/InventoryScreen';
import SettingsScreen from '../screens/SettingsScreen';
import FeedingLogScreen from '../screens/feeding/FeedingLogScreen';
import ShrimpHealthScreen from '../screens/shrimp-health/ShrimpHealthScreen';
import RecordWaterQualityScreen from '../screens/water-quality/RecordWaterQualityScreen';
import RecordHistoryScreen from '../screens/water-quality/RecordHistoryScreen';
import IncidentStackNavigator from './IncidentNavigator';
import NotificationButton from '../components/NotificationButton';

const Tab = createBottomTabNavigator();
const RootStack = createNativeStackNavigator();
const EnvironmentStack = createNativeStackNavigator();

/**
 * Stack navigator for the Môi trường tab.
 * Allows pushing sub-screens (RecordWaterQuality, RecordHistory)
 * without breaking the bottom tab bar.
 */
export function EnvironmentStackNavigator() {
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
          headerStyle: {
            backgroundColor: '#ffffff',
          },
          headerTitleStyle: {
            fontWeight: 'bold',
            color: '#0f172a',
          },
          headerTintColor: '#2563eb',
        }}
      />
      <EnvironmentStack.Screen
        name="RecordHistory"
        component={RecordHistoryScreen}
        options={{
          title: 'Lịch sử chất lượng nước',
          headerStyle: {
            backgroundColor: '#ffffff',
          },
          headerTitleStyle: {
            fontWeight: 'bold',
            color: '#0f172a',
          },
          headerTintColor: '#2563eb',
        }}
      />
    </EnvironmentStack.Navigator>
  );
}

/**
 * Main 7-Tab Navigator for FARM_MANAGER / ADMIN
 */
function MainTabs() {
  const insets = useSafeAreaInsets();
  // Khoảng cách an toàn phía dưới cho Android navigation bar / gesture bar / iOS home bar
  const bottomInset = insets.bottom > 0 ? insets.bottom : (Platform.OS === 'android' ? 10 : 8);
  const tabHeight = 58 + bottomInset;

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerRight: () => <NotificationButton color="#0f172a" />,
        tabBarIcon: ({ color }) => {
          const iconSize = 21;
          if (route.name === 'Dashboard') return <LayoutDashboard color={color} size={iconSize} />;
          if (route.name === 'Ao/Vụ') return <Waves color={color} size={iconSize} />;
          if (route.name === 'Môi trường') return <Thermometer color={color} size={iconSize} />;
          if (route.name === 'Theo dõi tăng trưởng') return <TrendingUp color={color} size={iconSize} />;
          if (route.name === 'Sự cố') return <AlertTriangle color={color} size={iconSize} />;
          if (route.name === 'Kho vật tư') return <Package color={color} size={iconSize} />;
          if (route.name === 'Cài đặt') return <Settings color={color} size={iconSize} />;
          return <LayoutDashboard color={color} size={iconSize} />;
        },
        tabBarShowLabel: true,
        tabBarActiveTintColor: '#2563eb',
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
          borderTopColor: '#f1f5f9',
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
          borderBottomColor: '#f1f5f9',
        },
        headerTitleStyle: {
          fontWeight: 'bold',
          color: '#0f172a',
        },
      })}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{
          headerTitle: 'Tổng quan Trang trại',
          tabBarLabel: 'Tổng quan',
        }}
      />
      <Tab.Screen
        name="Ao/Vụ"
        component={PondsScreen}
        options={{
          headerTitle: 'Quản lý Ao & Vụ nuôi',
          tabBarLabel: 'Ao/Vụ',
        }}
      />
      <Tab.Screen
        name="Môi trường"
        component={EnvironmentStackNavigator}
        options={{
          headerShown: false,
          tabBarLabel: 'Môi trường',
        }}
      />
      <Tab.Screen
        name="Theo dõi tăng trưởng"
        component={GrowthTrackingScreen}
        options={{
          headerShown: false,
          tabBarLabel: 'Tăng trưởng',
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
        name="Kho vật tư"
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
          headerTitle: 'Cài đặt hệ thống',
          tabBarLabel: 'Cài đặt',
        }}
      />
    </Tab.Navigator>
  );
}

/**
 * Root Stack for Authenticated Managers/Admins
 * Allows full-screen views (FeedingLog, ShrimpHealth) without tab bar clashing
 */
export default function MainNavigator() {
  return (
    <RootStack.Navigator screenOptions={{ headerShown: false }}>
      <RootStack.Screen name="MainTabs" component={MainTabs} />
      <RootStack.Screen name="FeedingLog" component={FeedingLogScreen} />
      <RootStack.Screen name="ShrimpHealth" component={ShrimpHealthScreen} />
    </RootStack.Navigator>
  );
}
