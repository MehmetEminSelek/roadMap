import { Controller, Get, Post, Param, UseGuards, Body } from '@nestjs/common';
import { TollsService } from './tolls.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

@Controller('tolls')
export class TollsController {
  constructor(private readonly tollsService: TollsService) {}

  @Get('stations')
  getAllStations() {
    return this.tollsService.getAllStations();
  }

  @Get('rates')
  getAllRates() {
    return this.tollsService.getAllRates();
  }

  @Get('rates/:stationId')
  getRatesForStation(@Param('stationId') stationId: string) {
    return this.tollsService.getRatesForStation(stationId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('update')
  updateTollData() {
    return this.tollsService.updateTollData();
  }
}
