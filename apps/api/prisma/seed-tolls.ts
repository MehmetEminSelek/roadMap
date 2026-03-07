import { PrismaClient, VehicleType } from '@prisma/client';

const prisma = new PrismaClient();

// ======================================================
// Türkiye Otoyol & Köprü Gişe Ücretleri
// Kaynak: KGM Resmi PDF'leri — 01.01.2026 Tarifeleri
// https://www.kgm.gov.tr/Sayfalar/KGM/SiteTr/Otoyollar/UcretlerYeni.aspx
// ======================================================
// Sınıflar:
//   1. Sınıf = Otomobil (CAR)
//   2. Sınıf = Minibüs/Van (VAN)
//   3. Sınıf = Otobüs (BUS)
//   4. Sınıf = Kamyon (TRUCK)
//   6. Sınıf = Motosiklet (MOTORCYCLE)

interface TollStationData {
    name: string;
    location: string;
    highway: string;
    lat: number;
    lng: number;
    rates: { vehicleType: VehicleType; amount: number }[];
}

const tollStations: TollStationData[] = [
    // ==========================================
    // KÖPRÜLER (Bridge Tolls)
    // ==========================================
    {
        name: '15 Temmuz Şehitler Köprüsü',
        location: 'İstanbul Boğaziçi',
        highway: 'Köprü',
        lat: 41.0451,
        lng: 29.0344,
        rates: [
            { vehicleType: 'CAR', amount: 59 },
            { vehicleType: 'MOTORCYCLE', amount: 25 },
            { vehicleType: 'VAN', amount: 75 },
            { vehicleType: 'BUS', amount: 168 },
            { vehicleType: 'TRUCK', amount: 333 },
        ],
    },
    {
        name: 'Fatih Sultan Mehmet Köprüsü',
        location: 'İstanbul Boğaziçi',
        highway: 'Köprü',
        lat: 41.0893,
        lng: 29.0638,
        rates: [
            { vehicleType: 'CAR', amount: 59 },
            { vehicleType: 'MOTORCYCLE', amount: 25 },
            { vehicleType: 'VAN', amount: 75 },
            { vehicleType: 'BUS', amount: 168 },
            { vehicleType: 'TRUCK', amount: 333 },
        ],
    },
    {
        name: 'Yavuz Sultan Selim Köprüsü',
        location: 'İstanbul 3. Köprü',
        highway: 'Köprü',
        lat: 41.2080,
        lng: 29.1172,
        rates: [
            { vehicleType: 'CAR', amount: 95 },
            { vehicleType: 'MOTORCYCLE', amount: 65 },
            { vehicleType: 'VAN', amount: 125 },
            { vehicleType: 'BUS', amount: 235 },
            { vehicleType: 'TRUCK', amount: 595 },
        ],
    },
    {
        name: 'Osmangazi Köprüsü',
        location: 'Kocaeli-Bursa İzmit Körfezi',
        highway: 'Köprü',
        lat: 40.7169,
        lng: 29.5094,
        rates: [
            { vehicleType: 'CAR', amount: 995 },
            { vehicleType: 'MOTORCYCLE', amount: 695 },
            { vehicleType: 'VAN', amount: 1590 },
            { vehicleType: 'BUS', amount: 1890 },
            { vehicleType: 'TRUCK', amount: 2505 },
        ],
    },
    {
        name: '1915 Çanakkale Köprüsü',
        location: 'Çanakkale Lapseki-Gelibolu',
        highway: 'Köprü',
        lat: 40.3372,
        lng: 26.6650,
        rates: [
            { vehicleType: 'CAR', amount: 995 },
            { vehicleType: 'MOTORCYCLE', amount: 250 },
            { vehicleType: 'VAN', amount: 1245 },
            { vehicleType: 'BUS', amount: 2240 },
            { vehicleType: 'TRUCK', amount: 2490 },
        ],
    },

    // ==========================================
    // ANADOLU OTOYOLU (O-4) — Çamlıca → Akıncı (İstanbul-Ankara)
    // KGM 2026: Tam rota 1.Sınıf = 338₺
    // Gişeler arası kümülatif ücretler
    // ==========================================
    {
        name: 'Samandıra Gişeleri',
        location: 'İstanbul Samandıra',
        highway: 'Anadolu Otoyolu (O-4)',
        lat: 40.9650,
        lng: 29.2180,
        rates: [
            { vehicleType: 'CAR', amount: 40 },
            { vehicleType: 'MOTORCYCLE', amount: 16 },
            { vehicleType: 'VAN', amount: 48 },
            { vehicleType: 'BUS', amount: 57 },
            { vehicleType: 'TRUCK', amount: 75 },
        ],
    },
    {
        name: 'Kurtköy Gişeleri',
        location: 'İstanbul Kurtköy',
        highway: 'Anadolu Otoyolu (O-4)',
        lat: 40.9103,
        lng: 29.3070,
        rates: [
            { vehicleType: 'CAR', amount: 49 },
            { vehicleType: 'MOTORCYCLE', amount: 20 },
            { vehicleType: 'VAN', amount: 59 },
            { vehicleType: 'BUS', amount: 70 },
            { vehicleType: 'TRUCK', amount: 93 },
        ],
    },
    {
        name: 'Gebze Gişeleri (O-4)',
        location: 'Kocaeli Gebze',
        highway: 'Anadolu Otoyolu (O-4)',
        lat: 40.7986,
        lng: 29.4311,
        rates: [
            { vehicleType: 'CAR', amount: 49 },
            { vehicleType: 'MOTORCYCLE', amount: 20 },
            { vehicleType: 'VAN', amount: 59 },
            { vehicleType: 'BUS', amount: 70 },
            { vehicleType: 'TRUCK', amount: 93 },
        ],
    },
    {
        name: 'Diliskelesi Gişeleri',
        location: 'Kocaeli Diliskelesi',
        highway: 'Anadolu Otoyolu (O-4)',
        lat: 40.7635,
        lng: 29.5350,
        rates: [
            { vehicleType: 'CAR', amount: 56 },
            { vehicleType: 'MOTORCYCLE', amount: 23 },
            { vehicleType: 'VAN', amount: 67 },
            { vehicleType: 'BUS', amount: 80 },
            { vehicleType: 'TRUCK', amount: 106 },
        ],
    },
    {
        name: 'Körfez Gişeleri (O-4)',
        location: 'Kocaeli Körfez',
        highway: 'Anadolu Otoyolu (O-4)',
        lat: 40.7365,
        lng: 29.7426,
        rates: [
            { vehicleType: 'CAR', amount: 71 },
            { vehicleType: 'MOTORCYCLE', amount: 29 },
            { vehicleType: 'VAN', amount: 85 },
            { vehicleType: 'BUS', amount: 101 },
            { vehicleType: 'TRUCK', amount: 134 },
        ],
    },
    {
        name: 'Doğu İzmit Gişeleri',
        location: 'Kocaeli İzmit',
        highway: 'Anadolu Otoyolu (O-4)',
        lat: 40.7660,
        lng: 29.9540,
        rates: [
            { vehicleType: 'CAR', amount: 82 },
            { vehicleType: 'MOTORCYCLE', amount: 33 },
            { vehicleType: 'VAN', amount: 98 },
            { vehicleType: 'BUS', amount: 117 },
            { vehicleType: 'TRUCK', amount: 155 },
        ],
    },
    {
        name: 'Sapanca Gişeleri',
        location: 'Sakarya Sapanca',
        highway: 'Anadolu Otoyolu (O-4)',
        lat: 40.6919,
        lng: 30.2729,
        rates: [
            { vehicleType: 'CAR', amount: 102 },
            { vehicleType: 'MOTORCYCLE', amount: 41 },
            { vehicleType: 'VAN', amount: 122 },
            { vehicleType: 'BUS', amount: 146 },
            { vehicleType: 'TRUCK', amount: 193 },
        ],
    },
    {
        name: 'Adapazarı Gişeleri',
        location: 'Sakarya Adapazarı',
        highway: 'Anadolu Otoyolu (O-4)',
        lat: 40.6768,
        lng: 30.4028,
        rates: [
            { vehicleType: 'CAR', amount: 115 },
            { vehicleType: 'MOTORCYCLE', amount: 46 },
            { vehicleType: 'VAN', amount: 138 },
            { vehicleType: 'BUS', amount: 164 },
            { vehicleType: 'TRUCK', amount: 218 },
        ],
    },
    {
        name: 'Akyazı Gişeleri (O-4)',
        location: 'Sakarya Akyazı',
        highway: 'Anadolu Otoyolu (O-4)',
        lat: 40.6875,
        lng: 30.6206,
        rates: [
            { vehicleType: 'CAR', amount: 136 },
            { vehicleType: 'MOTORCYCLE', amount: 55 },
            { vehicleType: 'VAN', amount: 163 },
            { vehicleType: 'BUS', amount: 195 },
            { vehicleType: 'TRUCK', amount: 258 },
        ],
    },
    {
        name: 'Hendek Gişeleri',
        location: 'Sakarya Hendek',
        highway: 'Anadolu Otoyolu (O-4)',
        lat: 40.7925,
        lng: 30.7500,
        rates: [
            { vehicleType: 'CAR', amount: 158 },
            { vehicleType: 'MOTORCYCLE', amount: 64 },
            { vehicleType: 'VAN', amount: 190 },
            { vehicleType: 'BUS', amount: 226 },
            { vehicleType: 'TRUCK', amount: 300 },
        ],
    },
    {
        name: 'Düzce (Gölyaka) Gişeleri',
        location: 'Düzce Gölyaka',
        highway: 'Anadolu Otoyolu (O-4)',
        lat: 40.7890,
        lng: 31.0310,
        rates: [
            { vehicleType: 'CAR', amount: 222 },
            { vehicleType: 'MOTORCYCLE', amount: 89 },
            { vehicleType: 'VAN', amount: 264 },
            { vehicleType: 'BUS', amount: 315 },
            { vehicleType: 'TRUCK', amount: 417 },
        ],
    },
    {
        name: 'Kaynaşlı Gişeleri',
        location: 'Düzce Kaynaşlı',
        highway: 'Anadolu Otoyolu (O-4)',
        lat: 40.7700,
        lng: 31.3200,
        rates: [
            { vehicleType: 'CAR', amount: 233 },
            { vehicleType: 'MOTORCYCLE', amount: 94 },
            { vehicleType: 'VAN', amount: 278 },
            { vehicleType: 'BUS', amount: 332 },
            { vehicleType: 'TRUCK', amount: 440 },
        ],
    },
    {
        name: 'Bolu Batı Gişeleri',
        location: 'Bolu',
        highway: 'Anadolu Otoyolu (O-4)',
        lat: 40.7310,
        lng: 31.5841,
        rates: [
            { vehicleType: 'CAR', amount: 289 },
            { vehicleType: 'MOTORCYCLE', amount: 116 },
            { vehicleType: 'VAN', amount: 340 },
            { vehicleType: 'BUS', amount: 406 },
            { vehicleType: 'TRUCK', amount: 538 },
        ],
    },
    {
        name: 'Gerede Gişeleri',
        location: 'Bolu Gerede',
        highway: 'Anadolu Otoyolu (O-4)',
        lat: 40.7990,
        lng: 32.2010,
        rates: [
            { vehicleType: 'CAR', amount: 338 },
            { vehicleType: 'MOTORCYCLE', amount: 136 },
            { vehicleType: 'VAN', amount: 390 },
            { vehicleType: 'BUS', amount: 522 },
            { vehicleType: 'TRUCK', amount: 675 },
        ],
    },
    {
        name: 'Akıncı Gişeleri (Ankara)',
        location: 'Ankara',
        highway: 'Anadolu Otoyolu (O-4)',
        lat: 39.9826,
        lng: 32.7370,
        rates: [
            { vehicleType: 'CAR', amount: 338 },
            { vehicleType: 'MOTORCYCLE', amount: 136 },
            { vehicleType: 'VAN', amount: 390 },
            { vehicleType: 'BUS', amount: 522 },
            { vehicleType: 'TRUCK', amount: 675 },
        ],
    },

    // ==========================================
    // AVRUPA OTOYOLU (O-3) — Mahmutbey → Edirne
    // KGM 2026: Tam rota 1.Sınıf = 378₺
    // ==========================================
    {
        name: 'Mahmutbey Gişeleri',
        location: 'İstanbul Mahmutbey',
        highway: 'Avrupa Otoyolu (O-3)',
        lat: 41.0647,
        lng: 28.8008,
        rates: [
            { vehicleType: 'CAR', amount: 93 },
            { vehicleType: 'MOTORCYCLE', amount: 37 },
            { vehicleType: 'VAN', amount: 110 },
            { vehicleType: 'BUS', amount: 134 },
            { vehicleType: 'TRUCK', amount: 193 },
        ],
    },
    {
        name: 'Edirne Gişeleri',
        location: 'Edirne',
        highway: 'Avrupa Otoyolu (O-3)',
        lat: 41.6725,
        lng: 26.5557,
        rates: [
            { vehicleType: 'CAR', amount: 378 },
            { vehicleType: 'MOTORCYCLE', amount: 153 },
            { vehicleType: 'VAN', amount: 440 },
            { vehicleType: 'BUS', amount: 535 },
            { vehicleType: 'TRUCK', amount: 705 },
        ],
    },
];

