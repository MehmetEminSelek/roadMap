import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { BrandPriceFetcher, BrandPrices } from './brand-fetchers/base.fetcher';
import { OpetFetcher } from './brand-fetchers/opet.fetcher';
import { ShellFetcher } from './brand-fetchers/shell.fetcher';
import { PetrolOfisiFetcher } from './brand-fetchers/po.fetcher';
import { TotalFetcher } from './brand-fetchers/total.fetcher';

export interface FuelPrices {
  petrol: number;
  diesel: number;
  lpg: number;
}

export interface BrandPriceSnapshot {
  brandId: string;
  brandName: string;
  prices: FuelPrices;
  live: boolean;
  updatedAt: string; // ISO
}

const DEFAULT_PROVINCE = 34; // İstanbul — backward compat + carousel default
// Saatlik refresh → @Cron('0 * * * *')'da ayarlı. Boot'ta 1 saatten eskiyse hemen tetikle.
const STALE_THRESHOLD_MS = 60 * 60 * 1000; // 1 saat

@Injectable()
export class FuelPriceService implements OnModuleInit {
  private readonly logger = new Logger(FuelPriceService.name);
  private readonly defaultPrice: number;
  private readonly defaultLpg: number;

  /** Backward-compat için Opet'i "primary" olarak tutuyoruz. */
  private readonly PRIMARY_BRAND = 'opet';

  private readonly fetchers: BrandPriceFetcher[];
  private readonly fetcherById = new Map<string, BrandPriceFetcher>();

  /**
   * In-memory lookup cache: `${brandId}:${provinceCode}` → BrandPrices.
   * DB'den refreshAll sonrası doldurulur; her getBrandPrice çağrısında DB hit
   * etmemek için.
   */
  private priceCache = new Map<string, BrandPrices>();
  private lastRefreshAt: Date | null = null;

