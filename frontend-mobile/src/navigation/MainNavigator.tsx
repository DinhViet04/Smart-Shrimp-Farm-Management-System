/**
 * MainNavigator.tsx
 *
 * Root navigator for authenticated users.
 * Structure:
 *   BottomTab
 *    ├── Dashboard
 *    ├── Ao/Vụ
 *    ├── 5T Care
 *    ├── Môi trường  ← Stack navigator wrapping EnvironmentScreen
 *    │     ├── EnvironmentHome  (EnvironmentScreen)
 *    │     └── RecordWaterQuality  (RecordWaterQualityScreen)
 *    ├── AI
 *    └── Cài đặt
 */
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { LayoutDashboard, Waves, LineChart, Thermometer, Bot, Settings } from 'lucide-react-native';

import DashboardScreen from '../screens/DashboardScreen';
import PondsScreen from '../screens/PondsScreen';
import FiveTCareScreen from '../screens/FiveTCareScreen';
import EnvironmentScreen from '../screens/EnvironmentScreen';
import ChatbotScreen from '../screens/ChatbotScreen';
import SettingsScreen from '../screens/SettingsScreen';
import RecordWaterQualityScreen from '../screens/water-quality/RecordWaterQualityScreen';
import RecordHistoryScreen from '../screens/water-quality/RecordHistoryScreen';

const Tab = createBottomTabNavigator();
const EnvironmentStack = createNativeStackNavigator();

/**
 * Stack navigator for the Môi trường tab.
 * Allows pushing sub-screens (RecordWaterQuality, future History, etc.)
 * without breaking the bottom tab bar.
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

export default function MainNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ color, size }) => {
          if (route.name === 'Dashboard') return <LayoutDashboard color={color} size={size} />;
          if (route.name === 'Ao/Vụ') return <Waves color={color} size={size} />;
          if (route.name === '5T Care') return <LineChart color={color} size={size} />;
          if (route.name === 'Môi trường') return <Thermometer color={color} size={size} />;
          if (route.name === 'AI') return <Bot color={color} size={size} />;
          if (route.name === 'Cài đặt') return <Settings color={color} size={size} />;
        },
        tabBarActiveTintColor: '#2563eb',
        tabBarInactiveTintColor: '#94a3b8',
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
      <Tab.Screen name="Dashboard" component={DashboardScreen} />
      <Tab.Screen name="Ao/Vụ" component={PondsScreen} />
      <Tab.Screen name="5T Care" component={FiveTCareScreen} />
      {/*
       * Môi trường tab uses its own stack so child screens
       * (RecordWaterQuality, History, etc.) can be pushed without
       * losing the bottom tab bar.
       */}
      <Tab.Screen
        name="Môi trường"
        component={EnvironmentStackNavigator}
        options={{ headerShown: false }}
      />
      <Tab.Screen name="AI" component={ChatbotScreen} />
      <Tab.Screen name="Cài đặt" component={SettingsScreen} />
    </Tab.Navigator>
  );
}
