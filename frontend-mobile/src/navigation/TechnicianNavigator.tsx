import React from 'react';
import { View, Platform } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Wrench,
  Settings,
  Droplets,
  AlertTriangle,
  TrendingUp,
  Package,
} from 'lucide-react-native';

import TechnicianScreen from '../screens/TechnicianScreen';
import SettingsScreen from '../screens/SettingsScreen';
import GrowthTrackingScreen from '../screens/growth/GrowthTrackingScreen';
import InventoryScreen from '../screens/inventory/InventoryScreen';
import { EnvironmentStackNavigator } from './MainNavigator';
import IncidentStackNavigator from './IncidentNavigator';
import NotificationButton from '../components/NotificationButton';

const Tab = createBottomTabNavigator();

export default function TechnicianNavigator() {
  const insets = useSafeAreaInsets();
  // Khoảng cách an toàn phía dưới cho Android navigation bar / gesture bar / iOS home bar
  const bottomInset = insets.bottom > 0 ? insets.bottom : (Platform.OS === 'android' ? 10 : 8);
  const tabHeight = 58 + bottomInset;

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerRight: () => <NotificationButton color="#312e81" />,
        tabBarIcon: ({ color }) => {
          const iconSize = 22;
          if (route.name === 'Dashboard') return <Wrench color={color} size={iconSize} />;
          if (route.name === 'Môi trường nước') return <Droplets color={color} size={iconSize} />;
          if (route.name === 'Theo dõi tăng trưởng') return <TrendingUp color={color} size={iconSize} />;
          if (route.name === 'Sự cố & Điều trị') return <AlertTriangle color={color} size={iconSize} />;
          if (route.name === 'Kho thức ăn') return <Package color={color} size={iconSize} />;
          if (route.name === 'Cài đặt') return <Settings color={color} size={iconSize} />;
        },
        tabBarShowLabel: true,
        tabBarActiveTintColor: '#4f46e5', // Deep Indigo
        tabBarInactiveTintColor: '#94a3b8',
        tabBarLabelStyle: {
          fontSize: 10,
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
        name="Dashboard"
        component={TechnicianScreen}
        options={{
          headerTitle: 'Tổng quan Kỹ thuật',
          tabBarLabel: 'Tổng quan',
        }}
      />
      <Tab.Screen
        name="Môi trường nước"
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
        name="Sự cố & Điều trị"
        component={IncidentStackNavigator}
        options={{
          headerShown: false,
          tabBarLabel: 'Sự cố',
        }}
      />
      <Tab.Screen
        name="Kho thức ăn"
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
