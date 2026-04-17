import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import {
  GeocodingResult,
  DirectionsResult,
  DirectionsRoute,
  DirectionsLeg,
  DirectionsStep,
  PlacesResponse,
  PlaceCandidate,
  RoutesV2Response,
  RoutesV2Route,
  RoutesV2Leg,
  RoutesV2Step,
  RoutesV2TollInfo,
  RouteWithAdvisory,
} from './dto/google-maps.dto';
import { AxiosResponse } from 'axios';
import { RateLimiterService } from '../../common/rate-limiter/rate-limiter.service';
import { RetryService } from '../../common/retry/retry.service';

@Injectable()
export class GoogleMapsService {
  private readonly apiUrl: string;
  private readonly apiKey: string;
  private readonly rateLimitKey = 'google-maps';
  // Routes API v2 base (ayrı endpoint — legacy maps.googleapis.com ile aynı key).
  private readonly routesV2Url = 'https://routes.googleapis.com/directions/v2:computeRoutes';

  constructor(
    private configService: ConfigService,
    private httpService: HttpService,
    private rateLimiter: RateLimiterService,
    private retryService: RetryService,
  ) {
    this.apiUrl = this.configService.get<string>('googleMaps.apiUrl') || 'https://maps.googleapis.com/maps/api';
    this.apiKey = this.configService.get<string>('googleMaps.apiKey') || '';
  }

  async autocomplete(input: string): Promise<{ description: string; placeId: string }[]> {
    if (!input || input.length < 2) return [];

    // Wait for rate limit
    const delay = await this.rateLimiter.acquireLimit(this.rateLimitKey, 300, 60000); // 300 req/min for autocomplete
    if (delay > 0) await new Promise(resolve => setTimeout(resolve, delay));

    try {
      return await this.retryService.executeWithRetry(
        async () => {
          const response: AxiosResponse<any> = await firstValueFrom(
            this.httpService.get(
              `${this.apiUrl}/place/autocomplete/json`,
              {
                params: {
                  input,
                  key: this.apiKey,
                  language: 'tr',
                  components: 'country:tr',
                  types: 'geocode|establishment',
                },
              },
            ),
          );
          if (response.data.status === 'OK' && response.data.predictions?.length > 0) {
            return response.data.predictions.map((p: any) => ({
              description: p.description,
              placeId: p.place_id,
            }));
          }
          return [];
        },
        { maxRetries: 2, baseDelayMs: 500 },
        'Google Autocomplete',
      );
    } catch (error) {
      console.error('Autocomplete error:', error);
      return [];
    }
  }

  async geocode(address: string): Promise<GeocodingResult> {
    // Wait for rate limit
    const delay = await this.rateLimiter.acquireLimit(this.rateLimitKey, 60, 60000); // 60 req/min
    if (delay > 0) await new Promise(resolve => setTimeout(resolve, delay));

    try {
      return await this.retryService.executeWithRetry(
        async () => {
          const response: AxiosResponse<any> = await firstValueFrom(
            this.httpService.get(
              `${this.apiUrl}/geocode/json`,
              {
                params: {
                  address,
                  key: this.apiKey,
                },
              },
            ),
          );

          if (response.data.status === 'OK' && response.data.results?.length > 0) {
            return response.data.results[0];
          }

          throw new BadRequestException(`Geocoding failed: ${response.data.error_message || 'No results found'}`);
        },
        { maxRetries: 3, baseDelayMs: 1000 },
        'Google Geocoding',
      );
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException(`Could not geocode address: ${address}`);
    }
  }

  /**
   * Google Routes API v2 (computeRoutes) ile rota hesaplar.
   * Tek cagrida adres->rota (geocode gerekmiyor) + trafik-farkindalikli sure + toll/fuel tahmini.
   */
  async getRouteWithAdvisory(
    origin: string,
    destination: string,
    mode: 'driving' | 'walking' | 'bicycling' | 'transit' = 'driving',
  ): Promise<RouteWithAdvisory> {
    const all = await this.getRoutesWithAdvisory(origin, destination, mode, { alternatives: false });
    return all[0];
  }

