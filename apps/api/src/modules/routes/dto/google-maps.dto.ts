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
  // Traffic-aware fields (Phase 2)
  static_duration_seconds?: number;
  traffic_ratio?: number;
  congestion?: 'FREE' | 'LIGHT' | 'MEDIUM' | 'HEAVY';
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

// ─────────────────────────────────────────────────────────────
// Routes API v2 (computeRoutes) — https://routes.googleapis.com
// ─────────────────────────────────────────────────────────────

export interface RoutesV2LatLng {
  latitude: number;
  longitude: number;
}

export interface RoutesV2Location {
  latLng: RoutesV2LatLng;
}

export interface RoutesV2Polyline {
  encodedPolyline: string;
}

export interface RoutesV2Money {
  currencyCode: string;
  units?: string; // int64 as string in JSON
  nanos?: number;
}

export interface RoutesV2TollInfo {
  estimatedPrice?: RoutesV2Money[];
}

export interface RoutesV2Step {
  distanceMeters?: number;
  duration?: string; // traffic-aware duration
  staticDuration?: string;
  polyline?: RoutesV2Polyline;
  startLocation?: RoutesV2Location;
  endLocation?: RoutesV2Location;
}

export interface RoutesV2Leg {
  distanceMeters?: number;
  duration?: string; // "123s"
  staticDuration?: string;
  polyline?: RoutesV2Polyline;
  startLocation?: RoutesV2Location;
  endLocation?: RoutesV2Location;
  steps?: RoutesV2Step[];
}

export interface RoutesV2TravelAdvisory {
  tollInfo?: RoutesV2TollInfo;
  fuelConsumptionMicroliters?: string;
}

export interface RoutesV2Route {
  legs?: RoutesV2Leg[];
  distanceMeters?: number;
  duration?: string;
  staticDuration?: string;
  polyline?: RoutesV2Polyline;
  description?: string;
  travelAdvisory?: RoutesV2TravelAdvisory;
  routeLabels?: string[];
}

export interface RoutesV2Response {
  routes?: RoutesV2Route[];
}

/**
 * Adapter output: eski DirectionsResult şeklinde rota + v2'ye özgü ham toll/fuel ipuçları.
 * Downstream (routes.service.ts, tolls.service.ts, places.service.ts) `legacy` kısmını tüketmeye devam eder.
 */
export interface RouteWithAdvisory {
  legacy: DirectionsResult;
  tollInfo?: RoutesV2TollInfo;
  fuelConsumptionMicroliters?: number;
  /** Route-level encoded polyline — Elevation API çağrısında path olarak kullanılır. */
  encodedPolyline?: string;
}
