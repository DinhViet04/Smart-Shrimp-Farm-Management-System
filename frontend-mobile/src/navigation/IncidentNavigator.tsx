import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import IncidentListScreen from '../screens/incidents/IncidentListScreen';
import IncidentDetailScreen from '../screens/incidents/IncidentDetailScreen';
import IncidentCreateScreen from '../screens/incidents/IncidentCreateScreen';

export type IncidentStackParamList = {
  IncidentList: undefined;
  IncidentDetail: { incidentId: string };
  IncidentCreate: undefined;
};

const Stack = createNativeStackNavigator<IncidentStackParamList>();

export default function IncidentStackNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="IncidentList"
        component={IncidentListScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="IncidentDetail"
        component={IncidentDetailScreen}
        options={{
          title: 'Chi tiết sự cố',
          headerStyle: { backgroundColor: '#ffffff' },
          headerTitleStyle: { fontWeight: 'bold', color: '#0f172a' },
          headerTintColor: '#dc2626',
        }}
      />
      <Stack.Screen
        name="IncidentCreate"
        component={IncidentCreateScreen}
        options={{
          title: 'Báo cáo sự cố',
          headerStyle: { backgroundColor: '#ffffff' },
          headerTitleStyle: { fontWeight: 'bold', color: '#0f172a' },
          headerTintColor: '#dc2626',
        }}
      />
    </Stack.Navigator>
  );
}
