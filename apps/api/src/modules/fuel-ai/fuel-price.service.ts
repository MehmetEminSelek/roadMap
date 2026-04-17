import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

export interface FuelPrices {
  petrol: number;
  diesel: number;
  lpg: number;
}

@Injectable()
export class FuelPriceService implements OnModuleInit {
  private readonly logger = new Logger(FuelPriceService.name);
  private currentPrices: FuelPrices;
  private readonly defaultPrice: number;

  constructor(
    private configService: ConfigService,
    private httpService: HttpService,
  ) {
    this.defaultPrice = this.configService.get<number>('FUEL_PRICE_TL', 40.00);
    this.currentPrices = {
      petrol: this.defaultPrice,
      diesel: this.defaultPrice,
      lpg: this.defaultPrice * 0.5, // Approx LPG ratio
    };
  }

  async onModuleInit() {
    // Initial fetch
    await this.fetchLatestPrices();
    
    // Update prices every hour
    setInterval(() => {
      this.fetchLatestPrices();
    }, 60 * 60 * 1000);
  }

  async fetchLatestPrices() {
    this.logger.log('Fetching latest fuel prices from Opet API...');
    try {
      // 34 = Istanbul province code
      const response = await firstValueFrom(
        this.httpService.get('https://api.opet.com.tr/api/fuelprices/prices?ProvinceCode=34', {
          timeout: 10000,
        })
      );

      const data = response.data;
      if (Array.isArray(data) && data.length > 0) {
        // Find average or use specific district (e.g., center)
        const prices = data[0].prices; // prices array contains products
        
        let newPetrol = this.defaultPrice;
        let newDiesel = this.defaultPrice;
        let newLpg = this.defaultPrice * 0.5;

        // Extract by product name or id
        for (const item of prices) {
          const name = (item.productName || '').toLowerCase();
          const amount = item.amount || 0;
          
          if (amount > 0) {
            if (name.includes('kurşunsuz') || name.includes('benzin')) {
              newPetrol = amount;
            } else if (name.includes('motorin') || name.includes('dizel') || name.includes('diesel') || name.includes('eco force')) {
              newDiesel = amount;
            } else if (name.includes('lpg') || name.includes('otogaz')) {
              newLpg = amount;
            }
          }
        }

        this.currentPrices = {
          petrol: newPetrol,
          diesel: newDiesel,
          lpg: newLpg,
        };
        this.logger.log(`Fuel prices updated: Petrol=${newPetrol}₺, Diesel=${newDiesel}₺, LPG=${newLpg}₺`);
      } else {
        this.logger.warn('Opet API returned unexpected data format. Keeping current prices.');
      }
    } catch (error) {
      this.logger.error(`Failed to fetch fuel prices: ${error.message}. Keeping current prices.`);
    }
  }

  getPrices(): FuelPrices {
    return this.currentPrices;
  }

  getPriceForType(type: string): number {
    const t = type.toLowerCase();
    if (t.includes('diesel') || t.includes('dizel')) return this.currentPrices.diesel;
    if (t.includes('lpg')) return this.currentPrices.lpg;
    // Hybrid uses petrol
    return this.currentPrices.petrol;
  }
}
