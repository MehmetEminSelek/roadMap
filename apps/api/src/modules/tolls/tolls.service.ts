import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { DirectionsRoute } from '../routes/dto/google-maps.dto';
import { Vehicle } from '@prisma/client';

@Injectable()
export class TollsService {
  constructor(private prisma: PrismaService) { }

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
        grouped[rate.tollStationId] = {
          station: rate.tollStation,
          rates: [],
        };
      }
      grouped[rate.tollStationId].rates.push(rate);
    }

    return Object.values(grouped);
  }

  async getRatesForStation(stationId: string) {
    const station = await this.prisma.tollStation.findUnique({
      where: { id: stationId },
    });

    if (!station) {
      throw new BadRequestException('Toll station not found');
    }

    const rates = await this.prisma.tollRate.findMany({
      where: { tollStationId: stationId, isActive: true },
    });

    return { station, rates };
  }

  async calculateTollCost(
    route: DirectionsRoute,
    vehicle: Vehicle | null,
  ): Promise<{
    totalCost: number;
    details: { name: string; highway: string; amount: number; lat: number; lng: number }[];
  }> {
    // Get stations with coordinates and their rates
    const stations = await this.prisma.tollStation.findMany({
      where: {
        isActive: true,
        lat: { not: null },
        lng: { not: null },
      },
      include: {
        tolls: { where: { isActive: true } },
      },
    });

    if (stations.length === 0 || !route.legs?.[0]?.steps) {
      return { totalCost: this.estimateTollCost(route, vehicle), details: [] };
    }

    // Decode ALL step-level polylines for accurate matching
    const polylinePoints: { lat: number; lng: number }[] = [];
    for (const step of route.legs[0].steps) {
      if (step.polyline?.points) {
        polylinePoints.push(...decodePolyline(step.polyline.points));
      }
    }
    if (polylinePoints.length === 0 && route.overview_polyline?.points) {
      polylinePoints.push(...decodePolyline(route.overview_polyline.points));
    }

    const vehicleType = this.getVehicleType(vehicle);
    let totalCost = 0;
    const details: { name: string; highway: string; amount: number; lat: number; lng: number }[] = [];
    const highwayMatches: Record<string, { name: string; amount: number; lat: number; lng: number }[]> = {};

    for (const station of stations) {
      if (station.lat === null || station.lng === null) continue;

      // Check if any polyline point is within 2km of the station
      // Using step-level polylines allows tighter radius
      const isOnRoute = polylinePoints.some(
        (point) => haversineDistance(point, { lat: station.lat!, lng: station.lng! }) < 2.0,
      );

      if (isOnRoute) {
        const rate = station.tolls.find((r) => r.vehicleType === vehicleType);
        if (rate && Number(rate.amount) > 0) {
          const highway = (station as any).highway || 'Diğer';
          if (!highwayMatches[highway]) {
            highwayMatches[highway] = [];
          }

          highwayMatches[highway].push({ name: station.name, amount: Number(rate.amount), lat: station.lat!, lng: station.lng! });
        }
      }
    }

    // KGM Pricing Logic:
    // - Bridges/Tunnels (Köprü, Tünel): Point-based, sum them up
    // - Highways (Otoyol): Cumulative/distance-based from main entry, take the MAX matched exit fee
    for (const [highway, matches] of Object.entries(highwayMatches)) {
      if (highway.includes('Köprü') || highway.includes('Tünel') || highway === 'Diğer') {
        matches.forEach((m) => {
          totalCost += m.amount;
          details.push({ name: m.name, highway, amount: m.amount, lat: m.lat, lng: m.lng });
        });
      } else {
        const maxMatch = matches.reduce((max, current) =>
          current.amount > max.amount ? current : max,
        );
        totalCost += maxMatch.amount;
        details.push({ name: maxMatch.name, highway, amount: maxMatch.amount, lat: maxMatch.lat, lng: maxMatch.lng });
      }
    }

    if (details.length > 0 && process.env.NODE_ENV !== 'production') {
      console.log(`Gişe eşleşmeleri (${details.length}), toplam: ${totalCost}₺`);
    }

    // Fall back to estimate if no stations matched
    if (totalCost === 0) {
      const estimatedCost = this.estimateTollCost(route, vehicle);
      if (estimatedCost > 0) {
        return {
          totalCost: estimatedCost,
          details: [
            {
              name: 'Otoyol / Köprü Kullanım Tahmini',
              highway: 'KGM İstasyon Eşleşmesi Kurulamadı',
              amount: estimatedCost,
              lat: 0,
              lng: 0,
            },
          ],
        };
      }
      return { totalCost: 0, details: [] };
    }

    return { totalCost, details };
  }

  private getVehicleType(vehicle: Vehicle | null): string {
    if (!vehicle) return 'CAR';
    // Determine vehicle type based on weight
    if (vehicle.weight < 400) return 'MOTORCYCLE';
    if (vehicle.weight > 7500) return 'TRUCK';
    if (vehicle.weight > 3500) return 'VAN';
    return 'CAR';
  }

  private estimateTollCost(route: DirectionsRoute, vehicle: Vehicle | null): number {
    const leg = route.legs[0];
    const distanceKm = leg.distance.value / 1000;

    // Base toll rate per km for Turkish highways
    const ratePerKm = 0.15;
    let tollCost = distanceKm * ratePerKm;

    if (tollCost < 30) tollCost = 30;

    return Math.round(tollCost * 100) / 100;
  }

  async updateTollData(): Promise<{ imported: number; updated: number }> {
    // Placeholder for KGM API integration
    return { imported: 0, updated: 0 };
  }
}

// Decode Google Maps encoded polyline string into lat/lng pairs
function decodePolyline(encoded: string): { lat: number; lng: number }[] {
  const points: { lat: number; lng: number }[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let shift = 0;
    let result = 0;
    let byte: number;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    lat += result & 1 ? ~(result >> 1) : result >> 1;

    shift = 0;
    result = 0;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    lng += result & 1 ? ~(result >> 1) : result >> 1;

    points.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }

  return points;
}

// Calculate distance in km between two lat/lng points using Haversine formula
function haversineDistance(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h = sinLat * sinLat + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinLng * sinLng;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}
