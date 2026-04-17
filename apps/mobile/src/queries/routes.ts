import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { routeService } from '../services/routeService';
import type { CreateRouteRequest, RouteCalculationResult, Route, PaginatedResponse } from '@/types/api';

export const useCalculateRoute = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateRouteRequest) => routeService.calculate(data),
    onSuccess: () => {
      // Invalidate routes list after calculation
      queryClient.invalidateQueries({ queryKey: ['routes'] });
    },
  });
};

export const useRoutes = () =>
  useQuery({
    queryKey: ['routes', 'list'],
    queryFn: () => routeService.getAll(1, 10),
    staleTime: 30_000,
  });

export const useRoute = (id: string | undefined) =>
  useQuery({
    queryKey: ['routes', id],
    queryFn: () => routeService.getOne(id!),
    enabled: !!id,
  });
