import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import type { Browser, Page } from 'playwright-core';
import { BrandPriceFetcher, BrandPrices } from './base.fetcher';
import { sleep } from '../../../common/concurrency';

/**
 * Shell Türkiye — Playwright headless scraper.
 *
 * Arka plan:
 *   - https://www.turkiyeshell.com/pompatest/ ASP.NET WebForms + DevExpress
 *     ASPxClientGridView kullanıyor. Fiyat tablosu ancak il dropdown seçildikten
 *     sonra (server callback) dolduruluyor; düz HTTP (axios) ile imkansız.
 *   - Playwright ile sayfa açılıyor, 81 il sırayla seçiliyor, grid'den fiyatlar
 *     okunuyor.
 *
 * Grid kolonları:
 *   0. İl/İlçe       — ilk satır il aggregate (LPG dolu, diğerleri "-")
 *   1. K.Benzin 95   → petrol
 *   2. Motorin       → diesel
 *   3. GazYağı
 *   4. Kalyak
 *   5. Yüksek Kükürtlü Fuel Oil
 *   6. Fuel Oil
 *   7. Otogaz        → lpg (yalnızca il aggregate satırında)
 *
 * İlçelerde petrol/diesel var ama LPG yok; il aggregate satırında LPG var ama
 * petrol/diesel yok → ilçeleri ortala, LPG için aggregate satırı kullan.
 *
 * Listbox value formatı: zero-padded plaka kodu ("001"=Adana, "034"=İstanbul).
 *
 * Süre: 81 il × ~2.5s = ~3-4 dk. 6 saatlik refresh döngüsünde kabul edilebilir.
 * Memory: Chromium runtime ~200MB; browser her fetchAll sonrası kapatılır.
 *
 * Chromium executable path: Dockerfile'da `apk add chromium` ile gelen
 * `/usr/bin/chromium-browser`. Local dev için CHROMIUM_PATH env.
 */
@Injectable()
export class ShellFetcher extends BrandPriceFetcher {
  readonly brandId = 'shell';
  readonly brandName = 'Shell';

  private readonly PAGE_URL = 'https://www.turkiyeshell.com/pompatest/';
  private readonly GRID_TIMEOUT_MS = 15_000;
  private readonly PAGE_LOAD_TIMEOUT_MS = 30_000;

  constructor(http: HttpService) {
    super(http);
  }

  private resolveExecutablePath(): string {
    if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
    if (process.platform === 'darwin') {
      return '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
    }
    return '/usr/bin/chromium-browser';
  }

  async fetch(provinceCode = 34): Promise<BrandPrices | null> {
    const all = await this.fetchAll();
    return all?.get(provinceCode) ?? null;
  }

  async fetchAll(): Promise<Map<number, BrandPrices> | null> {
    const { chromium } = await import('playwright-core');
    let browser: Browser | null = null;
    const out = new Map<number, BrandPrices>();

    try {
      browser = await chromium.launch({
        executablePath: this.resolveExecutablePath(),
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
      });
      const page = await browser.newPage();

      this.logger.log('Shell sayfası açılıyor…');
      await page.goto(this.PAGE_URL, {
        waitUntil: 'networkidle',
        timeout: this.PAGE_LOAD_TIMEOUT_MS,
      });
      // DevExpress init için biraz bekle
      await sleep(2500);

      // 81 il listesini al (value="034" gibi zero-padded plaka kodu)
      const provinces = await page.evaluate(() => {
        const lb = (window as any).cb_all_cb_province_DDD_L;
        if (!lb || typeof lb.GetItemCount !== 'function') return [];
        const count = lb.GetItemCount();
        const items: Array<{ value: string; text: string }> = [];
        for (let i = 0; i < count; i++) {
          const it = lb.GetItem(i);
          if (it) items.push({ value: String(it.value), text: String(it.text) });
        }
        return items;
      });

      if (provinces.length === 0) {
        this.logger.warn('Shell: il listesi okunamadı (DevExpress listbox yüklenmedi).');
        return null;
      }
      this.logger.log(`Shell: ${provinces.length} il dropdown'dan okundu.`);

      // Her ili sırayla işle
      let okCount = 0;
      for (const p of provinces) {
        const plateCode = parseInt(p.value, 10);
        if (!Number.isFinite(plateCode) || plateCode < 1 || plateCode > 81) continue;

        try {
          await this.selectProvince(page, p.text);
          const prices = await this.readGrid(page, p.text);
          if (prices && (prices.petrol != null || prices.diesel != null || prices.lpg != null)) {
            out.set(plateCode, prices);
            okCount++;
          }
        } catch (e: any) {
          this.logger.warn(`Shell ${p.text} (${plateCode}) çekilemedi: ${e.message}`);
        }
      }

      this.logger.log(`Shell: ${okCount}/${provinces.length} il için fiyat çekildi.`);
      return okCount > 0 ? out : null;
    } catch (e: any) {
      this.logger.error(`Shell Playwright hata: ${e.message}`);
      return null;
    } finally {
      if (browser) await browser.close().catch(() => {});
    }
  }

