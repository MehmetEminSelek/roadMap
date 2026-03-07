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
  createdAt: Date;
}

export { VehicleEntity };
