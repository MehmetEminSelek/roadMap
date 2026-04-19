/**
 * Basit promise-tabanlı concurrency limiter.
 * `createLimiter(6)` → aynı anda en fazla 6 promise çalışır, fazlası kuyruğa alınır.
 * Hem `scripts/scraper/scrape.ts` hem brand fetcher'lar kullanır.
 */
export function createLimiter(maxConcurrent: number) {
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

export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
