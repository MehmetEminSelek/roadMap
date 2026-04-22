import { IsInt, IsOptional, IsBoolean, IsNumber, Min, Max, IsIn } from 'class-validator';

class FuelCalculateDto {
  @IsInt()
  distanceKm: number;

  @IsInt()
  @IsOptional()
  durationSeconds?: number;

  @IsOptional()
  averageConsumption?: number;

  @IsBoolean()
  @IsOptional()
  hasClimateControl?: boolean;

  @IsOptional()
  vehicleType?: string;

  /** Otoyol seyir hızı km/h. */
  @IsInt() @Min(60) @Max(150) @IsOptional()
  cruisingSpeedKph?: number;

  /** Klima on/off (hasClimateControl ile dönüşümlü). */
  @IsBoolean() @IsOptional()
  acOn?: boolean;

  /** Motor hacmi L (AC yükünü + motor gücü proxy'sini ölçekler). */
  @IsNumber() @Min(0.5) @Max(10) @IsOptional()
  engineDisplacementL?: number;

  /** Dış ortam sıcaklığı °C. */
  @IsNumber() @Min(-30) @Max(55) @IsOptional()
  ambientTempC?: number;

  /** Ek yük (yolcu + bagaj) kg. */
  @IsNumber() @Min(0) @Max(3000) @IsOptional()
  extraLoadKg?: number;

  /** Baş rüzgâr km/s (+head, -tail). */
  @IsNumber() @Min(-150) @Max(150) @IsOptional()
  headwindKph?: number;

  /** Yağmur şiddeti: 0 kuru | 1 çiseleme | 2 orta | 3 şiddetli. */
  @IsIn([0, 1, 2, 3]) @IsOptional()
  rainLevel?: 0 | 1 | 2 | 3;

  /** Rotanın net tırmanışı m. */
  @IsNumber() @Min(0) @Max(10000) @IsOptional()
  elevationGainM?: number;
}

export { FuelCalculateDto };
