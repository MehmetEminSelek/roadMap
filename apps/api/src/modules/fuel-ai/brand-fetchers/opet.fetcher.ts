import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { BrandPriceFetcher, BrandPrices } from './base.fetcher';
import { createLimiter, sleep } from '../../../common/concurrency';
import { ALL_PROVINCE_CODES } from '../../../common/geo/province-lookup';

@Injectable()
export class OpetFetcher extends BrandPriceFetcher {
  readonly brandId = 'opet';
  readonly brandName = 'Opet';

  private readonly baseUrl = 'https://api.opet.com.tr/api/fuelprices/prices';
  private readonly CONCURRENCY = 6;
  private readonly PER_REQ_GAP_MS = 100;

  constructor(http: HttpService) {
    super(http);
  }

  async fetch(provinceCode = 34): Promise<BrandPrices | null> {
    // OPET API zaman zaman ilk denemede yavaş yanıtlıyor (özellikle datacenter
    // IP'lerinden). 20s timeout + 1 retry: başarısızlık oranını belirgin düşürüyor.
    let lastErr: any = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await firstValueFrom(
          this.http.get(`${this.baseUrl}?ProvinceCode=${provinceCode}`, { timeout: 20_000 }),
        );
        const data = res.data;
        if (!Array.isArray(data) || !data.length) return null;

        const prices = data[0].prices || [];
        const out: BrandPrices = { petrol: null, diesel: null, lpg: null };

        for (const item of prices) {
          const name = String(item.productName || '').toLowerCase();
          const amount = Number(item.amount) || 0;
          if (amount <= 0) continue;

          if (name.includes('kurşunsuz') || name.includes('benzin')) {
            out.petrol = amount;
          } else if (
            name.includes('motorin') || name.includes('dizel') ||
            name.includes('diesel') || name.includes('eco force')
          ) {
            out.diesel = amount;
          } else if (name.includes('lpg') || name.includes('otogaz')) {
            out.lpg = amount;
          }
        }

        return out;
      } catch (e: any) {
        lastErr = e;
        if (attempt === 0) await sleep(500);
      }
    }
    this.logger.warn(`ProvinceCode=${provinceCode} çekilemedi: ${lastErr?.message}`);
    return null;
  }

  /**
   * 81 il × ~1 request = 81 request. Concurrency 6, istek başı 100ms gap.
   * Süre: ~2-3s. Saatte 1 çalışacak, Opet'i sıkmaz.
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
