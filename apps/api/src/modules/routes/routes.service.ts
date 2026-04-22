import { Injectable, NotFoundException, ForbiddenException, BadRequestException, Inject } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateRouteDto } from './dto/create-route.dto';
import { RouteQueryDto } from './dto/route-query.dto';
import { GoogleMapsService } from './google-maps.service';
import { FuelAiService } from '../fuel-ai/fuel-ai.service';
import { FuelSimulationService } from '../fuel-ai/fuel-simulation.service';
import { TollsService } from '../tolls/tolls.service';
import { PlacesService } from '../places/places.service';
import { RouteStatus } from '@prisma/client';
import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager';
import { normalizeTr } from '../../common/text/normalize-tr';
import { buildCityCacheKey } from '../../common/text/extract-city';
import { extractProvincesFromCoords } from '../../common/geo/route-provinces';
import { decodeSteps as decodeStepsUtil } from '../../common/geo/polyline-decode';

@Injectable()
export class RoutesService {
  constructor(
    private prisma: PrismaService,
    private googleMaps: GoogleMapsService,
    private fuelAi: FuelAiService,
    private fuelSim: FuelSimulationService,
    private tolls: TollsService,
    private places: PlacesService,
    @Inject(CACHE_MANAGER) private cache: Cache,
  ) { }

