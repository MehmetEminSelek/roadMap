import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { PrismaModule } from '../../prisma/prisma.module';
import { FuelAiController } from './fuel-ai.controller';
import { FuelAiService } from './fuel-ai.service';
import { FuelPriceService } from './fuel-price.service';
import { FuelSimulationService } from './fuel-simulation.service';
import { FuelPricesController } from './fuel-prices.controller';
import { OpetFetcher } from './brand-fetchers/opet.fetcher';
import { ShellFetcher } from './brand-fetchers/shell.fetcher';
import { PetrolOfisiFetcher } from './brand-fetchers/po.fetcher';
import { BpFetcher } from './brand-fetchers/bp.fetcher';

@Module({
  imports: [PrismaModule, HttpModule],
  controllers: [FuelAiController, FuelPricesController],
  providers: [
    FuelAiService,
    FuelPriceService,
    FuelSimulationService,
    OpetFetcher,
    ShellFetcher,
    PetrolOfisiFetcher,
    BpFetcher,
  ],
  exports: [FuelAiService, FuelPriceService, FuelSimulationService],
})
export class FuelAiModule {}
