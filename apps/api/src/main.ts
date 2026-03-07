import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { json, urlencoded } from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Security headers
  app.use(helmet());

  // Request body size limits
  app.use(json({ limit: '10kb' }));
  app.use(urlencoded({ extended: true, limit: '10kb' }));

  // CORS
  const corsOrigins = process.env.CORS_ORIGINS;
  if (!corsOrigins && process.env.NODE_ENV === 'production') {
    throw new Error('CORS_ORIGINS must be set in production');
  }
  app.enableCors({
    origin: corsOrigins ? corsOrigins.split(',').map(o => o.trim()) : 'http://localhost:3000',
    credentials: true,
  });

  // Parsers
  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Swagger
  const config = new DocumentBuilder()
    .setTitle('RoadMap API')
    .setDescription('RoadMap API - Otoyol maliyeti hesaplama ve rota planlama')
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  // Start server
  const port = process.env.PORT || 3001;
  await app.listen(port);

  console.log(`🚀 RoadMap API is running at: http://localhost:${port}`);
  console.log(`Swagger docs available at: http://localhost:${port}/api/docs`);
}

bootstrap();
