import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { FuelCalculateDto } from './dto/fuel-calculate.dto';
import { FuelPriceService } from './fuel-price.service';
import { FuelCalculatorService } from './fuel-calculator.service';
import { AxiosResponse } from 'axios';

interface FuelCalculationResult {
  fuelCost: number;
  estimatedConsumption: number;
  fuelPrice: number;
  confidence: number;
  breakdown: {
    baseConsumption: number;
    speedFactor: number;
    acFactor: number;
    trafficFactor: number;
    climateControlFactor: number; // = acFactor, backward-compat alias
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

  constructor(
    private configService: ConfigService,
    private httpService: HttpService,
    private fuelPriceService: FuelPriceService,
    private fuelCalc: FuelCalculatorService,
  ) {
    this.apiKey = this.configService.get<string>('googleGemini.apiKey') || '';
    this.apiUrl = this.configService.get<string>('googleGemini.apiUrl', 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent');
  }

  async calculateFuelCost(dto: FuelCalculateDto): Promise<FuelCalculationResult> {
    const { distanceKm, durationSeconds, hasClimateControl = true } = dto;

    if (distanceKm <= 0) {
      throw new BadRequestException('Distance must be greater than 0');
    }

    // Default consumption values based on fuel type (L/100km)
    const defaultConsumption = this.getDefaultConsumption(dto.vehicleType);
    const rawBase = (distanceKm * defaultConsumption) / 100;

    // Tüm tüketim faktörleri (hız, klima, trafik) FuelCalculatorService'ten.
    const factors = this.fuelCalc.combinedFactor({
      speedKph: dto.cruisingSpeedKph,
      acOn: dto.acOn,
      engineDisplacementL: dto.engineDisplacementL,
      hasClimateControl,
      durationSeconds,
      distanceKm,
    });

    const weightFactor = dto.averageConsumption ? 1.0 : 1.05;
    let baseConsumption = rawBase * factors.combined * weightFactor;

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
        // AI returns L/100km — ancak AI döndürdüğü değerde hız/klima faktörlerini
        // bilmiyor; elle uygulamalıyız. Aksi halde client-side userMul/defaultMul
        // çarpanı "faktörsüz baseline"a uygulanır ve hesap tutarsız olur.
        const aiAdjustedL100 = aiResult.consumption * factors.speedFactor * factors.acFactor;
        finalConsumption = (distanceKm * aiAdjustedL100) / 100;
        confidence = aiResult.confidence;
        console.log(`🤖 AI yakıt tahmini: ${aiResult.consumption} L/100km → faktörlü ${aiAdjustedL100.toFixed(2)} → ${finalConsumption.toFixed(1)}L toplam (güven: ${(confidence * 100).toFixed(0)}%)`);
      } else {
        console.log(`⚠️ AI yakıt tahmini başarısız, varsayılan hesaplama kullanılıyor: ${finalConsumption.toFixed(1)}L`);
      }
    }

    const currentFuelPrice = this.fuelPriceService.getPriceForType(dto.vehicleType || 'petrol');
    const totalFuelCost = finalConsumption * currentFuelPrice;

    return {
      fuelCost: totalFuelCost,
      estimatedConsumption: finalConsumption,
      fuelPrice: currentFuelPrice,
      confidence,
      breakdown: {
        baseConsumption: rawBase,
        speedFactor: factors.speedFactor,
        acFactor: factors.acFactor,
        trafficFactor: factors.trafficFactor,
        climateControlFactor: factors.climateFactor,
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
          timeout: 25000,
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
