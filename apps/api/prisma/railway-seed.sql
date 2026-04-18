-- ============================================
-- RoadMap Railway DB Seed — Full SQL
-- ============================================

-- 1. Admin User
INSERT INTO "User" (id, email, name, password, "createdAt", "updatedAt")
VALUES (gen_random_uuid(), 'admin@roadmap.com', 'Admin', '$2a$10$pnaNI8P7xjfRTH.AVpzOc.LMNva/ht92xN9o09Ty/8mjcV3.BBerS', NOW(), NOW())
ON CONFLICT (email) DO NOTHING;

-- 2. Vehicle Makes
INSERT INTO "VehicleMake" (id, name) VALUES ('Audi', 'Audi') ON CONFLICT DO NOTHING;
INSERT INTO "VehicleMake" (id, name) VALUES ('BMW', 'BMW') ON CONFLICT DO NOTHING;
INSERT INTO "VehicleMake" (id, name) VALUES ('Fiat', 'Fiat') ON CONFLICT DO NOTHING;
INSERT INTO "VehicleMake" (id, name) VALUES ('Ford', 'Ford') ON CONFLICT DO NOTHING;
INSERT INTO "VehicleMake" (id, name) VALUES ('Honda', 'Honda') ON CONFLICT DO NOTHING;
INSERT INTO "VehicleMake" (id, name) VALUES ('Hyundai', 'Hyundai') ON CONFLICT DO NOTHING;
INSERT INTO "VehicleMake" (id, name) VALUES ('Mercedes', 'Mercedes') ON CONFLICT DO NOTHING;
INSERT INTO "VehicleMake" (id, name) VALUES ('Opel', 'Opel') ON CONFLICT DO NOTHING;
INSERT INTO "VehicleMake" (id, name) VALUES ('Peugeot', 'Peugeot') ON CONFLICT DO NOTHING;
INSERT INTO "VehicleMake" (id, name) VALUES ('Renault', 'Renault') ON CONFLICT DO NOTHING;
INSERT INTO "VehicleMake" (id, name) VALUES ('Toyota', 'Toyota') ON CONFLICT DO NOTHING;
INSERT INTO "VehicleMake" (id, name) VALUES ('Volkswagen', 'Volkswagen') ON CONFLICT DO NOTHING;

