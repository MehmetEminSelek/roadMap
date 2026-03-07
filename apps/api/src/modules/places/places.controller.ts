import { Controller, Get, Query, Post, UseGuards, Request, Body, BadRequestException } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { PlacesService } from './places.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { Request as ExpressRequest } from 'express';

interface UserRequest extends ExpressRequest {
  user: { sub: string };
}

@Controller('places')
export class PlacesController {
  constructor(private readonly placesService: PlacesService) {}

  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @Get('nearby')
  getNearbyPlaces(
    @Query('lat') lat: string,
    @Query('lng') lng: string,
    @Query('type') type?: string,
    @Query('radius') radius?: string,
  ) {
    const parsedLat = parseFloat(lat);
    const parsedLng = parseFloat(lng);
    if (isNaN(parsedLat) || isNaN(parsedLng) || parsedLat < -90 || parsedLat > 90 || parsedLng < -180 || parsedLng > 180) {
      throw new BadRequestException('Invalid coordinates. lat must be -90 to 90, lng must be -180 to 180.');
    }
    const parsedRadius = radius ? parseInt(radius) : 5000;
    if (parsedRadius < 100 || parsedRadius > 50000) {
      throw new BadRequestException('Radius must be between 100 and 50000 meters.');
    }
    return this.placesService.getNearbyPlaces(parsedLat, parsedLng, type, parsedRadius);
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
