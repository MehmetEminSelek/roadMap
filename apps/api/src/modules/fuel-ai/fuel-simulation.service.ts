import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { FuelPriceService, FuelPrices } from './fuel-price.service';
import { FuelCalculatorService } from './fuel-calculator.service';
import { getProvinceName } from '../../common/geo/province-lookup';
import { ProvinceSegment } from '../../common/geo/route-provinces';

export interface FuelStop {
  atKm: number;
  provinceCode: number;
  provinceName: string;
  brandId: string;
  litersPurchased: number;
  pricePerLiter: number;
  cost: number;
  tankBeforePct: number;
  tankAfterPct: number;
}

export interface FuelSimulationResult {
  stops: FuelStop[];
  totalFuelCost: number;
  totalLitersPurchased: number;
  litersConsumedTotal: number;
  endingFuelPct: number;
  warnings: string[];
}

export interface SimulateInput {
  vehicleId: string;
  preferredBrand?: string;       // null ise Vehicle.preferredFuelBrand ya da 'opet'
  initialFuelPct: number;        // 0-100
  routeProvinces: ProvinceSegment[];
  totalDistanceKm: number;
  reserveThresholdPct?: number;  // default 20 — ikmal %20'de tetiklenir, dolum %100'e çıkar (stop başı ~%80 tank)
  /** AI tahminlerinde EPA eksikse fallback L/100km */
  fallbackL100?: number;

  // ── Yeni tüketim faktörleri (FuelCalculatorService üzerinden uygulanır) ──
  /** Otoyol seyir hızı km/h. Default 110. */
  cruisingSpeedKph?: number;
  /** Klima açık mı? Default true. */
  acOn?: boolean;
  /** Motor hacmi litre. Default 1.6. AC faktörünü ölçekler. */
  engineDisplacementL?: number;
}

const DEFAULT_TANK_BY_FUEL: Record<string, number> = {
  PETROL: 50, DIZEL: 60, HYBRID: 45, LPG: 50, ELECTRIC: 0,
};

@Injectable()
export class FuelSimulationService {
  private readonly logger = new Logger(FuelSimulationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly fuelPrice: FuelPriceService,
    private readonly fuelCalc: FuelCalculatorService,
  ) {}