  /**
   * Dropdown'u aç, il satırına mouse event dispatch et. DevExpress'in
   * callback'ini bu yolla tetikliyoruz (programatik SetSelectedIndex tutarsız
   * çalıştı — gerçek click event güvenilir).
   */
  private async selectProvince(page: Page, provinceText: string): Promise<void> {
    await page.click('#cb_all_cb_province_B-1');
    await sleep(500);

    await page.evaluate((text: string) => {
      const lbTable = document.querySelector('#cb_all_cb_province_DDD_L_LBT');
      if (!lbTable) throw new Error('listbox not found');
      const rows = Array.from(lbTable.querySelectorAll('tr'));
      const target = rows.find(
        (r) => (r.textContent || '').trim().toUpperCase() === text.toUpperCase(),
      );
      if (!target) throw new Error(`row '${text}' not found`);
      const rect = target.getBoundingClientRect();
      const opts = {
        bubbles: true,
        cancelable: true,
        view: window,
        clientX: rect.left + 5,
        clientY: rect.top + 5,
      };
      target.dispatchEvent(new MouseEvent('mouseover', opts));
      target.dispatchEvent(new MouseEvent('mousedown', opts));
      target.dispatchEvent(new MouseEvent('mouseup', opts));
      target.dispatchEvent(new MouseEvent('click', opts));
    }, provinceText);

    // Grid'in *bu il için* yeniden render olmasını bekle — ilk data row'un
    // ilk hücresi seçilen il adıyla eşleşmeli. Sadece "dataRowCount>0" yeterli
    // değil: ardışık seçimlerde eski data hala görünüyor ve stale okuyoruz.
    await page.waitForFunction(
      (expected: string) => {
        const grid = document.querySelector('#cb_all_grdPrices');
        if (!grid) return false;
        const firstRow = grid.querySelector('tr.dxgvDataRow, tr[id*="DXDataRow"]');
        if (!firstRow) return false;
        const firstCell = firstRow.querySelector('td');
        if (!firstCell) return false;
        return (firstCell.textContent || '').trim().toUpperCase() === expected.toUpperCase();
      },
      provinceText,
      { timeout: this.GRID_TIMEOUT_MS },
    );
  }

  /**
   * Grid'deki satırları parse et. İlçeleri petrol/diesel için ortala,
   * aggregate (ilk) satırdan LPG'yi al. `expectedProvince` verilirse ilk satırın
   * il ile eşleştiğini doğrular (stale data koruması).
   */
  private async readGrid(page: Page, expectedProvince?: string): Promise<BrandPrices | null> {
    const rows = await page.evaluate(() => {
      const grid = document.querySelector('#cb_all_grdPrices');
      if (!grid) return [] as string[][];
      const dataRows = grid.querySelectorAll('tr.dxgvDataRow, tr[id*="DXDataRow"]');
      return Array.from(dataRows).map((tr) =>
        Array.from(tr.querySelectorAll('td')).map((td) => (td.textContent || '').trim()),
      );
    });

    if (!Array.isArray(rows) || rows.length === 0) return null;

    const aggregate: string[] = rows[0];
    if (
      expectedProvince &&
      aggregate[0]?.toUpperCase() !== expectedProvince.toUpperCase()
    ) {
      this.logger.warn(
        `Shell: stale grid, beklenen '${expectedProvince}' ama '${aggregate[0]}' okundu; atlanıyor.`,
      );
      return null;
    }
    const counties: string[][] = rows.slice(1).filter((r) => r.length >= 8);

    const lpg = this.parsePrice(aggregate[7]);

    const petrolVals = counties
      .map((r) => this.parsePrice(r[1]))
      .filter((n): n is number => n != null);
    const dieselVals = counties
      .map((r) => this.parsePrice(r[2]))
      .filter((n): n is number => n != null);

    const avg = (vals: number[]) =>
      vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;

    return {
      petrol: avg(petrolVals),
      diesel: avg(dieselVals),
      lpg,
    };
  }

  /**
   * "62,76" → 62.76. "-" veya boş → null.
   */
  private parsePrice(raw: string | undefined): number | null {
    if (!raw) return null;
    const cleaned = raw.replace(',', '.').trim();
    if (cleaned === '-' || cleaned === '') return null;
    const n = parseFloat(cleaned);
    return Number.isFinite(n) && n > 0 ? n : null;
  }
}
