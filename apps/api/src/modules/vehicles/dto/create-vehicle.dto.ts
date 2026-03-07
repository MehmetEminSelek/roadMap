import { IsString, IsInt, IsBoolean, IsEnum, Min, Max } from 'class-validator';
import { FuelType, Transmission } from '@prisma/client';

class CreateVehicleDto {
  @IsString()
  name: string; // "Astra 1.4 Turbo"

  @IsString()
  brand: string;

  @IsString()
  model: string;

  @IsEnum(FuelType)
  fuelType: FuelType;

  @IsInt()
  @Min(1)
  @Max(10000)
  enginePower: number; // HP

  @IsInt()
  @Min(1)
  engineCapacity: number; // cc

  @IsInt()
  @Min(1)
  weight: number; // kg

  @IsEnum(Transmission)
  transmission: Transmission;

  @IsBoolean()
  hasClimateControl?: boolean;
}

export { CreateVehicleDto };