  /**
   * Google Routes v2 — alternatifler dahil. computeAlternativeRoutes=true ile
   * genellikle 2-3 rota doner (primary + alternatifler). Her rotaya toll/fuel
   * advisory'si ekli gelir.
   */
  async getRoutesWithAdvisory(
    origin: string,
    destination: string,
    mode: 'driving' | 'walking' | 'bicycling' | 'transit' = 'driving',
    options: { alternatives?: boolean } = {},
  ): Promise<RouteWithAdvisory[]> {
    const delay = await this.rateLimiter.acquireLimit(this.rateLimitKey, 60, 60000);
    if (delay > 0) await new Promise(resolve => setTimeout(resolve, delay));

    try {
      return await this.retryService.executeWithRetry(
        async () => {
          const travelMode = this.mapTravelMode(mode);

          // NOT: Routes v2 Step message'da `duration` alani YOK, yalnizca `staticDuration` var.
          // Trafik-farkindalikli sure sadece leg/route seviyesinde doner. Segment-bazli trafik
          // icin `routes.legs.travelAdvisory.speedReadingIntervals` kullaniyoruz (NORMAL/SLOW/TRAFFIC_JAM).
          const fieldMask = [
            'routes.description',
            'routes.distanceMeters',
            'routes.duration',
            'routes.staticDuration',
            'routes.polyline.encodedPolyline',
            'routes.legs.distanceMeters',
            'routes.legs.duration',
            'routes.legs.staticDuration',
            'routes.legs.startLocation',
            'routes.legs.endLocation',
            'routes.legs.steps.distanceMeters',
            'routes.legs.steps.staticDuration',
            'routes.legs.steps.polyline.encodedPolyline',
            'routes.legs.steps.startLocation',
            'routes.legs.steps.endLocation',
            'routes.legs.travelAdvisory.speedReadingIntervals',
            'routes.travelAdvisory.tollInfo',
            'routes.travelAdvisory.fuelConsumptionMicroliters',
          ].join(',');

          const body: Record<string, any> = {
            origin: { address: origin },
            destination: { address: destination },
            travelMode,
            computeAlternativeRoutes: options.alternatives === true,
            languageCode: 'tr',
            regionCode: 'TR',
            units: 'METRIC',
          };

          if (travelMode === 'DRIVE') {
            // TRAFFIC_AWARE_OPTIMAL: daha akıllı rota hesaplama, daha kaliteli alternatifler
            body.routingPreference = 'TRAFFIC_AWARE_OPTIMAL';
            body.extraComputations = ['TOLLS', 'FUEL_CONSUMPTION'];
          }

          const response: AxiosResponse<RoutesV2Response> = await firstValueFrom(
            this.httpService.post(this.routesV2Url, body, {
              headers: {
                'Content-Type': 'application/json',
                'X-Goog-Api-Key': this.apiKey,
                'X-Goog-FieldMask': fieldMask,
              },
            }),
          );

          const v2 = response.data;
          if (!v2?.routes || v2.routes.length === 0) {
            throw new BadRequestException('Route calculation failed: No routes found');
          }

          const results = v2.routes.map((r) => {
            const legacy = this.adaptV2RouteToLegacy(r);
            const fuelStr = r.travelAdvisory?.fuelConsumptionMicroliters;
            return {
              legacy,
              tollInfo: r.travelAdvisory?.tollInfo,
              fuelConsumptionMicroliters: fuelStr ? Number(fuelStr) : undefined,
            };
          });

          // Alternatif kalite filtresi: ana rotaya göre
          // mesafe >%50 fazla veya süre >%60 fazla olan alakasız rotaları ele
          if (results.length > 1) {
            const primaryDist = results[0].legacy.routes[0]?.legs[0]?.distance?.value || 0;
            const primaryDur = results[0].legacy.routes[0]?.legs[0]?.duration?.value || 0;

            const filtered = [results[0]];
            for (let i = 1; i < results.length; i++) {
              const altDist = results[i].legacy.routes[0]?.legs[0]?.distance?.value || 0;
              const altDur = results[i].legacy.routes[0]?.legs[0]?.duration?.value || 0;

              const distRatio = primaryDist > 0 ? altDist / primaryDist : 1;
              const durRatio = primaryDur > 0 ? altDur / primaryDur : 1;

              if (distRatio <= 1.5 && durRatio <= 1.6) {
                filtered.push(results[i]);
              } else {
                console.log(`[GoogleMaps] Alternatif ${i} elendi — mesafe: ${(distRatio * 100).toFixed(0)}%, süre: ${(durRatio * 100).toFixed(0)}%`);
              }
            }
            return filtered;
          }

          return results;
        },
        { maxRetries: 3, baseDelayMs: 1000 },
        'Google Routes v2',
      );
    } catch (error: any) {
      if (error instanceof BadRequestException) throw error;
      const data = error?.response?.data;
      if (data) {
        console.error('[GoogleMaps v2] error response:', JSON.stringify(data).slice(0, 500));
      }
      throw new BadRequestException(`Could not calculate route: ${origin} -> ${destination}`);
    }
  }

