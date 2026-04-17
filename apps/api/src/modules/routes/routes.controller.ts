import { Controller, Get, Post, Body, Param, Delete, UseGuards, Request, Query, Inject } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { RoutesService } from './routes.service';
import { GoogleMapsService } from './google-maps.service';
import { CreateRouteDto } from './dto/create-route.dto';
import { RouteQueryDto } from './dto/route-query.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { Request as ExpressRequest } from 'express';
import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager';
import { normalizeTr } from '../../common/text/normalize-tr';

interface UserRequest extends ExpressRequest {
  user: { sub: string };
}

@Controller('routes')
export class RoutesController {
  constructor(
    private readonly routesService: RoutesService,
    private readonly googleMapsService: GoogleMapsService,
    @Inject(CACHE_MANAGER) private cache: Cache,
  ) { }

  @UseGuards(JwtAuthGuard)
  @Get('autocomplete')
  async autocomplete(@Query('input') input: string) {
    const norm = normalizeTr(input || '');
    if (norm.length < 2) return [];
    const key = `autocomplete:v1:${norm}`;
    const hit = await this.cache.get<any[]>(key);
    if (hit) return hit;
    const fresh = await this.googleMapsService.autocomplete(input);
    await this.cache.set(key, fresh, 7 * 24 * 60 * 60 * 1000);
    return fresh;
  }

  // Static routes MUST come before parameterized routes
  @UseGuards(JwtAuthGuard)
  @Post('calculate')
  calculateRoute(@Body() createRouteDto: CreateRouteDto, @Request() req: UserRequest): Promise<any> {
    return this.routesService.calculateRoute(createRouteDto, req.user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Get('stats')
  getStats(@Request() req: UserRequest) {
    return this.routesService.getStats(req.user.sub);
  }

  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @UseGuards(JwtAuthGuard)
  @Get('preview')
  previewRoute(
    @Query('origin') origin: string,
    @Query('destination') destination: string,
    @Request() req: UserRequest,
  ) {
    return this.routesService.previewRoute(origin, destination);
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  findAll(@Request() req: UserRequest, @Query() query: RouteQueryDto): Promise<any> {
    return this.routesService.findAll(req.user.sub, query);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  findOne(@Param('id') id: string, @Request() req: UserRequest): Promise<any> {
    return this.routesService.findOne(id, req.user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  remove(@Param('id') id: string, @Request() req: UserRequest): Promise<any> {
    return this.routesService.remove(id, req.user.sub);
  }
}
