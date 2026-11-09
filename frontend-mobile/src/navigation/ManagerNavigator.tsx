/**
 * ManagerNavigator.tsx
 *
 * Dedicated navigator for FARM_MANAGER role.
 * Business functions:
 *   - Tab 1: Trang trại     — Xem farms/ao, tạo vụ nuôi (FarmManagementScreen)
 *   - Tab 2: Môi trường     — Xem thông số nước (view-only, no record)
 *   - Tab 3: Tình trạng tôm — Xem tăng trưởng + sức khoẻ (view-only, ShrimpStatusScreen)
 *   - Tab 4: Sự cố          — Xem & phân công sự cố từ farmer + technician
 *   - Tab 5: Kho            — Quản lý vật tư, thêm vật tư mới, nhập/xuất kho (InventoryScreen)
 *   - Tab 6: Cài đặt        — Hồ sơ, bảo mật, hỗ trợ, workspace nhân sự
 */
import React from 'react';
import { Platform } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Building2,
  Thermometer,
  HeartPulse,
  ShieldAlert,
  Package,
  Settings,
} from 'lucide-react-native';

import FarmManagementScreen from '../screens/manager/FarmManagementScreen';
import ShrimpStatusScreen from '../screens/manager/ShrimpStatusScreen';
import WorkspaceScreen from '../screens/manager/WorkspaceScreen';
import EnvironmentScreen from '../screens/EnvironmentScreen';
import RecordHistoryScreen from '../screens/water-quality/RecordHistoryScreen';
import InventoryScreen from '../screens/inventory/InventoryScreen';
import SettingsScreen from '../screens/SettingsScreen';
import IncidentStackNavigator from './IncidentNavigator';
import BusinessHeader from '../components/BusinessHeader';

const Tab = createBottomTabNavigator();
const RootStack = createNativeStackNavigator();
const EnvironmentViewStack = createNativeStackNavigator();

/**
 * Manager's Environment Stack: view-only (no RecordWaterQuality screen)
 */
function ManagerEnvironmentStack() {
  return (
    <EnvironmentViewStack.Navigator>
      <EnvironmentViewStack.Screen
        name="EnvironmentHome"
        component={EnvironmentScreen}
        options={{ headerShown: false }}
      />
      <EnvironmentViewStack.Screen
        name="RecordHistory"
        component={RecordHistoryScreen}
        options={{
          title: 'Lịch sử chất lượng nước',
          headerStyle: { backgroundColor: '#ffffff' },
          headerTitleStyle: { fontWeight: 'bold', color: '#0f172a' },
          headerTintColor: '#2563eb',
        }}
      />
    </EnvironmentViewStack.Navigator>
  );
}

function ManagerTabs() {
  const insets = useSafeAreaInsets();
  const bottomInset = insets.bottom > 0 ? insets.bottom : (Platform.OS === 'android' ? 10 : 8);
  const tabHeight = 58 + bottomInset;

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        header: () => <BusinessHeader title={route.name} />,
        tabBarIcon: ({ color }) => {
          const iconSize = 21;
          if (route.name === 'Trang trại') return <Building2 color={color} size={iconSize} />;
          if (route.name === 'Môi trường') return <Thermometer color={color} size={iconSize} />;
          if (route.name === 'Tình trạng tôm') return <HeartPulse color={color} size={iconSize} />;
          if (route.name === 'Sự cố') return <ShieldAlert color={color} size={iconSize} />;
          if (route.name === 'Kho') return <Package color={color} size={iconSize} />;
          if (route.name === 'Cài đặt') return <Settings color={color} size={iconSize} />;
          return <Building2 color={color} size={iconSize} />;
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
      })}
    >
      <Tab.Screen
        name="Trang trại"
        component={FarmManagementScreen}
        options={{
          headerTitle: 'Trang trại',
          tabBarLabel: 'Trang trại',
        }}
      />
      <Tab.Screen
        name="Môi trường"
        component={ManagerEnvironmentStack}
        options={{
          headerShown: false,
          tabBarLabel: 'Môi trường',
        }}
      />
      <Tab.Screen
        name="Tình trạng tôm"
        component={ShrimpStatusScreen}
        options={{
          headerTitle: 'Tình trạng tôm',
          tabBarLabel: 'Tôm',
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
          headerTitle: 'Cài đặt',
          tabBarLabel: 'Cài đặt',
        }}
      />
    </Tab.Navigator>
  );
}

export default function ManagerNavigator() {
  return (
    <RootStack.Navigator screenOptions={{ headerShown: false }}>
      <RootStack.Screen name="ManagerTabs" component={ManagerTabs} />
      {/* Workspace screen accessible from Settings > Quản lý nhân sự */}
      <RootStack.Screen
        name="Workspace"
        component={WorkspaceScreen}
        options={{
          headerShown: true,
          title: 'Quản lý nhân sự',
          headerStyle: { backgroundColor: '#ffffff' },
          headerTitleStyle: { fontWeight: 'bold', color: '#0f172a' },
          headerTintColor: '#2563eb',
        }}
      />
    </RootStack.Navigator>
  );
}