async function main() {
    console.log('🚧 Mevcut gişe verileri temizleniyor...');
    await prisma.tollRate.deleteMany();
    await prisma.tollStation.deleteMany();

    console.log(`🏗️  ${tollStations.length} gişe istasyonu oluşturuluyor (KGM 2026 tarifeleri)...`);

    let stationCount = 0;
    let rateCount = 0;

    for (const station of tollStations) {
        const created = await prisma.tollStation.create({
            data: {
                name: station.name,
                location: station.location,
                lat: station.lat,
                lng: station.lng,
                isActive: true,
                tolls: {
                    create: station.rates.map((rate) => ({
                        vehicleType: rate.vehicleType,
                        amount: rate.amount,
                        isActive: true,
                    })),
                },
            },
            include: { tolls: true },
        });

        stationCount++;
        rateCount += created.tolls.length;
        console.log(`  ✅ ${created.name} — ${station.highway} (${created.tolls.length} tarife)`);
    }

    console.log('');
    console.log(`🎉 Tamamlandı! (KGM 01.01.2026 Tarifeleri)`);
    console.log(`   📍 ${stationCount} gişe istasyonu`);
    console.log(`   💰 ${rateCount} tarife kaydı`);
    console.log('');
    console.log('Köprüler:');
    console.log('  • 15 Temmuz Şehitler Köprüsü: 59₺');
    console.log('  • Fatih Sultan Mehmet Köprüsü: 59₺');
    console.log('  • Yavuz Sultan Selim Köprüsü: 95₺');
    console.log('  • Osmangazi Köprüsü: 995₺');
    console.log('  • 1915 Çanakkale Köprüsü: 995₺');
    console.log('Otoyollar:');
    console.log('  • Anadolu Otoyolu (O-4): Çamlıca→Akıncı = 338₺');
    console.log('  • Avrupa Otoyolu (O-3): Mahmutbey→Edirne = 378₺');
}

main()
    .catch((e) => {
        console.error('Hata:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
