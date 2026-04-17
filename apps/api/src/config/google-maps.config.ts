import { IsString, IsNotEmpty } from 'class-validator';

class EnvironmentVariables {
  @IsString()
  @IsNotEmpty()
  GOOGLE_MAPS_API_KEY: string = '';

  @IsString()
  @IsNotEmpty()
  GOOGLE_MAPS_API_URL: string = 'https://maps.googleapis.com/maps/api';

  @IsString()
  @IsNotEmpty()
  GOOGLE_GENERATIVE_AI_API_KEY: string = '';
}

export const validateConfig = (config: EnvironmentVariables) => {
  const errors = [];

  if (!config.GOOGLE_MAPS_API_KEY) {
    errors.push('GOOGLE_MAPS_API_KEY is not set');
  }

  if (!config.GOOGLE_GENERATIVE_AI_API_KEY) {
    errors.push('GOOGLE_GENERATIVE_AI_API_KEY is not set');
  }

  if (errors.length > 0) {
    console.warn('Environment variable validation errors:', errors);
  }

  return config;
};

export default () => ({
  googleMaps: {
    apiKey: process.env.GOOGLE_MAPS_API_KEY,
    apiUrl: process.env.GOOGLE_MAPS_API_URL || 'https://maps.googleapis.com/maps/api',
  },
  googleGemini: {
    apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
  },
  tollguru: {
    apiKey: process.env.TOLLGURU_API_KEY || '',
    // 'tollguru' | 'local' | 'auto' (default: auto -> tollguru -> local fallback)
    provider: (process.env.TOLL_PROVIDER || 'auto').toLowerCase(),
  },
});
