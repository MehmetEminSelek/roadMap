// ==========================================
// Enums
// ==========================================
export type FuelType = 'PETROL' | 'DIZEL' | 'HYBRID' | 'ELECTRIC' | 'LPG';
export type Transmission = 'MANUAL' | 'AUTOMATIC' | 'CVT' | 'SEMI_AUTOMATIC';
export type VehicleType = 'CAR' | 'MOTORCYCLE' | 'BUS' | 'TRUCK' | 'VAN';
export type RouteStatus = 'PENDING' | 'CALCULATING' | 'COMPLETED' | 'FAILED';
export type PlaceType = 'GAS_STATION' | 'RESTAURANT' | 'SERVICE_AREA' | 'HOTEL' | 'PARK';

// ==========================================
// Models
// ==========================================
export interface User {
  id: string;
  email: string;
  name?: string;
  createdAt: string;
}

export interface Vehicle {
  id: string;
  userId: string;
  name: string;
  brand: string;
  model: string;
  fuelType: FuelType;
  enginePower: number;
  engineCapacity: number;
  weight: number;
  transmission: Transmission;
  hasClimateControl: boolean;
  createdAt: string;
}

export interface Route {
  id: string;
  userId: string;
  vehicleId?: string;
  origin: string;
  destination: string;
  originLat: number;
  originLng: number;
  destLat: number;
  destLng: number;
  distance: number;
  duration: number;
  tollCost: number;
  tollDetails?: { name: string; highway: string; amount: number; lat: number; lng: number }[] | null;
  fuelCost: number;
  totalCost: number;
  aiFuelEstimate?: number;
  aiConfidence?: number;
  status: RouteStatus;
  vehicle?: Vehicle;
  createdAt: string;
  routeCoordinates?: string;
  routeStepsJson?: any; // Per-step traffic data (Phase 2)
}

export interface FavoriteRoute {
  id: string;
  userId: string;
  name: string;
  routeId: string;
  route: Route;
  createdAt: string;
}

export interface FavoritePlace {
  id: string;
  userId: string;
  name: string;
  lat: number;
  lng: number;
  address?: string;
  placeId?: string;
  type: PlaceType;
  createdAt: string;
}

export interface Brand {
  id: string;
  name: string;
}

export interface VehicleModel {
  id: string;
  makeId: string;
  name: string;
}

export interface VehicleTrim {
  id: string;
  year: number;
  fuelType: FuelType;
  engineCapacity: number | null;
  transmission: Transmission | null;
  fuelEconomyL100: number | null;
}

// ==========================================
// API Request/Response Types
// ==========================================
export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name?: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}

export interface CreateRouteRequest {
  origin: string;
  destination: string;
  vehicleId?: string;
  stopsCount?: number;
  hasClimateControl?: boolean;
}

export interface RouteCalculationResult {
  route: Route;
  tollCost: number;
  tollDetails?: { name: string; highway: string; amount: number; lat: number; lng: number }[] | null;
  fuelCost: number;
  totalCost: number;
  fuelDetails?: {
    estimatedConsumption: number;
    fuelPrice: number;
    totalFuelCost: number;
    confidence: number;
  };
  stops?: StopSuggestion[];
  nearbyRestAreas?: NearbyRestArea[];
  alternatives?: any[];
}

export interface StopSuggestion {
  name: string;
  location: string;
  lat: number;
  lng: number;
  type: string;
  rating?: number;
}

export interface NearbyRestArea {
  name: string;
  lat: number;
  lng: number;
  type: string;
  rating?: number;
  vicinity?: string;
}

export interface CreateVehicleRequest {
  name: string;
  brand: string;
  model: string;
  fuelType: FuelType;
  enginePower: number;
  engineCapacity: number;
  weight: number;
  transmission: Transmission;
  hasClimateControl?: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    lastPage: number;
  };
}
