import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { AxiosResponse } from 'axios';
import { Vehicle } from '@prisma/client';
import { RateLimiterService } from '../../common/rate-limiter/rate-limiter.service';
import { RetryService } from '../../common/retry/retry.service';
import { TollCalculationResult, TollDetail } from './dto/toll-calculation.dto';

interface TollGuruResponse {
  status?: string;
  route?: {
    costs?: {
      tag?: number;
      cash?: number;
      tagAndCash?: number;
      minimumTollCost?: number;
      maximumTollCost?: number;
      currency?: string;
    };
    tolls?: Array<{
      name?: string;
      road?: string;
      tagCost?: number;
      cashCost?: number;
      currency?: string;
      lat?: number;
      lng?: number;
    }>;
    summary?: { name?: string };
  };
  // TollGuru bazen `routes: []` olarak doner; savunmaci sekilde ikisini de destekle.
  routes?: Array<{
    costs?: {
      tag?: number;
      cash?: number;
      tagAndCash?: number;
      minimumTollCost?: number;
      currency?: string;
    };
    tolls?: Array<{
      name?: string;
      road?: string;
      tagCost?: number;
      cashCost?: number;
      lat?: number;
      lng?: number;
    }>;
  }>;
  message?: string;
}

type VehicleParams = {
  origin: { lat: number; lng: number };
  destination: { lat: number; lng: number };
  vehicle: Vehicle | null;
};

interface CacheEntry {
  at: number;
  data: TollCalculationResult;
}

@Injectable()
export class TollGuruService {
  private readonly logger = new Logger(TollGuruService.name);
  private readonly apiUrl = 'https://apis.tollguru.com/toll/v2';
  private readonly apiKey: string;
  private readonly rateLimitKey = 'tollguru';
  private readonly cache = new Map<string, CacheEntry>();
  private readonly TTL_MS = 24 * 60 * 60 * 1000; // 24 saat
  private readonly CACHE_MAX = 500;

  constructor(
    private configService: ConfigService,
    private httpService: HttpService,
    private rateLimiter: RateLimiterService,
    private retryService: RetryService,
  ) {
    this.apiKey = this.configService.get<string>('tollguru.apiKey') || '';
  }

  isEnabled(): boolean {
    return !!this.apiKey;
  }

  /**
   * Origin-destination lat/lng ile toll hesabi. Basarisiz olursa null -> caller fallback'e duser.
   */
  async computeTolls(params: VehicleParams): Promise<TollCalculationResult | null> {
    if (!this.isEnabled()) return null;

    const key = this.cacheKey(params);
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.at < this.TTL_MS) {
      return cached.data;
    }

    // 150 req/gun trial limit. Defansif: 100/gun.
    const delay = await this.rateLimiter.acquireLimit(this.rateLimitKey, 100, 24 * 60 * 60 * 1000);
    if (delay > 0) await new Promise((r) => setTimeout(r, delay));

    try {
      const result = await this.retryService.executeWithRetry(
        async () => {
          const body = {
            from: { lat: params.origin.lat, lng: params.origin.lng },
            to: { lat: params.destination.lat, lng: params.destination.lng },
            serviceProvider: 'here',
            vehicle: { type: this.mapVehicleToTollGuru(params.vehicle) },
            country: 'TUR',
          };

          const response: AxiosResponse<TollGuruResponse> = await firstValueFrom(
            this.httpService.post(`${this.apiUrl}/origin-destination-waypoints`, body, {
              headers: {
                'Content-Type': 'application/json',
                'x-api-key': this.apiKey,
              },
              timeout: 15000,
            }),
          );

          // Ham response'u development ortaminda log'la — alan adlarini (name/lat/lng) dogrulamak icin.
          if (process.env.NODE_ENV !== 'production') {
            const sample = response.data?.route?.tolls?.[0] ?? response.data?.routes?.[0]?.tolls?.[0];
            if (sample) {
              this.logger.debug(`TollGuru sample toll keys: ${Object.keys(sample).join(',')}`);
              this.logger.debug(`TollGuru sample toll: ${JSON.stringify(sample).slice(0, 300)}`);
            }
          }

          return this.mapResponseToResult(response.data);
        },
        { maxRetries: 2, baseDelayMs: 500, retryableErrors: ['5xx', 'ETIMEDOUT', 'ECONNRESET'] },
        'TollGuru',
      );

      if (result) this.setCache(key, result);
      return result;
    } catch (error: any) {
      const status = error?.response?.status;
      const msg = error?.response?.data?.message || error?.message || 'unknown';
      this.logger.warn(`TollGuru basarisiz (status=${status}): ${msg}`);
      return null;
    }
  }

  // ---------- internals ----------

  private mapVehicleToTollGuru(vehicle: Vehicle | null): string {
    if (!vehicle) return '2AxlesAuto';
    if (vehicle.weight < 400) return '2AxlesMotorcycle';
    if (vehicle.weight > 7500) return '2AxlesTruck';
    if (vehicle.weight > 3500) return '2AxlesRv';
    return '2AxlesAuto';
  }

  private cacheKey(params: VehicleParams): string {
    const r = (n: number) => n.toFixed(4); // ~11 m hassasiyet
    const veh = this.mapVehicleToTollGuru(params.vehicle);
    return `${r(params.origin.lat)},${r(params.origin.lng)}|${r(params.destination.lat)},${r(
      params.destination.lng,
    )}|${veh}`;
  }

  private setCache(key: string, data: TollCalculationResult) {
    // LRU yerine sade eviction: dolunca ilk 50 entry'i sil (basit ve yeterli).
    if (this.cache.size >= this.CACHE_MAX) {
      const toDrop = Math.floor(this.CACHE_MAX / 10);
      const iter = this.cache.keys();
      for (let i = 0; i < toDrop; i++) {
        const k = iter.next().value;
        if (k) this.cache.delete(k);
      }
    }
    this.cache.set(key, { at: Date.now(), data });
  }

  private mapResponseToResult(data: TollGuruResponse): TollCalculationResult | null {
    const route = data?.route ?? data?.routes?.[0];
    if (!route) return null;

    const costs = route.costs || {};
    // Oncelik: tagAndCash (karma) -> minimumTollCost -> tag -> cash.
    const total =
      (costs.tagAndCash as number | undefined) ??
      (costs.minimumTollCost as number | undefined) ??
      (costs.tag as number | undefined) ??
      (costs.cash as number | undefined) ??
      0;

    if (total <= 0) return null;

    // TollGuru Turkiye'de barrier tipi (kopru/tunel) toll'larda `name` doldurur,
    // ama HGS system/gantry tipi otoyol toll'larinda `name` genelde null — `road` dolu gelir.
    const details: TollDetail[] = (route.tolls || []).map((t, idx) => {
      const name = (t.name || '').trim();
      const road = (t.road || '').trim();
      return {
        name: name || road || `Gise ${idx + 1}`,
        highway: road || 'Otoyol',
        amount: (t.tagCost ?? t.cashCost ?? 0) as number,
        lat: t.lat ?? 0,
        lng: t.lng ?? 0,
      };
    });

    return { totalCost: Number(total), details, source: 'tollguru' };
  }
}