  async calculateRoute(createRouteDto: CreateRouteDto, userId: string): Promise<any> {
    const { origin, destination, vehicleId, stopsCount = 0 } = createRouteDto;

    // ── İKİ KATMANLI CACHE STRATEJİSİ ───────────────────────────────
    // Katman 1: Tam adres cache (birebir aynı origin+destination+araç)
    //   → Toll, fuel, alternatifler dahil tam sonuç. 6 saat TTL.
    // Katman 2: İl bazlı cache ("istanbul|ankara" gibi)
    //   → Google API yanıtı (allRoutes). 12 saat TTL.
    //   → Farklı mahallelerden gelen kullanıcılar aynı Google API sonucunu paylaşır,
    //     ama toll/fuel hesabı kullanıcının aracına göre yeniden yapılır.
    // ─────────────────────────────────────────────────────────────────

    const exactCacheKey = `route:exact:v1:${normalizeTr(origin)}|${normalizeTr(destination)}|${vehicleId ?? 'anon'}|${!!createRouteDto.hasClimateControl}`;
    const cityCacheKey = buildCityCacheKey(origin, destination);

    // Katman 1: Birebir aynı arama — tam cache hit
    const exactCached = await this.cache.get<any>(exactCacheKey);
    if (exactCached) {
      console.log(`🎯 [Cache] Exact HIT: ${exactCacheKey}`);
      return this.persistAndReturnFromCache(exactCached, userId, vehicleId, createRouteDto);
    }

    // Katman 2: İl bazlı Google API cache — API çağrısından tasarruf
    let allRoutes: any[];
    const cityCached = await this.cache.get<any>(cityCacheKey);

    if (cityCached) {
      console.log(`🏙️ [Cache] City-level HIT: ${cityCacheKey} — Google API çağrısı atlandı`);
      allRoutes = cityCached;
    } else {
      console.log(`🌐 [Cache] MISS — Google API çağrısı yapılıyor: ${origin} → ${destination}`);
      // 1. Get routes from Google Routes API v2 (primary + alternatifler, tek cagride)
      allRoutes = await this.googleMaps.getRoutesWithAdvisory(origin, destination, 'driving', {
        alternatives: true,
      });

      // İl bazlı cache'e yaz (12 saat TTL) — arka planda
      this.cache.set(cityCacheKey, allRoutes, 12 * 60 * 60 * 1000).catch(() => {});
    }

    if (!allRoutes.length || !allRoutes[0].legacy?.routes?.[0]) {
      throw new BadRequestException('Could not calculate route. Please check locations.');
    }

    const primary = allRoutes[0];
    const googleRoute = primary.legacy;
    const googleTollHint = primary.tollInfo;
    const route = googleRoute.routes[0];
    const leg = route.legs[0];

    // 2. Fetch vehicle details implicitly if vehicleId is provided
    const vehicle = vehicleId ? await this.prisma.vehicle.findUnique({ where: { id: vehicleId } }) : null;

    // 3. EPA lookup (gerekiyorsa) — primary VE tüm alternatifler için ortak
    const distanceKm = leg.distance.value / 1000;
    let epaFuelEconomyL100: number | undefined;

    if (vehicle) {
      const epaMatch = await this.prisma.vehicleTrim.findFirst({
        where: {
          vehicleModel: {
            name: vehicle.model,
            vehicleMake: { name: vehicle.brand },
          },
          fuelType: vehicle.fuelType,
        },
        orderBy: { year: 'desc' },
        select: { fuelEconomyL100: true },
      });

      if (epaMatch?.fuelEconomyL100) {
        epaFuelEconomyL100 = epaMatch.fuelEconomyL100;
        console.log(`📊 EPA verisi bulundu: ${vehicle.brand} ${vehicle.model} → ${epaFuelEconomyL100} L/100km`);
      } else {
        console.log(`⚠️ EPA verisi bulunamadı: ${vehicle.brand} ${vehicle.model} (${vehicle.fuelType}), AI tahmini kullanılacak`);
      }
    }

    // ─────────────────────────────────────────────────────────────────
    // 4-8. FULL PARALLEL FAN-OUT
    // Tüm ağır işler (toll, fuel, alternatifler, stops, rest areas)
    // tek bir Promise.all içinde eş zamanlı çalışır.
    // Toplam süre = en yavaş tek çağrı süresi
    // ─────────────────────────────────────────────────────────────────

    const primaryTollPromise = this.tolls.calculateTollCost(route, vehicle, googleTollHint);

    const primaryFuelPromise = this.fuelAi.calculateFuelCost({
      distanceKm,
      durationSeconds: leg.duration.value,
      hasClimateControl: createRouteDto.hasClimateControl,
      acOn: createRouteDto.hasClimateControl,
      cruisingSpeedKph: createRouteDto.cruisingSpeedKph,
      engineDisplacementL: createRouteDto.engineDisplacementL,
      ambientTempC: createRouteDto.ambientTempC,
      extraLoadKg: createRouteDto.extraLoadKg,
      headwindKph: createRouteDto.headwindKph,
      rainLevel: createRouteDto.rainLevel,
      elevationGainM: createRouteDto.elevationGainM,
      averageConsumption: epaFuelEconomyL100 ? (distanceKm * epaFuelEconomyL100) / 100 : undefined,
      vehicleType: vehicle ? vehicle.fuelType.toLowerCase() : undefined,
    });

    // Yakıt ikmali simülasyonu — sadece vehicleId varsa.
    const fuelSimPromise: Promise<any> = vehicle
      ? (async () => {
          try {
            const coords = this.decodeStepsToCoords(leg.steps);
            const routeProvinces = extractProvincesFromCoords(coords);
            return await this.fuelSim.simulate({
              vehicleId: vehicle.id,
              initialFuelPct: createRouteDto.initialFuelPct ?? 80,
              // reserveThresholdPct: verilmediğinde simülasyon default'u (%20) kullanır.
              reserveThresholdPct: createRouteDto.reserveThresholdPct,
              routeProvinces,
              totalDistanceKm: distanceKm,
              fallbackL100: epaFuelEconomyL100,
              cruisingSpeedKph: createRouteDto.cruisingSpeedKph,
              acOn: createRouteDto.hasClimateControl,
              engineDisplacementL: createRouteDto.engineDisplacementL,
              ambientTempC: createRouteDto.ambientTempC,
              extraLoadKg: createRouteDto.extraLoadKg,
              headwindKph: createRouteDto.headwindKph,
              rainLevel: createRouteDto.rainLevel,
              elevationGainM: createRouteDto.elevationGainM,
            });
          } catch (e) {
            console.error('[RoutesService] Fuel simulation failed:', e);
            return null;
          }
        })()
      : Promise.resolve(null);

    // Her alternatif rota kendi içinde toll+fuel'ı paralel hesaplar
    const altTasks = allRoutes.slice(1).map(async (alt, idx) => {
      const i = idx + 1;
      try {
        const altRoute = alt.legacy.routes[0];
        const altLeg = altRoute.legs[0];
        const altDistanceKm = altLeg.distance.value / 1000;

        const [altToll, altFuel] = await Promise.all([
          this.tolls.calculateTollCost(altRoute, vehicle, alt.tollInfo),
          this.fuelAi.calculateFuelCost({
            distanceKm: altDistanceKm,
            durationSeconds: altLeg.duration.value,
            hasClimateControl: createRouteDto.hasClimateControl,
            acOn: createRouteDto.hasClimateControl,
            cruisingSpeedKph: createRouteDto.cruisingSpeedKph,
            engineDisplacementL: createRouteDto.engineDisplacementL,
            ambientTempC: createRouteDto.ambientTempC,
            extraLoadKg: createRouteDto.extraLoadKg,
            headwindKph: createRouteDto.headwindKph,
            rainLevel: createRouteDto.rainLevel,
            elevationGainM: createRouteDto.elevationGainM,
            averageConsumption: epaFuelEconomyL100 ? (altDistanceKm * epaFuelEconomyL100) / 100 : undefined,
            vehicleType: vehicle ? vehicle.fuelType.toLowerCase() : undefined,
          }),
        ]);

        return {
          index: i,
          summary: altRoute.summary || `Alternatif ${i}`,
          distance: altLeg.distance.value,
          distanceText: altLeg.distance.text,
          duration: altLeg.duration.value,
          durationText: altLeg.duration.text,
          tollCost: altToll.totalCost,
          tollDetails: altToll.details,
          fuelCost: altFuel.fuelCost,
          totalCost: altToll.totalCost + altFuel.fuelCost,
          routeCoordinates: this.decodeStepsToCoords(altLeg.steps),
        };
      } catch (e) {
        console.error(`[RoutesService] Alternative ${i} compute failed:`, e);
        return null;
      }
    });

    // Stops promise (non-critical — hata verirse boş döner)
    const stopsPromise = stopsCount > 0
      ? this.places.getStopsAlongRoute(route, stopsCount).catch((e) => {
          console.error('[RoutesService] Stops fetch failed:', e);
          return [] as any[];
        })
      : Promise.resolve([] as any[]);

    // Rest areas promise (non-critical — hata verirse boş döner)
    const restAreasPromise = this.places.getRestAreasAlongRoute(route, 20).catch((e) => {
      console.error('[RoutesService] Rest areas fetch failed:', e);
      return [] as { name: string; lat: number; lng: number; type: string; rating?: number; vicinity?: string }[];
    });

    // ── TEK BİR AWAIT: her şey aynı anda çalışır ──
    const [tollData, fuelResult, fuelSimulation, altsSettled, stops, nearbyRestAreas] = await Promise.all([
      primaryTollPromise,
      primaryFuelPromise,
      fuelSimPromise,
      Promise.all(altTasks),
      stopsPromise,
      restAreasPromise,
    ]);

    const alternatives = altsSettled.filter((a): a is NonNullable<typeof a> => !!a);
    const totalCost = tollData.totalCost + fuelResult.fuelCost;

    // 6. DB kayıt — hesaplama bittiği anda persiste et
    const savedRoute = await this.prisma.$transaction(async (tx) => {
      return tx.route.create({
        data: {
          userId,
          vehicleId: vehicleId || null,
          origin,
          destination,
          originLat: leg.start_location.lat,
          originLng: leg.start_location.lng,
          destLat: leg.end_location.lat,
          destLng: leg.end_location.lng,
          googleRouteId: route.summary,
          distance: leg.distance.value,
          duration: leg.duration.value,
          routeCoordinates: JSON.stringify(this.decodeStepsToCoords(leg.steps)),
          routeStepsJson: JSON.stringify(leg.steps.map((s: any) => ({
            encodedPolyline: s.polyline?.points || '',
            congestion: s.congestion ?? 'FREE',
            trafficRatio: s.traffic_ratio ?? 1,
          }))),
          alternativesJson: alternatives.length > 0 ? (alternatives as any) : null,
          tollCost: tollData.totalCost,
          tollDetails: tollData.details as any,
          fuelCost: fuelResult.fuelCost,
          totalCost: totalCost,
          aiFuelEstimate: fuelResult.estimatedConsumption,
          aiConfidence: fuelResult.confidence,
          status: RouteStatus.COMPLETED,
        },
        include: {
          vehicle: true,
        },
      });
    });

    const result = {
      route: savedRoute,
      tollCost: tollData.totalCost,
      tollDetails: tollData.details,
      fuelCost: fuelResult.fuelCost,
      totalCost,
      fuelDetails: fuelResult,
      stops,
      nearbyRestAreas,
      duration: leg.duration.text,
      distance: leg.distance.text,
      alternatives,
      fuelSimulation: fuelSimulation || undefined,
    };

    // Tam sonuç cache — arka planda yaz (6 saat TTL)
    // NOT: fuelSimulation cache'lenmez; initialFuelPct kullanıcıya özel.
    this.cache.set(exactCacheKey, {
      tollData,
      fuelResult,
      totalCost,
      stops,
      nearbyRestAreas,
      duration: leg.duration.text,
      distance: leg.distance.text,
      alternatives,
      allRoutes,
      createRouteDto,
    }, 6 * 60 * 60 * 1000).catch(() => {});

    return result;
  }

