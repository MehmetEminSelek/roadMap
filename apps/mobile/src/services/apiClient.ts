import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001';

if (__DEV__) {
  // Dev'de hangi backend'e bağlanıldığını hızlı doğrulamak için.
  // Prod bundle'da bu blok minify sırasında drop edilir.
  console.log(`[apiClient] baseURL → ${API_URL}`);
}

export const STORAGE_KEYS = {
  AUTH_TOKEN: 'roadmap_auth_token',
  USER_DATA: 'roadmap_user_data',
} as const;

// Secure token storage: uses SecureStore on native, AsyncStorage on web
export const tokenStorage = {
  async getToken(): Promise<string | null> {
    if (Platform.OS === 'web') {
      return AsyncStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
    }
    return SecureStore.getItemAsync(STORAGE_KEYS.AUTH_TOKEN);
  },
  async setToken(token: string): Promise<void> {
    if (Platform.OS === 'web') {
      await AsyncStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, token);
      return;
    }
    await SecureStore.setItemAsync(STORAGE_KEYS.AUTH_TOKEN, token);
  },
  async removeToken(): Promise<void> {
    if (Platform.OS === 'web') {
      await AsyncStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
      return;
    }
    await SecureStore.deleteItemAsync(STORAGE_KEYS.AUTH_TOKEN);
  },
};

const apiClient = axios.create({
  baseURL: API_URL,
  timeout: 45000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor: inject auth token
apiClient.interceptors.request.use(
  async (config) => {
    const token = await tokenStorage.getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// Response interceptor: unwrap { success, data } envelope
apiClient.interceptors.response.use(
  (response) => {
    if (response.data && typeof response.data === 'object' && 'success' in response.data) {
      response.data = response.data.data;
    }
    return response;
  },
  async (error) => {
    if (error.response?.status === 401) {
      await tokenStorage.removeToken();
      await AsyncStorage.removeItem(STORAGE_KEYS.USER_DATA);
    }

    const message =
      error.response?.data?.message ||
      error.message ||
      'Bir hata oluştu. Lütfen tekrar deneyin.';

    return Promise.reject(new Error(message));
  },
);

export default apiClient;
