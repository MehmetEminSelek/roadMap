import { IsString, IsInt, IsBoolean, IsEnum, IsIn, IsOptional, Min, Max } from 'class-validator';
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

  /** İkmal simülasyonunda kullanılacak yakıt markası. Null → Opet default. */
  @IsString()
  @IsIn(['opet', 'shell', 'po', 'total'])
  @IsOptional()
  preferredFuelBrand?: string;

  /** Genelde kaç kişi taşıyor (sürücü dahil). Yakıt yük faktörü için. Default 1. */
  @IsInt()
  @Min(1)
  @Max(9)
  @IsOptional()
  defaultPassengers?: number;

  /** Tipik bagaj ağırlığı kg. Default 0. */
  @IsInt()
  @Min(0)
  @Max(500)
  @IsOptional()
  typicalCargoKg?: number;
}

export { CreateVehicleDto };
