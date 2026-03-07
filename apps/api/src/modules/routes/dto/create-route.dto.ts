import { IsString, IsOptional, IsInt, Min, IsBoolean } from 'class-validator';

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
}

export { CreateRouteDto };
