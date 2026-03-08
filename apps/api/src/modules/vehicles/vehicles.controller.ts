import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Request } from '@nestjs/common';
import { VehiclesService } from './vehicles.service';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { Request as ExpressRequest } from 'express';

interface UserRequest extends ExpressRequest {
  user: { sub: string };
}

@Controller('vehicles')
export class VehiclesController {
  constructor(private readonly vehiclesService: VehiclesService) { }

  // Static routes MUST come before parameterized routes
  @Get('brands')
  getBrands() {
    return this.vehiclesService.getVehicleBrands();
  }

  @Get('brands/:brandId/models')
  getModels(@Param('brandId') brandId: string) {
    return this.vehiclesService.getVehicleModels(brandId);
  }

  @Get('models/:modelId/trims')
  getTrims(@Param('modelId') modelId: string) {
    return this.vehiclesService.getVehicleTrims(modelId);
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  create(@Body() createVehicleDto: CreateVehicleDto, @Request() req: UserRequest) {
    return this.vehiclesService.create(createVehicleDto, req.user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  findAll(@Request() req: UserRequest) {
    return this.vehiclesService.findAll(req.user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  findOne(@Param('id') id: string, @Request() req: UserRequest) {
    return this.vehiclesService.findOne(id, req.user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  update(@Param('id') id: string, @Body() updateVehicleDto: UpdateVehicleDto, @Request() req: UserRequest) {
    return this.vehiclesService.update(id, updateVehicleDto, req.user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  remove(@Param('id') id: string, @Request() req: UserRequest) {
    return this.vehiclesService.remove(id, req.user.sub);
  }
}
