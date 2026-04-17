import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { GoogleMapsService } from '../routes/google-maps.service';
import { DirectionsRoute, PlaceCandidate } from '../routes/dto/google-maps.dto';
import { PlaceType } from '@prisma/client';

@Injectable()
export class PlacesService {
  constructor(
    private prisma: PrismaService,
    private googleMaps: GoogleMapsService,
  ) {}

  async getNearbyPlaces(
    lat: number,
    lng: number,
    type: string = 'gas_station',
    radius: number = 5000,
  ): Promise<PlaceCandidate[]> {
    return this.googleMaps.getNearbyPlaces(lat, lng, radius, type);
  }

  async getStopsForRoute(origin: string, destination: string, stopsCount: number = 1) {
    // Get the route first
    const route = await this.googleMaps.getRouteDirections(origin, destination);

    if (!route?.routes?.[0]) {
      throw new BadRequestException('Could not calculate route');
    }

    return this.getStopsAlongRoute(route.routes[0], stopsCount);
  }

  async getStopsAlongRoute(route: DirectionsRoute, count: number = 1): Promise<any[]> {
    const leg = route.legs[0];
    const totalDistance = leg.distance.value;
    const totalDuration = leg.duration.value;

    // Calculate stop intervals
    const interval = totalDistance / (count + 1);
    const stops: any[] = [];

    for (let i = 1; i <= count; i++) {
      const targetDistance = interval * i;

      // Find the step that contains this distance
      let cumulativeDistance = 0;
      let stopStep = null;

      for (const step of leg.steps) {
        cumulativeDistance += step.distance.value;
        if (cumulativeDistance >= targetDistance) {
          stopStep = step;
          break;
        }
      }

      if (stopStep) {
        // Get places near this location
        const nearby = await this.googleMaps.getNearbyPlaces(
          stopStep.end_location.lat,
          stopStep.end_location.lng,
          2000,
          'restaurant', // Default to restaurants
        );

        stops.push({
          distance: Math.round(targetDistance / 1000),
          location: {
            lat: stopStep.end_location.lat,
            lng: stopStep.end_location.lng,
          },
          address: leg.end_address,
          nearbyPlaces: nearby.slice(0, 3), // Top 3 options
        });
      }
    }

    return stops;
  }

  /**
   * Discover rest areas along the route within a given radius.
   * Samples points every ~80km and searches for gas stations & restaurants.
   */
  async getRestAreasAlongRoute(
    route: DirectionsRoute,
    radiusKm: number = 20,
  ): Promise<{ name: string; lat: number; lng: number; type: string; rating?: number; vicinity?: string }[]> {
    const leg = route.legs[0];
    if (!leg?.steps?.length) return [];

    const totalDistance = leg.distance.value; // meters
    const SAMPLE_INTERVAL = 80000; // sample every 80km
    const sampleCount = Math.max(1, Math.floor(totalDistance / SAMPLE_INTERVAL));

    // Collect sample points along the route
    const samplePoints: { lat: number; lng: number }[] = [];
    let cumulativeDistance = 0;
    let nextSampleAt = SAMPLE_INTERVAL;

    for (const step of leg.steps) {
      cumulativeDistance += step.distance.value;
      if (cumulativeDistance >= nextSampleAt && samplePoints.length < sampleCount) {
        samplePoints.push({
          lat: step.end_location.lat,
          lng: step.end_location.lng,
        });
        nextSampleAt += SAMPLE_INTERVAL;
      }
    }

    // If no sample points (short route), use midpoint
    if (samplePoints.length === 0) {
      const midIdx = Math.floor(leg.steps.length / 2);
      if (leg.steps[midIdx]) {
        samplePoints.push({
          lat: leg.steps[midIdx].end_location.lat,
          lng: leg.steps[midIdx].end_location.lng,
        });
      }
    }

    // Search for rest areas near each sample point
    const allRestAreas: { name: string; lat: number; lng: number; type: string; rating?: number; vicinity?: string }[] = [];
    const seenNames = new Set<string>();

    for (const point of samplePoints) {
      try {
        const places = await this.googleMaps.getNearbyPlaces(
          point.lat,
          point.lng,
          radiusKm * 1000,
          'gas_station',
        );

        for (const place of places.slice(0, 5)) {
          const name = place.name || '';
          if (seenNames.has(name)) continue;
          seenNames.add(name);
          allRestAreas.push({
            name,
            lat: place.geometry?.location?.lat ?? point.lat,
            lng: place.geometry?.location?.lng ?? point.lng,
            type: 'GAS_STATION',
            rating: place.rating,
            vicinity: place.formatted_address,
          });
        }
      } catch (e) {
        console.error(`[PlacesService] Rest area search failed at (${point.lat}, ${point.lng}):`, e);
      }
    }

    return allRestAreas;
  }

  async addFavoritePlace(
    userId: string,
    name: string,
    lat: number,
    lng: number,
    type: string = 'GAS_STATION',
  ) {
    const placeType = this.validatePlaceType(type);

    return this.prisma.favoritePlace.create({
      data: {
        userId,
        name,
        lat,
        lng,
        type: placeType,
      },
    });
  }

  async getFavoritePlaces(userId: string) {
    return this.prisma.favoritePlace.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getFavoriteRoutes(userId: string) {
    return this.prisma.favoriteRoute.findMany({
      where: { userId },
      include: { route: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  private validatePlaceType(type: string): PlaceType {
    const validTypes = ['GAS_STATION', 'RESTAURANT', 'SERVICE_AREA', 'HOTEL', 'PARK'];
    const upperType = type.toUpperCase();

    if (validTypes.includes(upperType)) {
      return upperType as PlaceType;
    }

    return 'GAS_STATION' as PlaceType;
  }
}