  /**
   * Geriye donuk uyumluluk: downstream servisler hala DirectionsResult bekliyor.
   */
  async getRouteDirections(
    origin: string,
    destination: string,
    mode: 'driving' | 'walking' | 'bicycling' | 'transit' = 'driving',
  ): Promise<DirectionsResult> {
    const { legacy } = await this.getRouteWithAdvisory(origin, destination, mode);
    return legacy;
  }

  private mapTravelMode(mode: string): string {
    switch (mode) {
      case 'walking': return 'WALK';
      case 'bicycling': return 'BICYCLE';
      case 'transit': return 'TRANSIT';
      default: return 'DRIVE';
    }
  }

  private parseDurationSeconds(durationStr?: string): number {
    if (!durationStr) return 0;
    const m = /^(\d+(?:\.\d+)?)s$/.exec(durationStr.trim());
    return m ? Math.round(Number(m[1])) : 0;
  }

  private formatDistanceText(meters: number): string {
    if (meters >= 1000) {
      return `${(meters / 1000).toFixed(meters >= 10000 ? 0 : 1)} km`;
    }
    return `${meters} m`;
  }

  private formatDurationText(seconds: number): string {
    if (seconds <= 0) return '0 dk';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.round((seconds % 3600) / 60);
    if (hours > 0) return minutes > 0 ? `${hours} sa ${minutes} dk` : `${hours} sa`;
    return `${minutes} dk`;
  }

  private adaptV2RouteToLegacy(route: RoutesV2Route): DirectionsResult {
    const legs: DirectionsLeg[] = (route.legs || []).map((leg) => this.adaptV2Leg(leg));

    const legacyRoute: DirectionsRoute = {
      legs,
      summary: route.description || '',
      overview_polyline: { points: route.polyline?.encodedPolyline || '' },
      warnings: [],
      waypoint_order: [],
    };

    return { routes: [legacyRoute], status: 'OK' };
  }

  private adaptV2Leg(leg: RoutesV2Leg): DirectionsLeg {
    const distanceMeters = leg.distanceMeters ?? 0;
    const durationSec = this.parseDurationSeconds(leg.duration);

    const start = leg.startLocation?.latLng ?? { latitude: 0, longitude: 0 };
    const end = leg.endLocation?.latLng ?? { latitude: 0, longitude: 0 };

    const steps: DirectionsStep[] = (leg.steps || []).map((s) => this.adaptV2Step(s));

    return {
      steps,
      distance: { text: this.formatDistanceText(distanceMeters), value: distanceMeters },
      duration: { text: this.formatDurationText(durationSec), value: durationSec },
      start_address: '',
      end_address: '',
      start_location: { lat: start.latitude, lng: start.longitude },
      end_location: { lat: end.latitude, lng: end.longitude },
    };
  }

