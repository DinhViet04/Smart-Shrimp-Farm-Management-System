import React, { createContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

type AuthContextType = {
  userToken: string | null;
  userRole: string | null;
  userId: string | null;
  isLoading: boolean;
  login: (token: string, user: any) => Promise<void>;
  logout: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextType>({
  userToken: null,
  userRole: null,
  userId: null,
  isLoading: true,
  login: async () => {},
  logout: async () => {},
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [userToken, setUserToken] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadToken = async () => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      const role = await AsyncStorage.getItem('userRole');
      const storedUserId = await AsyncStorage.getItem('userId');
      if (token) {
        setUserToken(token);
        if (role) setUserRole(role);
        if (storedUserId) setUserId(storedUserId);
      }
    } catch (e) {
      console.error('Failed to load token', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadToken();
  }, []);

  const login = async (token: string, user: any) => {
    try {
      setIsLoading(true);
      await AsyncStorage.setItem('userToken', token);
      if (user?.role) {
        await AsyncStorage.setItem('userRole', user.role);
        setUserRole(user.role);
      }
      if (user?.id) {
        await AsyncStorage.setItem('userId', user.id);
        setUserId(user.id);
      }
      setUserToken(token);
    } catch (e) {
      console.error('Failed to save token', e);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      setIsLoading(true);
      // Gọi API logout lên backend
      const apiUrl = 'http://localhost:3000';
      if (userToken) {
        await fetch(`${apiUrl}/api/auth/logout`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${userToken}`,
          },
        }).catch(err => console.log('Logout API call failed:', err));
      }

      await AsyncStorage.removeItem('userToken');
      await AsyncStorage.removeItem('userRole');
      await AsyncStorage.removeItem('userId');
      setUserToken(null);
      setUserRole(null);
      setUserId(null);
    } catch (e) {
      console.error('Failed to remove token', e);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ userToken, userRole, userId, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => React.useContext(AuthContext);
