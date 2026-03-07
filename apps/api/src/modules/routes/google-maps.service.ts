import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import {
  GeocodingResult,
  DirectionsResult,
  PlacesResponse,
  PlaceCandidate,
} from './dto/google-maps.dto';
import { AxiosResponse } from 'axios';

@Injectable()
export class GoogleMapsService {
  private readonly apiUrl: string;
  private readonly apiKey: string;

  constructor(
    private configService: ConfigService,
    private httpService: HttpService,
  ) {
    this.apiUrl = this.configService.get<string>('googleMaps.apiUrl') || 'https://maps.googleapis.com/maps/api';
    this.apiKey = this.configService.get<string>('googleMaps.apiKey') || '';
  }

  async autocomplete(input: string): Promise<{ description: string; placeId: string }[]> {
    if (!input || input.length < 2) return [];
    try {
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
    } catch (error) {
      console.error('Autocomplete error:', error);
      return [];
    }
  }

  async geocode(address: string): Promise<GeocodingResult> {
    try {
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

      // Google Geocoding API returns { status, results: [...] }
      if (response.data.status === 'OK' && response.data.results?.length > 0) {
        return response.data.results[0];
      }

      throw new BadRequestException(`Geocoding failed: ${response.data.error_message || 'No results found'}`);
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException(`Could not geocode address: ${address}`);
    }
  }

  async getRouteDirections(
    origin: string,
    destination: string,
    mode: 'driving' | 'walking' | 'bicycling' | 'transit' = 'driving',
  ): Promise<DirectionsResult> {
    try {
      // First, geocode addresses to get coordinates
      const originLocation = await this.geocode(origin);
      const destLocation = await this.geocode(destination);

      const response: AxiosResponse<any> = await firstValueFrom(
        this.httpService.get(
          `${this.apiUrl}/directions/json`,
          {
            params: {
              origin: `${originLocation.geometry.location.lat},${originLocation.geometry.location.lng}`,
              destination: `${destLocation.geometry.location.lat},${destLocation.geometry.location.lng}`,
              mode,
              key: this.apiKey,
              language: 'tr',
            },
          },
        ),
      );

      // Google Directions API returns { status, routes: [...] }
      if (response.data.status === 'OK' && response.data.routes?.length > 0) {
        return response.data;
      }

      throw new BadRequestException(`Route calculation failed: ${response.data.error_message || 'No routes found'}`);
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException(`Could not calculate route: ${origin} -> ${destination}`);
    }
  }

  async getNearbyPlaces(
    lat: number,
    lng: number,
    radius: number = 5000,
    type: string = 'gas_station',
  ): Promise<PlaceCandidate[]> {
    try {
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

      // Google Places Nearby Search returns { status, results: [...] }
      if (response.data.status === 'OK' && response.data.results?.length > 0) {
        return response.data.results;
      }

      return [];
    } catch (error) {
      console.error('Error fetching nearby places:', error);
      return [];
    }
  }

  async getPlaceDetails(placeId: string): Promise<PlaceCandidate | null> {
    try {
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

      // Google Place Details returns { status, result: { ... } }
      if (response.data.status === 'OK' && response.data.result) {
        return response.data.result;
      }

      return null;
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
