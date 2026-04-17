import { useQuery } from '@tanstack/react-query';
import { routeService } from '../services/routeService';

export const useAutocomplete = (input: string) =>
  useQuery({
    queryKey: ['autocomplete', input.trim().toLocaleLowerCase('tr')],
    queryFn: () => routeService.autocomplete(input),
    enabled: input.trim().length >= 2,
    staleTime: 60 * 60 * 1000,       // 1h taze
    gcTime: 7 * 24 * 60 * 60 * 1000, // 7d bellek
  });
