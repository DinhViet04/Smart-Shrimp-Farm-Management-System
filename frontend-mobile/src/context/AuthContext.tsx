import React, { createContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../config/api';

type AuthContextType = {
  userToken: string | null;
  userRole: string | null;
  userId: string | null;
  currentUser: any | null;
  isLoading: boolean;
  login: (token: string, user: any, refreshToken?: string) => Promise<void>;
  logout: () => Promise<void>;
  updateCurrentUser: (userData: any) => Promise<void>;
};

export const AuthContext = createContext<AuthContextType>({
  userToken: null,
  userRole: null,
  userId: null,
  currentUser: null,
  isLoading: true,
  login: async () => {},
  logout: async () => {},
  updateCurrentUser: async () => {},
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [userToken, setUserToken] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadToken = async () => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      const role = await AsyncStorage.getItem('userRole');
      const storedUserId = await AsyncStorage.getItem('userId');
      const storedUserStr = await AsyncStorage.getItem('user');

      if (token) {
        setUserToken(token);
        if (role) setUserRole(role);

        let resolvedUserId = storedUserId;
        if (storedUserStr) {
          try {
            const parsed = JSON.parse(storedUserStr);
            setCurrentUser(parsed);
            if (!resolvedUserId && (parsed?.id || parsed?.userId)) {
              resolvedUserId = parsed.id || parsed.userId;
            }
          } catch {
            // ignore JSON parse error
          }
        }
        if (resolvedUserId) {
          setUserId(resolvedUserId);
          await AsyncStorage.setItem('userId', resolvedUserId);
        }
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

  const login = async (token: string, user: any, refreshToken?: string) => {
    try {
      setIsLoading(true);
      await AsyncStorage.setItem('userToken', token);
      if (refreshToken) {
        await AsyncStorage.setItem('refreshToken', refreshToken);
      }
      if (user?.role) {
        await AsyncStorage.setItem('userRole', user.role);
        setUserRole(user.role);
      }
      const uid = user?.id || user?.userId;
      if (uid) {
        await AsyncStorage.setItem('userId', uid);
        setUserId(uid);
      }
      if (user) {
        await AsyncStorage.setItem('user', JSON.stringify(user));
        setCurrentUser(user);
      }
      setUserToken(token);
    } catch (e) {
      console.error('Failed to save token', e);
    } finally {
      setIsLoading(false);
    }
  };

  const updateCurrentUser = async (userData: any) => {
    try {
      const merged = { ...currentUser, ...userData };
      await AsyncStorage.setItem('user', JSON.stringify(merged));
      setCurrentUser(merged);
    } catch (e) {
      console.error('Failed to update current user', e);
    }
  };

  const logout = async () => {
    try {
      setIsLoading(true);
      const storedRefreshToken = await AsyncStorage.getItem('refreshToken');
      if (userToken) {
        await fetch(`${API_BASE_URL}/api/auth/logout`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${userToken}`,
          },
          body: JSON.stringify({ refreshToken: storedRefreshToken }),
        }).catch((err) => console.log('Logout API call failed:', err));
      }

      await AsyncStorage.removeItem('userToken');
      await AsyncStorage.removeItem('refreshToken');
      await AsyncStorage.removeItem('userRole');
      await AsyncStorage.removeItem('userId');
      await AsyncStorage.removeItem('user');
      setUserToken(null);
      setUserRole(null);
      setUserId(null);
      setCurrentUser(null);
    } catch (e) {
      console.error('Failed to remove token', e);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        userToken,
        userRole,
        userId,
        currentUser,
        isLoading,
        login,
        logout,
        updateCurrentUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => React.useContext(AuthContext);
