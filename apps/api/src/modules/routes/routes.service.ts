import { Injectable, NotFoundException, ForbiddenException, BadRequestException, Inject } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateRouteDto } from './dto/create-route.dto';
import { RouteQueryDto } from './dto/route-query.dto';
import { GoogleMapsService } from './google-maps.service';
import { FuelAiService } from '../fuel-ai/fuel-ai.service';
import { TollsService } from '../tolls/tolls.service';
import { PlacesService } from '../places/places.service';
import { RouteStatus } from '@prisma/client';
import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager';
import { normalizeTr } from '../../common/text/normalize-tr';

@Injectable()
export class RoutesService {
  constructor(
    private prisma: PrismaService,
    private googleMaps: GoogleMapsService,
    private fuelAi: FuelAiService,
    private tolls: TollsService,
    private places: PlacesService,
    @Inject(CACHE_MANAGER) private cache: Cache,
  ) { }

  async calculateRoute(createRouteDto: CreateRouteDto, userId: string): Promise<any> {
    const { origin, destination, vehicleId, stopsCount = 0 } = createRouteDto;

    // Cache key: normalized origin|destination|vehicleId|climateControl
    const cacheKey = `route:v1:${normalizeTr(origin)}|${normalizeTr(destination)}|${vehicleId ?? 'anon'}|${!!createRouteDto.hasClimateControl}`;
    const cached = await this.cache.get<any>(cacheKey);
    if (cached) {
      // Cache'den dönerken kullanıcıya özel Route row'u oluştur (hesaplama bypass)
      return this.persistAndReturnFromCache(cached, userId, vehicleId, createRouteDto);
    }

    // 1. Get routes from Google Routes API v2 (primary + alternatifler, tek cagride)
    const allRoutes = await this.googleMaps.getRoutesWithAdvisory(origin, destination, 'driving', {
      alternatives: true,
    });

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

    // 3. Calculate toll cost (TollGuru -> KGM-local -> km estimate fallback zinciri)
    const tollData = await this.tolls.calculateTollCost(route, vehicle, googleTollHint);

    // 4. Look up EPA fuel economy data for this vehicle (if available)
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
        orderBy: { year: 'desc' }, // en güncel trim
        select: { fuelEconomyL100: true },
      });

      if (epaMatch?.fuelEconomyL100) {
        epaFuelEconomyL100 = epaMatch.fuelEconomyL100;
        console.log(`📊 EPA verisi bulundu: ${vehicle.brand} ${vehicle.model} → ${epaFuelEconomyL100} L/100km`);
      } else {
        console.log(`⚠️ EPA verisi bulunamadı: ${vehicle.brand} ${vehicle.model} (${vehicle.fuelType}), AI tahmini kullanılacak`);
      }
    }

    // 5. Predict fuel cost (EPA verisi varsa AI bypass edilir, yoksa AI kullanılır)
    const fuelResult = await this.fuelAi.calculateFuelCost({
      distanceKm,
      durationSeconds: leg.duration.value,
      hasClimateControl: createRouteDto.hasClimateControl,
      // EPA L/100km → toplam litre (bu mesafe için)
      averageConsumption: epaFuelEconomyL100 ? (distanceKm * epaFuelEconomyL100) / 100 : undefined,
      vehicleType: vehicle ? vehicle.fuelType.toLowerCase() : undefined,
    });

    // 5. Calculate total cost
    const totalCost = tollData.totalCost + fuelResult.fuelCost;

    // 5b. Compute alternatives in parallel (skip primary, same vehicle assumptions)
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
    const alternatives = (await Promise.all(altTasks)).filter((a): a is NonNullable<typeof a> => !!a);

    // 6. Save route to database (transaction for data consistency)
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

    // 7. Get nearby places for stops if requested
    let stops = [];
    if (stopsCount > 0) {
      stops = await this.places.getStopsAlongRoute(route, stopsCount);
    }

    // 8. Get rest areas along the route (20km radius)
    let nearbyRestAreas: { name: string; lat: number; lng: number; type: string; rating?: number; vicinity?: string }[] = [];
    try {
      nearbyRestAreas = await this.places.getRestAreasAlongRoute(route, 20);
    } catch (e) {
      console.error('[RoutesService] Rest areas fetch failed:', e);
      // Non-critical, continue without rest areas
    }

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
    };

    // Cache the compute result snapshot (6 hours)
    await this.cache.set(cacheKey, {
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
    }, 6 * 60 * 60 * 1000);

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
    const { tollData, fuelResult, totalCost, stops, nearbyRestAreas, duration, distance, allRoutes } = cached;
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
      alternatives: cached.alternatives,
    };
  }

  /** Decode Google encoded polylines from each step and flatten into coord list. */
  private decodeStepsToCoords(steps: any[]): { lat: number; lng: number }[] {
    return (steps || []).flatMap((step) => {
      const encoded = step?.polyline?.points || '';
      const coords: { lat: number; lng: number }[] = [];
      let index = 0, lat = 0, lng = 0;
      while (index < encoded.length) {
        let b: number, shift = 0, result = 0;
        do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
        lat += (result & 1) ? ~(result >> 1) : (result >> 1);
        shift = 0; result = 0;
        do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
        lng += (result & 1) ? ~(result >> 1) : (result >> 1);
        coords.push({ lat: lat / 1e5, lng: lng / 1e5 });
      }
      return coords;
    });
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
