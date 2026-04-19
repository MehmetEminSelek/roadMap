import { IsString, IsOptional, IsInt, Min, Max, IsBoolean, IsNumber } from 'class-validator';

class CreateRouteDto {
  @IsString()
  origin: string; // "İstanbul"

  @IsString()
  destination: string; // "Ankara"

  @IsString()
  @IsOptional()
  originLat?: string;

  @IsString()
  @IsOptional()
  originLng?: string;

  @IsString()
  @IsOptional()
  destLat?: string;

  @IsString()
  @IsOptional()
  destLng?: string;

  @IsString()
  @IsOptional()
  vehicleId?: string;

  @IsInt()
  @Min(0)
  @IsOptional()
  stopsCount?: number;

  @IsBoolean()
  @IsOptional()
  hasClimateControl?: boolean;

  /** Yola çıkarken depodaki yakıt yüzdesi (0-100). İkmal simülasyonu için. */
  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  initialFuelPct?: number;

  /** Depoda kalan yüzdede ikmal tetiklensin (default %10). */
  @IsNumber()
  @Min(0)
  @Max(50)
  @IsOptional()
  reserveThresholdPct?: number;
}

export { CreateRouteDto };
