import apiClient from './apiClient';
import type { Route, FavoriteRoute, PaginatedResponse } from '@/types/api';

export const historyService = {
  async getAll(page = 1, limit = 10): Promise<PaginatedResponse<Route>> {
    const response = await apiClient.get<PaginatedResponse<Route>>('/history', {
      params: { page, limit },
    });
    return response.data;
  },

  async getOne(id: string): Promise<Route> {
    const response = await apiClient.get<Route>(`/history/${id}`);
    return response.data;
  },

  async delete(id: string): Promise<void> {
    await apiClient.delete(`/history/${id}`);
  },

  async addFavorite(routeId: string, name?: string): Promise<FavoriteRoute> {
    const response = await apiClient.post<FavoriteRoute>(
      `/history/favorites/${routeId}`,
      name ? { name } : {},
    );
    return response.data;
  },
};
