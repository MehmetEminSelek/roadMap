import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { AxiosResponse } from 'axios';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { RetryService } from '../../common/retry/retry.service';

/**
 * Normalized weather snapshot — yakıt hesaplayıcısının kullandığı form.
 */
export interface WeatherSnapshot {
  tempC: number;
  /** km/h (OpenWeatherMap m/s döner — bu alan dönüştürülmüş). */
  windSpeedKph: number;
  /** 0=N, 90=E (meteorolojik: rüzgâr nereden esiyor). */
  windFromDeg: number;
  rainLevel: 0 | 1 | 2 | 3;
  /** Ham mm/h — audit ve debug. */
  rawMmPerHour: number;
}

/**
 * One Call 3.0 response'unun kullandığımız alt-şeması.
 */
interface OneCallV3Response {
  current?: {
    temp: number;
    wind_speed: number;
    wind_deg: number;
    wind_gust?: number;
    rain?: { '1h'?: number };
    snow?: { '1h'?: number };
    weather?: Array<{ id: number; main: string }>;
  };
  hourly?: Array<{
    dt: number;
    temp: number;
    wind_speed: number;
    wind_deg: number;
    rain?: { '1h'?: number };
    snow?: { '1h'?: number };
  }>;
}

/**
 * WeatherService
 * ---------------------------------------------------------------------------
 * OpenWeatherMap One Call API 3.0 wrapper. Yakıt hesaplama servisine
 * ambient temperature + wind vector + rain severity besler.
 *
 * Cache: `${round(lat,2)}:${round(lng,2)}` key'i (~1km resolution), 30 dk TTL.
 * One Call 3.0 aynı çağrıda current + 48h hourly döndürüyor; ikisini
 * birlikte cache'liyoruz ki future `fetchForecastAt` extra request
 * yapmasın.
 *
 * Hatalar: 401/404/429/5xx hiçbirinde exception fırlatmıyor — null döner.
 * Caller nötr factor'ü (1.0) kullanacak şekilde zaten defensive.
 */
@Injectable()
export class WeatherService {
  private readonly logger = new Logger(WeatherService.name);
  private readonly apiKey: string;
  private readonly apiUrl = 'https://api.openweathermap.org/data/3.0/onecall';
  private static readonly CACHE_TTL_MS = 30 * 60 * 1000; // 30 dk

  constructor(
    private readonly config: ConfigService,
    private readonly http: HttpService,
    private readonly retry: RetryService,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {
    this.apiKey = this.config.get<string>('OPENWEATHERMAP_API_KEY') || '';
    if (!this.apiKey) {
      this.logger.warn('OPENWEATHERMAP_API_KEY tanımlı değil — weather fetches null dönecek.');
    }
  }

  /** Şu andaki hava durumu. */
  async fetchCurrent(lat: number, lng: number): Promise<WeatherSnapshot | null> {
    const data = await this.getOneCall(lat, lng);
    if (!data?.current) return null;
    return this.normalizeCurrent(data.current);
  }

  /**
   * (Future work) Belirtilen unix timestamp'e en yakın saatteki tahmin.
   * Şu anki sprint'te çağrılmıyor ama imza hazır — uzun seyahatte
   * destination'da ETA hava için kullanılacak.
   */
  async fetchForecastAt(lat: number, lng: number, unixTs: number): Promise<WeatherSnapshot | null> {
    const data = await this.getOneCall(lat, lng);
    if (!data?.hourly || data.hourly.length === 0) return null;
    // En yakın saati bul (hourly 1 saat aralıklı)
    const target = data.hourly.reduce((best, h) =>
      Math.abs(h.dt - unixTs) < Math.abs(best.dt - unixTs) ? h : best,
    );
    return this.normalizeHourly(target);
  }

  // ────────────────────────── internals ──────────────────────────

  /** Cache-layered One Call API call. */
  private async getOneCall(lat: number, lng: number): Promise<OneCallV3Response | null> {
    if (!this.apiKey) return null;
    const key = `weather:onecall:${this.roundCoord(lat)}:${this.roundCoord(lng)}`;
    const cached = await this.cache.get<OneCallV3Response>(key).catch(() => null);
    if (cached) return cached;

    try {
      const response: AxiosResponse<OneCallV3Response> = await this.retry.executeWithRetry(
        async () =>
          firstValueFrom(
            this.http.get<OneCallV3Response>(this.apiUrl, {
              params: {
                lat,
                lon: lng,
                exclude: 'minutely,alerts,daily',
                units: 'metric',
                appid: this.apiKey,
              },
              timeout: 8000,
            }),
          ),
        { maxRetries: 2, baseDelayMs: 500 },
        'OpenWeatherMap One Call 3.0',
      );

      const data = response.data;
      if (!data?.current) {
        this.logger.warn(`OneCall response eksik: ${JSON.stringify(data).slice(0, 200)}`);
        return null;
      }

      await this.cache.set(key, data, WeatherService.CACHE_TTL_MS).catch(() => {});
      this.logger.log(
        `[Weather] ${lat.toFixed(2)},${lng.toFixed(2)}: ${data.current.temp}°C, ` +
        `wind ${(data.current.wind_speed * 3.6).toFixed(1)} km/h from ${data.current.wind_deg}°`,
      );
      return data;
    } catch (err: any) {
      const status = err?.response?.status;
      const msg = err?.response?.data?.message || err?.message || 'unknown';
      this.logger.warn(`OneCall fetch failed (${status ?? '?'}): ${msg}`);
      return null;
    }
  }

  private normalizeCurrent(c: NonNullable<OneCallV3Response['current']>): WeatherSnapshot {
    const rainMm = c.rain?.['1h'] ?? 0;
    const snowMm = c.snow?.['1h'] ?? 0;
    const totalMm = rainMm + snowMm;
    return {
      tempC: c.temp,
      windSpeedKph: c.wind_speed * 3.6,
      windFromDeg: c.wind_deg,
      rainLevel: this.rainLevelFor(totalMm, snowMm > 0),
      rawMmPerHour: totalMm,
    };
  }

  private normalizeHourly(h: NonNullable<OneCallV3Response['hourly']>[number]): WeatherSnapshot {
    const rainMm = h.rain?.['1h'] ?? 0;
    const snowMm = h.snow?.['1h'] ?? 0;
    const totalMm = rainMm + snowMm;
    return {
      tempC: h.temp,
      windSpeedKph: h.wind_speed * 3.6,
      windFromDeg: h.wind_deg,
      rainLevel: this.rainLevelFor(totalMm, snowMm > 0),
      rawMmPerHour: totalMm,
    };
  }

  /**
   * mm/h → 0-3 band. Kar varsa bir üst band'a bump (yüzey sürtünmesi
   * yağmurdan fazla).
   */
  private rainLevelFor(mmPerHour: number, hasSnow: boolean): 0 | 1 | 2 | 3 {
    let level: 0 | 1 | 2 | 3 = 0;
    if (mmPerHour <= 0) level = 0;
    else if (mmPerHour < 1) level = 1;
    else if (mmPerHour < 5) level = 2;
    else level = 3;
    if (hasSnow && level < 3) level = (level + 1) as 0 | 1 | 2 | 3;
    return level;
  }

  /** 2 ondalık = ~1km resolution → cache hit rate iyi. */
  private roundCoord(v: number): string {
    return v.toFixed(2);
  }
}
