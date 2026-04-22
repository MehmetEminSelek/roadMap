import { Injectable } from '@nestjs/common';

export interface ConsumptionFactors {
  speedFactor: number;
  acFactor: number;
  trafficFactor: number;
  climateFactor: number; // backward-compat alias for acFactor
  combined: number;      // product of all active factors
}

/**
 * FuelCalculatorService
 * ---------------------------------------------------------------------------
 * Yakıt tüketimine etki eden dış faktörlerin (hız, klima, trafik) merkezi
 * hesaplama servisi. Önceden bu mantık `FuelAiService` içinde dağılmıştı;
 * `FuelSimulationService`'in aynı faktörleri kullanabilmesi için ayrıştırıldı.
 *
 * Değerler FuelAiService + FuelSimulationService tarafından tüketilir.
 */
@Injectable()
export class FuelCalculatorService {
  /**
   * Hız faktörü — ADAC bazlı ampirik model.
   * Referans: 90 km/h → 1.00 (Türkiye otoyol normali, L/100 bu hız civarı için).
   *   factor = (speed / 90) ^ 1.8, clamp [0.80, 1.60]
   *
   * Örnek:
   *   90  → 1.00
   *   100 → 1.09
   *   110 → 1.18
   *   120 → 1.28
   *   130 → 1.38
   *   140 → 1.49
   */
  speedFactor(speedKph: number): number {
    if (!speedKph || speedKph <= 0) return 1.0;
    const raw = Math.pow(speedKph / 90, 1.8);
    return Math.max(0.80, Math.min(1.60, raw));
  }

  /**
   * Klima faktörü — motor hacmine göre yakıt etkisi.
   * Büyük motor kompresör yükünü daha az hisseder.
   *
   *   <1.4L      → %8  (×1.08)
   *   1.4-1.99L  → %6  (×1.06)
   *   2.0-2.99L  → %4  (×1.04)
   *   ≥3.0L      → %2  (×1.02)
   *   AC off     → ×1.00
   */
  acFactor(engineDisplacementL: number, acOn: boolean): number {
    if (!acOn) return 1.0;
    if (engineDisplacementL >= 3.0) return 1.02;
    if (engineDisplacementL >= 2.0) return 1.04;
    if (engineDisplacementL >= 1.4) return 1.06;
    return 1.08;
  }

  /**
   * Trafik faktörü — ortalama hız / mesafeden türetilir.
   * (Eskiden FuelAiService.calculateTrafficFactor idi.)
   */
  trafficFactor(durationSeconds: number | undefined, distanceKm: number): number {
    if (!durationSeconds || durationSeconds <= 0 || distanceKm <= 0) return 1.0;
    const avgSpeedKph = (distanceKm / durationSeconds) * 3600;
    if (avgSpeedKph > 100) return 0.90; // otoyol → daha verimli
    if (avgSpeedKph > 70) return 1.00;
    if (avgSpeedKph > 40) return 1.15;
    return 1.30; // şehir içi yoğun
  }

  /**
   * Backward-compat: eski `hasClimateControl: boolean` kullanımı için.
   * Motor hacmi bilinmiyorsa 1.6L kabul eder (en yaygın segment).
   */
  climateControlFactor(hasClimateControl: boolean, engineDisplacementL = 1.6): number {
    return this.acFactor(engineDisplacementL, hasClimateControl);
  }

  /** Tüm faktörlerin çarpımı — single-shot hesaplama için. */
  combinedFactor(params: {
    speedKph?: number;
    acOn?: boolean;
    engineDisplacementL?: number;
    hasClimateControl?: boolean;
    durationSeconds?: number;
    distanceKm?: number;
  }): ConsumptionFactors {
    const speedF = params.speedKph ? this.speedFactor(params.speedKph) : 1.0;
    const acF =
      params.acOn !== undefined
        ? this.acFactor(params.engineDisplacementL ?? 1.6, params.acOn)
        : this.climateControlFactor(
            params.hasClimateControl ?? true,
            params.engineDisplacementL ?? 1.6,
          );
    const trafficF = this.trafficFactor(params.durationSeconds, params.distanceKm ?? 0);

    return {
      speedFactor: speedF,
      acFactor: acF,
      trafficFactor: trafficF,
      climateFactor: acF,
      combined: speedF * acF * trafficF,
    };
  }
}
