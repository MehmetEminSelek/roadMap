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

  // CORS — Mobil uygulama native HTTP isteği gönderdiği için
  // Origin header'ı olmaz. Tüm origin'lere izin veriyoruz.
  app.enableCors({
    origin: true,
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

  // Start server — Railway requires 0.0.0.0 binding
  const port = process.env.PORT || 3001;
  await app.listen(port, '0.0.0.0');

  console.log(`🚀 RoadMap API is running on port ${port}`);
  console.log(`Swagger docs available at: /api/docs`);
}

bootstrap();
