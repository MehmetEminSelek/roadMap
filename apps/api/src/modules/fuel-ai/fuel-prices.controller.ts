import { Controller, Get, Query, ParseIntPipe, DefaultValuePipe } from '@nestjs/common';
import { FuelPriceService, BrandPriceSnapshot } from './fuel-price.service';

/**
 * Public endpoint: mobile özet sayfasındaki yakıt carousel'ı buradan besleniyor.
 * Auth gerektirmez.
 *
 * GET /fuel-prices/brands?provinceCode=34
 *   provinceCode verilmezse İstanbul (34) default.
 */
@Controller('fuel-prices')
export class FuelPricesController {
  constructor(private readonly fuelPriceService: FuelPriceService) {}

  @Get('brands')
  getBrands(
    @Query('provinceCode', new DefaultValuePipe(34), ParseIntPipe) provinceCode: number,
  ): { brands: BrandPriceSnapshot[]; provinceCode: number } {
    const clamped = provinceCode >= 1 && provinceCode <= 81 ? provinceCode : 34;
    return {
      brands: this.fuelPriceService.getAllBrandPrices(clamped),
      provinceCode: clamped,
    };
  }
}
