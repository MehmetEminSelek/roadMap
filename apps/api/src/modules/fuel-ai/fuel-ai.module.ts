import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { PrismaModule } from '../../prisma/prisma.module';
import { FuelAiController } from './fuel-ai.controller';
import { FuelAiService } from './fuel-ai.service';
import { FuelPriceService } from './fuel-price.service';
import { FuelSimulationService } from './fuel-simulation.service';
import { FuelCalculatorService } from './fuel-calculator.service';
import { FuelPricesController } from './fuel-prices.controller';
import { OpetFetcher } from './brand-fetchers/opet.fetcher';
import { ShellFetcher } from './brand-fetchers/shell.fetcher';
import { PetrolOfisiFetcher } from './brand-fetchers/po.fetcher';
import { TotalFetcher } from './brand-fetchers/total.fetcher';

@Module({
  imports: [PrismaModule, HttpModule],
  controllers: [FuelAiController, FuelPricesController],
  providers: [
    FuelAiService,
    FuelPriceService,
    FuelSimulationService,
    FuelCalculatorService,
    OpetFetcher,
    ShellFetcher,
    PetrolOfisiFetcher,
    TotalFetcher,
  ],
  exports: [FuelAiService, FuelPriceService, FuelSimulationService, FuelCalculatorService],
})
export class FuelAiModule {}
