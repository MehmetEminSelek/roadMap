import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { PrismaService } from './prisma/prisma.service';
import googleMapsConfig from './config/google-maps.config';

// Modules
import { VehiclesModule } from './modules/vehicles/vehicles.module';
import { RoutesModule } from './modules/routes/routes.module';
import { TollsModule } from './modules/tolls/tolls.module';
import { FuelAiModule } from './modules/fuel-ai/fuel-ai.module';
import { PlacesModule } from './modules/places/places.module';
import { HistoryModule } from './modules/history/history.module';
import { FavoritesModule } from './modules/favorites/favorites.module';
import { AuthModule } from './auth/auth.module';

// Config validation
function validateConfig(config: Record<string, unknown>) {
  const requiredVars = [
    'GOOGLE_MAPS_API_KEY',
    'GOOGLE_GENERATIVE_AI_API_KEY',
    'DATABASE_URL',
  ];

  for (const varName of requiredVars) {
    if (!config[varName]) {
      console.warn(`⚠️  Missing required environment variable: ${varName}`);
    }
  }

  return config;
}

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      load: [googleMapsConfig],
      validate: validateConfig,
    }),
    PrismaModule,
    VehiclesModule,
    RoutesModule,
    TollsModule,
    FuelAiModule,
    PlacesModule,
    HistoryModule,
    FavoritesModule,
    AuthModule,
  ],
  providers: [PrismaService],
})
export class AppModule { }
