import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { PrismaModule } from '../../prisma/prisma.module';
import { RoutesController } from './routes.controller';
import { RoutesService } from './routes.service';
import { GoogleMapsService } from './google-maps.service';
import { FuelAiModule } from '../fuel-ai/fuel-ai.module';
import { TollsModule } from '../tolls/tolls.module';
import { PlacesModule } from '../places/places.module';
import { WeatherModule } from '../weather/weather.module';
import { VehiclesModule } from '../vehicles/vehicles.module';

@Module({
  imports: [
    PrismaModule,
    HttpModule,
    FuelAiModule,
    TollsModule,
    PlacesModule,
    WeatherModule,
    VehiclesModule,
  ],
  controllers: [RoutesController],
  providers: [RoutesService, GoogleMapsService],
  exports: [RoutesService, GoogleMapsService],
})
export class RoutesModule {}
