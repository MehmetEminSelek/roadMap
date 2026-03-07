import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { FuelCalculateDto } from './dto/fuel-calculate.dto';
import { Vehicle } from '@prisma/client';
import { AxiosResponse } from 'axios';

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

interface GeminiPrompt {
  role: 'user' | 'model';
  parts: { text: string }[];
}

interface GeminiResponse {
  candidates: {
    content: {
      parts: {
        text: string;
      }[];
    };
  }[];
}

@Injectable()
export class FuelAiService {
  private readonly apiKey: string;
  private readonly apiUrl: string;
  private readonly fuelPrice: number;

  constructor(
    private configService: ConfigService,
    private httpService: HttpService,
  ) {
    this.apiKey = this.configService.get<string>('googleGemini.apiKey') || '';
    this.apiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';
    this.fuelPrice = this.configService.get<number>('fuel.price', 28.5); // TL/L (varsayılan)
  }

  async calculateFuelCost(dto: FuelCalculateDto): Promise<FuelCalculationResult> {
    const { distanceKm, durationSeconds, hasClimateControl = true } = dto;

    if (distanceKm <= 0) {
      throw new BadRequestException('Distance must be greater than 0');
    }

    // Default consumption values based on fuel type (L/100km)
    const defaultConsumption = this.getDefaultConsumption(dto.vehicleType);

    // Calculate base consumption in total liters
    let baseConsumption = (distanceKm * defaultConsumption) / 100;

    // Apply factors
    const trafficFactor = this.calculateTrafficFactor(durationSeconds, distanceKm);
    const climateFactor = hasClimateControl ? 1.1 : 1.0;
    const weightFactor = dto.averageConsumption ? 1.0 : 1.05;

    baseConsumption *= climateFactor * weightFactor;

    // Use AI for refinement if no direct consumption provided
    let finalConsumption = dto.averageConsumption || baseConsumption;
    let confidence = 0.75;

    if (!dto.averageConsumption) {
      const aiResult = await this.getAiFuelEstimate(
        distanceKm,
        durationSeconds,
        hasClimateControl,
      );

      if (aiResult && aiResult.consumption > 0) {
        // AI returns L/100km — convert to total liters
        finalConsumption = (distanceKm * aiResult.consumption) / 100;
        confidence = aiResult.confidence;
        console.log(`🤖 AI yakıt tahmini: ${aiResult.consumption} L/100km = ${finalConsumption.toFixed(1)}L toplam (güven: ${(confidence * 100).toFixed(0)}%)`);
      } else {
        console.log(`⚠️ AI yakıt tahmini başarısız, varsayılan hesaplama kullanılıyor: ${finalConsumption.toFixed(1)}L`);
      }
    }

    const totalFuelCost = finalConsumption * this.fuelPrice;

    return {
      fuelCost: totalFuelCost,
      estimatedConsumption: finalConsumption,
      fuelPrice: this.fuelPrice,
      confidence,
      breakdown: {
        baseConsumption,
        climateControlFactor: climateFactor,
        trafficFactor,
        weightFactor,
      },
    };
  }

  private getDefaultConsumption(vehicleType?: string): number {
    // L/100km default values
    const defaults: Record<string, number> = {
      small: 6.5, // Honda Civic, VW Polo
      medium: 7.5, // Opel Astra, Ford Focus
      large: 9.0, // BMW 3 Series, Ford Mustang
      suv: 9.5, // Toyota RAV4, Ford Edge
      diesel: 6.0, // Diesel engines more efficient
      hybrid: 5.0, // Hybrid vehicles
      electric: 15, // kWh/100km (equivalent)
      lpg: 8.0, // LPG consumption
    };

    if (vehicleType) {
      const lower = vehicleType.toLowerCase();
      if (lower.includes('small') || lower.includes('city')) return defaults.small;
      if (lower.includes('medium') || lower.includes('compact')) return defaults.medium;
      if (lower.includes('large') || lower.includes('premium')) return defaults.large;
      if (lower.includes('suv')) return defaults.suv;
      if (lower.includes('diesel')) return defaults.diesel;
      if (lower.includes('hybrid')) return defaults.hybrid;
      if (lower.includes('electric')) return defaults.electric;
      if (lower.includes('lpg')) return defaults.lpg;
    }

    return defaults.medium; // Default to medium
  }

  private calculateTrafficFactor(durationSeconds: number | undefined, distanceKm: number): number {
    if (!durationSeconds || durationSeconds <= 0) return 1.0;

    const averageSpeedKmh = (distanceKm / (durationSeconds / 3600));

    // Traffic factor based on average speed
    if (averageSpeedKmh > 100) return 0.9; // Highway - more efficient
    if (averageSpeedKmh > 70) return 1.0; // Normal
    if (averageSpeedKmh > 40) return 1.15; // City traffic
    return 1.3; // Heavy traffic
  }

  private async getAiFuelEstimate(
    distanceKm: number,
    durationSeconds: number | undefined,
    hasClimateControl: boolean,
  ): Promise<{ consumption: number; confidence: number } | null> {
    if (!this.apiKey) {
      console.warn('Google Gemini API key not configured, using default estimates');
      return null;
    }

    const prompt = `
      Calculate the fuel consumption (L/100km) for a trip with these details:
      - Distance: ${distanceKm} km
      - Duration: ${durationSeconds ? `${Math.round(durationSeconds / 60)} minutes` : 'Not specified'}
      - Climate control: ${hasClimateControl ? 'ON' : 'OFF'}

      Provide only a JSON response with:
      {
        "consumption": <estimated L/100km>,
        "confidence": <0-1 confidence score>
      }
    `;

    try {
      const payload = {
        contents: [
          {
            parts: [{ text: prompt }],
          },
        ],
      };

      const response: AxiosResponse<GeminiResponse> = await firstValueFrom(
        this.httpService.post<GeminiResponse>(`${this.apiUrl}?key=${this.apiKey}`, payload, {
          timeout: 10000,
        }),
      );

      if (response.data.candidates?.[0]?.content?.parts?.[0]?.text) {
        const text = response.data.candidates[0].content.parts[0].text;
        const jsonMatch = text.match(/\{[\s\S]*\}/);

        if (jsonMatch) {
          const result = JSON.parse(jsonMatch[0]);
          return {
            consumption: result.consumption,
            confidence: Math.min(Math.max(result.confidence, 0), 1),
          };
        }
      }

      return null;
    } catch (error) {
      console.error('AI Fuel Estimate Error:', error);
      return null;
    }
  }
}
