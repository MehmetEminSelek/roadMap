import { Controller, Get, Post, Delete, Param, Body, UseGuards, Request } from '@nestjs/common';
import { FavoritesService } from './favorites.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { Request as ExpressRequest } from 'express';

interface UserRequest extends ExpressRequest {
  user: { sub: string };
}

@Controller('favorites')
export class FavoritesController {
  constructor(private readonly favoritesService: FavoritesService) {}

  @UseGuards(JwtAuthGuard)
  @Get('routes')
  getFavoriteRoutes(@Request() req: UserRequest) {
    return this.favoritesService.getFavoriteRoutes(req.user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('routes/:id')
  removeFavoriteRoute(@Param('id') id: string, @Request() req: UserRequest) {
    return this.favoritesService.removeFavoriteRoute(id, req.user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Get('places')
  getFavoritePlaces(@Request() req: UserRequest) {
    return this.favoritesService.getFavoritePlaces(req.user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('places/:id')
  removeFavoritePlace(@Param('id') id: string, @Request() req: UserRequest) {
    return this.favoritesService.removeFavoritePlace(id, req.user.sub);
  }
}
