import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { BrandPriceFetcher, BrandPrices } from './base.fetcher';

/**
 * Petrol Ofisi — TODO: Public endpoint belirlendiğinde doldur.
 *
 * Denenebilecek kaynaklar:
 *   - https://www.po.com.tr/akaryakit-fiyatlari  (HTML — scrape)
 *   - Muhtemel internal API: po.com.tr DevTools → Network altında XHR ara
 */
@Injectable()
export class PetrolOfisiFetcher extends BrandPriceFetcher {
  readonly brandId = 'po';
  readonly brandName = 'Petrol Ofisi';

  constructor(http: HttpService) { super(http); }

  async fetch(_provinceCode = 34): Promise<BrandPrices | null> {
    this.logger.debug('Petrol Ofisi fetcher henüz implement edilmedi (endpoint bekleniyor).');
    return null;
  }
}
