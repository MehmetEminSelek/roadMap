import { IsInt, IsOptional, IsBoolean, IsNumber, Min, Max } from 'class-validator';

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
  hasClimateControl?: boolean; // Klima kullanımı (backward-compat)

  @IsOptional()
  vehicleType?: string; // Araç tipi

  /** Otoyol seyir hızı km/h — yakıt hesabında hız faktörü için. */
  @IsInt()
  @Min(60)
  @Max(150)
  @IsOptional()
  cruisingSpeedKph?: number;

  /** Klima on/off — hasClimateControl ile dönüşümlü. */
  @IsBoolean()
  @IsOptional()
  acOn?: boolean;

  /** Motor hacmi litre (örn. 1.6) — AC faktörünü skalalar. */
  @IsNumber()
  @Min(0.5)
  @Max(10)
  @IsOptional()
  engineDisplacementL?: number;
}

export { FuelCalculateDto };
