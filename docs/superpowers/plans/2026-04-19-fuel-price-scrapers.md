# Fuel Price Scrapers (Shell + PO) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement working Shell and Petrol Ofisi fuel price fetchers by discovering their hidden XHR API endpoints and implementing them following the existing `BrandPriceFetcher` pattern.

**Architecture:** Two standalone Node.js probe scripts discover the XHR endpoints Shell TR and PO TR call when a province is selected. The findings are then hardcoded into `ShellFetcher` and `PetrolOfisiFetcher`, which extend `BrandPriceFetcher` exactly like `OpetFetcher`. Since both sites may return national (non-per-province) prices, the base class `fetchAll()` default (Istanbul only) is used unless per-province is confirmed.

**Tech Stack:** NestJS, `@nestjs/axios`, `cheerio@1.2`, existing `BrandPriceFetcher` base class, Node.js probe scripts (plain `axios` + `cheerio`).

---

## Files

| Action | Path | Purpose |
|--------|------|---------|
| Create | `apps/api/test-probe-shell.js` | Standalone endpoint discovery for Shell TR |
| Create | `apps/api/test-probe-po.js` | Standalone endpoint discovery for PO TR |
| Modify | `apps/api/src/modules/fuel-ai/brand-fetchers/shell.fetcher.ts` | Implement Shell fetcher |
| Modify | `apps/api/src/modules/fuel-ai/brand-fetchers/po.fetcher.ts` | Implement PO fetcher |

---

## Task 1: Shell Endpoint Discovery Script

**Files:**
- Create: `apps/api/test-probe-shell.js`

- [ ] **Step 1: Write the probe script**

