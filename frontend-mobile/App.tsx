import React, { useContext } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import MainNavigator from './src/navigation/MainNavigator';
import AuthNavigator from './src/navigation/AuthNavigator';
import TechnicianNavigator from './src/navigation/TechnicianNavigator';
import { AuthProvider, AuthContext } from './src/context/AuthContext';
import { NavigationContainer } from '@react-navigation/native';
import FloatingAIChatModal from './src/components/FloatingAIChatModal';

function RootNavigator() {
  const { userToken, userRole, isLoading } = useContext(AuthContext);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  const renderNavigator = () => {
    if (!userToken) return <AuthNavigator />;
    if (userRole === 'TECHNICIAN') return <TechnicianNavigator />;
    return <MainNavigator />;
  };

  return (
    // Root container phải fill toàn màn hình để absolute children hoạt động
    <View style={styles.root}>
      <NavigationContainer>
        {renderNavigator()}
      </NavigationContainer>

      {/* Floating Mascot AI Button - hiển thị toàn cục khi đã đăng nhập */}
      {!!userToken && (
        <View style={styles.floatingPortal} pointerEvents="box-none">
          <FloatingAIChatModal />
        </View>
      )}
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
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Portal layer nằm trên NavContainer, fill toàn màn, pointerEvents=box-none
  // để touch pass-through trừ bản thân các children có touchable
  floatingPortal: {
    ...StyleSheet.absoluteFill,
    zIndex: 9999,
    elevation: 9999,
  },
});
