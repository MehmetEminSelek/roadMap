/**
 * Full grid extraction using click-based interaction (reliably worked in earlier test).
 */
const { chromium } = require('playwright-core');

async function main() {
  const browser = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--no-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.goto('https://www.turkiyeshell.com/pompatest/', {
      waitUntil: 'networkidle',
      timeout: 30_000,
    });
    await page.waitForTimeout(2500);

    // Open dropdown
    console.log('Opening province dropdown...');
    await page.click('#cb_all_cb_province_B-1');
    await page.waitForTimeout(1000);

    // Click Istanbul via mouse events
    console.log('Clicking Istanbul...');
    await page.evaluate(() => {
      const lbTable = document.querySelector('#cb_all_cb_province_DDD_L_LBT');
      const rows = Array.from(lbTable.querySelectorAll('tr'));
      const istanbul = rows.find((r) => (r.textContent || '').trim().toUpperCase() === 'ISTANBUL');
      if (!istanbul) throw new Error('Istanbul row not found');
      const rect = istanbul.getBoundingClientRect();
      const opts = { bubbles: true, cancelable: true, view: window, clientX: rect.left + 5, clientY: rect.top + 5 };
      istanbul.dispatchEvent(new MouseEvent('mouseover', opts));
      istanbul.dispatchEvent(new MouseEvent('mousedown', opts));
      istanbul.dispatchEvent(new MouseEvent('mouseup', opts));
      istanbul.dispatchEvent(new MouseEvent('click', opts));
    });
    await page.waitForTimeout(5000);

    const grid = await page.evaluate(() => {
      const g = document.querySelector('#cb_all_grdPrices');
      if (!g) return { error: 'no grid' };
      const headerCells = g.querySelectorAll('.dxgvHeader');
      const headers = Array.from(headerCells).map((h) => (h.textContent || '').trim());
      const dataRows = g.querySelectorAll('tr.dxgvDataRow, tr[id*="DXDataRow"]');
      const rows = Array.from(dataRows).map((tr) =>
        Array.from(tr.querySelectorAll('td')).map((td) => (td.textContent || '').trim())
      );
      return { headers, rowCount: rows.length, rowSample: rows.slice(0, 8), lastRows: rows.slice(-3) };
    });

    console.log('=== GRID AFTER ISTANBUL SELECTION ===');
    console.log('Headers:', grid.headers);
    console.log('Row count:', grid.rowCount);
    console.log('First 8 rows:');
    grid.rowSample.forEach((r, i) => console.log('  [' + i + ']', JSON.stringify(r)));

    // Check counties
    const counties = await page.evaluate(() => {
      const lb = window.cb_all_cb_county_DDD_L;
      const count = lb?.GetItemCount?.() || 0;
      return count;
    });
    console.log('\nCounty count:', counties);

    // Now try ANKARA for comparison
    console.log('\n=== SWITCHING TO ANKARA ===');
    await page.click('#cb_all_cb_province_B-1');
    await page.waitForTimeout(1000);
    await page.evaluate(() => {
      const lbTable = document.querySelector('#cb_all_cb_province_DDD_L_LBT');
      const rows = Array.from(lbTable.querySelectorAll('tr'));
      const ankara = rows.find((r) => (r.textContent || '').trim().toUpperCase() === 'ANKARA');
      const rect = ankara.getBoundingClientRect();
      const opts = { bubbles: true, cancelable: true, view: window, clientX: rect.left + 5, clientY: rect.top + 5 };
      ankara.dispatchEvent(new MouseEvent('mouseover', opts));
      ankara.dispatchEvent(new MouseEvent('mousedown', opts));
      ankara.dispatchEvent(new MouseEvent('mouseup', opts));
      ankara.dispatchEvent(new MouseEvent('click', opts));
    });
    await page.waitForTimeout(5000);
    const ankGrid = await page.evaluate(() => {
      const g = document.querySelector('#cb_all_grdPrices');
      const dataRows = g.querySelectorAll('tr.dxgvDataRow, tr[id*="DXDataRow"]');
      const rows = Array.from(dataRows).map((tr) =>
        Array.from(tr.querySelectorAll('td')).map((td) => (td.textContent || '').trim())
      );
      return { count: rows.length, first: rows.slice(0, 5) };
    });
    console.log('Ankara row count:', ankGrid.count);
    ankGrid.first.forEach((r, i) => console.log('  [' + i + ']', JSON.stringify(r)));
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error('FAIL:', e.message);
  process.exit(1);
});
