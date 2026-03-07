import { Controller, Get, Post, Body, Param, Delete, UseGuards, Request, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { RoutesService } from './routes.service';
import { CreateRouteDto } from './dto/create-route.dto';
import { RouteQueryDto } from './dto/route-query.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { Request as ExpressRequest } from 'express';

interface UserRequest extends ExpressRequest {
  user: { sub: string };
}

@Controller('routes')
export class RoutesController {
  constructor(private readonly routesService: RoutesService) { }

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
