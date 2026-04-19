import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { BrandPriceFetcher, BrandPrices } from './base.fetcher';

/**
 * BP Türkiye — TODO: Public endpoint belirlendiğinde doldur.
 *
 * Denenebilecek kaynaklar:
 *   - https://www.bp.com/tr_tr/turkey/home/products-and-services/akaryakit-fiyatlari.html
 *   - 3rd party aggregator fallback
 */
@Injectable()
export class BpFetcher extends BrandPriceFetcher {
  readonly brandId = 'bp';
  readonly brandName = 'BP';

  constructor(http: HttpService) { super(http); }

  async fetch(_provinceCode = 34): Promise<BrandPrices | null> {
    this.logger.debug('BP fetcher henüz implement edilmedi (endpoint bekleniyor).');
    return null;
  }
}
