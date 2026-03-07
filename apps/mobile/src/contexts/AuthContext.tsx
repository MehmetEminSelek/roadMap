import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authService } from '@/services/authService';
import { STORAGE_KEYS, tokenStorage } from '@/services/apiClient';
import type { User } from '@/types/api';

interface AuthContextValue {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name?: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const isAuthenticated = !!token && !!user;

  // Check stored token on mount
  useEffect(() => {
    const restoreSession = async () => {
      try {
        const storedToken = await tokenStorage.getToken();
        if (storedToken) {
          setToken(storedToken);
          try {
            const profile = await authService.getProfile();
            setUser(profile);
          } catch {
            // Token might be invalid after API restart, try auto-login in dev
            if (__DEV__) {
              await tokenStorage.removeToken();
              await devAutoLogin();
            } else {
              await tokenStorage.removeToken();
              setToken(null);
              setUser(null);
            }
          }
        } else if (__DEV__) {
          await devAutoLogin();
        }
      } catch {
        await tokenStorage.removeToken();
        await AsyncStorage.removeItem(STORAGE_KEYS.USER_DATA);
        setToken(null);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    const devAutoLogin = async () => {
      const MAX_RETRIES = 3;
      for (let i = 0; i < MAX_RETRIES; i++) {
        try {
          const result = await authService.login({
            email: 'admin@roadmap.com',
            password: 'Test1234',
          });
          await tokenStorage.setToken(result.token);
          setToken(result.token);
          setUser(result.user);
          return;
        } catch {
          if (i < MAX_RETRIES - 1) {
            await new Promise(r => setTimeout(r, 2000));
          }
        }
      }
      // All retries failed
      setToken(null);
      setUser(null);
    };

    restoreSession();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const result = await authService.login({ email, password });
    await tokenStorage.setToken(result.token);
    setToken(result.token);
    setUser(result.user);
  }, []);

  const register = useCallback(async (email: string, password: string, name?: string) => {
    const result = await authService.register({ email, password, name });
    await tokenStorage.setToken(result.token);
    setToken(result.token);
    setUser(result.user);
  }, []);

  const logout = useCallback(async () => {
    await tokenStorage.removeToken();
    await AsyncStorage.removeItem(STORAGE_KEYS.USER_DATA);
    setToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, token, isLoading, isAuthenticated, login, register, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
