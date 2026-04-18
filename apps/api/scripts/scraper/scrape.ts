/**
 * data/urls.json'u okur, her URL'i paralel fetch eder, parse eder,
 * data/vehicles.jsonl'e satır olarak append eder.
 *
 * Resumable: daha önce yazılmış URL'ler atlanır. Ctrl+C → tekrar çalıştır.
 *
 * Çalıştır: cd apps/api && npx ts-node scripts/scraper/scrape.ts
 */
import axios, { AxiosError } from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { parseVehiclePage, ScrapedVehicle } from './parse';

/** Mini concurrency limiter — p-limit bağımlılığı yerine. */
function createLimiter(maxConcurrent: number) {
  let active = 0;
  const queue: Array<() => void> = [];
  const next = () => {
    if (active >= maxConcurrent || queue.length === 0) return;
    active++;
    const run = queue.shift()!;
    run();
  };
  return function limit<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const run = () => {
        fn()
          .then((v) => { resolve(v); active--; next(); })
          .catch((e) => { reject(e); active--; next(); });
      };
      queue.push(run);
      next();
    });
  };
}

const DATA_DIR = path.join(__dirname, 'data');
const URLS_PATH = path.join(DATA_DIR, 'urls.json');
const OUT_PATH = path.join(DATA_DIR, 'vehicles.jsonl');
const ERR_PATH = path.join(DATA_DIR, 'errors.jsonl');

const CONCURRENCY = 6;
const PER_REQ_DELAY_MS = 400;
const MAX_RETRIES = 2;
const UA = 'roadmap-scraper/1.0 (+dev)';

const http = axios.create({
  timeout: 20_000,
  headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml' },
  maxRedirects: 3,
  validateStatus: (s) => s < 500, // 4xx'i error'a düşür, 5xx retry
});

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchWithRetry(url: string): Promise<string> {
  let attempt = 0;
  let lastErr: any;
  while (attempt <= MAX_RETRIES) {
    try {
      const res = await http.get<string>(url, { responseType: 'text' });
      if (res.status >= 200 && res.status < 300 && typeof res.data === 'string' && res.data.length > 1000) {
        return res.data;
      }
      throw new Error(`HTTP ${res.status} or empty body (${res.data?.length ?? 0} bytes)`);
    } catch (e: any) {
      lastErr = e;
      attempt++;
      if (attempt > MAX_RETRIES) break;
      const backoff = 500 * Math.pow(2, attempt);
      await sleep(backoff);
    }
  }
  throw lastErr;
}

function loadDoneSet(): Set<string> {
  if (!fs.existsSync(OUT_PATH)) return new Set();
  const done = new Set<string>();
  const raw = fs.readFileSync(OUT_PATH, 'utf8');
  for (const line of raw.split('\n')) {
    if (!line.trim()) continue;
    try {
      const rec = JSON.parse(line);
      if (rec.url) done.add(rec.url);
    } catch {
      // ignore malformed
    }
  }
  return done;
}

async function main() {
  if (!fs.existsSync(URLS_PATH)) {
    console.error(`urls.json yok. Önce: npx ts-node scripts/scraper/fetch-urls.ts`);
    process.exit(1);
  }
  const urlFile = JSON.parse(fs.readFileSync(URLS_PATH, 'utf8')) as { urls: string[] };
  const total = urlFile.urls.length;
  const done = loadDoneSet();
  const todo = urlFile.urls.filter((u) => !done.has(u));
  console.log(`Toplam: ${total} | tamamlanan: ${done.size} | kalan: ${todo.length}`);

  if (todo.length === 0) {
    console.log('Hepsi tamam. vehicles.jsonl hazır.');
    return;
  }

  const outStream = fs.createWriteStream(OUT_PATH, { flags: 'a' });
  const errStream = fs.createWriteStream(ERR_PATH, { flags: 'a' });

  const limit = createLimiter(CONCURRENCY);
  let ok = 0, fail = 0, skipNoData = 0;
  const t0 = Date.now();

  const tasks = todo.map((url, idx) =>
    limit(async () => {
      // Per-request politelik: concurrency içindeki her istek arası kısa bekleme
      await sleep(PER_REQ_DELAY_MS);
      try {
        const html = await fetchWithRetry(url);
        const parsed: ScrapedVehicle | null = parseVehiclePage(url, html);
        if (!parsed) {
          skipNoData++;
          errStream.write(JSON.stringify({ url, reason: 'no_spec_table', at: new Date().toISOString() }) + '\n');
          return;
        }
        outStream.write(JSON.stringify(parsed) + '\n');
        ok++;
      } catch (e: any) {
        fail++;
        const msg = e instanceof AxiosError ? `${e.code ?? ''} ${e.message}` : e?.message || String(e);
        errStream.write(JSON.stringify({ url, reason: 'fetch_error', error: msg, at: new Date().toISOString() }) + '\n');
      }

      if ((ok + fail + skipNoData) % 50 === 0) {
        const elapsed = (Date.now() - t0) / 1000;
        const rate = (ok + fail + skipNoData) / elapsed;
        const remaining = todo.length - (ok + fail + skipNoData);
        const eta = remaining / (rate || 1);
        console.log(
          `[${ok + fail + skipNoData}/${todo.length}] ok=${ok} fail=${fail} empty=${skipNoData} | ${rate.toFixed(1)} req/s | ETA ${(eta / 60).toFixed(1)} dk`,
        );
      }
    }),
  );

  await Promise.all(tasks);
  outStream.end();
  errStream.end();

  const elapsed = (Date.now() - t0) / 1000;
  console.log(
    `\n✅ Bitti. ok=${ok} fail=${fail} empty=${skipNoData} | ${elapsed.toFixed(1)} sn | output: ${OUT_PATH}`,
  );
}

main().catch((e) => {
  console.error('scrape hata:', e);
  process.exit(1);
});
