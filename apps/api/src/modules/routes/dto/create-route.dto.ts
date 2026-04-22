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

  /** Depoda kalan yüzdede ikmal tetiklensin (default %20). */
  @IsNumber()
  @Min(0)
  @Max(50)
  @IsOptional()
  reserveThresholdPct?: number;

  /** Otoyol seyir hızı km/h (default 110). Yakıt hesabında hız faktörü için. */
  @IsInt()
  @Min(60)
  @Max(150)
  @IsOptional()
  cruisingSpeedKph?: number;

  /** Motor hacmi litre (örn. 1.6). AC faktörü için. Bilinmiyorsa DB'den okunur. */
  @IsNumber()
  @Min(0.5)
  @Max(10)
  @IsOptional()
  engineDisplacementL?: number;
}

export { CreateRouteDto };
