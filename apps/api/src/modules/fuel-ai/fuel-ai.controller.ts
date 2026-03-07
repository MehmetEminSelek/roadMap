import { Controller, Post, Body, UseGuards, Request } from '@nestjs/common';
import { FuelAiService } from './fuel-ai.service';
import { FuelCalculateDto } from './dto/fuel-calculate.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { Request as ExpressRequest } from 'express';

interface UserRequest extends ExpressRequest {
  user: { sub: string };
}

interface FuelCalculationResult {
  fuelCost: number;
  estimatedConsumption: number;
  fuelPrice: number;
  confidence: number;
  breakdown: {
    baseConsumption: number;
    climateControlFactor: number;
    trafficFactor: number;
    weightFactor: number;
  };
}

@Controller('ai/fuel')
export class FuelAiController {
  constructor(private readonly fuelAiService: FuelAiService) {}

  @UseGuards(JwtAuthGuard)
  @Post('calculate')
  calculateFuel(@Body() dto: FuelCalculateDto, @Request() req: UserRequest): Promise<FuelCalculationResult> {
    return this.fuelAiService.calculateFuelCost(dto);
  }
}
