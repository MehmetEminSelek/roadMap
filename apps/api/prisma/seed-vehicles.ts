/**
 * EPA Vehicle Dataset Seed Script
 * Kaynak: https://www.fueleconomy.gov/feg/epadata/vehicles.csv.zip
 *
 * Çalıştırma:
 *   1. CSV'yi indir: curl -L -o /tmp/vehicles.csv.zip https://www.fueleconomy.gov/feg/epadata/vehicles.csv.zip
 *   2. Unzip: unzip /tmp/vehicles.csv.zip -d /tmp/epa_data
 *   3. Çalıştır: npx ts-node prisma/seed-vehicles.ts
 */

import { PrismaClient, FuelType, Transmission } from '@prisma/client';
import * as fs from 'fs';

const prisma = new PrismaClient();

// ─── CSV Parser (basit state-machine, quote'lu alanları destekler) ───────────

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

// ─── Fuel Type Mapping ───────────────────────────────────────────────────────

function mapFuelType(fuelType1: string, atvType: string): FuelType {
  const atv = atvType.toLowerCase();
  const fuel = fuelType1.toLowerCase();

  if (atv.includes('plug-in') || atv.includes('phev')) return FuelType.HYBRID;
  if (atv.includes('hybrid')) return FuelType.HYBRID;
  if (atv.includes('ev') || fuel.includes('electricity')) return FuelType.ELECTRIC;
  if (fuel.includes('diesel')) return FuelType.DIZEL;
  if (fuel.includes('cng') || fuel.includes('natural gas') || fuel.includes('lpg')) return FuelType.LPG;
  return FuelType.PETROL; // Regular, Premium, Midgrade Gasoline
}

// ─── Transmission Mapping ────────────────────────────────────────────────────

function mapTransmission(trany: string): Transmission | null {
  if (!trany) return null;
  const t = trany.toLowerCase();
  if (t.includes('manual')) return Transmission.MANUAL;
  if (t.includes('(av)') || t.includes('cvt') || t.includes('variable')) return Transmission.CVT;
  if (t.includes('am') && t.includes('t')) return Transmission.SEMI_AUTOMATIC;
  if (t.includes('auto') || t.includes('(s') || t.includes('(l')) return Transmission.AUTOMATIC;
  return null;
}

// ─── MPG → L/100km ──────────────────────────────────────────────────────────

function mpgToL100km(mpg: number): number | null {
  if (!mpg || mpg <= 0) return null;
  return Math.round((235.214 / mpg) * 10) / 10;
}

// ─── Türkiye + Avrupa Pazarı Ek Araçlar ─────────────────────────────────────
// EPA'da olmayan veya eksik olan ama Türkiye'de yaygın markalar/modeller.
// Sadece isim bazında VehicleMake + VehicleModel oluşturulur.
// Trim verisi olan satırlar ayrıca TRIM_EXTRAS'ta.

