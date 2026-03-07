import { Controller, Get, Query, Post, UseGuards, Request, Body } from '@nestjs/common';
import { PlacesService } from './places.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { Request as ExpressRequest } from 'express';

interface UserRequest extends ExpressRequest {
  user: { sub: string };
}

@Controller('places')
export class PlacesController {
  constructor(private readonly placesService: PlacesService) {}

  @Get('nearby')
  getNearbyPlaces(
    @Query('lat') lat: string,
    @Query('lng') lng: string,
    @Query('type') type?: string,
    @Query('radius') radius?: string,
  ) {
    return this.placesService.getNearbyPlaces(parseFloat(lat), parseFloat(lng), type, radius ? parseInt(radius) : 5000);
  }

  @UseGuards(JwtAuthGuard)
  @Get('route-stops')
  getRouteStops(
    @Request() req: UserRequest,
    @Query('origin') origin: string,
    @Query('destination') destination: string,
    @Query('stops') stops?: string,
  ) {
    return this.placesService.getStopsForRoute(origin, destination, stops ? parseInt(stops) : 1);
  }

  @UseGuards(JwtAuthGuard)
  @Post('favorite')
  addFavorite(@Request() req: UserRequest, @Query('name') name: string, @Query('lat') lat: string, @Query('lng') lng: string, @Query('type') type?: string) {
    return this.placesService.addFavoritePlace(req.user.sub, name, parseFloat(lat), parseFloat(lng), type);
  }

  @UseGuards(JwtAuthGuard)
  @Get('favorites')
  getFavorites(@Request() req: UserRequest) {
    return this.placesService.getFavoritePlaces(req.user.sub);
  }
}
