import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { BrandPriceFetcher, BrandPrices } from './base.fetcher';
import { createLimiter, sleep } from '../../../common/concurrency';
import { ALL_PROVINCE_CODES } from '../../../common/geo/province-lookup';

/**
 * TotalEnergies Türkiye — GüzelEnerji API (BP'nin yerini aldı, BP Türkiye 2013'te
 * fuel retail'den çekildi).
 *
 * API: https://apimobile.guzelenerji.com.tr/exapi/fuel_prices?city_code=XX
 *   - city_code direkt Türk plaka koduyla eşleşiyor (1..81)
 *   - Response uzun format: her (ilçe × ürün) bir satır
 *   - İl içinde ilçeden ilçeye küçük fiyat farkları var (~0.2 TL) → ortalama al
 *
 * İlgili product_name'ler:
 *   "Kurşunsuz 95(Excellium95)" → petrol
 *   "Motorin"                    → diesel
 *   "Otogaz"                     → lpg (bazı illerde price=0 veya yok)
 *
 * "Motorin(Excellium)" TotalEnergies'in premium versiyonu, kullanmıyoruz.
 * Çoğu İstanbul ilçesinde Otogaz listelenmiyor; null bırakıp orchestrator'ın
 * cross-brand fallback'ine güveniyoruz.
 */
@Injectable()
export class TotalFetcher extends BrandPriceFetcher {
  readonly brandId = 'total';
  readonly brandName = 'TotalEnergies';

  private readonly baseUrl = 'https://apimobile.guzelenerji.com.tr/exapi/fuel_prices';
  private readonly CONCURRENCY = 6;
  private readonly PER_REQ_GAP_MS = 100;

  constructor(http: HttpService) {
    super(http);
  }

  async fetch(provinceCode = 34): Promise<BrandPrices | null> {
    // 2 deneme × 15s timeout. OPET benzeri.
    let lastErr: any = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await firstValueFrom(
          this.http.get(`${this.baseUrl}?city_code=${provinceCode}`, {
            timeout: 15_000,
            headers: {
              'User-Agent':
                'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
              Accept: 'application/json',
            },
          }),
        );
        const data = res.data;
        if (!Array.isArray(data) || !data.length) return null;
        return this.aggregateCounties(data);
      } catch (e: any) {
        lastErr = e;
        if (attempt === 0) await sleep(500);
      }
    }
    this.logger.warn(`ProvinceCode=${provinceCode} çekilemedi: ${lastErr?.message}`);
    return null;
  }

  /**
   * İl içindeki ilçelerin ortalamasını alır.
   * Her ilçenin kendi fiyatı olabilir (ör. İstanbul 36 ilçe × 0.16 TL varyans).
   */
  private aggregateCounties(rows: any[]): BrandPrices {
    const petrolVals: number[] = [];
    const dieselVals: number[] = [];
    const lpgVals: number[] = [];

    for (const row of rows) {
      const name = String(row.product_name || '');
      const price = Number(row.price);
      if (!Number.isFinite(price) || price <= 0) continue;

      if (name === 'Kurşunsuz 95(Excellium95)') {
        petrolVals.push(price);
      } else if (name === 'Motorin') {
        dieselVals.push(price);
      } else if (name === 'Otogaz') {
        lpgVals.push(price);
      }
    }

    const avg = (vals: number[]) =>
      vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;

    return {
      petrol: avg(petrolVals),
      diesel: avg(dieselVals),
      lpg: avg(lpgVals),
    };
  }

  /**
   * 81 il × 1 request = 81 request. Concurrency 6, 100ms gap.
   * OPET ile aynı pattern — ~2-3s.
   */
  async fetchAll(): Promise<Map<number, BrandPrices> | null> {
    const limit = createLimiter(this.CONCURRENCY);
    const out = new Map<number, BrandPrices>();
    let okCount = 0;

    const tasks = ALL_PROVINCE_CODES.map((code) =>
      limit(async () => {
        await sleep(this.PER_REQ_GAP_MS);
        const res = await this.fetch(code);
        if (res) {
          out.set(code, res);
          okCount++;
        }
      }),
    );

    await Promise.all(tasks);
    this.logger.log(`${okCount}/${ALL_PROVINCE_CODES.length} il için fiyat çekildi.`);
    return okCount > 0 ? out : null;
  }
}