const MANUAL_MAKES: Array<{ make: string; models: string[] }> = [
  // ── Renault (EPA'da sadece 1984-1987, modern modeller yok) ──────────────
  { make: 'Renault', models: [
    'Clio', 'Megane', 'Laguna', 'Fluence', 'Talisman', 'Symbol',
    'Kadjar', 'Captur', 'Austral', 'Arkana', 'Koleos',
    'Zoe', 'Scenic', 'Espace', 'Twingo', 'Sandero', 'Express',
  ]},
  // ── Opel ────────────────────────────────────────────────────────────────
  { make: 'Opel', models: [
    'Astra', 'Corsa', 'Insignia', 'Mokka', 'Grandland',
    'Crossland', 'Zafira', 'Vectra', 'Meriva', 'Tigra',
    'Cascada', 'Combo', 'Vivaro',
  ]},
  // ── Citroen ─────────────────────────────────────────────────────────────
  { make: 'Citroen', models: [
    'C3', 'C4', 'C5', 'C1', 'C2', 'C6',
    'C3 Aircross', 'C5 Aircross', 'C4 Cactus',
    'Berlingo', 'C-Elysee', 'DS3', 'DS4', 'DS5', 'Jumpy',
  ]},
  // ── Dacia (EPA'da sadece 1988) ───────────────────────────────────────────
  { make: 'Dacia', models: [
    'Duster', 'Logan', 'Sandero', 'Sandero Stepway',
    'Jogger', 'Spring', 'Dokker', 'Lodgy', 'Logan MCV',
  ]},
  // ── Skoda ────────────────────────────────────────────────────────────────
  { make: 'Skoda', models: [
    'Octavia', 'Fabia', 'Superb', 'Karoq', 'Kodiaq',
    'Rapid', 'Kamiq', 'Enyaq', 'Citigo', 'Scala',
  ]},
  // ── Seat ────────────────────────────────────────────────────────────────
  { make: 'Seat', models: [
    'Ibiza', 'Leon', 'Arona', 'Ateca', 'Tarraco',
    'Toledo', 'Altea', 'Alhambra', 'Mii',
  ]},
  // ── Fiat (modern Türkiye modelleri) ─────────────────────────────────────
  { make: 'Fiat', models: [
    'Egea', 'Egea Cross', 'Egea Sedan', 'Egea Wagon',
    'Doblo', 'Tipo', 'Punto', 'Stilo', 'Linea', 'Bravo',
    'Panda', 'Qubo', 'Fullback',
  ]},
  // ── Peugeot (EPA'da 1984-1992) ───────────────────────────────────────────
  { make: 'Peugeot', models: [
    '107', '206', '207', '208', '208 GT',
    '301', '307', '308', '3008', '4008', '5008',
    '408', '508', '2008', 'Partner', 'Expert',
  ]},
  // ── Togg (Türk EV markası) ────────────────────────────────────────────────
  { make: 'Togg', models: ['T10X', 'T10F', 'T10S'] },
  // ── Suzuki (EPA'da 2000-2013, sonrası yok) ───────────────────────────────
  { make: 'Suzuki', models: [
    'Swift', 'Vitara', 'S-Cross', 'Baleno',
    'Ignis', 'Jimny', 'Celerio', 'Dzire',
  ]},
];

// ─── Türkiye Özel Trim Verileri ───────────────────────────────────────────────
// EPA'da olmayan ama Türkiye'de çok yaygın: LPG, spesifik motor hacimleri

