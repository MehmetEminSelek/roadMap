import apiClient from './apiClient';
import type { FavoriteRoute, FavoritePlace } from '@/types/api';

export const favoritesService = {
  async getRoutes(): Promise<FavoriteRoute[]> {
    const response = await apiClient.get<FavoriteRoute[]>('/favorites/routes');
    return response.data;
  },

  async getPlaces(): Promise<FavoritePlace[]> {
    const response = await apiClient.get<FavoritePlace[]>('/favorites/places');
    return response.data;
  },

  async removeRoute(id: string): Promise<void> {
    await apiClient.delete(`/favorites/routes/${id}`);
  },

  async removePlace(id: string): Promise<void> {
    await apiClient.delete(`/favorites/places/${id}`);
  },
};
