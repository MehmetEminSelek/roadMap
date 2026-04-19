import { useQuery } from '@tanstack/react-query';
import { fuelPriceService } from '@/services/fuelPriceService';

export const useFuelBrandPrices = () =>
  useQuery({
    queryKey: ['fuel-prices', 'brands'],
    queryFn: () => fuelPriceService.getBrands(),
    staleTime: 30 * 60 * 1000, // 30 dk
    gcTime: 2 * 60 * 60 * 1000, // 2 saat
    retry: 1,
  });
