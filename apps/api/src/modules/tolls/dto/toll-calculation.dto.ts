/**
 * Ortak toll hesaplama tipleri.
 * Mobile contract: `tollDetails[]` icindeki alanlar (name/highway/amount/lat/lng) asla degistirilemez
 * — results.tsx ve route/[id].tsx bu alanlari dogrudan tuketiyor.
 */

export type TollSource = 'tollguru' | 'local-kgm' | 'estimate' | 'mixed';

export interface TollDetail {
  name: string;
  highway: string;
  amount: number;
  lat: number;
  lng: number;
}

export interface TollCalculationResult {
  totalCost: number;
  details: TollDetail[];
  source: TollSource;
}
