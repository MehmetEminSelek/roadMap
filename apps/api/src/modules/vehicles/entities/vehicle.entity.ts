import { Vehicle, FuelType, Transmission } from '@prisma/client';

class VehicleEntity implements Omit<Vehicle, 'userId'> {
  id: string;
  name: string;
  brand: string;
  model: string;
  fuelType: FuelType;
  enginePower: number;
  engineCapacity: number;
  weight: number;
  transmission: Transmission;
  hasClimateControl: boolean;
  preferredFuelBrand: string | null;
  defaultPassengers: number;
  typicalCargoKg: number;
  correctionFactor: number;
  correctionSampleN: number;
  createdAt: Date;
}

export { VehicleEntity };
