/**
 * Seed 50 Test Routes Between Turkey's 50 Most Populous Cities
 *
 * This script creates 50 routes for testing and stress testing.
 * Run: npx ts-node -r tsconfig-paths/register prisma/seed-50-routes.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Turkey's 50 Most Populous Cities (2025 data)
const cities = [
  { name: 'İstanbul', lat: 41.0082, lng: 28.9784 },
  { name: 'Ankara', lat: 39.9334, lng: 32.8597 },
  { name: 'İzmir', lat: 38.4237, lng: 27.1428 },
  { name: 'Bursa', lat: 40.1826, lng: 29.0665 },
  { name: 'Antalya', lat: 36.8969, lng: 30.7133 },
  { name: 'Adana', lat: 37.0, lng: 35.3211 },
  { name: 'Konya', lat: 37.8686, lng: 32.485 },
  { name: 'Şanlıurfa', lat: 37.1591, lng: 38.7969 },
  { name: 'Gaziantep', lat: 37.066, lng: 37.3781 },
  { name: 'Kocaeli', lat: 40.8533, lng: 29.8815 },
  { name: 'Mersin', lat: 36.8121, lng: 34.6415 },
  { name: 'Diyarbakır', lat: 37.9144, lng: 40.2306 },
  { name: 'Kayseri', lat: 38.7312, lng: 35.4787 },
  { name: 'Eskişehir', lat: 39.7767, lng: 30.5205 },
  { name: 'Samsun', lat: 41.2867, lng: 36.33 },
  { name: 'Denizli', lat: 37.7765, lng: 29.0864 },
  { name: 'Malatya', lat: 38.3552, lng: 38.3095 },
  { name: 'Erzurum', lat: 39.9043, lng: 41.2678 },
  { name: 'Batman', lat: 37.8814, lng: 41.1399 },
  { name: 'Elazığ', lat: 38.6748, lng: 39.2226 },
  { name: 'Trabzon', lat: 41.0027, lng: 39.7168 },
  { name: 'Manisa', lat: 38.6191, lng: 27.4289 },
  { name: 'Van', lat: 38.4891, lng: 43.4039 },
  { name: 'Isparta', lat: 37.7648, lng: 30.5566 },
  { name: 'Aydın', lat: 37.856, lng: 27.8416 },
  { name: 'Muğla', lat: 37.2153, lng: 28.3636 },
  { name: 'Balıkesir', lat: 39.6484, lng: 27.8826 },
  { name: 'Kahramanmaraş', lat: 37.5858, lng: 36.9371 },
  { name: 'Zonguldak', lat: 41.4564, lng: 31.7987 },
  { name: 'Ordu', lat: 40.9839, lng: 37.8788 },
  { name: 'Bolu', lat: 40.7394, lng: 31.6061 },
  { name: 'Afyonkarahisar', lat: 38.7507, lng: 30.5567 },
  { name: 'Sakarya', lat: 40.7694, lng: 30.4036 },
  { name: 'Tekirdağ', lat: 40.9833, lng: 27.5117 },
  { name: 'Tokat', lat: 40.3139, lng: 36.5544 },
  { name: 'Siirt', lat: 37.9339, lng: 41.9328 },
  { name: 'Aksaray', lat: 38.3687, lng: 34.0369 },
  { name: 'Mardin', lat: 37.3106, lng: 40.7253 },
  { name: 'Adıyaman', lat: 37.7644, lng: 38.2786 },
  { name: 'Kütahya', lat: 39.4242, lng: 29.9833 },
  { name: 'Giresun', lat: 40.9128, lng: 38.3895 },
  { name: 'Kırıkkale', lat: 39.8383, lng: 33.5154 },
  { name: 'Rize', lat: 41.0027, lng: 40.5244 },
  { name: 'Yalova', lat: 40.65, lng: 29.2667 },
  { name: 'Kastamonu', lat: 41.3804, lng: 33.782 },
  { name: 'Nevşehir', lat: 38.6251, lng: 34.723 },
  { name: 'Amasya', lat: 40.6499, lng: 35.835 },
  { name: 'Burdur', lat: 37.4613, lng: 30.0667 },
  { name: 'Uşak', lat: 38.6735, lng: 29.408 },
  { name: 'Edirne', lat: 41.6771, lng: 26.555 },
];

// Generate 50 routes between major cities
function generateRoutes() {
  const routes = [];

  // Create routes from Istanbul to other major cities (15 routes)
  for (let i = 1; i <= 15 && i < cities.length; i++) {
    routes.push({
      origin: cities[0].name, // Istanbul
      destination: cities[i].name,
      originLat: cities[0].lat,
      originLng: cities[0].lng,
      destLat: cities[i].lat,
      destLng: cities[i].lng,
    });
  }

  // Create routes from Ankara to other major cities (10 routes)
  for (let i = 1; i <= 10 && i + 15 < cities.length; i++) {
    routes.push({
      origin: cities[1].name, // Ankara
      destination: cities[i + 15].name,
      originLat: cities[1].lat,
      originLng: cities[1].lng,
      destLat: cities[i + 15].lat,
      destLng: cities[i + 15].lng,
    });
  }

  // Create routes from Izmir to other cities (10 routes)
  for (let i = 1; i <= 10 && i + 25 < cities.length; i++) {
    routes.push({
      origin: cities[2].name, // Izmir
      destination: cities[i + 25].name,
      originLat: cities[2].lat,
      originLng: cities[2].lng,
      destLat: cities[i + 25].lat,
      destLng: cities[i + 25].lng,
    });
  }

  // Create cross routes between major hubs (15 routes)
  const crossRoutes = [
    { from: 3, to: 4 },   // Bursa -> Antalya
    { from: 5, to: 6 },   // Adana -> Konya
    { from: 7, to: 8 },   // Sanliurfa -> Gaziantep
    { from: 9, to: 0 },   // Kocaeli -> Istanbul
    { from: 10, to: 5 },  // Mersin -> Adana
    { from: 11, to: 8 },  // Diyarbakir -> Gaziantep
    { from: 12, to: 1 },  // Kayseri -> Ankara
    { from: 13, to: 0 },  // Eskisehir -> Istanbul
    { from: 14, to: 20 }, // Samsun -> Trabzon
    { from: 15, to: 2 },  // Denizli -> Izmir
    { from: 16, to: 11 }, // Malatya -> Diyarbakir
    { from: 17, to: 12 }, // Erzurum -> Kayseri
    { from: 21, to: 2 },  // Manisa -> Izmir
    { from: 22, to: 17 }, // Van -> Erzurum
    { from: 23, to: 1 },  // Isparta -> Ankara
  ];

  for (const { from, to } of crossRoutes) {
    if (from < cities.length && to < cities.length) {
      routes.push({
        origin: cities[from].name,
        destination: cities[to].name,
        originLat: cities[from].lat,
        originLng: cities[from].lng,
        destLat: cities[to].lat,
        destLng: cities[to].lng,
      });
    }
  }

  return routes.slice(0, 50);
}

async function main() {
  console.log('🚧 50 test rotası oluşturuluyor...\n');

  // Get or create test user
  let testUser = await prisma.user.findFirst({
    where: { email: 'test-routes@roadmap.test' },
  });

  if (!testUser) {
    testUser = await prisma.user.create({
      data: {
        email: 'test-routes@roadmap.test',
        name: 'Test Routes User',
        password: '$2b$10$testHashedPassword',
      },
    });
    console.log('✅ Test kullanıcı oluşturuldu\n');
  }

  // Get or create a test vehicle
  let testVehicle = await prisma.vehicle.findFirst({
    where: { userId: testUser.id },
  });

  if (!testVehicle) {
    testVehicle = await prisma.vehicle.create({
      data: {
        userId: testUser.id,
        name: 'Test Araç',
        brand: 'Toyota',
        model: 'Corolla',
        fuelType: 'HYBRID',
        enginePower: 140,
        engineCapacity: 1800,
        weight: 1500,
        transmission: 'AUTOMATIC',
        hasClimateControl: true,
      },
    });
    console.log('✅ Test araç oluşturuldu\n');
  }

  const routes = generateRoutes();
  console.log(`📍 ${routes.length} rota oluşturulacak\n`);

  let success = 0;
  let failed = 0;

  for (const route of routes) {
    try {
      console.log(`📍 Rota: ${route.origin} → ${route.destination}`);

      // Note: In real scenario, you would call the API to calculate the route
      // For seed purposes, we create mock data
      await prisma.route.create({
        data: {
          userId: testUser.id,
          vehicleId: testVehicle.id,
          origin: route.origin,
          destination: route.destination,
          originLat: route.originLat,
          originLng: route.originLng,
          destLat: route.destLat,
          destLng: route.destLng,
          googleRouteId: `seed-${Date.now()}-${Math.random()}`,
          distance: Math.floor(Math.random() * 500000) + 50000, // 50-550 km
          duration: Math.floor(Math.random() * 20000) + 3000, // 30min - 5.5 hours
          routeCoordinates: JSON.stringify([
            { lat: route.originLat, lng: route.originLng },
            { lat: (route.originLat + route.destLat) / 2, lng: (route.originLng + route.destLng) / 2 },
            { lat: route.destLat, lng: route.destLng },
          ]),
          tollCost: Math.round((Math.random() * 500 + 50) * 100) / 100,
          tollDetails: [],
          fuelCost: Math.round((Math.random() * 300 + 100) * 100) / 100,
          totalCost: 0, // Will be calculated
          aiFuelEstimate: Math.round((Math.random() * 2 + 6) * 100) / 100,
          aiConfidence: 0.75,
          status: 'COMPLETED',
        },
      });

      success++;
      console.log(`✅ Oluşturuldu\n`);
    } catch (error) {
      failed++;
      console.error(`❌ Hata: ${route.origin} → ${route.destination}`);
      console.error(error);
    }
  }

  console.log('\n=================================');
  console.log(`✅ Başarılı: ${success}`);
  console.log(`❌ Başarısız: ${failed}`);
  console.log('=================================');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