  /**
   * Cache'ten dönen sonucu kullanıcıya özel Route row'u olarakpersist eder.
   */
  private async persistAndReturnFromCache(
    cached: any,
    userId: string,
    vehicleId: string | undefined,
    createRouteDto: CreateRouteDto,
  ): Promise<any> {
    const { tollData, fuelResult, totalCost, stops, nearbyRestAreas, duration, distance, allRoutes, alternatives } = cached;
    const primary = allRoutes[0];
    const googleRoute = primary.legacy;
    const route = googleRoute.routes[0];
    const leg = route.legs[0];

    const savedRoute = await this.prisma.route.create({
      data: {
        userId,
        vehicleId: vehicleId || null,
        origin: createRouteDto.origin,
        destination: createRouteDto.destination,
        originLat: leg.start_location.lat,
        originLng: leg.start_location.lng,
        destLat: leg.end_location.lat,
        destLng: leg.end_location.lng,
        googleRouteId: route.summary,
        distance: leg.distance.value,
        duration: leg.duration.value,
        routeCoordinates: JSON.stringify(this.decodeStepsToCoords(leg.steps)),
        routeStepsJson: JSON.stringify(leg.steps.map((s: any) => ({
          encodedPolyline: s.polyline?.points || '',
          congestion: s.congestion ?? 'FREE',
          trafficRatio: s.traffic_ratio ?? 1,
        }))),
        alternativesJson: alternatives && alternatives.length > 0 ? (alternatives as any) : null,
        tollCost: tollData.totalCost,
        tollDetails: tollData.details as any,
        fuelCost: fuelResult.fuelCost,
        totalCost: totalCost,
        aiFuelEstimate: fuelResult.estimatedConsumption,
        aiConfidence: fuelResult.confidence,
        status: RouteStatus.COMPLETED,
      },
      include: { vehicle: true },
    });

    // Cache hit path — yakıt simülasyonunu taze hesapla (initialFuelPct değişebilir).
    let cachedFuelSim: any = null;
    if (vehicleId) {
      try {
        const vehicle = await this.prisma.vehicle.findUnique({ where: { id: vehicleId } });
        if (vehicle) {
          const coords = this.decodeStepsToCoords(leg.steps);
          const routeProvinces = extractProvincesFromCoords(coords);
          cachedFuelSim = await this.fuelSim.simulate({
            vehicleId: vehicle.id,
            initialFuelPct: createRouteDto.initialFuelPct ?? 80,
            reserveThresholdPct: createRouteDto.reserveThresholdPct ?? 10,
            routeProvinces,
            totalDistanceKm: leg.distance.value / 1000,
            fallbackL100: fuelResult?.estimatedConsumption
              ? (fuelResult.estimatedConsumption * 100) / (leg.distance.value / 1000)
              : undefined,
          });
        }
      } catch (e) {
        console.error('[RoutesService] Cached fuel simulation failed:', e);
      }
    }

    return {
      route: savedRoute,
      tollCost: tollData.totalCost,
      tollDetails: tollData.details,
      fuelCost: fuelResult.fuelCost,
      totalCost,
      fuelDetails: fuelResult,
      stops,
      nearbyRestAreas,
      duration,
      distance,
      alternatives: alternatives || [],
      fuelSimulation: cachedFuelSim || undefined,
    };
  }

