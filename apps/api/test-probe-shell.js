// apps/api/test-probe-shell.js
const axios = require('axios');
const cheerio = require('cheerio');

const URL = 'https://www.shell.com.tr/suruculer/shell-yakitlari/akaryakit-pompa-satis-fiyatlari.html';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'tr-TR,tr;q=0.9,en;q=0.8',
  'Referer': 'https://www.shell.com.tr/',
};

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

    const tables = $('table');
    console.log(`Tables found: ${tables.length}`);
    tables.each((i, el) => {
      const rows = $(el).find('tr');
      console.log(`  Table ${i}: ${rows.length} rows`);
      rows.slice(0, 3).each((j, row) => {
        console.log(`    Row ${j}: ${$(row).text().replace(/\s+/g, ' ').trim().slice(0, 100)}`);
      });
    });

    const scripts = $('script:not([src])');
    const apiUrls = [];
    scripts.each((_, el) => {
      const text = $(el).html() || '';
      const matches = text.match(/['"`](\/api\/[^'"`\s]{3,100})['"`]/g) || [];
      apiUrls.push(...matches);
      const fetchMatches = text.match(/fetch\(['"`](https?:\/\/[^'"`]+)['"`]/g) || [];
      apiUrls.push(...fetchMatches);
    });
    if (apiUrls.length) {
      console.log('\nAPI URL candidates found in scripts:');
      [...new Set(apiUrls)].forEach(u => console.log(' ', u));
    }

    const initStateMatch = res.data.match(/window\.__[A-Z_]+\s*=\s*(\{.{0,500})/);
    if (initStateMatch) {
      console.log('\nEmbedded state found:', initStateMatch[1].slice(0, 200));
    }

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

    // Also print ALL script src tags for manual inspection
    console.log('\nAll script[src] tags:');
    $('script[src]').each((_, el) => {
      console.log(' ', $(el).attr('src'));
    });

    // Print first 2000 chars of HTML for manual inspection
    console.log('\nHTML preview (first 2000 chars):');
    console.log(res.data.slice(0, 2000));

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
