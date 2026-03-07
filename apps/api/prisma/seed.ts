import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create admin user
  const hashedPassword = await bcrypt.hash('Test1234', 10);
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@roadmap.com' },
    update: {},
    create: {
      email: 'admin@roadmap.com',
      name: 'Admin',
      password: hashedPassword,
    },
  });
  console.log(`Created admin user: ${adminUser.email}`);

  // Create vehicle makes
  const makes = [
    { name: 'Audi' },
    { name: 'BMW' },
    { name: 'Fiat' },
    { name: 'Ford' },
    { name: 'Honda' },
    { name: 'Hyundai' },
    { name: 'Mercedes' },
    { name: 'Opel' },
    { name: 'Peugeot' },
    { name: 'Renault' },
    { name: 'Toyota' },
    { name: 'Volkswagen' },
  ];

  const createdMakes = [];
  for (const make of makes) {
    const created = await prisma.vehicleMake.upsert({
      where: { id: make.name },
      update: {},
      create: make,
    });
    createdMakes.push(created);
  }
  console.log(`Created ${createdMakes.length} vehicle makes`);

  // Create vehicle models
  const models = [
    { makeId: createdMakes.find(m => m.name === 'Audi')!.id, name: 'A3' },
    { makeId: createdMakes.find(m => m.name === 'Audi')!.id, name: 'A4' },
    { makeId: createdMakes.find(m => m.name === 'Audi')!.id, name: 'Q5' },
    { makeId: createdMakes.find(m => m.name === 'BMW')!.id, name: '3 Series' },
    { makeId: createdMakes.find(m => m.name === 'BMW')!.id, name: '5 Series' },
    { makeId: createdMakes.find(m => m.name === 'BMW')!.id, name: 'X1' },
    { makeId: createdMakes.find(m => m.name === 'Fiat')!.id, name: 'Egea' },
    { makeId: createdMakes.find(m => m.name === 'Fiat')!.id, name: 'Doblo' },
    { makeId: createdMakes.find(m => m.name === 'Ford')!.id, name: 'Focus' },
    { makeId: createdMakes.find(m => m.name === 'Ford')!.id, name: 'Kuga' },
    { makeId: createdMakes.find(m => m.name === 'Honda')!.id, name: 'Civic' },
    { makeId: createdMakes.find(m => m.name === 'Honda')!.id, name: 'CR-V' },
    { makeId: createdMakes.find(m => m.name === 'Hyundai')!.id, name: 'i20' },
    { makeId: createdMakes.find(m => m.name === 'Hyundai')!.id, name: 'Tucson' },
    { makeId: createdMakes.find(m => m.name === 'Mercedes')!.id, name: 'A Class' },
    { makeId: createdMakes.find(m => m.name === 'Mercedes')!.id, name: 'C Class' },
    { makeId: createdMakes.find(m => m.name === 'Mercedes')!.id, name: 'E Class' },
    { makeId: createdMakes.find(m => m.name === 'Opel')!.id, name: 'Astra' },
    { makeId: createdMakes.find(m => m.name === 'Opel')!.id, name: 'Corsa' },
    { makeId: createdMakes.find(m => m.name === 'Peugeot')!.id, name: '208' },
    { makeId: createdMakes.find(m => m.name === 'Peugeot')!.id, name: '308' },
    { makeId: createdMakes.find(m => m.name === 'Peugeot')!.id, name: '2008' },
    { makeId: createdMakes.find(m => m.name === 'Renault')!.id, name: 'Clio' },
    { makeId: createdMakes.find(m => m.name === 'Renault')!.id, name: 'Megane' },
    { makeId: createdMakes.find(m => m.name === 'Renault')!.id, name: 'Kadjar' },
    { makeId: createdMakes.find(m => m.name === 'Toyota')!.id, name: 'Yaris' },
    { makeId: createdMakes.find(m => m.name === 'Toyota')!.id, name: 'Corolla' },
    { makeId: createdMakes.find(m => m.name === 'Toyota')!.id, name: 'RAV4' },
    { makeId: createdMakes.find(m => m.name === 'Toyota')!.id, name: 'Camry' },
    { makeId: createdMakes.find(m => m.name === 'Volkswagen')!.id, name: 'Polo' },
    { makeId: createdMakes.find(m => m.name === 'Volkswagen')!.id, name: 'Golf' },
    { makeId: createdMakes.find(m => m.name === 'Volkswagen')!.id, name: 'Passat' },
    { makeId: createdMakes.find(m => m.name === 'Volkswagen')!.id, name: 'Tiguan' },
  ];

  const createdModels = [];
  for (const model of models) {
    const created = await prisma.vehicleModel.create({ data: model });
    createdModels.push(created);
  }
  console.log(`Created ${createdModels.length} vehicle models`);

  // Create toll stations with real coordinates
  const tollStations = [
    // Istanbul-Ankara Otoyolu (O-4 / TEM)
    { name: 'Gebze Gişeleri', location: 'Gebze, Kocaeli', lat: 40.7943, lng: 29.4316 },
    { name: 'Hereke Gişeleri', location: 'Hereke, Kocaeli', lat: 40.7833, lng: 29.6167 },
    { name: 'Bolu Dağı Gişeleri', location: 'Bolu', lat: 40.7339, lng: 31.6078 },
    { name: 'Düzce Gişeleri', location: 'Düzce', lat: 40.8438, lng: 31.1558 },
    { name: 'Kaynaşlı Gişeleri', location: 'Kaynaşlı, Düzce', lat: 40.7680, lng: 30.9150 },
    // Köprüler
    { name: 'Osmangazi Köprüsü', location: 'Gebze-Yalova', lat: 40.7300, lng: 29.5100 },
    { name: '15 Temmuz Şehitler Köprüsü', location: 'İstanbul Boğazı', lat: 41.0456, lng: 29.0337 },
    { name: 'Yavuz Sultan Selim Köprüsü', location: 'İstanbul Kuzey', lat: 41.2053, lng: 29.1080 },
    // İzmir Otoyolu
    { name: 'Bursa Gişeleri', location: 'Bursa', lat: 40.1827, lng: 29.0661 },
    { name: 'İzmir Otoyol Gişeleri', location: 'İzmir', lat: 38.4192, lng: 27.1287 },
    // Ankara Çevre
    { name: 'Ankara Batı Gişeleri', location: 'Ankara', lat: 39.9334, lng: 32.6546 },
    // Antalya Otoyolu
    { name: 'Antalya Gişeleri', location: 'Antalya', lat: 36.8969, lng: 30.7133 },
    // Mersin-Adana
    { name: 'Tarsus Gişeleri', location: 'Tarsus, Mersin', lat: 36.9081, lng: 34.8500 },
  ];

  const createdStations = [];
  for (const station of tollStations) {
    const created = await prisma.tollStation.create({
      data: {
        name: station.name,
        location: station.location,
        lat: station.lat,
        lng: station.lng,
        isActive: true,
      },
    });
    createdStations.push(created);
  }
  console.log(`Created ${createdStations.length} toll stations`);

  // Create toll rates for each station (all vehicle types)
  const vehicleTypes = ['CAR', 'MOTORCYCLE', 'BUS', 'TRUCK', 'VAN'] as const;

  // Rates per station (TL) - approximate 2025 KGM rates
  const stationRates: Record<string, Record<string, number>> = {
    'Gebze Gişeleri': { CAR: 42, MOTORCYCLE: 21, BUS: 84, TRUCK: 126, VAN: 63 },
    'Hereke Gişeleri': { CAR: 38, MOTORCYCLE: 19, BUS: 76, TRUCK: 114, VAN: 57 },
    'Bolu Dağı Gişeleri': { CAR: 55, MOTORCYCLE: 28, BUS: 110, TRUCK: 165, VAN: 83 },
    'Düzce Gişeleri': { CAR: 45, MOTORCYCLE: 23, BUS: 90, TRUCK: 135, VAN: 68 },
    'Kaynaşlı Gişeleri': { CAR: 35, MOTORCYCLE: 18, BUS: 70, TRUCK: 105, VAN: 53 },
    'Osmangazi Köprüsü': { CAR: 310, MOTORCYCLE: 155, BUS: 620, TRUCK: 930, VAN: 465 },
    '15 Temmuz Şehitler Köprüsü': { CAR: 168, MOTORCYCLE: 84, BUS: 336, TRUCK: 504, VAN: 252 },
    'Yavuz Sultan Selim Köprüsü': { CAR: 168, MOTORCYCLE: 84, BUS: 336, TRUCK: 504, VAN: 252 },
    'Bursa Gişeleri': { CAR: 48, MOTORCYCLE: 24, BUS: 96, TRUCK: 144, VAN: 72 },
    'İzmir Otoyol Gişeleri': { CAR: 65, MOTORCYCLE: 33, BUS: 130, TRUCK: 195, VAN: 98 },
    'Ankara Batı Gişeleri': { CAR: 52, MOTORCYCLE: 26, BUS: 104, TRUCK: 156, VAN: 78 },
    'Antalya Gişeleri': { CAR: 58, MOTORCYCLE: 29, BUS: 116, TRUCK: 174, VAN: 87 },
    'Tarsus Gişeleri': { CAR: 40, MOTORCYCLE: 20, BUS: 80, TRUCK: 120, VAN: 60 },
  };

  let rateCount = 0;
  for (const station of createdStations) {
    const rates = stationRates[station.name];
    if (!rates) continue;

    for (const vt of vehicleTypes) {
      await prisma.tollRate.create({
        data: {
          tollStationId: station.id,
          vehicleType: vt,
          amount: rates[vt],
          isActive: true,
        },
      });
      rateCount++;
    }
  }
  console.log(`Created ${rateCount} toll rates`);

  console.log('Seeding completed!');
}

main()
  .catch((e) => {
    console.error('Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
