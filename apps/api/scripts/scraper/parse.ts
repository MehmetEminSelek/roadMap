/**
 * HTML → Vehicle record parse fonksiyonları.
 * Tek tek alanlar opsiyonel — eksik olursa null döner, sayfayı bozmaz.
 *
 * Site yapısı (teyit edilmiş):
 *   <table class="teknik-ozellikler">
 *     <tr><td class="ozellik">Motor Hacmi</td><td class="veri">999 cc</td></tr>
 *     ...
 *   </table>
 */
import * as cheerio from 'cheerio';

export type ScrapedVehicle = {
  url: string;
  make: string;         // slug (dacia)
  makeName: string;     // görünen ad (breadcrumb'dan — yoksa slug title-case)
  model: string;        // slug (sandero)
  modelName: string;    // görünen ad
  year: number;
  variantSlug: string;  // 1-0-essential
  variantName: string | null;  // "1.0 Essential"

  fuelType: 'PETROL' | 'DIZEL' | 'HYBRID' | 'ELECTRIC' | 'LPG' | null;
  engineCapacityCc: number | null;
  enginePowerHp: number | null;
  torqueNm: number | null;
  transmission: 'MANUAL' | 'AUTOMATIC' | 'CVT' | 'SEMI_AUTOMATIC' | null;
  fuelEconomyL100: number | null;
  tankCapacityL: number | null;
  weightKg: number | null;

  // ham rapor — parse edilemeyen alan olursa debug için
  rawSpecs: Record<string, string>;
};

// ============================================================================
// URL → make/model/year/variant parse
// ============================================================================

export function parseUrlParts(url: string): {
  make: string; model: string; year: number; variantSlug: string;
} | null {
  try {
    const u = new URL(url);
    const segs = u.pathname.split('/').filter(Boolean);
    if (segs.length !== 4) return null;
    const [make, model, yearStr, variantSlug] = segs;
    const year = parseInt(yearStr, 10);
    if (!Number.isInteger(year) || year < 1990 || year > 2100) return null;
    return { make, model, year, variantSlug };
  } catch {
    return null;
  }
}

// ============================================================================
// Value normalizers — hepsi null-safe
// ============================================================================

/** "999 cc" → 999; "~ 5.1 lt" → 5.1; "1.134 Kg" → 1134 */
function toNumber(raw: string | undefined | null): number | null {
  if (!raw) return null;
  // Türkçe ondalık ayraç virgül ama site "5.1" nokta kullanıyor. Yine de her ikisini handle et.
  const cleaned = raw.replace(/[~\s]/g, '').replace(/[^\d.,]/g, '');
  if (!cleaned) return null;
  // "1.134" sayfa kullanımına göre bin ayracı olabilir; ama veriler küçük olduğunda ondalık. Heuristic:
  // virgül varsa ondalık virgül, nokta bin ayracı ("1.134,5"). Değilse noktayı aynen ondalık gör.
  let normalized: string;
  if (cleaned.includes(',')) {
    normalized = cleaned.replace(/\./g, '').replace(',', '.');
  } else {
    // "1.134" → 1134 mü yoksa 1.134 mü? Sağındaki hane sayısı 3 ve sol tek rakam değilse bin ayracı olasılığı yüksek.
    const m = cleaned.match(/^(\d+)\.(\d{3})$/);
    normalized = m ? `${m[1]}${m[2]}` : cleaned;
  }
  const n = parseFloat(normalized);
  return Number.isFinite(n) ? n : null;
}

function toInt(raw: string | undefined | null): number | null {
  const n = toNumber(raw);
  return n == null ? null : Math.round(n);
}

