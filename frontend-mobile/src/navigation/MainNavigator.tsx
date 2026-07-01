import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer } from '@react-navigation/native'; // Not used here anymore
import { LayoutDashboard, Waves, LineChart, Thermometer, Bot, Settings } from 'lucide-react-native';

import DashboardScreen from '../screens/DashboardScreen';
import PondsScreen from '../screens/PondsScreen';
import FiveTCareScreen from '../screens/FiveTCareScreen';
import EnvironmentScreen from '../screens/EnvironmentScreen';
import ChatbotScreen from '../screens/ChatbotScreen';
import SettingsScreen from '../screens/SettingsScreen';

const Tab = createBottomTabNavigator();

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
        <Tab.Screen name="Môi trường" component={EnvironmentScreen} />
        <Tab.Screen name="AI" component={ChatbotScreen} />
        <Tab.Screen name="Cài đặt" component={SettingsScreen} />
      </Tab.Navigator>
  );
}
