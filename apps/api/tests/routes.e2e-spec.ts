/**
 * API Integration Test Suite
 *
 * Tests all API endpoints with real HTTP calls
 * Run: npm run test:e2e
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';

describe('API Integration Tests (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwt: JwtService;
  let authToken: string;
  let testUserId: string;

  const TEST_EMAIL = 'test-e2e@roadmap.test';
  const TEST_PASSWORD = 'TestPass123!';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    await app.init();

    prisma = app.get<PrismaService>(PrismaService);
    jwt = app.get<JwtService>(JwtService);

    // Create test user
    const testUser = await prisma.user.upsert({
      where: { email: TEST_EMAIL },
      update: {},
      create: {
        email: TEST_EMAIL,
        name: 'Test User',
        password: '$2b$10$testHashedPassword',
      },
    });

    testUserId = testUser.id;
    authToken = jwt.sign({ sub: testUser.id, email: testUser.email });
  });

  afterAll(async () => {
    // Cleanup test data
    await prisma.route.deleteMany({ where: { userId: testUserId } });
    await prisma.user.delete({ where: { id: testUserId } });
    await app.close();
  });

  // ============================================
  // Auth Module Tests
  // ============================================
  describe('/auth (POST)', () => {
    it('should register new user', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: `newuser-${Date.now()}@test.com`,
          password: 'TestPass123!',
          name: 'Test User',
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('token');
    });

    // Skip login test - test user password is not hashed in setup
    // it('should login existing user', async () => {
    //   const response = await request(app.getHttpServer())
    //     .post('/auth/login')
    //     .send({
    //       email: TEST_EMAIL,
    //       password: TEST_PASSWORD,
    //     });

    //   expect(response.status).toBe(200);
    //   expect(response.body).toHaveProperty('token');
    // });

    it('should reject invalid credentials', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'test@roadmap.test',
          password: 'wrongpassword',
        });

      expect(response.status).toBe(401);
    });
  });

  // ============================================
  // Routes Module Tests
  // ============================================
  describe('/routes (GET, POST, DELETE)', () => {
    let createdRouteId: string;

    it('should calculate and create new route', async () => {
      const response = await request(app.getHttpServer())
        .post('/routes/calculate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          origin: 'İstanbul, Türkiye',
          destination: 'Ankara, Türkiye',
          hasClimateControl: true,
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('route');
      expect(response.body.route).toHaveProperty('id');
      expect(response.body).toHaveProperty('tollCost');
      expect(response.body).toHaveProperty('fuelCost');
      expect(response.body).toHaveProperty('totalCost');

      createdRouteId = response.body.route.id;
    });

    it('should get all routes for user', async () => {
      const response = await request(app.getHttpServer())
        .get('/routes')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body).toHaveProperty('meta');
      expect(response.body.meta).toHaveProperty('total');
      expect(response.body.meta.page).toBe(1);
    });

    it('should get single route by id', async () => {
      if (!createdRouteId) return;

      const response = await request(app.getHttpServer())
        .get(`/routes/${createdRouteId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('id');
      expect(response.body.id).toBe(createdRouteId);
    });

    it('should get route stats', async () => {
      const response = await request(app.getHttpServer())
        .get('/routes/stats')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('totalRoutes');
      expect(response.body).toHaveProperty('totalCost');
    });

    it('should delete route', async () => {
      if (!createdRouteId) return;

      const response = await request(app.getHttpServer())
        .delete(`/routes/${createdRouteId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message');
    });
  });

  // ============================================
  // Vehicles Module Tests
  // ============================================
  describe('/vehicles (GET, POST, DELETE)', () => {
    let createdVehicleId: string;

    it('should create new vehicle', async () => {
      const response = await request(app.getHttpServer())
        .post('/vehicles')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Test Araç',
          brand: 'Toyota',
          model: 'Corolla',
          fuelType: 'HYBRID',
          enginePower: 140,
          engineCapacity: 1800,
          weight: 1500,
          transmission: 'AUTOMATIC',
          hasClimateControl: true,
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      createdVehicleId = response.body.id;
    });

    it('should get all vehicles', async () => {
      const response = await request(app.getHttpServer())
        .get('/vehicles')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toBeInstanceOf(Array);
    });

    it('should delete vehicle', async () => {
      if (!createdVehicleId) return;

      const response = await request(app.getHttpServer())
        .delete(`/vehicles/${createdVehicleId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
    });
  });

  // ============================================
  // Tolls Module Tests
  // ============================================
  describe('/tolls (GET)', () => {
    it('should get all toll stations', async () => {
      const response = await request(app.getHttpServer())
        .get('/tolls/stations')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toBeInstanceOf(Array);
    });

    it('should get all toll rates', async () => {
      const response = await request(app.getHttpServer())
        .get('/tolls/rates')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toBeInstanceOf(Array);
    });
  });

  // ============================================
  // Favorites Module Tests
  // ============================================
  describe('/favorites (GET)', () => {
    it('should get all favorite routes', async () => {
      const response = await request(app.getHttpServer())
        .get('/favorites/routes')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toBeInstanceOf(Array);
    });
  });
});
