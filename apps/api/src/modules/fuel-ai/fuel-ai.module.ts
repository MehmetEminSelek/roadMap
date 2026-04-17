import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { PrismaModule } from '../../prisma/prisma.module';
import { FuelAiController } from './fuel-ai.controller';
import { FuelAiService } from './fuel-ai.service';
import { FuelPriceService } from './fuel-price.service';

@Module({
  imports: [PrismaModule, HttpModule],
  controllers: [FuelAiController],
  providers: [FuelAiService, FuelPriceService],
  exports: [FuelAiService, FuelPriceService],
})
export class FuelAiModule {}