-- 3. Vehicle Models
INSERT INTO "VehicleModel" (id, "makeId", name) VALUES (gen_random_uuid(), 'Audi', 'A3') ON CONFLICT DO NOTHING;
INSERT INTO "VehicleModel" (id, "makeId", name) VALUES (gen_random_uuid(), 'Audi', 'A4') ON CONFLICT DO NOTHING;
INSERT INTO "VehicleModel" (id, "makeId", name) VALUES (gen_random_uuid(), 'Audi', 'Q5') ON CONFLICT DO NOTHING;
INSERT INTO "VehicleModel" (id, "makeId", name) VALUES (gen_random_uuid(), 'BMW', '3 Series') ON CONFLICT DO NOTHING;
INSERT INTO "VehicleModel" (id, "makeId", name) VALUES (gen_random_uuid(), 'BMW', '5 Series') ON CONFLICT DO NOTHING;
INSERT INTO "VehicleModel" (id, "makeId", name) VALUES (gen_random_uuid(), 'BMW', 'X1') ON CONFLICT DO NOTHING;
INSERT INTO "VehicleModel" (id, "makeId", name) VALUES (gen_random_uuid(), 'Fiat', 'Egea') ON CONFLICT DO NOTHING;
INSERT INTO "VehicleModel" (id, "makeId", name) VALUES (gen_random_uuid(), 'Fiat', 'Doblo') ON CONFLICT DO NOTHING;
INSERT INTO "VehicleModel" (id, "makeId", name) VALUES (gen_random_uuid(), 'Ford', 'Focus') ON CONFLICT DO NOTHING;
INSERT INTO "VehicleModel" (id, "makeId", name) VALUES (gen_random_uuid(), 'Ford', 'Kuga') ON CONFLICT DO NOTHING;
INSERT INTO "VehicleModel" (id, "makeId", name) VALUES (gen_random_uuid(), 'Honda', 'Civic') ON CONFLICT DO NOTHING;
INSERT INTO "VehicleModel" (id, "makeId", name) VALUES (gen_random_uuid(), 'Honda', 'CR-V') ON CONFLICT DO NOTHING;
INSERT INTO "VehicleModel" (id, "makeId", name) VALUES (gen_random_uuid(), 'Hyundai', 'i20') ON CONFLICT DO NOTHING;
INSERT INTO "VehicleModel" (id, "makeId", name) VALUES (gen_random_uuid(), 'Hyundai', 'Tucson') ON CONFLICT DO NOTHING;
INSERT INTO "VehicleModel" (id, "makeId", name) VALUES (gen_random_uuid(), 'Mercedes', 'A Class') ON CONFLICT DO NOTHING;
INSERT INTO "VehicleModel" (id, "makeId", name) VALUES (gen_random_uuid(), 'Mercedes', 'C Class') ON CONFLICT DO NOTHING;
INSERT INTO "VehicleModel" (id, "makeId", name) VALUES (gen_random_uuid(), 'Mercedes', 'E Class') ON CONFLICT DO NOTHING;
INSERT INTO "VehicleModel" (id, "makeId", name) VALUES (gen_random_uuid(), 'Opel', 'Astra') ON CONFLICT DO NOTHING;
INSERT INTO "VehicleModel" (id, "makeId", name) VALUES (gen_random_uuid(), 'Opel', 'Corsa') ON CONFLICT DO NOTHING;
INSERT INTO "VehicleModel" (id, "makeId", name) VALUES (gen_random_uuid(), 'Peugeot', '208') ON CONFLICT DO NOTHING;
INSERT INTO "VehicleModel" (id, "makeId", name) VALUES (gen_random_uuid(), 'Peugeot', '308') ON CONFLICT DO NOTHING;
INSERT INTO "VehicleModel" (id, "makeId", name) VALUES (gen_random_uuid(), 'Peugeot', '2008') ON CONFLICT DO NOTHING;
INSERT INTO "VehicleModel" (id, "makeId", name) VALUES (gen_random_uuid(), 'Renault', 'Clio') ON CONFLICT DO NOTHING;
INSERT INTO "VehicleModel" (id, "makeId", name) VALUES (gen_random_uuid(), 'Renault', 'Megane') ON CONFLICT DO NOTHING;
INSERT INTO "VehicleModel" (id, "makeId", name) VALUES (gen_random_uuid(), 'Renault', 'Kadjar') ON CONFLICT DO NOTHING;
INSERT INTO "VehicleModel" (id, "makeId", name) VALUES (gen_random_uuid(), 'Toyota', 'Yaris') ON CONFLICT DO NOTHING;
INSERT INTO "VehicleModel" (id, "makeId", name) VALUES (gen_random_uuid(), 'Toyota', 'Corolla') ON CONFLICT DO NOTHING;
INSERT INTO "VehicleModel" (id, "makeId", name) VALUES (gen_random_uuid(), 'Toyota', 'RAV4') ON CONFLICT DO NOTHING;
INSERT INTO "VehicleModel" (id, "makeId", name) VALUES (gen_random_uuid(), 'Toyota', 'Camry') ON CONFLICT DO NOTHING;
INSERT INTO "VehicleModel" (id, "makeId", name) VALUES (gen_random_uuid(), 'Volkswagen', 'Polo') ON CONFLICT DO NOTHING;
INSERT INTO "VehicleModel" (id, "makeId", name) VALUES (gen_random_uuid(), 'Volkswagen', 'Golf') ON CONFLICT DO NOTHING;
INSERT INTO "VehicleModel" (id, "makeId", name) VALUES (gen_random_uuid(), 'Volkswagen', 'Passat') ON CONFLICT DO NOTHING;
INSERT INTO "VehicleModel" (id, "makeId", name) VALUES (gen_random_uuid(), 'Volkswagen', 'Tiguan') ON CONFLICT DO NOTHING;