  /**
   * Overlap koruması: Shell Playwright ~2 dk sürüyor. Bir sonraki saatlik cron
   * önceki refresh hala çalışırken tetiklenirse iki Chromium paralel açılır ve
   * DevExpress session'ı karışır. İkinci tetiklemeyi sessizce pas geç.
   */
  private refreshing = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    opet: OpetFetcher,
    shell: ShellFetcher,
    po: PetrolOfisiFetcher,
    total: TotalFetcher,
  ) {
    this.fetchers = [opet, shell, po, total];
    for (const f of this.fetchers) this.fetcherById.set(f.brandId, f);

    // ConfigService env'i string döner; Number() ile coerce etmezsek
    // response'ta fiyatlar string olarak sızıyor ve mobile `formatPrice` bozuluyor.
    const rawDefault = this.configService.get<string | number>('FUEL_PRICE_TL', 40.0);
    const parsed = Number(rawDefault);
    this.defaultPrice = Number.isFinite(parsed) && parsed > 0 ? parsed : 40.0;
    this.defaultLpg = this.defaultPrice * 0.5;
  }

  async onModuleInit() {
    // DB'den mevcut cache'i yükle
    await this.loadCacheFromDb();

    // Son fetch 1+ saatlik ise boot'ta hemen refresh; değilse bir sonraki saat
    // cron'una bırak.
    const newest = await this.prisma.brandProvincePrice.findFirst({
      orderBy: { updatedAt: 'desc' },
      select: { updatedAt: true },
    });
    const age = newest ? Date.now() - newest.updatedAt.getTime() : Infinity;
    if (age > STALE_THRESHOLD_MS) {
      this.logger.log(`DB cache ${Math.round(age / 60_000)}dk eski → boot refresh…`);
      this.refreshAll().catch((e) => this.logger.error(`Initial refresh failed: ${e.message}`));
    } else {
      this.logger.log(`DB cache taze (${Math.round(age / 60_000)}dk) — boot refresh'e gerek yok.`);
    }
  }

  /**
   * Saatlik cron — her saatin 0. dakikasında çalışır (UTC).
   * Örn: 00:00, 01:00, 02:00… 4 markayı paralel refresh eder.
   *
   * @Cron overlap koruması: `refreshing` flag'i ile önceki iş bitmediyse pas geç.
   */
  @Cron(CronExpression.EVERY_HOUR)
  async scheduledRefresh() {
    if (this.refreshing) {
      this.logger.warn('Önceki refresh hala çalışıyor, bu tetiklemeyi atlıyorum.');
      return;
    }
    try {
      await this.refreshAll();
    } catch (e: any) {
      this.logger.error(`Scheduled refresh failed: ${e.message}`);
    }
  }

  /** Tüm markaları paralel olarak çeker ve DB'ye upsert eder. */
  async refreshAll() {
    if (this.refreshing) {
      this.logger.warn('refreshAll çağrıldı ama zaten refresh var; bekleniyor yerine atla.');
      return;
    }
    this.refreshing = true;
    const t0 = Date.now();
    try {
      this.logger.log(`Refreshing fuel prices for ${this.fetchers.length} brand(s)…`);
      await Promise.all(this.fetchers.map((f) => this.refreshOne(f)));
      await this.loadCacheFromDb();
      this.lastRefreshAt = new Date();
      this.logger.log(`Refresh complete (${Math.round((Date.now() - t0) / 1000)}s).`);
    } finally {
      this.refreshing = false;
    }
  }

  private async refreshOne(fetcher: BrandPriceFetcher) {
    try {
      const map = await fetcher.fetchAll();
      if (!map || map.size === 0) {
        this.logger.warn(`${fetcher.brandName}: fetchAll boş döndü, DB'ye yazma yok.`);
        return;
      }

      const ops: Promise<unknown>[] = [];
      for (const [provinceCode, prices] of map.entries()) {
        ops.push(
          this.prisma.brandProvincePrice.upsert({
            where: { brandId_provinceCode: { brandId: fetcher.brandId, provinceCode } },
            create: {
              brandId: fetcher.brandId,
              provinceCode,
              petrol: prices.petrol,
              diesel: prices.diesel,
              lpg: prices.lpg,
              live: true,
              source: `${fetcher.brandId}-api`,
            },
            update: {
              petrol: prices.petrol ?? undefined,
              diesel: prices.diesel ?? undefined,
              lpg: prices.lpg ?? undefined,
              live: true,
              source: `${fetcher.brandId}-api`,
            },
          }),
        );
      }
      await Promise.all(ops);
      this.logger.log(`${fetcher.brandName}: ${map.size} il DB'ye yazıldı.`);
    } catch (e: any) {
      this.logger.error(`${fetcher.brandName} refresh hata: ${e.message}`);
    }
  }

  private async loadCacheFromDb() {
    const rows = await this.prisma.brandProvincePrice.findMany();
    this.priceCache.clear();
    for (const r of rows) {
      this.priceCache.set(`${r.brandId}:${r.provinceCode}`, {
        petrol: r.petrol,
        diesel: r.diesel,
        lpg: r.lpg,
      });
    }
    this.logger.log(`Cache reloaded: ${rows.length} kayıt.`);
  }

  // ─── Public API ────────────────────────────────────────────────────────────

  /**
   * Markanın il fiyatı. Fallback zinciri:
   *   1. Bu markanın bu ili için direkt kayıt
   *   2. Bu markanın ulusal ortalaması (diğer illerin ortalaması)
   *   3. Tüm markaların bu il için ortalaması (cross-brand)
   *   4. Tüm markaların ulusal ortalaması (cross-brand global)
   *   5. Env default (FUEL_PRICE_TL)
   *
   * 3-4: OPET down olduğunda OPET kartı 65/65 fallback yerine PO/BP'nin gerçek
   * fiyatlarına yakın değer gösterir.
   */
  getBrandPrice(brandId: string, provinceCode: number = DEFAULT_PROVINCE): FuelPrices {
    const direct = this.priceCache.get(`${brandId}:${provinceCode}`);
    if (direct) return this.fillNulls(direct, brandId);

    const brandAvg = this.brandAverage(brandId);
    if (brandAvg) return brandAvg;

    const provinceAvg = this.crossBrandProvinceAverage(provinceCode);
    if (provinceAvg) return provinceAvg;

    const globalAvg = this.crossBrandGlobalAverage();
    if (globalAvg) return globalAvg;

    return {
      petrol: this.defaultPrice,
      diesel: this.defaultPrice,
      lpg: this.defaultLpg,
    };
  }

  private crossBrandProvinceAverage(provinceCode: number): FuelPrices | null {
    const bucket: BrandPrices[] = [];
    for (const [key, v] of this.priceCache.entries()) {
      if (key.endsWith(`:${provinceCode}`)) bucket.push(v);
    }
    return this.averageBucket(bucket);
  }

  private crossBrandGlobalAverage(): FuelPrices | null {
    return this.averageBucket(Array.from(this.priceCache.values()));
  }

  private averageBucket(bucket: BrandPrices[]): FuelPrices | null {
    if (!bucket.length) return null;
    const avg = (k: keyof BrandPrices) => {
      const vals = bucket.map((p) => p[k]).filter((n): n is number => n != null);
      return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
    };
    const petrol = avg('petrol');
    const diesel = avg('diesel');
    const lpg = avg('lpg');
    if (petrol == null && diesel == null && lpg == null) return null;
    return {
      petrol: petrol ?? this.defaultPrice,
      diesel: diesel ?? this.defaultPrice,
      lpg: lpg ?? this.defaultLpg,
    };
  }

  private brandAverage(brandId: string): FuelPrices | null {
    const all: Array<[number, BrandPrices]> = [];
    for (const [key, v] of this.priceCache.entries()) {
      if (key.startsWith(`${brandId}:`)) all.push([Number(key.split(':')[1]), v]);
    }
    if (!all.length) return null;
    const avg = (k: keyof BrandPrices) => {
      const vals = all.map(([, p]) => p[k]).filter((n): n is number => n != null);
      return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
    };
    return this.fillNulls(
      { petrol: avg('petrol'), diesel: avg('diesel'), lpg: avg('lpg') },
      brandId,
    );
  }

  private fillNulls(p: BrandPrices, _brandId: string): FuelPrices {
    return {
      petrol: p.petrol ?? this.defaultPrice,
      diesel: p.diesel ?? this.defaultPrice,
      lpg: p.lpg ?? this.defaultLpg,
    };
  }

  /** Tüm markaların verilen il için snapshot'ı (carousel için). */
  getAllBrandPrices(provinceCode: number = DEFAULT_PROVINCE): BrandPriceSnapshot[] {
    return this.fetchers.map((f) => {
      const has = this.priceCache.has(`${f.brandId}:${provinceCode}`);
      const prices = this.getBrandPrice(f.brandId, provinceCode);
      return {
        brandId: f.brandId,
        brandName: f.brandName,
        prices,
        live: has,
        updatedAt: (this.lastRefreshAt ?? new Date()).toISOString(),
      };
    });
  }

  /** Backward compat: primary marka (Opet İstanbul) fiyatları. */
  getPrices(): FuelPrices {
    return this.getBrandPrice(this.PRIMARY_BRAND, DEFAULT_PROVINCE);
  }

  /** Backward compat: AI yakıt hesaplaması primary marka üzerinden. */
  getPriceForType(type: string): number {
    const p = this.getPrices();
    const t = type.toLowerCase();
    if (t.includes('diesel') || t.includes('dizel')) return p.diesel;
    if (t.includes('lpg')) return p.lpg;
    return p.petrol;
  }

  /** Utility: hangi iller için hangi marka canlı verisi var? */
  hasLivePrice(brandId: string, provinceCode: number): boolean {
    return this.priceCache.has(`${brandId}:${provinceCode}`);
  }
}
