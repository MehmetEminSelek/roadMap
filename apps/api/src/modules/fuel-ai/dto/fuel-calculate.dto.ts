import { IsInt, IsOptional, IsBoolean } from 'class-validator';

class FuelCalculateDto {
  @IsInt()
  distanceKm: number; // Mesafe km cinsinden

  @IsInt()
  @IsOptional()
  durationSeconds?: number; // Süre saniye cinsinden

  @IsOptional()
  averageConsumption?: number; // L/100km (belirtilirse AI kullanma)

  @IsBoolean()
  @IsOptional()
  hasClimateControl?: boolean; // Klima kullanımı

  @IsOptional()
  vehicleType?: string; // Araç tipi
}

export { FuelCalculateDto };
