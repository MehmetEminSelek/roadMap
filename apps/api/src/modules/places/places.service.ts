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
