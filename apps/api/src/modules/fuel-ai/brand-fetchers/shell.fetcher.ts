import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { BrandPriceFetcher, BrandPrices } from './base.fetcher';

/**
 * Shell Türkiye — TODO: Public endpoint belirlendiğinde `fetch()` doldurulacak.
 *
 * Denenebilecek kaynaklar:
 *   - https://www.shell.com.tr/motorists/shell-fuels/fuel-pricing.html
 *     (client-side rendered; JSON API kullanıyor — DevTools → Network ile yakala)
 *   - 3rd party aggregator: akaryakit-fiyatlari.com.tr, hepsiyakit.com
 *
 * Şu an null döner → orchestrator "eski / default fiyat" kullanır.
 */
@Injectable()
export class ShellFetcher extends BrandPriceFetcher {
  readonly brandId = 'shell';
  readonly brandName = 'Shell';

  constructor(http: HttpService) { super(http); }

  async fetch(_provinceCode = 34): Promise<BrandPrices | null> {
    this.logger.debug('Shell fetcher henüz implement edilmedi (endpoint bekleniyor).');
    return null;
  }
}
