// Google Maps API Response Interfaces
export interface GoogleMapsResponse<T> {
  status: string;
  result?: T;
  results?: T[];
  error_message?: string;
}

export interface GeocodingResult {
  address_components: GeocodingAddressComponent[];
  formatted_address: string;
  geometry: {
    location: {
      lat: number;
      lng: number;
    };
    location_type: string;
    viewport: {
      northeast: { lat: number; lng: number };
      southwest: { lat: number; lng: number };
    };
  };
  place_id: string;
  types: string[];
}

export interface GeocodingAddressComponent {
  long_name: string;
  short_name: string;
  types: string[];
}

export interface DirectionsResult {
  routes: DirectionsRoute[];
  status: string;
}

export interface DirectionsRoute {
  legs: DirectionsLeg[];
  summary: string;
  overview_polyline: {
    points: string;
  };
  warnings: string[];
  waypoint_order: number[];
}

export interface DirectionsLeg {
  steps: DirectionsStep[];
  distance: {
    text: string;
    value: number; // meters
  };
  duration: {
    text: string;
    value: number; // seconds
  };
  start_address: string;
  end_address: string;
  start_location: {
    lat: number;
    lng: number;
  };
  end_location: {
    lat: number;
    lng: number;
  };
}

export interface DirectionsStep {
  distance: {
    text: string;
    value: number;
  };
  duration: {
    text: string;
    value: number;
  };
  end_location: {
    lat: number;
    lng: number;
  };
  html_instructions: string;
  maneuver: string;
  polyline: {
    points: string;
  };
  start_location: {
    lat: number;
    lng: number;
  };
  travel_mode: string;
}

export interface PlacesResponse {
  candidates: PlaceCandidate[];
  status: string;
}

export interface PlaceCandidate {
  formatted_address: string;
  geometry: {
    location: {
      lat: number;
      lng: number;
    };
  };
  name: string;
  place_id: string;
  rating?: number;
  user_ratings_total?: number;
}
