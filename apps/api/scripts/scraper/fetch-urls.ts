/**
 * Sitemap'ten /marka/model/yıl/versiyon URL'lerini toplar, 2020+ filtreler,
 * data/urls.json'a yazar.
 *
 * Çalıştır: cd apps/api && npx ts-node scripts/scraper/fetch-urls.ts
 */
import axios from 'axios';
import { XMLParser } from 'fast-xml-parser';
import * as fs from 'fs';
import * as path from 'path';

const INDEX_URL = 'https://www.arabalar.com.tr/sitemap_index.xml';
const MIN_YEAR = 2020;
const UA = 'roadmap-scraper/1.0 (+dev)';
const DATA_DIR = path.join(__dirname, 'data');

type SitemapEntry = { loc: string; lastmod?: string };

const http = axios.create({
  timeout: 20_000,
  headers: { 'User-Agent': UA, Accept: 'application/xml,text/xml,*/*' },
});

const parser = new XMLParser({ ignoreAttributes: true });

async function fetchXml(url: string): Promise<any> {
  const { data } = await http.get<string>(url, { responseType: 'text' });
  return parser.parse(data);
}

function extractLocs(xml: any, rootKey: 'sitemapindex' | 'urlset'): SitemapEntry[] {
  const root = xml?.[rootKey];
  if (!root) return [];
  const items = rootKey === 'sitemapindex' ? root.sitemap : root.url;
  if (!items) return [];
  const arr = Array.isArray(items) ? items : [items];
  return arr
    .map((it: any) => ({ loc: it?.loc, lastmod: it?.lastmod }))
    .filter((e: SitemapEntry) => typeof e.loc === 'string' && e.loc.length > 0);
}

/**
 * Path yapısı: /marka/model/yıl/versiyon
 * 4 segment, 3. segment 4 haneli yıl, 1. ve 2. segment marka/model slug.
 * Yıl filtresi min MIN_YEAR.
 */
function isVersionUrl(u: string): { ok: boolean; year?: number } {
  try {
    const url = new URL(u);
    if (url.hostname !== 'www.arabalar.com.tr') return { ok: false };
    const segs = url.pathname.split('/').filter(Boolean);
    if (segs.length !== 4) return { ok: false };
    const [, , yearStr] = segs;
    if (!/^\d{4}$/.test(yearStr)) return { ok: false };
    const year = parseInt(yearStr, 10);
    if (year < MIN_YEAR || year > new Date().getFullYear() + 1) return { ok: false };
    return { ok: true, year };
  } catch {
    return { ok: false };
  }
}

async function main() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  console.log(`Sitemap index çekiliyor: ${INDEX_URL}`);
  const indexXml = await fetchXml(INDEX_URL);
  const sitemaps = extractLocs(indexXml, 'sitemapindex');
  const targetSitemaps = sitemaps
    .map((s) => s.loc)
    .filter((u) => /yeni-araba-sitemap\d+\.xml$/.test(u));
  console.log(`${targetSitemaps.length} araç sitemap'ı bulundu.`);

  const allUrls = new Set<string>();
  let skipped = 0;

  for (let i = 0; i < targetSitemaps.length; i++) {
    const sm = targetSitemaps[i];
    try {
      const xml = await fetchXml(sm);
      const urls = extractLocs(xml, 'urlset');
      let addedHere = 0;
      for (const u of urls) {
        const check = isVersionUrl(u.loc);
        if (!check.ok) {
          skipped++;
          continue;
        }
        if (!allUrls.has(u.loc)) {
          allUrls.add(u.loc);
          addedHere++;
        }
      }
      console.log(`  [${i + 1}/${targetSitemaps.length}] ${path.basename(sm)}: +${addedHere} (total: ${allUrls.size})`);
    } catch (e: any) {
      console.warn(`  ! ${sm} okunamadı: ${e.message}`);
    }
  }

  const sorted = [...allUrls].sort();
  const outPath = path.join(DATA_DIR, 'urls.json');
  fs.writeFileSync(outPath, JSON.stringify({ count: sorted.length, generatedAt: new Date().toISOString(), minYear: MIN_YEAR, urls: sorted }, null, 2));
  console.log(`\n✅ ${sorted.length} URL yazıldı: ${outPath}  (skipped: ${skipped})`);
}

main().catch((e) => {
  console.error('fetch-urls hata:', e);
  process.exit(1);
});
