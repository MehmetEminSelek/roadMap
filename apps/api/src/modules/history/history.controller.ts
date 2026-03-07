import { Controller, Get, Delete, Param, UseGuards, Request, Query, Post, Body } from '@nestjs/common';
import { HistoryService } from './history.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { Request as ExpressRequest } from 'express';

interface UserRequest extends ExpressRequest {
  user: { sub: string };
}

@Controller('history')
export class HistoryController {
  constructor(private readonly historyService: HistoryService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  getHistory(@Request() req: UserRequest, @Query('page') page?: string, @Query('limit') limit?: string) {
    return this.historyService.getHistory(req.user.sub, page, limit);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  getRouteDetail(@Param('id') id: string, @Request() req: UserRequest) {
    return this.historyService.getRouteDetail(id, req.user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  deleteRoute(@Param('id') id: string, @Request() req: UserRequest) {
    return this.historyService.deleteRoute(id, req.user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Post('favorites/:routeId')
  addFavorite(@Param('routeId') routeId: string, @Request() req: UserRequest, @Body('name') name?: string) {
    return this.historyService.addFavoriteRoute(req.user.sub, routeId, name);
  }
}
