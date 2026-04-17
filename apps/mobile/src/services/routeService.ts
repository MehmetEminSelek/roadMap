import apiClient from './apiClient';
import type {
  Route,
  CreateRouteRequest,
  RouteCalculationResult,
  PaginatedResponse,
} from '@/types/api';

export const routeService = {
  async calculate(data: CreateRouteRequest): Promise<RouteCalculationResult> {
    const response = await apiClient.post<RouteCalculationResult>('/routes/calculate', data);
    return response.data;
  },

  async getAll(page = 1, limit = 10): Promise<PaginatedResponse<Route>> {
    const response = await apiClient.get<PaginatedResponse<Route>>('/routes', {
      params: { page, limit },
    });
    return response.data;
  },

  async getOne(id: string): Promise<Route> {
    const response = await apiClient.get<Route>(`/routes/${id}`);
    return response.data;
  },

  async delete(id: string): Promise<void> {
    await apiClient.delete(`/routes/${id}`);
  },

  async getStats(): Promise<{
    totalRoutes: number;
    totalTollCost: number;
    totalFuelCost: number;
    totalCost: number;
    totalDistance: number;
    totalDuration: number;
    weeklyCost: number;
    monthlyCost: number;
  }> {
    const response = await apiClient.get('/routes/stats');
    return response.data;
  },

  async autocomplete(input: string): Promise<{ description: string; placeId: string }[]> {
    if (!input || input.length < 2) return [];
    const response = await apiClient.get('/routes/autocomplete', { params: { input } });
    return response.data;
  },
};