function normalizeFuelType(raw: string | undefined | null): ScrapedVehicle['fuelType'] {
  if (!raw) return null;
  const s = raw.toLocaleLowerCase('tr');
  // Sadece elektrik
  if (s.includes('elektrik') && !s.includes('/')) return 'ELECTRIC';
  // LPG
  if (s.includes('lpg')) return 'LPG';
  // Plug-in hybrid & full hybrid → HYBRID (fuel cost hesabı hibrit formülü)
  if (s.includes('phev') || s.includes('plug')) return 'HYBRID';
  if ((s.includes('hibrit') || s.includes('hybrid') || (s.includes('hev') && !s.includes('mhev'))) && !s.match(/benzin|dizel/)) return 'HYBRID';
  // Mild hybrid (MHEV) → ana yakıt tipiyle saklanır (benzin/dizel hakim)
  if (s.includes('dizel') || s.includes('diesel')) return 'DIZEL';
  if (s.includes('benzin') || s.includes('petrol') || s.includes('gasoline')) return 'PETROL';
  // "Hibrit" tek başına geldiyse
  if (s.includes('hibrit') || s.includes('hybrid')) return 'HYBRID';
  if (s.includes('elektrik')) return 'ELECTRIC';
  return null;
}

function normalizeTransmission(raw: string | undefined | null): ScrapedVehicle['transmission'] {
  if (!raw) return null;
  const s = raw.toLocaleLowerCase('tr');
  if (s.includes('cvt')) return 'CVT';
  if (s.includes('yarı') || s.includes('yari') || s.includes('semi') || s.includes('dsg') || s.includes('dct')) return 'SEMI_AUTOMATIC';
  if (s.includes('otomatik') || s.includes('automatic')) return 'AUTOMATIC';
  if (s.includes('manuel') || s.includes('manual')) return 'MANUAL';
  return null;
}

// ============================================================================
// Ana parser
// ============================================================================

export function parseVehiclePage(url: string, html: string): ScrapedVehicle | null {
  const urlParts = parseUrlParts(url);
  if (!urlParts) return null;

  const $ = cheerio.load(html);
  const table = $('table.teknik-ozellikler');
  if (table.length === 0) return null;

  const raw: Record<string, string> = {};
  table.find('tr').each((_, tr) => {
    const label = $(tr).find('td.ozellik').first().text().trim();
    const value = $(tr).find('td.veri').first().text().trim();
    if (label) raw[label] = value;
  });

  // Breadcrumb'dan görünen ad (slug yerine)
  let makeName = urlParts.make;
  let modelName = urlParts.model;
  try {
    // JSON-LD BreadcrumbList
    $('script[type="application/ld+json"]').each((_, el) => {
      const json = JSON.parse($(el).contents().text());
      const list = Array.isArray(json) ? json.find((x: any) => x['@type'] === 'BreadcrumbList') : (json['@type'] === 'BreadcrumbList' ? json : null);
      if (list?.itemListElement) {
        for (const it of list.itemListElement) {
          if (it.position === 2 && it.name) makeName = it.name;
          if (it.position === 3 && it.name) modelName = it.name;
        }
      }
    });
  } catch {
    // ignore
  }

  return {
    url,
    make: urlParts.make,
    makeName,
    model: urlParts.model,
    modelName,
    year: urlParts.year,
    variantSlug: urlParts.variantSlug,
    variantName: raw['Versiyon Adı'] || null,
    fuelType: normalizeFuelType(raw['Enerji Türü'] || raw['Yakıt Tipi']),
    engineCapacityCc: toInt(raw['Silindir Hacmi'] || raw['Motor Hacmi']),
    enginePowerHp: toInt(raw['Sistem Gücü'] || raw['Motor Gücü']),
    torqueNm: toInt(raw['Sistem Torku'] || raw['Tork']),
    transmission: normalizeTransmission(raw['Vites Tipi'] || raw['Şanzıman']),
    fuelEconomyL100: toNumber(raw['Ortalama Tüketim']),
    tankCapacityL: toInt(raw['Yakıt Deposu']),
    weightKg: toInt(raw['Boş Ağırlık'] || raw['Ağırlık']),
    rawSpecs: raw,
  };
}
