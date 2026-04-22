import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { WeatherService } from './weather.service';

/**
 * WeatherModule
 * ---------------------------------------------------------------------------
 * OpenWeatherMap One Call 3.0 istemcisi. `RetryService` + `CACHE_MANAGER`
 * global olarak CommonModule/AppCacheModule tarafından sağlanıyor — burada
 * tekrar provide etmeye gerek yok.
 */
@Module({
  imports: [HttpModule],
  providers: [WeatherService],
  exports: [WeatherService],
})
export class WeatherModule {}
