// apps/api/test-probe-po.js
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

    const priceEls = $('[class*="price"], [class*="fiyat"], [id*="price"], [id*="fiyat"]');
    console.log(`\nPrice-related elements: ${priceEls.length}`);
    priceEls.slice(0, 5).each((_, el) => {
      console.log(' ', $(el).attr('class') || $(el).attr('id'), '→', $(el).text().trim().slice(0, 80));
    });

    const scripts = $('script:not([src])');
    const apiUrls = [];
    scripts.each((_, el) => {
      const text = $(el).html() || '';
      const matches = text.match(/['"`](\/api\/[^'"`\s]{3,100})['"`]/g) || [];
      apiUrls.push(...matches);
      const fetchMatches = text.match(/fetch\(['"`](https?:\/\/[^'"`]+)['"`]/g) || [];
      apiUrls.push(...fetchMatches);
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

    const nextDataMatch = res.data.match(/<script id="__NEXT_DATA__"[^>]*>(\{.{0,2000})/);
    if (nextDataMatch) {
      console.log('\n__NEXT_DATA__ found:', nextDataMatch[1].slice(0, 800));
    }

    // Print ALL script tags (inline content preview)
    console.log('\nAll inline script previews:');
    scripts.each((i, el) => {
      const text = ($(el).html() || '').trim().slice(0, 200);
      if (text.length > 10) console.log(`  Script ${i}: ${text}`);
    });

    // All script src
    console.log('\nAll script[src]:');
    $('script[src]').each((_, el) => console.log(' ', $(el).attr('src')));

    // HTML preview
    console.log('\nHTML preview (first 3000 chars):');
    console.log(res.data.slice(0, 3000));

    console.log('\nStatus:', res.status, '| Length:', res.data.length);
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
        const preview = JSON.stringify(res.data).slice(0, 500);
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
