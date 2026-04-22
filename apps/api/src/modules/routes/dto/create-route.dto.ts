import { IsString, IsOptional, IsInt, Min, Max, IsBoolean, IsNumber, IsIn } from 'class-validator';

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

  /** Motor hacmi litre (örn. 1.6). AC faktörü + motor gücü proxy'si. */
  @IsNumber() @Min(0.5) @Max(10) @IsOptional()
  engineDisplacementL?: number;

  /** Dış ortam sıcaklığı °C. Aşırı sıcak → AC yükü artar; soğuk → hava
   *  yoğunluğu artar → aero drag + yakıt artar. */
  @IsNumber() @Min(-30) @Max(55) @IsOptional()
  ambientTempC?: number;

  /** Ek yük (yolcu + bagaj), kg. Her 100 kg ≈ %5 rolling+climb yakıt cezası. */
  @IsNumber() @Min(0) @Max(3000) @IsOptional()
  extraLoadKg?: number;

  /** Baş rüzgâr km/s (+ head, - tail). Aero drag (v+vw)² ile ölçeklenir. */
  @IsNumber() @Min(-150) @Max(150) @IsOptional()
  headwindKph?: number;

  /** Yağmur şiddeti: 0 kuru | 1 çiseleme | 2 orta | 3 şiddetli. */
  @IsIn([0, 1, 2, 3]) @IsOptional()
  rainLevel?: 0 | 1 | 2 | 3;

  /** Rotanın toplam tırmanışı (m). Potansiyel enerji işi için. Elevation API
   *  entegrasyonu gelene kadar manuel / varsayılan 0. */
  @IsNumber() @Min(0) @Max(10000) @IsOptional()
  elevationGainM?: number;
}

export { CreateRouteDto };