-- 4. Toll Stations
INSERT INTO "TollStation" (id, name, location, lat, lng, "isActive", "createdAt", "updatedAt") VALUES (gen_random_uuid(), 'Gebze Gişeleri', 'Gebze, Kocaeli', 40.7943, 29.4316, true, NOW(), NOW());
INSERT INTO "TollStation" (id, name, location, lat, lng, "isActive", "createdAt", "updatedAt") VALUES (gen_random_uuid(), 'Hereke Gişeleri', 'Hereke, Kocaeli', 40.7833, 29.6167, true, NOW(), NOW());
INSERT INTO "TollStation" (id, name, location, lat, lng, "isActive", "createdAt", "updatedAt") VALUES (gen_random_uuid(), 'Bolu Dağı Gişeleri', 'Bolu', 40.7339, 31.6078, true, NOW(), NOW());
INSERT INTO "TollStation" (id, name, location, lat, lng, "isActive", "createdAt", "updatedAt") VALUES (gen_random_uuid(), 'Düzce Gişeleri', 'Düzce', 40.8438, 31.1558, true, NOW(), NOW());
INSERT INTO "TollStation" (id, name, location, lat, lng, "isActive", "createdAt", "updatedAt") VALUES (gen_random_uuid(), 'Kaynaşlı Gişeleri', 'Kaynaşlı, Düzce', 40.7680, 30.9150, true, NOW(), NOW());
INSERT INTO "TollStation" (id, name, location, lat, lng, "isActive", "createdAt", "updatedAt") VALUES (gen_random_uuid(), 'Osmangazi Köprüsü', 'Gebze-Yalova', 40.7300, 29.5100, true, NOW(), NOW());
INSERT INTO "TollStation" (id, name, location, lat, lng, "isActive", "createdAt", "updatedAt") VALUES (gen_random_uuid(), '15 Temmuz Şehitler Köprüsü', 'İstanbul Boğazı', 41.0456, 29.0337, true, NOW(), NOW());
INSERT INTO "TollStation" (id, name, location, lat, lng, "isActive", "createdAt", "updatedAt") VALUES (gen_random_uuid(), 'Yavuz Sultan Selim Köprüsü', 'İstanbul Kuzey', 41.2053, 29.1080, true, NOW(), NOW());
INSERT INTO "TollStation" (id, name, location, lat, lng, "isActive", "createdAt", "updatedAt") VALUES (gen_random_uuid(), 'Bursa Gişeleri', 'Bursa', 40.1827, 29.0661, true, NOW(), NOW());
INSERT INTO "TollStation" (id, name, location, lat, lng, "isActive", "createdAt", "updatedAt") VALUES (gen_random_uuid(), 'İzmir Otoyol Gişeleri', 'İzmir', 38.4192, 27.1287, true, NOW(), NOW());
INSERT INTO "TollStation" (id, name, location, lat, lng, "isActive", "createdAt", "updatedAt") VALUES (gen_random_uuid(), 'Ankara Batı Gişeleri', 'Ankara', 39.9334, 32.6546, true, NOW(), NOW());
INSERT INTO "TollStation" (id, name, location, lat, lng, "isActive", "createdAt", "updatedAt") VALUES (gen_random_uuid(), 'Antalya Gişeleri', 'Antalya', 36.8969, 30.7133, true, NOW(), NOW());
INSERT INTO "TollStation" (id, name, location, lat, lng, "isActive", "createdAt", "updatedAt") VALUES (gen_random_uuid(), 'Tarsus Gişeleri', 'Tarsus, Mersin', 36.9081, 34.8500, true, NOW(), NOW());

-- 5. Toll Rates (per station, per vehicle type)
DO $$
DECLARE
  s RECORD;
  rates JSONB;
  vtype TEXT;
  amount NUMERIC;
  all_rates JSONB := '{
    "Gebze Gişeleri": {"CAR":42,"MOTORCYCLE":21,"BUS":84,"TRUCK":126,"VAN":63},
    "Hereke Gişeleri": {"CAR":38,"MOTORCYCLE":19,"BUS":76,"TRUCK":114,"VAN":57},
    "Bolu Dağı Gişeleri": {"CAR":55,"MOTORCYCLE":28,"BUS":110,"TRUCK":165,"VAN":83},
    "Düzce Gişeleri": {"CAR":45,"MOTORCYCLE":23,"BUS":90,"TRUCK":135,"VAN":68},
    "Kaynaşlı Gişeleri": {"CAR":35,"MOTORCYCLE":18,"BUS":70,"TRUCK":105,"VAN":53},
    "Osmangazi Köprüsü": {"CAR":310,"MOTORCYCLE":155,"BUS":620,"TRUCK":930,"VAN":465},
    "15 Temmuz Şehitler Köprüsü": {"CAR":168,"MOTORCYCLE":84,"BUS":336,"TRUCK":504,"VAN":252},
    "Yavuz Sultan Selim Köprüsü": {"CAR":168,"MOTORCYCLE":84,"BUS":336,"TRUCK":504,"VAN":252},
    "Bursa Gişeleri": {"CAR":48,"MOTORCYCLE":24,"BUS":96,"TRUCK":144,"VAN":72},
    "İzmir Otoyol Gişeleri": {"CAR":65,"MOTORCYCLE":33,"BUS":130,"TRUCK":195,"VAN":98},
    "Ankara Batı Gişeleri": {"CAR":52,"MOTORCYCLE":26,"BUS":104,"TRUCK":156,"VAN":78},
    "Antalya Gişeleri": {"CAR":58,"MOTORCYCLE":29,"BUS":116,"TRUCK":174,"VAN":87},
    "Tarsus Gişeleri": {"CAR":40,"MOTORCYCLE":20,"BUS":80,"TRUCK":120,"VAN":60}
  }'::JSONB;
BEGIN
  FOR s IN SELECT id, name FROM "TollStation" LOOP
    rates := all_rates -> s.name;
    IF rates IS NOT NULL THEN
      FOR vtype IN SELECT unnest(ARRAY['CAR','MOTORCYCLE','BUS','TRUCK','VAN']) LOOP
        amount := (rates ->> vtype)::NUMERIC;
        INSERT INTO "TollRate" (id, "tollStationId", "vehicleType", amount, "isActive", "createdAt", "updatedAt")
        VALUES (gen_random_uuid(), s.id, vtype::"VehicleType", amount, true, NOW(), NOW());
      END LOOP;
    END IF;
  END LOOP;
END $$;
