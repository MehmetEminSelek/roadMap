import axios from 'axios';

const API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';
const MAPS_API_URL = 'https://maps.googleapis.com/maps/api';

interface GeocodingResponse {
  results: Array<{
    geometry: {
      location: {
        lat: number;
        lng: number;
      };
    };
    formatted_address: string;
  }>;
  status: string;
}

interface DirectionsResponse {
  routes: Array<{
    legs: Array<{
      distance: {
        value: number;
        text: string;
      };
      duration: {
        value: number;
        text: string;
      };
      start_location: {
        lat: number;
        lng: number;
      };
      end_location: {
        lat: number;
        lng: number;
      };
      steps: Array<{
        distance: {
          value: number;
        };
        html_instructions: string;
        start_location: {
          lat: number;
          lng: number;
        };
      }>;
    }>;
    overview_polyline: {
      points: string;
    };
  }>;
  status: string;
}

interface NearbySearchResponse {
  results: Array<{
    place_id: string;
    name: string;
    vicinity: string;
    geometry: {
      location: {
        lat: number;
        lng: number;
      };
    };
    rating?: number;
  }>;
  status: string;
}

export const mapsService = {
  async geocode(address: string) {
    try {
      const response = await axios.get<GeocodingResponse>(
        `${MAPS_API_URL}/geocode/json`,
        {
          params: {
            address,
            key: API_KEY,
          },
        },
      );

      if (response.data.status === 'OK' && response.data.results.length > 0) {
        return {
          lat: response.data.results[0].geometry.location.lat,
          lng: response.data.results[0].geometry.location.lng,
          address: response.data.results[0].formatted_address,
        };
      }
      return null;
    } catch (error) {
      console.error('Geocoding error:', error);
      return null;
    }
  },

  async getDirections(origin: string, destination: string) {
    try {
      const originCoords = await this.geocode(origin);
      const destCoords = await this.geocode(destination);

      if (!originCoords || !destCoords) {
        return null;
      }

      const response = await axios.get<DirectionsResponse>(
        `${MAPS_API_URL}/directions/json`,
        {
          params: {
            origin: `${originCoords.lat},${originCoords.lng}`,
            destination: `${destCoords.lat},${destCoords.lng}`,
            mode: 'driving',
            key: API_KEY,
          },
        },
      );

      if (response.data.status === 'OK' && response.data.routes.length > 0) {
        return response.data.routes[0];
      }
      return null;
    } catch (error) {
      console.error('Directions error:', error);
      return null;
    }
  },

  async getNearbyPlaces(lat: number, lng: number, radius: number = 5000, type: string = 'gas_station') {
    try {
      const response = await axios.get<NearbySearchResponse>(
        `${MAPS_API_URL}/place/nearbysearch/json`,
        {
          params: {
            location: `${lat},${lng}`,
            radius,
            type,
            key: API_KEY,
          },
        },
      );

      if (response.data.status === 'OK') {
        return response.data.results;
      }
      return [];
    } catch (error) {
      console.error('Nearby places error:', error);
      return [];
    }
  },

  async getPlaceDetails(placeId: string) {
    try {
      const response = await axios.get(
        `${MAPS_API_URL}/place/details/json`,
        {
          params: {
            place_id: placeId,
            fields: 'name,formatted_address,rating,geometry',
            key: API_KEY,
          },
        },
      );

      if (response.data.result) {
        return response.data.result;
      }
      return null;
    } catch (error) {
      console.error('Place details error:', error);
      return null;
    }
  },
};

export default mapsService;
