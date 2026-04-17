import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { DirectionsRoute, RoutesV2TollInfo } from '../routes/dto/google-maps.dto';
import { Vehicle } from '@prisma/client';
import { TollsCalculatorService } from './tolls-calculator.service';
import { TollGuruService } from './tollguru.service';
import { TollCalculationResult } from './dto/toll-calculation.dto';

/**
 * Toll orchestrator.
 *
 * Provider stratejisi (ENV `TOLL_PROVIDER`):
 *  - `tollguru` : sadece TollGuru; basarisizsa bos sonuc.
 *  - `local`    : sadece KGM seed + km tahmini fallback.
 *  - `auto` (default): TollGuru -> KGM local -> estimate zinciri.
 */
@Injectable()
export class TollsService {
  private readonly logger = new Logger(TollsService.name);
  private readonly provider: 'tollguru' | 'local' | 'auto';

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    private calculator: TollsCalculatorService,
    private tollGuru: TollGuruService,
  ) {
    const configured = (
      this.configService.get<string>('tollguru.provider') || 'auto'
    ).toLowerCase();
    this.provider = (['tollguru', 'local', 'auto'].includes(configured)
      ? configured
      : 'auto') as 'tollguru' | 'local' | 'auto';
  }

  async getAllStations() {
    return this.prisma.tollStation.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  async getAllRates() {
    const rates = await this.prisma.tollRate.findMany({
      where: { isActive: true },
      include: { tollStation: true },
      orderBy: { amount: 'asc' },
    });

    const grouped: Record<string, any> = {};
    for (const rate of rates) {
      if (!grouped[rate.tollStationId]) {
        grouped[rate.tollStationId] = { station: rate.tollStation, rates: [] };
      }
      grouped[rate.tollStationId].rates.push(rate);
    }
    return Object.values(grouped);
  }

  async getRatesForStation(stationId: string) {
    const station = await this.prisma.tollStation.findUnique({ where: { id: stationId } });
    if (!station) throw new BadRequestException('Toll station not found');
    const rates = await this.prisma.tollRate.findMany({
      where: { tollStationId: stationId, isActive: true },
    });
    return { station, rates };
  }

  /**
   * Rota icin toll hesabi. `googleTollHint` Routes API v2'den gelen ham tahmin;
   * su an bilgilendirme amacli logla tutuluyor — gelecekte TollGuru/KGM sonucuyla
   * carsi yapmak icin kullanilabilir.
   */
  async calculateTollCost(
    route: DirectionsRoute,
    vehicle: Vehicle | null,
    googleTollHint?: RoutesV2TollInfo,
  ): Promise<{ totalCost: number; details: TollCalculationResult['details']; source?: string }> {
    if (googleTollHint?.estimatedPrice?.length) {
      const p = googleTollHint.estimatedPrice[0];
      this.logger.debug(
        `Google v2 toll hint: ${p.units ?? '?'} ${p.currencyCode ?? ''} (nanos=${p.nanos ?? 0})`,
      );
    }

    const leg = route.legs?.[0];
    if (!leg) return { totalCost: 0, details: [], source: 'none' };

    // 1) TollGuru (provider izin veriyorsa)
    if (this.provider === 'tollguru' || this.provider === 'auto') {
      const origin = { lat: leg.start_location.lat, lng: leg.start_location.lng };
      const destination = { lat: leg.end_location.lat, lng: leg.end_location.lng };
      const tg = await this.tollGuru.computeTolls({ origin, destination, vehicle });
      if (tg && tg.totalCost > 0) {
        // TollGuru barrier tipi toll'larda (kopru/tunel) name+lat+lng dolu doner;
        // HGS system/gantry tipinde ise genelde isim/koordinat bos geliyor. Cozum:
        // (1) rota polyline'i boyunca KGM seed'den sirali gise eslesmesi al,
        // (2) isimsiz/koordinatsiz TollGuru detaylarini sirayla KGM eslesmeleriyle doldur.
        await this.calculator.mergeDetailsWithRouteStations(route, tg.details);
        // Yine de eksik kalani fuzzy isim eslesmesiyle son bir kez dene (safety net).
        await this.calculator.enrichDetailsWithCoordinates(tg.details);
        const withCoords = tg.details.filter((d) => d.lat && d.lng).length;
        this.logger.log(
          `Toll: tollguru total=${tg.totalCost} (${tg.details.length} stations, ${withCoords} with coords)`,
        );
        return tg;
      }
      if (this.provider === 'tollguru') {
        // Sadece TollGuru isteniyorsa ve bos donuyorsa 0 don; estimate fallback yok.
        return { totalCost: 0, details: [], source: 'tollguru' };
      }
    }

    // 2) KGM local seed (+ estimate fallback icerir)
    const local = await this.calculator.calculateFromLocalKGM(route, vehicle);
    this.logger.log(`Toll: ${local.source} total=${local.totalCost} (${local.details.length})`);
    return local;
  }

  async updateTollData(): Promise<{ imported: number; updated: number }> {
    // KGM entegrasyonu placeholder (ayri is).
    return { imported: 0, updated: 0 };
  }
}
