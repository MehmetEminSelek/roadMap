# arabalar.com.tr Scraper

Türkiye pazarı araç verisi (marka/model/yıl/versiyon + teknik özellikler) toplayan, sonra Prisma'ya seed eden helper.

## Pipeline

1. **`fetch-urls.ts`** — `sitemap_index.xml`'i çeker, tüm `yeni-araba-sitemap*.xml` dosyalarından `/marka/model/yıl/versiyon` URL'lerini çıkarır, 2020+ filtreler, `data/urls.json`'a yazar.
2. **`scrape.ts`** — `urls.json`'u okur, her URL'i paralel (concurrency=6, delay=400ms) fetch eder, `cheerio` ile tech spec'i parse eder, `data/vehicles.jsonl`'e satır satır append eder. Resumable — zaten yazılmış URL'leri atlar.
3. **`seed-from-jsonl.ts`** — `vehicles.jsonl`'i okur, Prisma'da `VehicleMake` → `VehicleModel` → `VehicleTrim` hiyerarşisine upsert eder. Aynı `(model, year, fuel, cc)` düşen paketlerde son kayıt kazanır, warn log'lar.

## Çalıştırma

```bash
cd apps/api

# 1) URL'leri topla (~30 sn, ~42 sitemap)
npm run scraper:urls

# 2) Detay scraping (binlerce sayfa, saatlerce sürebilir, Ctrl+C sonra kaldığı yerden devam)
npm run scraper:scrape

# 3) DB'ye seed (lokal)
npm run scraper:seed

# 3b) Prod'a seed
DATABASE_URL="postgresql://..." npm run scraper:seed
```

## Çıktı dosyaları

- `data/urls.json` — filtrelenmiş URL listesi (~2020+)
- `data/vehicles.jsonl` — her satır bir araç paketi. Ham scrap verisi. Git'e commit edilmez.
- `data/errors.jsonl` — 4xx/5xx veya parse hatası düşen URL'ler. Manuel inceleme için.

## Saygılı crawling

- Concurrency=6, per-request delay=400ms → ~15 req/s tavan
- `User-Agent: roadmap-scraper (+mailto:dev@example)` — bloklama durumunda değişsin
- Retry: exponential 2 kere, sonra `errors.jsonl`'e yaz
