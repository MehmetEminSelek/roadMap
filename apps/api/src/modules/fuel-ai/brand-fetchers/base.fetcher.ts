import { HttpService } from '@nestjs/axios';
import { Logger } from '@nestjs/common';

export type FuelProductKey = 'petrol' | 'diesel' | 'lpg';

export interface BrandPrices {
  petrol: number | null;
  diesel: number | null;
  lpg: number | null;
}

/**
 * Marka bazlı yakıt fiyatı fetcher'larının base sınıfı.
 *
 * Her marka kendi subclass'ını yazar:
 *   - `brandId`:   "opet" | "shell" | "po" | "total"...
 *   - `brandName`: "Opet", "Shell"...
 *   - `fetch()`:   o markanın API/HTML endpoint'inden fiyatları çeker.
 *
 * Hata durumunda `null` dönebilir ya da eksik alanları `null` bırakabilir —
 * orchestrator servis bunu "eski fiyatı koru" olarak yorumlar.
 */
export abstract class BrandPriceFetcher {
  abstract readonly brandId: string;
  abstract readonly brandName: string;

  private _logger?: Logger;
  protected get logger(): Logger {
    if (!this._logger) this._logger = new Logger(`FuelPrice:${this.brandName}`);
    return this._logger;
  }

  constructor(protected readonly http: HttpService) {}

  /** Tek il fiyatı. `null` = çekilemedi. İstanbul (34) default. */
  abstract fetch(provinceCode?: number): Promise<BrandPrices | null>;

  /**
   * 81 il için fiyatları toplu çeker (provinceCode → BrandPrices).
   * Default implementation: `fetch()`'i 34 için çağırır — tek-ulusal-fiyatlı
   * markalar için yeterli. Opet gibi il bazlı API'si olanlar override eder.
   */
  async fetchAll(): Promise<Map<number, BrandPrices> | null> {
    const single = await this.fetch(34);
    if (!single) return null;
    return new Map([[34, single]]);
  }
}
