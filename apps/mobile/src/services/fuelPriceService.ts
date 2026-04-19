import apiClient from './apiClient';

export interface BrandPriceSnapshot {
  brandId: string;
  brandName: string;
  prices: { petrol: number; diesel: number; lpg: number };
  live: boolean;
  updatedAt: string;
}

export const fuelPriceService = {
  async getBrands(): Promise<BrandPriceSnapshot[]> {
    const res = await apiClient.get<{ brands: BrandPriceSnapshot[] }>('/fuel-prices/brands');
    // apiClient response interceptor'ı { success, data } zarfını çözüyor →
    // eğer backend envelope kullanıyorsa res.data doğrudan { brands } döner.
    const payload = (res.data as any)?.brands ?? (res.data as any);
    return Array.isArray(payload) ? payload : [];
  },
};
