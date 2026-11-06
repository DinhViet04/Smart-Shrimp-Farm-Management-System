import React, { useContext } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import ManagerNavigator from './src/navigation/ManagerNavigator';
import AuthNavigator from './src/navigation/AuthNavigator';
import TechnicianNavigator from './src/navigation/TechnicianNavigator';
import FarmerNavigator from './src/navigation/FarmerNavigator';
import { AuthProvider, AuthContext } from './src/context/AuthContext';
import { NavigationContainer } from '@react-navigation/native';
import FloatingAIChatModal from './src/components/FloatingAIChatModal';

function RootNavigator() {
  const { userToken, userRole, isLoading, isViewingHome } = useContext(AuthContext);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  // Khi chưa đăng nhập -> Hiển thị AuthNavigator (Home -> Login / Register)
  if (!userToken) {
    return (
      <NavigationContainer>
        <AuthNavigator />
      </NavigationContainer>
    );
  }

  // Khi ĐÃ đăng nhập nhưng người dùng bấm logo để về xem lại trang Home
  if (isViewingHome) {
    return (
      <NavigationContainer>
        <AuthNavigator />
      </NavigationContainer>
    );
  }

  // Phân quyền theo role khi đã đăng nhập
  const renderRoleNavigator = () => {
    if (userRole === 'TECHNICIAN') return <TechnicianNavigator />;
    if (userRole === 'FARMER') return <FarmerNavigator />;
    if (userRole === 'FARM_MANAGER') return <ManagerNavigator />;
    return <AuthNavigator />;
  };

  return (
    <View style={styles.root}>
      <NavigationContainer>
        {renderRoleNavigator()}
      </NavigationContainer>

      {/* Floating Mascot AI Button - hiển thị khi đã đăng nhập */}
      <View style={styles.floatingPortal} pointerEvents="box-none">
        <FloatingAIChatModal />
      </View>
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="auto" />
        <RootNavigator />
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    position: 'relative',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  floatingPortal: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
  },
});
