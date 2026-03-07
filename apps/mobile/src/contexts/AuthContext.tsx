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
          const profile = await authService.getProfile();
          setUser(profile);
        } else if (__DEV__) {
          // Auto-login with test credentials during development
          try {
            const result = await authService.login({
              email: 'admin@roadmap.com',
              password: 'Test1234',
            });
            await tokenStorage.setToken(result.token);
            setToken(result.token);
            setUser(result.user);
          } catch {
            // Dev auto-login failed, proceed without authentication
            setToken(null);
            setUser(null);
          }
        }
      } catch {
        // Token expired or invalid, clear storage
        await tokenStorage.removeToken();
        await AsyncStorage.removeItem(STORAGE_KEYS.USER_DATA);
        setToken(null);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
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