  private adaptV2Step(step: RoutesV2Step): DirectionsStep {
    const distanceMeters = step.distanceMeters ?? 0;
    const staticSec = this.parseDurationSeconds(step.staticDuration);
    const trafficSec = this.parseDurationSeconds(step.duration);
    const ratio = staticSec > 0 ? trafficSec / staticSec : 1;
    const congestion =
      ratio < 1.1 ? 'FREE' :
      ratio < 1.3 ? 'LIGHT' :
      ratio < 1.6 ? 'MEDIUM' : 'HEAVY';

    const start = step.startLocation?.latLng ?? { latitude: 0, longitude: 0 };
    const end = step.endLocation?.latLng ?? { latitude: 0, longitude: 0 };

    return {
      distance: { text: this.formatDistanceText(distanceMeters), value: distanceMeters },
      duration: { text: this.formatDurationText(trafficSec), value: trafficSec },
      start_location: { lat: start.latitude, lng: start.longitude },
      end_location: { lat: end.latitude, lng: end.longitude },
      html_instructions: '',
      maneuver: '',
      polyline: { points: step.polyline?.encodedPolyline || '' },
      travel_mode: 'DRIVING',
      static_duration_seconds: staticSec,
      traffic_ratio: ratio,
      congestion,
    };
  }

  async getNearbyPlaces(
    lat: number,
    lng: number,
    radius: number = 5000,
    type: string = 'gas_station',
  ): Promise<PlaceCandidate[]> {
    // Wait for rate limit
    const delay = await this.rateLimiter.acquireLimit(this.rateLimitKey, 60, 60000); // 60 req/min
    if (delay > 0) await new Promise(resolve => setTimeout(resolve, delay));

    try {
      return await this.retryService.executeWithRetry(
        async () => {
          const response: AxiosResponse<any> = await firstValueFrom(
            this.httpService.get(
              `${this.apiUrl}/place/nearbysearch/json`,
              {
                params: {
                  location: `${lat},${lng}`,
                  radius,
                  type,
                  key: this.apiKey,
                  language: 'tr',
                },
              },
            ),
          );

          if (response.data.status === 'OK' && response.data.results?.length > 0) {
            return response.data.results;
          }

          return [];
        },
        { maxRetries: 2, baseDelayMs: 500 },
        'Google Places Nearby',
      );
    } catch (error) {
      console.error('Error fetching nearby places:', error);
      return [];
    }
  }

  async getPlaceDetails(placeId: string): Promise<PlaceCandidate | null> {
    // Wait for rate limit
    const delay = await this.rateLimiter.acquireLimit(this.rateLimitKey, 300, 60000); // 300 req/min for place details
    if (delay > 0) await new Promise(resolve => setTimeout(resolve, delay));

    try {
      return await this.retryService.executeWithRetry(
        async () => {
          const response: AxiosResponse<any> = await firstValueFrom(
            this.httpService.get(
              `${this.apiUrl}/place/details/json`,
              {
                params: {
                  place_id: placeId,
                  fields: 'formatted_address,name,rating,geometry,place_id',
                  key: this.apiKey,
                  language: 'tr',
                },
              },
            ),
          );

          if (response.data.status === 'OK' && response.data.result) {
            return response.data.result;
          }

          return null;
        },
        { maxRetries: 2, baseDelayMs: 500 },
        'Google Place Details',
      );
    } catch (error) {
      console.error('Error fetching place details:', error);
      return null;
    }
  }

  async getCoordinates(address: string): Promise<{ lat: number; lng: number } | null> {
    try {
      const result = await this.geocode(address);
      return {
        lat: result.geometry.location.lat,
        lng: result.geometry.location.lng,
      };
    } catch (error) {
      return null;
    }
  }
}
