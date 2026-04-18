/**
 * data/vehicles.jsonl'i okur, Prisma'ya seed eder.
 *
 * Hiyerarşi:
 *   makeName → VehicleMake (unique: name)
 *   modelName → VehicleModel (unique: makeId+name)
 *   (year, fuelType, engineCapacityCc) → VehicleTrim (unique: modelId+year+fuelType+engineCapacity)
 *
 * Duplicate trim (aynı motor, farklı paket) → son kayıt kazanır + warn log.
 * Eksik fuelType veya engineCapacity → satır atlanır (trim unique'i ihlal olurdu).
 *
 * Çalıştır:
 *   # Lokal
 *   cd apps/api && npx ts-node scripts/scraper/seed-from-jsonl.ts
 *   # Prod
 *   DATABASE_URL="postgresql://..." npx ts-node scripts/scraper/seed-from-jsonl.ts
 */
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import * as bcrypt from 'bcryptjs';
import { ScrapedVehicle } from './parse';

const prisma = new PrismaClient();
const JSONL_PATH = path.join(__dirname, 'data', 'vehicles.jsonl');

type Stats = {
  read: number;
  skippedMissingField: number;
  duplicateTrim: number;
  makes: number;
  models: number;
  trims: number;
  errors: number;
};

function readJsonl(p: string): ScrapedVehicle[] {
  if (!fs.existsSync(p)) {
    throw new Error(`vehicles.jsonl yok: ${p}. Önce scrape.ts çalıştır.`);
  }
  const raw = fs.readFileSync(p, 'utf8');
  const out: ScrapedVehicle[] = [];
  for (const line of raw.split('\n')) {
    if (!line.trim()) continue;
    try {
      out.push(JSON.parse(line));
    } catch {
      // ignore malformed
    }
  }
  return out;
}

async function seedAdmin() {
  const hashed = await bcrypt.hash('Test1234', 10);
  await prisma.user.upsert({
    where: { email: 'admin@roadmap.com' },
    update: {},
    create: { email: 'admin@roadmap.com', name: 'Admin', password: hashed },
  });
  console.log('✓ Admin user ready');
}

async function main() {
  console.log('📥 vehicles.jsonl okunuyor...');
  const records = readJsonl(JSONL_PATH);
  console.log(`  ${records.length} kayıt okundu.\n`);

  await seedAdmin();

  // Make cache: name → id
  const makeCache = new Map<string, string>();
  // Model cache: `${makeId}::${name}` → modelId
  const modelCache = new Map<string, string>();
  // Seen trim keys for duplicate detection: `${modelId}|${year}|${variantSlug}`
  const seenTrim = new Set<string>();

  const stats: Stats = {
    read: records.length,
    skippedMissingField: 0,
    duplicateTrim: 0,
    makes: 0,
    models: 0,
    trims: 0,
    errors: 0,
  };

  for (let i = 0; i < records.length; i++) {
    const r = records[i];

    // Zorunlu alanlar: makeName, modelName, year, fuelType, engineCapacityCc
    if (!r.makeName || !r.modelName || !r.year || !r.fuelType) {
      stats.skippedMissingField++;
      continue;
    }
    // Elektrikli araçlarda cc=0 olabilir, bunu kabul ediyoruz; ama null olmamalı
    const cc = r.engineCapacityCc ?? (r.fuelType === 'ELECTRIC' ? 0 : null);
    if (cc == null) {
      stats.skippedMissingField++;
      continue;
    }

    try {
      // Make
      let makeId = makeCache.get(r.makeName);
      if (!makeId) {
        const make = await prisma.vehicleMake.upsert({
          where: { name: r.makeName },
          update: {},
          create: { name: r.makeName },
        });
        makeId = make.id;
        makeCache.set(r.makeName, makeId);
        stats.makes++;
      }

      // Model
      const modelKey = `${makeId}::${r.modelName}`;
      let modelId = modelCache.get(modelKey);
      if (!modelId) {
        const model = await prisma.vehicleModel.upsert({
          where: { makeId_name: { makeId, name: r.modelName } },
          update: {},
          create: { makeId, name: r.modelName },
        });
        modelId = model.id;
        modelCache.set(modelKey, modelId);
        stats.models++;
      }

      // Trim — unique: (modelId, year, variantSlug)
      const trimKey = `${modelId}|${r.year}|${r.variantSlug}`;
      if (seenTrim.has(trimKey)) {
        stats.duplicateTrim++;
        if (stats.duplicateTrim <= 5) {
          console.warn(`  ⚠ duplicate slug: ${r.makeName} ${r.modelName} ${r.year} ${r.variantSlug}`);
        } else if (stats.duplicateTrim === 6) {
          console.warn('  ⚠ daha fazla duplicate slug var, log kısaltıldı...');
        }
      }
      seenTrim.add(trimKey);

      await prisma.vehicleTrim.upsert({
        where: {
          modelId_year_variantSlug: {
            modelId,
            year: r.year,
            variantSlug: r.variantSlug,
          },
        },
        update: {
          fuelType: r.fuelType as any,
          engineCapacity: cc,
          transmission: r.transmission as any,
          fuelEconomyL100: r.fuelEconomyL100,
          enginePowerHp: r.enginePowerHp,
          torqueNm: r.torqueNm,
          tankCapacityL: r.tankCapacityL,
          weightKg: r.weightKg,
          variantName: r.variantName,
        },
        create: {
          modelId,
          year: r.year,
          variantSlug: r.variantSlug,
          fuelType: r.fuelType as any,
          engineCapacity: cc,
          transmission: r.transmission as any,
          fuelEconomyL100: r.fuelEconomyL100,
          enginePowerHp: r.enginePowerHp,
          torqueNm: r.torqueNm,
          tankCapacityL: r.tankCapacityL,
          weightKg: r.weightKg,
          variantName: r.variantName,
        },
      });
      stats.trims++;

      if ((i + 1) % 200 === 0) {
        console.log(`  [${i + 1}/${records.length}] makes=${stats.makes} models=${stats.models} trims=${stats.trims}`);
      }
    } catch (e: any) {
      stats.errors++;
      if (stats.errors <= 5) {
        console.error(`  ✗ ${r.url}: ${e.message}`);
      }
    }
  }

  console.log('\n📊 Özet:');
  console.log(`  Okunan:       ${stats.read}`);
  console.log(`  Skip (eksik): ${stats.skippedMissingField}`);
  console.log(`  Duplicate:    ${stats.duplicateTrim} (son kayıt kazandı)`);
  console.log(`  Yeni make:    ${stats.makes}`);
  console.log(`  Yeni model:   ${stats.models}`);
  console.log(`  Upsert trim:  ${stats.trims}`);
  console.log(`  Hata:         ${stats.errors}`);
  console.log('\n✅ Seed tamam.');
}

main()
  .catch((e) => {
    console.error('seed hata:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