const TURKEY_TRIM_EXTRAS: Array<{
  make: string;
  model: string;
  year: number;
  fuelType: FuelType;
  engineCapacity?: number;
  transmission?: Transmission;
  fuelEconomyL100?: number;
}> = [
  // ── Renault ──────────────────────────────────────────────────────────────
  { make: 'Renault', model: 'Symbol', year: 2021, fuelType: FuelType.PETROL, engineCapacity: 1600, transmission: Transmission.MANUAL, fuelEconomyL100: 7.0 },
  { make: 'Renault', model: 'Symbol', year: 2021, fuelType: FuelType.LPG, engineCapacity: 1600, transmission: Transmission.MANUAL, fuelEconomyL100: 9.2 },
  { make: 'Renault', model: 'Clio', year: 2022, fuelType: FuelType.PETROL, engineCapacity: 1000, transmission: Transmission.MANUAL, fuelEconomyL100: 5.9 },
  { make: 'Renault', model: 'Clio', year: 2022, fuelType: FuelType.HYBRID, engineCapacity: 1600, transmission: Transmission.AUTOMATIC, fuelEconomyL100: 4.6 },
  { make: 'Renault', model: 'Megane', year: 2022, fuelType: FuelType.PETROL, engineCapacity: 1300, transmission: Transmission.AUTOMATIC, fuelEconomyL100: 6.3 },
  { make: 'Renault', model: 'Megane', year: 2022, fuelType: FuelType.DIZEL, engineCapacity: 1500, transmission: Transmission.MANUAL, fuelEconomyL100: 4.7 },
  { make: 'Renault', model: 'Megane', year: 2022, fuelType: FuelType.LPG, engineCapacity: 1600, transmission: Transmission.MANUAL, fuelEconomyL100: 9.5 },
  { make: 'Renault', model: 'Fluence', year: 2015, fuelType: FuelType.PETROL, engineCapacity: 1600, transmission: Transmission.MANUAL, fuelEconomyL100: 7.3 },
  { make: 'Renault', model: 'Fluence', year: 2015, fuelType: FuelType.LPG, engineCapacity: 1600, transmission: Transmission.MANUAL, fuelEconomyL100: 9.8 },
  { make: 'Renault', model: 'Kadjar', year: 2022, fuelType: FuelType.PETROL, engineCapacity: 1300, transmission: Transmission.AUTOMATIC, fuelEconomyL100: 6.8 },
  { make: 'Renault', model: 'Kadjar', year: 2022, fuelType: FuelType.DIZEL, engineCapacity: 1500, transmission: Transmission.MANUAL, fuelEconomyL100: 5.0 },
  { make: 'Renault', model: 'Talisman', year: 2022, fuelType: FuelType.PETROL, engineCapacity: 1300, transmission: Transmission.AUTOMATIC, fuelEconomyL100: 6.5 },
  { make: 'Renault', model: 'Talisman', year: 2022, fuelType: FuelType.DIZEL, engineCapacity: 1500, transmission: Transmission.AUTOMATIC, fuelEconomyL100: 5.1 },
  { make: 'Renault', model: 'Zoe', year: 2022, fuelType: FuelType.ELECTRIC, engineCapacity: 0, transmission: Transmission.AUTOMATIC, fuelEconomyL100: 0 },
  { make: 'Renault', model: 'Austral', year: 2023, fuelType: FuelType.HYBRID, engineCapacity: 1300, transmission: Transmission.AUTOMATIC, fuelEconomyL100: 5.0 },

  // ── Opel ─────────────────────────────────────────────────────────────────
  { make: 'Opel', model: 'Astra', year: 2022, fuelType: FuelType.PETROL, engineCapacity: 1200, transmission: Transmission.MANUAL, fuelEconomyL100: 5.6 },
  { make: 'Opel', model: 'Astra', year: 2022, fuelType: FuelType.DIZEL, engineCapacity: 1500, transmission: Transmission.MANUAL, fuelEconomyL100: 4.5 },
  { make: 'Opel', model: 'Astra', year: 2022, fuelType: FuelType.LPG, engineCapacity: 1400, transmission: Transmission.MANUAL, fuelEconomyL100: 9.3 },
  { make: 'Opel', model: 'Corsa', year: 2022, fuelType: FuelType.PETROL, engineCapacity: 1200, transmission: Transmission.MANUAL, fuelEconomyL100: 5.8 },
  { make: 'Opel', model: 'Corsa', year: 2022, fuelType: FuelType.ELECTRIC, engineCapacity: 0, transmission: Transmission.AUTOMATIC, fuelEconomyL100: 0 },
  { make: 'Opel', model: 'Insignia', year: 2022, fuelType: FuelType.PETROL, engineCapacity: 1500, transmission: Transmission.MANUAL, fuelEconomyL100: 6.8 },
  { make: 'Opel', model: 'Insignia', year: 2022, fuelType: FuelType.DIZEL, engineCapacity: 2000, transmission: Transmission.AUTOMATIC, fuelEconomyL100: 5.5 },
  { make: 'Opel', model: 'Mokka', year: 2022, fuelType: FuelType.PETROL, engineCapacity: 1200, transmission: Transmission.AUTOMATIC, fuelEconomyL100: 6.2 },
  { make: 'Opel', model: 'Grandland', year: 2022, fuelType: FuelType.PETROL, engineCapacity: 1200, transmission: Transmission.AUTOMATIC, fuelEconomyL100: 6.0 },
  { make: 'Opel', model: 'Grandland', year: 2022, fuelType: FuelType.HYBRID, engineCapacity: 1600, transmission: Transmission.AUTOMATIC, fuelEconomyL100: 1.8 },

  // ── Citroen ──────────────────────────────────────────────────────────────
  { make: 'Citroen', model: 'C3', year: 2022, fuelType: FuelType.PETROL, engineCapacity: 1200, transmission: Transmission.MANUAL, fuelEconomyL100: 5.7 },
  { make: 'Citroen', model: 'C3', year: 2022, fuelType: FuelType.DIZEL, engineCapacity: 1500, transmission: Transmission.MANUAL, fuelEconomyL100: 4.3 },
  { make: 'Citroen', model: 'C4', year: 2022, fuelType: FuelType.PETROL, engineCapacity: 1200, transmission: Transmission.AUTOMATIC, fuelEconomyL100: 5.9 },
  { make: 'Citroen', model: 'C4', year: 2022, fuelType: FuelType.ELECTRIC, engineCapacity: 0, transmission: Transmission.AUTOMATIC, fuelEconomyL100: 0 },
  { make: 'Citroen', model: 'C-Elysee', year: 2020, fuelType: FuelType.PETROL, engineCapacity: 1600, transmission: Transmission.MANUAL, fuelEconomyL100: 6.9 },
  { make: 'Citroen', model: 'C5 Aircross', year: 2022, fuelType: FuelType.PETROL, engineCapacity: 1200, transmission: Transmission.AUTOMATIC, fuelEconomyL100: 6.5 },
  { make: 'Citroen', model: 'C5 Aircross', year: 2022, fuelType: FuelType.DIZEL, engineCapacity: 1500, transmission: Transmission.AUTOMATIC, fuelEconomyL100: 5.0 },

  // ── Dacia ─────────────────────────────────────────────────────────────────
  { make: 'Dacia', model: 'Duster', year: 2022, fuelType: FuelType.PETROL, engineCapacity: 1000, transmission: Transmission.MANUAL, fuelEconomyL100: 6.6 },
  { make: 'Dacia', model: 'Duster', year: 2022, fuelType: FuelType.DIZEL, engineCapacity: 1500, transmission: Transmission.MANUAL, fuelEconomyL100: 5.2 },
  { make: 'Dacia', model: 'Duster', year: 2022, fuelType: FuelType.LPG, engineCapacity: 1600, transmission: Transmission.MANUAL, fuelEconomyL100: 10.0 },
  { make: 'Dacia', model: 'Logan', year: 2022, fuelType: FuelType.PETROL, engineCapacity: 1000, transmission: Transmission.MANUAL, fuelEconomyL100: 5.8 },
  { make: 'Dacia', model: 'Logan', year: 2022, fuelType: FuelType.LPG, engineCapacity: 1600, transmission: Transmission.MANUAL, fuelEconomyL100: 9.1 },
  { make: 'Dacia', model: 'Sandero', year: 2022, fuelType: FuelType.PETROL, engineCapacity: 1000, transmission: Transmission.MANUAL, fuelEconomyL100: 5.7 },
  { make: 'Dacia', model: 'Sandero Stepway', year: 2022, fuelType: FuelType.PETROL, engineCapacity: 1000, transmission: Transmission.MANUAL, fuelEconomyL100: 6.0 },
  { make: 'Dacia', model: 'Jogger', year: 2023, fuelType: FuelType.PETROL, engineCapacity: 1000, transmission: Transmission.MANUAL, fuelEconomyL100: 6.3 },
  { make: 'Dacia', model: 'Spring', year: 2023, fuelType: FuelType.ELECTRIC, engineCapacity: 0, transmission: Transmission.AUTOMATIC, fuelEconomyL100: 0 },

  // ── Skoda ─────────────────────────────────────────────────────────────────
  { make: 'Skoda', model: 'Octavia', year: 2022, fuelType: FuelType.PETROL, engineCapacity: 1000, transmission: Transmission.MANUAL, fuelEconomyL100: 5.8 },
  { make: 'Skoda', model: 'Octavia', year: 2022, fuelType: FuelType.DIZEL, engineCapacity: 2000, transmission: Transmission.AUTOMATIC, fuelEconomyL100: 4.6 },
  { make: 'Skoda', model: 'Fabia', year: 2022, fuelType: FuelType.PETROL, engineCapacity: 1000, transmission: Transmission.MANUAL, fuelEconomyL100: 5.5 },
  { make: 'Skoda', model: 'Superb', year: 2022, fuelType: FuelType.PETROL, engineCapacity: 1500, transmission: Transmission.AUTOMATIC, fuelEconomyL100: 6.0 },
  { make: 'Skoda', model: 'Karoq', year: 2022, fuelType: FuelType.PETROL, engineCapacity: 1500, transmission: Transmission.AUTOMATIC, fuelEconomyL100: 6.5 },
  { make: 'Skoda', model: 'Kodiaq', year: 2022, fuelType: FuelType.PETROL, engineCapacity: 2000, transmission: Transmission.AUTOMATIC, fuelEconomyL100: 7.0 },

  // ── Seat ─────────────────────────────────────────────────────────────────
  { make: 'Seat', model: 'Ibiza', year: 2022, fuelType: FuelType.PETROL, engineCapacity: 1000, transmission: Transmission.MANUAL, fuelEconomyL100: 5.6 },
  { make: 'Seat', model: 'Leon', year: 2022, fuelType: FuelType.PETROL, engineCapacity: 1000, transmission: Transmission.MANUAL, fuelEconomyL100: 5.8 },
  { make: 'Seat', model: 'Leon', year: 2022, fuelType: FuelType.DIZEL, engineCapacity: 2000, transmission: Transmission.AUTOMATIC, fuelEconomyL100: 4.7 },
  { make: 'Seat', model: 'Arona', year: 2022, fuelType: FuelType.PETROL, engineCapacity: 1000, transmission: Transmission.AUTOMATIC, fuelEconomyL100: 6.1 },
  { make: 'Seat', model: 'Ateca', year: 2022, fuelType: FuelType.PETROL, engineCapacity: 1500, transmission: Transmission.AUTOMATIC, fuelEconomyL100: 6.8 },

  // ── Fiat (Türkiye üretimi) ─────────────────────────────────────────────
  { make: 'Fiat', model: 'Egea', year: 2022, fuelType: FuelType.PETROL, engineCapacity: 1000, transmission: Transmission.MANUAL, fuelEconomyL100: 5.8 },
  { make: 'Fiat', model: 'Egea', year: 2022, fuelType: FuelType.DIZEL, engineCapacity: 1300, transmission: Transmission.MANUAL, fuelEconomyL100: 4.5 },
  { make: 'Fiat', model: 'Egea Cross', year: 2022, fuelType: FuelType.PETROL, engineCapacity: 1000, transmission: Transmission.MANUAL, fuelEconomyL100: 5.9 },
  { make: 'Fiat', model: 'Doblo', year: 2022, fuelType: FuelType.DIZEL, engineCapacity: 1300, transmission: Transmission.MANUAL, fuelEconomyL100: 5.6 },

  // ── Peugeot (modern modeller) ─────────────────────────────────────────
  { make: 'Peugeot', model: '208', year: 2022, fuelType: FuelType.PETROL, engineCapacity: 1200, transmission: Transmission.MANUAL, fuelEconomyL100: 5.7 },
  { make: 'Peugeot', model: '208', year: 2022, fuelType: FuelType.ELECTRIC, engineCapacity: 0, transmission: Transmission.AUTOMATIC, fuelEconomyL100: 0 },
  { make: 'Peugeot', model: '308', year: 2022, fuelType: FuelType.PETROL, engineCapacity: 1200, transmission: Transmission.MANUAL, fuelEconomyL100: 6.0 },
  { make: 'Peugeot', model: '308', year: 2022, fuelType: FuelType.DIZEL, engineCapacity: 1500, transmission: Transmission.AUTOMATIC, fuelEconomyL100: 4.6 },
  { make: 'Peugeot', model: '3008', year: 2022, fuelType: FuelType.HYBRID, engineCapacity: 1600, transmission: Transmission.AUTOMATIC, fuelEconomyL100: 1.8 },
  { make: 'Peugeot', model: '2008', year: 2022, fuelType: FuelType.PETROL, engineCapacity: 1200, transmission: Transmission.AUTOMATIC, fuelEconomyL100: 6.4 },
  { make: 'Peugeot', model: '5008', year: 2022, fuelType: FuelType.PETROL, engineCapacity: 1200, transmission: Transmission.AUTOMATIC, fuelEconomyL100: 6.8 },

  // ── Togg ──────────────────────────────────────────────────────────────────
  { make: 'Togg', model: 'T10X', year: 2023, fuelType: FuelType.ELECTRIC, engineCapacity: 0, transmission: Transmission.AUTOMATIC, fuelEconomyL100: 0 },
  { make: 'Togg', model: 'T10X', year: 2024, fuelType: FuelType.ELECTRIC, engineCapacity: 0, transmission: Transmission.AUTOMATIC, fuelEconomyL100: 0 },
  { make: 'Togg', model: 'T10F', year: 2024, fuelType: FuelType.ELECTRIC, engineCapacity: 0, transmission: Transmission.AUTOMATIC, fuelEconomyL100: 0 },
  { make: 'Togg', model: 'T10S', year: 2025, fuelType: FuelType.ELECTRIC, engineCapacity: 0, transmission: Transmission.AUTOMATIC, fuelEconomyL100: 0 },

  // ── LPG Ekleri (Türkiye'de çok kullanılan mevcut EPA markaları) ─────────
  { make: 'Hyundai', model: 'i20', year: 2022, fuelType: FuelType.LPG, engineCapacity: 1400, transmission: Transmission.MANUAL, fuelEconomyL100: 9.0 },
  { make: 'Hyundai', model: 'i10', year: 2022, fuelType: FuelType.LPG, engineCapacity: 1200, transmission: Transmission.MANUAL, fuelEconomyL100: 8.5 },
  { make: 'Volkswagen', model: 'Passat', year: 2020, fuelType: FuelType.LPG, engineCapacity: 1800, transmission: Transmission.AUTOMATIC, fuelEconomyL100: 10.2 },
  { make: 'Toyota', model: 'Corolla', year: 2022, fuelType: FuelType.LPG, engineCapacity: 1600, transmission: Transmission.AUTOMATIC, fuelEconomyL100: 9.8 },
  { make: 'Ford', model: 'Focus', year: 2020, fuelType: FuelType.LPG, engineCapacity: 1600, transmission: Transmission.MANUAL, fuelEconomyL100: 9.5 },
  { make: 'Ford', model: 'Fiesta', year: 2020, fuelType: FuelType.LPG, engineCapacity: 1400, transmission: Transmission.MANUAL, fuelEconomyL100: 9.0 },
  { make: 'Kia', model: 'Stonic', year: 2022, fuelType: FuelType.LPG, engineCapacity: 1200, transmission: Transmission.MANUAL, fuelEconomyL100: 8.8 },
  { make: 'Kia', model: 'Picanto', year: 2022, fuelType: FuelType.LPG, engineCapacity: 1000, transmission: Transmission.MANUAL, fuelEconomyL100: 8.3 },
];

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const csvPath = process.env.EPA_CSV_PATH || '/tmp/epa_data/vehicles.csv';

  if (!fs.existsSync(csvPath)) {
    console.error(`\n❌ CSV dosyası bulunamadı: ${csvPath}`);
    console.error('Önce şunu çalıştır:');
    console.error('  curl -L -o /tmp/vehicles.csv.zip https://www.fueleconomy.gov/feg/epadata/vehicles.csv.zip');
    console.error('  unzip /tmp/vehicles.csv.zip -d /tmp/epa_data\n');
    process.exit(1);
  }

  console.log('📂 CSV okunuyor...');
  const content = fs.readFileSync(csvPath, 'utf8');
  const lines = content.split('\n').filter((l) => l.trim());
  const header = parseCSVLine(lines[0]);

  const COL = {
    make: header.indexOf('make'),
    model: header.indexOf('model'),
    year: header.indexOf('year'),
    fuelType1: header.indexOf('fuelType1'),
    atvType: header.indexOf('atvType'),
    displ: header.indexOf('displ'),
    trany: header.indexOf('trany'),
    comb08: header.indexOf('comb08'),
  };

  console.log(`📊 Toplam satır: ${lines.length - 1}`);

  // ── 1. EPA verilerini parse et ──────────────────────────────────────────
  type TrimEntry = {
    year: number;
    fuelType: FuelType;
    engineCapacity: number | null;
    transmission: Transmission | null;
    fuelEconomyL100: number | null;
  };
  const makeMap = new Map<string, Map<string, TrimEntry[]>>();

  let skipped = 0;
  for (let i = 1; i < lines.length; i++) {
    const vals = parseCSVLine(lines[i]);
    const make = vals[COL.make];
    const model = vals[COL.model];
    const yearStr = vals[COL.year];

    if (!make || !model || !yearStr) { skipped++; continue; }

    const year = parseInt(yearStr, 10);
    if (isNaN(year) || year < 1990) continue; // 1990 öncesi araçları atla

    const fuelType = mapFuelType(vals[COL.fuelType1] || '', vals[COL.atvType] || '');
    const displLiters = parseFloat(vals[COL.displ]);
    const engineCapacity = !isNaN(displLiters) && displLiters > 0
      ? Math.round(displLiters * 1000)
      : null;
    const transmission = mapTransmission(vals[COL.trany] || '');
    const mpg = parseFloat(vals[COL.comb08]);
    const fuelEconomyL100 = mpgToL100km(!isNaN(mpg) ? mpg : 0);

    if (!makeMap.has(make)) makeMap.set(make, new Map());
    const models = makeMap.get(make)!;
    if (!models.has(model)) models.set(model, []);

    models.get(model)!.push({ year, fuelType, engineCapacity, transmission, fuelEconomyL100 });
  }

  console.log(`✅ Parse tamamlandı. Atlanılan: ${skipped}`);
  console.log(`🏷️  Benzersiz marka: ${makeMap.size}`);
  const totalModels = Array.from(makeMap.values()).reduce((s, m) => s + m.size, 0);
  console.log(`🚗 Benzersiz model: ${totalModels}`);

  // ── 2. Manuel markalar (sadece isim) ────────────────────────────────────
  for (const entry of MANUAL_MAKES) {
    if (!makeMap.has(entry.make)) makeMap.set(entry.make, new Map());
    const models = makeMap.get(entry.make)!;
    for (const modelName of entry.models) {
      if (!models.has(modelName)) models.set(modelName, []);
    }
  }

  // ── 3. Türkiye trim verileri (LPG + Avrupa markaları) ───────────────────
  for (const extra of TURKEY_TRIM_EXTRAS) {
    if (!makeMap.has(extra.make)) makeMap.set(extra.make, new Map());
    const models = makeMap.get(extra.make)!;
    if (!models.has(extra.model)) models.set(extra.model, []);
    models.get(extra.model)!.push({
      year: extra.year,
      fuelType: extra.fuelType,
      engineCapacity: extra.engineCapacity ?? null,
      transmission: extra.transmission ?? null,
      fuelEconomyL100: extra.fuelEconomyL100 ?? null,
    });
  }

  // ── 3. Mevcut veriyi temizle ─────────────────────────────────────────────
  console.log('\n🗑️  Eski araç referans verileri siliniyor...');
  await prisma.vehicleTrim.deleteMany({});
  await prisma.vehicleModel.deleteMany({});
  await prisma.vehicleMake.deleteMany({});
  console.log('✅ Silindi.');

  // ── 4. Veritabanına yükle ────────────────────────────────────────────────
  console.log('\n💾 Veritabanına yükleniyor...');
  let makeCount = 0;
  let modelCount = 0;
  let trimCount = 0;

  for (const [makeName, models] of makeMap) {
    // Marka oluştur
    const dbMake = await prisma.vehicleMake.create({
      data: { name: makeName },
    });
    makeCount++;

    for (const [modelName, trims] of models) {
      // Model oluştur
      const dbModel = await prisma.vehicleModel.create({
        data: { makeId: dbMake.id, name: modelName },
      });
      modelCount++;

      // Trim'leri deduplicate et (aynı year+fuelType+engineCapacity olabilir)
      const seen = new Set<string>();
      const uniqueTrims = trims.filter((t) => {
        const key = `${t.year}-${t.fuelType}-${t.engineCapacity ?? 'null'}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      // Batch insert trims
      if (uniqueTrims.length > 0) {
        await prisma.vehicleTrim.createMany({
          data: uniqueTrims.map((t) => ({
            modelId: dbModel.id,
            year: t.year,
            fuelType: t.fuelType,
            engineCapacity: t.engineCapacity,
            transmission: t.transmission,
            fuelEconomyL100: t.fuelEconomyL100,
          })),
          skipDuplicates: true,
        });
        trimCount += uniqueTrims.length;
      }
    }

    if (makeCount % 10 === 0) {
      process.stdout.write(`  Marka: ${makeCount}/${makeMap.size}, Model: ${modelCount}, Trim: ${trimCount}\r`);
    }
  }

  console.log(`\n\n🎉 Tamamlandı!`);
  console.log(`   Marka:  ${makeCount}`);
  console.log(`   Model:  ${modelCount}`);
  console.log(`   Trim:   ${trimCount}`);
}

main()
  .catch((e) => {
    console.error('❌ Hata:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