  async simulate(input: SimulateInput): Promise<FuelSimulationResult> {
    const warnings: string[] = [];

    const vehicle = await this.prisma.vehicle.findUnique({ where: { id: input.vehicleId } });
    if (!vehicle) {
      return {
        stops: [],
        totalFuelCost: 0,
        totalLitersPurchased: 0,
        litersConsumedTotal: 0,
        endingFuelPct: input.initialFuelPct,
        warnings: ['Araç bulunamadı, yakıt simülasyonu atlandı.'],
      };
    }

    // Tank + tüketim
    const trim = await this.prisma.vehicleTrim.findFirst({
      where: {
        vehicleModel: { name: vehicle.model, vehicleMake: { name: vehicle.brand } },
        fuelType: vehicle.fuelType,
      },
      orderBy: { year: 'desc' },
      select: { tankCapacityL: true, fuelEconomyL100: true },
    });

    const tankCapacity = trim?.tankCapacityL ?? DEFAULT_TANK_BY_FUEL[vehicle.fuelType] ?? 50;
    if (!trim?.tankCapacityL) {
      warnings.push(`Tank kapasitesi bilinmiyor, ${tankCapacity}L varsayıldı.`);
    }

    const l100Base = trim?.fuelEconomyL100 ?? input.fallbackL100 ?? 7.5;
    if (!trim?.fuelEconomyL100 && !input.fallbackL100) {
      warnings.push(`Ortalama tüketim verisi yok, ${l100Base} L/100km varsayıldı.`);
    }

    // Hız + klima faktörleri. Trafik faktörü simülasyonda kullanılmaz (province
    // segmentlerine bakıyoruz, ortalama hız hesabı anlamlı değil).
    const factors = this.fuelCalc.combinedFactor({
      speedKph: input.cruisingSpeedKph ?? 110,
      acOn: input.acOn ?? true,
      engineDisplacementL: input.engineDisplacementL ?? 1.6,
    });
    const l100 = l100Base * factors.speedFactor * factors.acFactor;

    // Marka tercihi
    const preferredBrand =
      input.preferredBrand ?? vehicle.preferredFuelBrand ?? 'opet';

    // Yakıt tipini FuelPrices key'ine eşle
    const fuelKey = this.mapFuelKey(vehicle.fuelType);

    const reserveThresholdPct = input.reserveThresholdPct ?? 20;
    const reserveLiters = (tankCapacity * reserveThresholdPct) / 100;
    let currentLiters = (tankCapacity * input.initialFuelPct) / 100;

    const stops: FuelStop[] = [];
    let litersConsumedTotal = 0;

    // Boş/yetersiz route segments → sadece tüketim, stop yok
    const segments = input.routeProvinces.length
      ? input.routeProvinces
      : [{ provinceCode: 34, entryKm: 0, exitKm: input.totalDistanceKm }];

    for (const seg of segments) {
      const segmentKm = Math.max(0, seg.exitKm - seg.entryKm);
      let remainingSegKm = segmentKm;
      let cursorKm = seg.entryKm;

      while (remainingSegKm > 0) {
        // Bu kadar km gitsek hangi noktada reserve'e düşüyoruz?
        const kmToReserve =
          Math.max(0, (currentLiters - reserveLiters) / (l100 / 100));

        if (kmToReserve >= remainingSegKm) {
          // Segmenti sorunsuz geçeriz
          const consumed = (remainingSegKm * l100) / 100;
          currentLiters -= consumed;
          litersConsumedTotal += consumed;
          cursorKm += remainingSegKm;
          remainingSegKm = 0;
        } else {
          // Segment içinde bir noktada tam dolum yapmamız gerek.
          // Pragmatik simülasyon: stop'u bu ilin entry km'sinde (ya da segmentin
          // başladığı yerde) tetikliyoruz, sonra devam.
          const consumeBeforeStop = (kmToReserve * l100) / 100;
          currentLiters -= consumeBeforeStop;
          litersConsumedTotal += consumeBeforeStop;
          cursorKm += kmToReserve;
          remainingSegKm -= kmToReserve;

          const brandPrices: FuelPrices =
            this.fuelPrice.getBrandPrice(preferredBrand, seg.provinceCode);
          const pricePerLiter = brandPrices[fuelKey];
          const litersPurchased = tankCapacity - currentLiters;
          const cost = litersPurchased * pricePerLiter;

          const tankBeforePct = (currentLiters / tankCapacity) * 100;
          currentLiters = tankCapacity;
          const tankAfterPct = 100;

          stops.push({
            atKm: round(cursorKm),
            provinceCode: seg.provinceCode,
            provinceName: getProvinceName(seg.provinceCode),
            brandId: preferredBrand,
            litersPurchased: round(litersPurchased, 2),
            pricePerLiter: round(pricePerLiter, 2),
            cost: round(cost, 2),
            tankBeforePct: round(tankBeforePct, 1),
            tankAfterPct,
          });

          if (stops.length > 20) {
            warnings.push('20+ ikmal durağı — muhtemelen tank çok küçük / rota uzun.');
            break;
          }
        }
      }
    }

    const totalFuelCost = stops.reduce((a, s) => a + s.cost, 0);
    const totalLitersPurchased = stops.reduce((a, s) => a + s.litersPurchased, 0);
    const endingFuelPct = Math.max(0, (currentLiters / tankCapacity) * 100);

    if (stops.length === 0) {
      warnings.push('Bu rotada yakıt alman gerekmiyor.');
    }

    return {
      stops,
      totalFuelCost: round(totalFuelCost, 2),
      totalLitersPurchased: round(totalLitersPurchased, 2),
      litersConsumedTotal: round(litersConsumedTotal, 2),
      endingFuelPct: round(endingFuelPct, 1),
      warnings,
    };
  }

  private mapFuelKey(fuelType: string): keyof FuelPrices {
    const t = fuelType.toUpperCase();
    if (t === 'DIZEL' || t === 'DIESEL') return 'diesel';
    if (t === 'LPG') return 'lpg';
    return 'petrol';
  }
}

function round(n: number, d = 1): number {
  const m = Math.pow(10, d);
  return Math.round(n * m) / m;
}
