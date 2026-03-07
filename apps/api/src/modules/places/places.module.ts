import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { PrismaModule } from '../../prisma/prisma.module';
import { PlacesController } from './places.controller';
import { PlacesService } from './places.service';
import { GoogleMapsService } from '../routes/google-maps.service';

@Module({
  imports: [PrismaModule, HttpModule],
  controllers: [PlacesController],
  providers: [PlacesService, GoogleMapsService],
  exports: [PlacesService],
})
export class PlacesModule {}