```js
// apps/api/test-probe-shell.js
// Çalıştır: node test-probe-shell.js
const axios = require('axios');
const cheerio = require('cheerio');

const URL = 'https://www.shell.com.tr/suruculer/shell-yakitlari/akaryakit-pompa-satis-fiyatlari.html';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'tr-TR,tr;q=0.9,en;q=0.8',
  'Referer': 'https://www.shell.com.tr/',
};

// Denenecek API endpoint tahminleri
const API_CANDIDATES = [
  'https://www.shell.com.tr/api/fuel-prices',
  'https://www.shell.com.tr/api/prices',
  'https://www.shell.com.tr/api/fuel-prices/list',
  'https://www.shell.com.tr/api/fuelprices',
  'https://www.shell.com.tr/api/fuel-prices?cityId=34',
  'https://www.shell.com.tr/api/fuel-prices?provinceCode=34',
  'https://www.shell.com.tr/api/pump-prices',
  'https://www.shell.com.tr/api/pump-prices?city=34',
];

async function probeHtml() {
  console.log('\n=== HTML Probe ===');
  try {
    const res = await axios.get(URL, { headers: HEADERS, timeout: 15000 });
    const $ = cheerio.load(res.data);

    // Fiyat tablosunu ara
    const tables = $('table');
    console.log(`Tables found: ${tables.length}`);
    tables.each((i, el) => {
      const rows = $(el).find('tr');
      console.log(`  Table ${i}: ${rows.length} rows`);
      rows.slice(0, 3).each((j, row) => {
        console.log(`    Row ${j}: ${$(row).text().replace(/\s+/g, ' ').trim().slice(0, 100)}`);
      });
    });

    // API URL'leri script tag'lerinde ara
    const scripts = $('script:not([src])');
    const apiUrls = [];
    scripts.each((_, el) => {
      const text = $(el).html() || '';
      const matches = text.match(/['"`](\/api\/[^'"`\s]{3,100})['"`]/g) || [];
      apiUrls.push(...matches);
      // fetch( veya axios.get( çağrıları
      const fetchMatches = text.match(/fetch\(['"`](https?:\/\/[^'"`]+)['"`]/g) || [];
      apiUrls.push(...fetchMatches);
    });
    if (apiUrls.length) {
      console.log('\nAPI URL candidates found in scripts:');
      [...new Set(apiUrls)].forEach(u => console.log(' ', u));
    }

    // window.__INITIAL_STATE__ veya benzeri embedded JSON
    const initStateMatch = res.data.match(/window\.__[A-Z_]+\s*=\s*(\{.{0,500})/);
    if (initStateMatch) {
      console.log('\nEmbedded state found:', initStateMatch[1].slice(0, 200));
    }

    // script[src] → harici JS dosyaları
    const externalScripts = [];
    $('script[src]').each((_, el) => {
      const src = $(el).attr('src') || '';
      if (src.includes('price') || src.includes('fuel') || src.includes('api')) {
        externalScripts.push(src);
      }
    });
    if (externalScripts.length) {
      console.log('\nRelevant external scripts:', externalScripts);
    }

    console.log('\nStatus:', res.status);
  } catch (e) {
    console.error('HTML fetch error:', e.message);
  }
}

async function probeApiCandidates() {
  console.log('\n=== API Candidate Probe ===');
  for (const url of API_CANDIDATES) {
    try {
      const res = await axios.get(url, {
        headers: { ...HEADERS, 'Accept': 'application/json', 'Referer': URL },
        timeout: 8000,
        validateStatus: () => true,
      });
      console.log(`${res.status} ${url}`);
      if (res.status === 200) {
        const preview = JSON.stringify(res.data).slice(0, 300);
        console.log('  RESPONSE:', preview);
      }
    } catch (e) {
      console.log(`ERR  ${url} → ${e.message}`);
    }
  }
}

(async () => {
  await probeHtml();
  await probeApiCandidates();
})();
```

- [ ] **Step 2: Run the probe**

```bash
cd apps/api && node test-probe-shell.js
```

- [ ] **Step 3: Note the findings**

Probe çıktısına bak:
- `200` dönen bir API endpoint varsa → URL + JSON yapısını not al
- HTML tablosunda fiyat verisi varsa → hangi satır/sütun yapısı

---

## Task 2: Petrol Ofisi Endpoint Discovery Script

**Files:**
- Create: `apps/api/test-probe-po.js`

- [ ] **Step 1: Write the probe script**

```js
// apps/api/test-probe-po.js
// Çalıştır: node test-probe-po.js
const axios = require('axios');
const cheerio = require('cheerio');

const URL = 'https://www.petrolofisi.com.tr/akaryakit-fiyatlari';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'tr-TR,tr;q=0.9,en;q=0.8',
  'Referer': 'https://www.petrolofisi.com.tr/',
};

const API_CANDIDATES = [
  'https://www.petrolofisi.com.tr/api/fuel-prices',
  'https://www.petrolofisi.com.tr/api/prices',
  'https://www.petrolofisi.com.tr/api/akaryakit-fiyatlari',
  'https://www.petrolofisi.com.tr/api/fuelprices',
  'https://www.petrolofisi.com.tr/api/fuel-prices?cityId=34',
  'https://www.petrolofisi.com.tr/api/fuel-prices?provinceCode=34',
  'https://api.petrolofisi.com.tr/fuel-prices',
  'https://api.petrolofisi.com.tr/prices',
  'https://www.petrolofisi.com.tr/api/prices/list?cityId=34',
  'https://www.petrolofisi.com.tr/api/prices/list?il=34',
];

async function probeHtml() {
  console.log('\n=== HTML Probe ===');
  try {
    const res = await axios.get(URL, { headers: HEADERS, timeout: 15000 });
    const $ = cheerio.load(res.data);

    const tables = $('table');
    console.log(`Tables found: ${tables.length}`);
    tables.each((i, el) => {
      const rows = $(el).find('tr');
      console.log(`  Table ${i}: ${rows.length} rows`);
      rows.slice(0, 5).each((j, row) => {
        console.log(`    Row ${j}: ${$(row).text().replace(/\s+/g, ' ').trim().slice(0, 120)}`);
      });
    });

    // Fiyat içeren div/span'ları ara
    const priceEls = $('[class*="price"], [class*="fiyat"], [id*="price"], [id*="fiyat"]');
    console.log(`\nPrice-related elements: ${priceEls.length}`);
    priceEls.slice(0, 5).each((_, el) => {
      console.log(' ', $(el).attr('class') || $(el).attr('id'), '→', $(el).text().trim().slice(0, 80));
    });

    // Script tag'lerinde API URL ara
    const scripts = $('script:not([src])');
    const apiUrls = [];
    scripts.each((_, el) => {
      const text = $(el).html() || '';
      const matches = text.match(/['"`](\/api\/[^'"`\s]{3,100})['"`]/g) || [];
      apiUrls.push(...matches);
      const fetchMatches = text.match(/fetch\(['"`](https?:\/\/[^'"`]+)['"`]/g) || [];
      apiUrls.push(...fetchMatches);
      // axios/http calls
      const axiosMatches = text.match(/axios\.[a-z]+\(['"`](https?:\/\/[^'"`]+)['"`]/g) || [];
      apiUrls.push(...axiosMatches);
    });
    if (apiUrls.length) {
      console.log('\nAPI URL candidates in scripts:');
      [...new Set(apiUrls)].forEach(u => console.log(' ', u));
    }

    const initStateMatch = res.data.match(/window\.__[A-Z_]+\s*=\s*(\{.{0,1000})/);
    if (initStateMatch) {
      console.log('\nEmbedded state found:', initStateMatch[1].slice(0, 300));
    }

    // next.js veya nuxt __NEXT_DATA__ / __NUXT__
    const nextDataMatch = res.data.match(/<script id="__NEXT_DATA__"[^>]*>(\{.{0,2000})/);
    if (nextDataMatch) {
      console.log('\n__NEXT_DATA__ found:', nextDataMatch[1].slice(0, 500));
    }

    console.log('\nStatus:', res.status, '| Content-Length:', res.data.length);
  } catch (e) {
    console.error('HTML fetch error:', e.message);
  }
}

async function probeApiCandidates() {
  console.log('\n=== API Candidate Probe ===');
  for (const url of API_CANDIDATES) {
    try {
      const res = await axios.get(url, {
        headers: { ...HEADERS, 'Accept': 'application/json', 'Referer': URL },
        timeout: 8000,
        validateStatus: () => true,
      });
      console.log(`${res.status} ${url}`);
      if (res.status === 200) {
        const preview = JSON.stringify(res.data).slice(0, 300);
        console.log('  RESPONSE:', preview);
      }
    } catch (e) {
      console.log(`ERR  ${url} → ${e.message}`);
    }
  }
}

(async () => {
  await probeHtml();
  await probeApiCandidates();
})();
```

- [ ] **Step 2: Run the probe**

```bash
cd apps/api && node test-probe-po.js
```

- [ ] **Step 3: Note the findings**

Aynı şekilde çıktıyı incele.

---

## Task 3: Shell Fetcher Implementation

**Files:**
- Modify: `apps/api/src/modules/fuel-ai/brand-fetchers/shell.fetcher.ts`

> **Not:** Bu task, Task 1'deki probe sonuçlarına göre doldurulur. Aşağıda iki senaryo var:

### Senaryo A: Probe bir JSON API endpoint buldu

- [ ] **Step 1: Implement Shell fetcher with discovered API**

`shell.fetcher.ts` içeriğini aşağıdaki template ile güncelle. `ENDPOINT_URL`, `PROVINCE_PARAM` ve `parsePrices()` kısmını probe çıktısına göre doldur:

```typescript
import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { BrandPriceFetcher, BrandPrices } from './base.fetcher';
import { createLimiter, sleep } from '../../../common/concurrency';
import { ALL_PROVINCE_CODES } from '../../../common/geo/province-lookup';

@Injectable()
export class ShellFetcher extends BrandPriceFetcher {
  readonly brandId = 'shell';
  readonly brandName = 'Shell';

  // TODO: probe çıktısından gelen gerçek endpoint
  private readonly ENDPOINT = 'https://www.shell.com.tr/api/REPLACE_ME';
  private readonly CONCURRENCY = 4;
  private readonly PER_REQ_GAP_MS = 150;

  constructor(http: HttpService) { super(http); }

  async fetch(provinceCode = 34): Promise<BrandPrices | null> {
    try {
      const res = await firstValueFrom(
        this.http.get(this.ENDPOINT, {
          params: { cityId: provinceCode }, // TODO: probe'dan gelen param adını yaz
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; RoadMapBot/1.0)',
            'Referer': 'https://www.shell.com.tr/suruculer/shell-yakitlari/akaryakit-pompa-satis-fiyatlari.html',
          },
          timeout: 10_000,
        }),
      );
      return this.parsePrices(res.data);
    } catch (e: any) {
      this.logger.warn(`Shell fetch failed (provinceCode=${provinceCode}): ${e.message}`);
      return null;
    }
  }

  private parsePrices(data: any): BrandPrices | null {
    // TODO: probe çıktısındaki JSON yapısına göre doldur
    // Örnek: data.prices.petrol, data.benzin, vb.
    const out: BrandPrices = { petrol: null, diesel: null, lpg: null };
    if (!data) return null;

    // Eğer array of products geliyorsa (OPET benzeri):
    const items: any[] = Array.isArray(data) ? data : (data.prices ?? data.products ?? data.items ?? []);
    for (const item of items) {
      const name = String(item.name ?? item.productName ?? item.title ?? '').toLowerCase();
      const price = Number(item.price ?? item.amount ?? item.value ?? 0);
      if (price <= 0) continue;
      if (name.includes('benzin') || name.includes('kurşunsuz') || name.includes('v-power') || name.includes('unleaded')) {
        out.petrol = price;
      } else if (name.includes('motorin') || name.includes('diesel') || name.includes('dizel') || name.includes('fuelsave')) {
        out.diesel = price;
      } else if (name.includes('lpg') || name.includes('otogaz') || name.includes('autogas')) {
        out.lpg = price;
      }
    }

    // Eğer flat object geliyorsa (data.petrolPrice, data.dieselPrice, vb.):
    if (!out.petrol && !out.diesel) {
      out.petrol = Number(data.petrolPrice ?? data.benzin ?? data.unleaded ?? 0) || null;
      out.diesel = Number(data.dieselPrice ?? data.motorin ?? data.diesel ?? 0) || null;
      out.lpg = Number(data.lpgPrice ?? data.lpg ?? data.autogas ?? 0) || null;
    }

    return (out.petrol || out.diesel) ? out : null;
  }

  // Per-province API ise 81 ili çek. Ulusal fiyat ise base class default yeterli.
  // Probe'da farklı iller için aynı fiyat geliyorsa bu override'ı SİL.
  async fetchAll(): Promise<Map<number, BrandPrices> | null> {
    const limit = createLimiter(this.CONCURRENCY);
    const out = new Map<number, BrandPrices>();
    let okCount = 0;

    const tasks = ALL_PROVINCE_CODES.map((code) =>
      limit(async () => {
        await sleep(this.PER_REQ_GAP_MS);
        const res = await this.fetch(code);
        if (res) { out.set(code, res); okCount++; }
      }),
    );
    await Promise.all(tasks);
    this.logger.log(`Shell: ${okCount}/${ALL_PROVINCE_CODES.length} il çekildi.`);
    return okCount > 0 ? out : null;
  }
}
```

### Senaryo B: Probe API bulamadı, HTML tablosu var (Cheerio)

- [ ] **Step 1: Implement Shell fetcher with HTML scraping**

```typescript
import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import * as cheerio from 'cheerio';
import { BrandPriceFetcher, BrandPrices } from './base.fetcher';

@Injectable()
export class ShellFetcher extends BrandPriceFetcher {
  readonly brandId = 'shell';
  readonly brandName = 'Shell';

  private readonly PAGE_URL = 'https://www.shell.com.tr/suruculer/shell-yakitlari/akaryakit-pompa-satis-fiyatlari.html';

  constructor(http: HttpService) { super(http); }

  // Shell ulusal fiyat sunuyorsa province parametresi kullanılmaz.
  async fetch(_provinceCode = 34): Promise<BrandPrices | null> {
    try {
      const res = await firstValueFrom(
        this.http.get(this.PAGE_URL, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; RoadMapBot/1.0)',
            'Accept': 'text/html',
          },
          timeout: 12_000,
        }),
      );
      return this.parseHtml(res.data as string);
    } catch (e: any) {
      this.logger.warn(`Shell HTML fetch failed: ${e.message}`);
      return null;
    }
  }

  private parseHtml(html: string): BrandPrices | null {
    const $ = cheerio.load(html);
    const out: BrandPrices = { petrol: null, diesel: null, lpg: null };

    $('table tr').each((_, row) => {
      const cells = $(row).find('td');
      if (cells.length < 2) return;
      const label = $(cells[0]).text().toLowerCase().trim();
      const raw = $(cells[1]).text().replace(',', '.').replace(/[^\d.]/g, '');
      const price = parseFloat(raw);
      if (!price || price <= 0) return;

      if (label.includes('benzin') || label.includes('kurşunsuz') || label.includes('v-power')) {
        out.petrol = price;
      } else if (label.includes('motorin') || label.includes('diesel') || label.includes('dizel')) {
        out.diesel = price;
      } else if (label.includes('lpg') || label.includes('otogaz')) {
        out.lpg = price;
      }
    });

    return (out.petrol || out.diesel) ? out : null;
  }
}
```

- [ ] **Step 2: Commit whichever scenario was implemented**

```bash
git add apps/api/src/modules/fuel-ai/brand-fetchers/shell.fetcher.ts
git commit -m "feat: implement Shell fuel price fetcher"
```

---

## Task 4: Petrol Ofisi Fetcher Implementation

**Files:**
- Modify: `apps/api/src/modules/fuel-ai/brand-fetchers/po.fetcher.ts`

> **Not:** Task 2'deki probe sonuçlarına göre aynı iki senaryo geçerli. Aşağıda her ikisi var.

### Senaryo A: JSON API endpoint bulundu

- [ ] **Step 1: Implement PO fetcher with discovered API**

```typescript
import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { BrandPriceFetcher, BrandPrices } from './base.fetcher';
import { createLimiter, sleep } from '../../../common/concurrency';
import { ALL_PROVINCE_CODES } from '../../../common/geo/province-lookup';

@Injectable()
export class PetrolOfisiFetcher extends BrandPriceFetcher {
  readonly brandId = 'po';
  readonly brandName = 'Petrol Ofisi';

  // TODO: probe çıktısından gelen gerçek endpoint
  private readonly ENDPOINT = 'https://www.petrolofisi.com.tr/api/REPLACE_ME';
  private readonly CONCURRENCY = 4;
  private readonly PER_REQ_GAP_MS = 150;

  constructor(http: HttpService) { super(http); }

  async fetch(provinceCode = 34): Promise<BrandPrices | null> {
    try {
      const res = await firstValueFrom(
        this.http.get(this.ENDPOINT, {
          params: { cityId: provinceCode }, // TODO: probe'dan gelen param adını yaz
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; RoadMapBot/1.0)',
            'Referer': 'https://www.petrolofisi.com.tr/akaryakit-fiyatlari',
          },
          timeout: 10_000,
        }),
      );
      return this.parsePrices(res.data);
    } catch (e: any) {
      this.logger.warn(`PO fetch failed (provinceCode=${provinceCode}): ${e.message}`);
      return null;
    }
  }

  private parsePrices(data: any): BrandPrices | null {
    const out: BrandPrices = { petrol: null, diesel: null, lpg: null };
    if (!data) return null;

    const items: any[] = Array.isArray(data) ? data : (data.prices ?? data.products ?? data.items ?? data.data ?? []);
    for (const item of items) {
      const name = String(item.name ?? item.productName ?? item.title ?? item.urunAdi ?? '').toLowerCase();
      const price = Number(item.price ?? item.amount ?? item.fiyat ?? item.value ?? 0);
      if (price <= 0) continue;
      if (name.includes('benzin') || name.includes('kurşunsuz')) {
        out.petrol = price;
      } else if (name.includes('motorin') || name.includes('diesel') || name.includes('dizel')) {
        out.diesel = price;
      } else if (name.includes('lpg') || name.includes('otogaz')) {
        out.lpg = price;
      }
    }

    // Flat object fallback
    if (!out.petrol && !out.diesel) {
      out.petrol = Number(data.petrolPrice ?? data.benzin ?? data.benzinFiyati ?? 0) || null;
      out.diesel = Number(data.dieselPrice ?? data.motorin ?? data.motorinFiyati ?? 0) || null;
      out.lpg = Number(data.lpgPrice ?? data.lpg ?? data.lpgFiyati ?? 0) || null;
    }

    return (out.petrol || out.diesel) ? out : null;
  }

  async fetchAll(): Promise<Map<number, BrandPrices> | null> {
    const limit = createLimiter(this.CONCURRENCY);
    const out = new Map<number, BrandPrices>();
    let okCount = 0;

    const tasks = ALL_PROVINCE_CODES.map((code) =>
      limit(async () => {
        await sleep(this.PER_REQ_GAP_MS);
        const res = await this.fetch(code);
        if (res) { out.set(code, res); okCount++; }
      }),
    );
    await Promise.all(tasks);
    this.logger.log(`PO: ${okCount}/${ALL_PROVINCE_CODES.length} il çekildi.`);
    return okCount > 0 ? out : null;
  }
}
```

### Senaryo B: HTML scraping (Cheerio)

- [ ] **Step 1: Implement PO fetcher with HTML scraping**

```typescript
import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import * as cheerio from 'cheerio';
import { BrandPriceFetcher, BrandPrices } from './base.fetcher';

@Injectable()
export class PetrolOfisiFetcher extends BrandPriceFetcher {
  readonly brandId = 'po';
  readonly brandName = 'Petrol Ofisi';

  private readonly PAGE_URL = 'https://www.petrolofisi.com.tr/akaryakit-fiyatlari';

  constructor(http: HttpService) { super(http); }

  async fetch(_provinceCode = 34): Promise<BrandPrices | null> {
    try {
      const res = await firstValueFrom(
        this.http.get(this.PAGE_URL, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; RoadMapBot/1.0)',
            'Accept': 'text/html',
          },
          timeout: 12_000,
        }),
      );
      return this.parseHtml(res.data as string);
    } catch (e: any) {
      this.logger.warn(`PO HTML fetch failed: ${e.message}`);
      return null;
    }
  }

  private parseHtml(html: string): BrandPrices | null {
    const $ = cheerio.load(html);
    const out: BrandPrices = { petrol: null, diesel: null, lpg: null };

    $('table tr').each((_, row) => {
      const cells = $(row).find('td');
      if (cells.length < 2) return;
      const label = $(cells[0]).text().toLowerCase().trim();
      const raw = $(cells[1]).text().replace(',', '.').replace(/[^\d.]/g, '');
      const price = parseFloat(raw);
      if (!price || price <= 0) return;

      if (label.includes('benzin') || label.includes('kurşunsuz')) {
        out.petrol = price;
      } else if (label.includes('motorin') || label.includes('diesel') || label.includes('dizel')) {
        out.diesel = price;
      } else if (label.includes('lpg') || label.includes('otogaz')) {
        out.lpg = price;
      }
    });

    return (out.petrol || out.diesel) ? out : null;
  }
}
```

- [ ] **Step 2: Commit whichever scenario was implemented**

```bash
git add apps/api/src/modules/fuel-ai/brand-fetchers/po.fetcher.ts
git commit -m "feat: implement Petrol Ofisi fuel price fetcher"
```

---

## Task 5: Local Integration Test

- [ ] **Step 1: Start the API locally**

```bash
cd apps/api && npm run start:dev
```

- [ ] **Step 2: Check startup logs for fetch results**

Beklenen log (başarılı):
```
LOG [FuelPriceService] Refreshing fuel prices for 4 brand(s)…
LOG [FuelPriceService] Shell: X il DB'ye yazıldı.
LOG [FuelPriceService] Petrol Ofisi: X il DB'ye yazıldı.
```

Beklenen log (başarısız — parse değişikliği gerekiyor):
```
WARN [FuelPrice:Shell] Shell fetch failed: ...
WARN [FuelPriceService] Shell: fetchAll boş döndü, DB'ye yazma yok.
```

- [ ] **Step 3: Hit the brands endpoint**

```bash
curl "http://localhost:8080/fuel-prices/brands?provinceCode=34" | jq .
```

Beklenen çıktı: `live: true` olan Shell ve PO kayıtları.

- [ ] **Step 4: If scraping/parsing is wrong, update `parsePrices()` or `parseHtml()`**

Probe çıktısını ve curl response'u karşılaştırarak doğru field isimlerini bul ve güncelle.

- [ ] **Step 5: Commit final working state**

```bash
git add apps/api/src/modules/fuel-ai/brand-fetchers/
git commit -m "feat: working Shell and PO fuel price fetchers"
```
