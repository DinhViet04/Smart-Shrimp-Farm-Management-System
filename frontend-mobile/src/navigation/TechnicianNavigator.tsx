import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Wrench, Settings } from 'lucide-react-native';

import TechnicianScreen from '../screens/TechnicianScreen';
import SettingsScreen from '../screens/SettingsScreen';

const Tab = createBottomTabNavigator();

export default function TechnicianNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ color, size }) => {
          if (route.name === 'Dashboard') return <Wrench color={color} size={size} />;
          if (route.name === 'Cài đặt') return <Settings color={color} size={size} />;
        },
        tabBarActiveTintColor: '#6366f1', // Indigo
        tabBarInactiveTintColor: '#94a3b8',
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
        },
      })}
    >
      <Tab.Screen name="Dashboard" component={TechnicianScreen} />
      <Tab.Screen name="Cài đặt" component={SettingsScreen} />
    </Tab.Navigator>
  );
}
