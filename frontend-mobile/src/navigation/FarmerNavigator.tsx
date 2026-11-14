/**
 * FarmerNavigator.tsx
 *
 * Dedicated navigator for FARMER role.
 * Business functions:
 *   - Tab 1: Cho ăn      — Ghi nhận cho ăn (FeedingLogScreen)
 *   - Tab 2: Kho         — Xem kho vật tư (InventoryScreen)
 *   - Tab 3: Sự cố       — Báo cáo & xem sự cố (IncidentStackNavigator)
 *   - Tab 4: Cài đặt    — Hồ sơ, bảo mật, hỗ trợ (SettingsScreen)
 */
import React from 'react';
import { Platform } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Utensils,
  Package,
  AlertTriangle,
  Settings,
  MessageSquare,
} from 'lucide-react-native';

import FeedingLogScreen from '../screens/feeding/FeedingLogScreen';
import InventoryScreen from '../screens/inventory/InventoryScreen';
import SettingsScreen from '../screens/SettingsScreen';
import ChatGroupScreen from '../screens/ChatGroupScreen';
import { useUnreadChatConversations } from '../hooks/useUnreadChatConversations';
import IncidentStackNavigator from './IncidentNavigator';
import BusinessHeader from '../components/BusinessHeader';

const Tab = createBottomTabNavigator();
const RootStack = createNativeStackNavigator();

function FarmerTabs() {
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
          if (route.name === 'Cho ăn') return <Utensils color={color} size={iconSize} />;
          if (route.name === 'Kho') return <Package color={color} size={iconSize} />;
          if (route.name === 'Sự cố') return <AlertTriangle color={color} size={iconSize} />;
          if (route.name === 'Nhóm Chat') return <MessageSquare color={color} size={iconSize} />;
          if (route.name === 'Cài đặt') return <Settings color={color} size={iconSize} />;
          return <Utensils color={color} size={iconSize} />;
        },
        tabBarShowLabel: true,
        tabBarActiveTintColor: '#059669',
        tabBarInactiveTintColor: '#94a3b8',
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
        tabBarStyle: {
          height: tabHeight,
          paddingBottom: bottomInset,
          paddingTop: 6,
          backgroundColor: '#ffffff',
          borderTopWidth: 1,
          borderTopColor: '#e2e8f0',
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
        name="Cho ăn"
        component={FeedingLogScreen}
        options={{
          headerShown: false,
          tabBarLabel: 'Cho ăn',
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
        name="Sự cố"
        component={IncidentStackNavigator}
        options={{
          headerShown: false,
          tabBarLabel: 'Sự cố',
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

export default function FarmerNavigator() {
  return (
    <RootStack.Navigator screenOptions={{ headerShown: false }}>
      <RootStack.Screen name="FarmerTabs" component={FarmerTabs} />
    </RootStack.Navigator>
  );
}
