import { IsNumber, Min, Max } from 'class-validator';

/**
 * Post-trip kalibrasyon payload'u.
 * Kullanıcı sefer sonu gerçekten kaç litre yaktığını girer.
 */
export class CompleteRouteDto {
  @IsNumber()
  @Min(0.1)
  @Max(1000)
  actualFuelL: number;
}