  /** Decode Google encoded polylines from each step and flatten into coord list. */
  private decodeStepsToCoords(steps: any[]): { lat: number; lng: number }[] {
    return decodeStepsUtil(steps);
  }

  async findAll(userId: string, query: RouteQueryDto): Promise<any> {
    const { page = 1, limit = 10, vehicleId, status } = query;
    const skip = (page - 1) * limit;
    const take = limit;

    const where: any = { userId };

    if (vehicleId) {
      where.vehicleId = vehicleId;
    }

    if (status) {
      where.status = status;
    }

    const [routes, total] = await Promise.all([
      this.prisma.route.findMany({
        where,
        skip,
        take,
        orderBy: [{ id: 'desc' }],
        include: { vehicle: true },
      }),
      this.prisma.route.count({ where }),
    ]);

    return {
      data: routes,
      meta: {
        total,
        page,
        lastPage: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string, userId: string): Promise<any> {
    const route = await this.prisma.route.findFirst({
      where: { id, userId },
      include: { vehicle: true },
    });

    if (!route) {
      throw new NotFoundException('Route not found');
    }

    return route;
  }

  async remove(id: string, userId: string): Promise<any> {
    await this.findOne(id, userId); // Check ownership
    await this.prisma.route.delete({ where: { id } });
    return { message: 'Route deleted successfully' };
  }

  async getStats(userId: string) {
    const routes = await this.prisma.route.findMany({
      where: { userId, status: RouteStatus.COMPLETED },
      select: {
        id: true,
        tollCost: true,
        fuelCost: true,
        totalCost: true,
        distance: true,
        duration: true,
      },
    });

    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay()); // Roughly Sunday/Monday depending on locale
    startOfWeek.setHours(0, 0, 0, 0);

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const totalRoutes = routes.length;
    let totalTollCost = 0;
    let totalFuelCost = 0;
    let totalCost = 0;
    let totalDistance = 0;
    let totalDuration = 0;
    
    let weeklyCost = 0;
    let monthlyCost = 0;

    for (const r of routes) {
      const cToll = Number(r.tollCost);
      const cFuel = Number(r.fuelCost);
      const cTot = Number(r.totalCost);

      totalTollCost += cToll;
      totalFuelCost += cFuel;
      totalCost += cTot;
      totalDistance += r.distance;
      totalDuration += r.duration;

      // Since createdAt is not in the database schema yet, we approximate
      // all fetched routes to be within the month/week for demo purposes.
      // Once `createdAt` is added to the schema, this can be filtered properly.
      weeklyCost += cTot;
      monthlyCost += cTot;
    }

    return {
      totalRoutes,
      totalTollCost: Math.round(totalTollCost * 100) / 100,
      totalFuelCost: Math.round(totalFuelCost * 100) / 100,
      totalCost: Math.round(totalCost * 100) / 100,
      totalDistance,
      totalDuration,
      weeklyCost: Math.round(weeklyCost * 100) / 100,
      monthlyCost: Math.round(monthlyCost * 100) / 100,
    };
  }

  async previewRoute(origin: string, destination: string) {
    return this.googleMaps.getRouteDirections(origin, destination);
  }
}
