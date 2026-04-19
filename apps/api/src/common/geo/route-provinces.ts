/**
 * Polyline → geçilen illerin (plaka kodu bazlı) sıralı listesi.
 *
 * Kullanım:
 *   const provinces = extractProvincesFromPolyline(encodedPolyline);
 *   // [{ provinceCode: 34, entryKm: 0, exitKm: 48 }, { provinceCode: 41, ... }, ...]
 *
 * Performans: GeoJSON ilk kullanımda yüklenir (~240KB parse, ~80ms).
 * Noktaları her il için bbox ön-filtre ile test eder; büyük rotalarda bile
 * ms mertebesinde sonuç.
 */
import * as fs from 'fs';
import * as path from 'path';
import { decodePolyline, haversineMeters, LatLng } from './polyline-decode';
import { pointInGeoJSONGeometry } from './point-in-polygon';

interface ProvinceFeature {
  code: number;
  name: string;
  geometry: { type: string; coordinates: any };
  bbox: [number, number, number, number]; // [minLng, minLat, maxLng, maxLat]
}

// GeoJSON'daki `properties.name` → resmi plaka kodu eşleme.
// GeoJSON "Afyon" → 03 Afyonkarahisar; başka eşitsizlik yok.
const NAME_TO_CODE: Record<string, number> = {
  'Adana': 1, 'Adıyaman': 2, 'Afyon': 3, 'Afyonkarahisar': 3,
  'Ağrı': 4, 'Amasya': 5, 'Ankara': 6, 'Antalya': 7, 'Artvin': 8,
  'Aydın': 9, 'Balıkesir': 10, 'Bilecik': 11, 'Bingöl': 12, 'Bitlis': 13,
  'Bolu': 14, 'Burdur': 15, 'Bursa': 16, 'Çanakkale': 17, 'Çankırı': 18,
  'Çorum': 19, 'Denizli': 20, 'Diyarbakır': 21, 'Edirne': 22, 'Elazığ': 23,
  'Erzincan': 24, 'Erzurum': 25, 'Eskişehir': 26, 'Gaziantep': 27,
  'Giresun': 28, 'Gümüşhane': 29, 'Hakkari': 30, 'Hatay': 31, 'Isparta': 32,
  'Mersin': 33, 'İstanbul': 34, 'İzmir': 35, 'Kars': 36, 'Kastamonu': 37,
  'Kayseri': 38, 'Kırklareli': 39, 'Kırşehir': 40, 'Kocaeli': 41, 'Konya': 42,
  'Kütahya': 43, 'Malatya': 44, 'Manisa': 45, 'Kahramanmaraş': 46,
  'Mardin': 47, 'Muğla': 48, 'Muş': 49, 'Nevşehir': 50, 'Niğde': 51,
  'Ordu': 52, 'Rize': 53, 'Sakarya': 54, 'Samsun': 55, 'Siirt': 56,
  'Sinop': 57, 'Sivas': 58, 'Tekirdağ': 59, 'Tokat': 60, 'Trabzon': 61,
  'Tunceli': 62, 'Şanlıurfa': 63, 'Uşak': 64, 'Van': 65, 'Yozgat': 66,
  'Zonguldak': 67, 'Aksaray': 68, 'Bayburt': 69, 'Karaman': 70,
  'Kırıkkale': 71, 'Batman': 72, 'Şırnak': 73, 'Bartın': 74, 'Ardahan': 75,
  'Iğdır': 76, 'Yalova': 77, 'Karabük': 78, 'Kilis': 79, 'Osmaniye': 80,
  'Düzce': 81,
};

let _features: ProvinceFeature[] | null = null;

function loadFeatures(): ProvinceFeature[] {
  if (_features) return _features;
  const p = path.join(__dirname, 'turkey-provinces.geojson');
  const raw = JSON.parse(fs.readFileSync(p, 'utf8'));
  const feats: ProvinceFeature[] = [];
  for (const f of raw.features || []) {
    const name = f.properties?.name;
    const code = NAME_TO_CODE[name];
    if (!code || !f.geometry) continue;
    feats.push({ code, name, geometry: f.geometry, bbox: computeBbox(f.geometry) });
  }
  _features = feats;
  return feats;
}

function computeBbox(geometry: { type: string; coordinates: any }): [number, number, number, number] {
  let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
  const visit = (coords: any) => {
    if (typeof coords[0] === 'number') {
      const [lng, lat] = coords;
      if (lng < minLng) minLng = lng;
      if (lat < minLat) minLat = lat;
      if (lng > maxLng) maxLng = lng;
      if (lat > maxLat) maxLat = lat;
    } else for (const c of coords) visit(c);
  };
  visit(geometry.coordinates);
  return [minLng, minLat, maxLng, maxLat];
}

/** Nokta hangi il içinde? Hiçbirinde değilse null. */
export function pointToProvince(pt: LatLng): number | null {
  const feats = loadFeatures();
  for (const f of feats) {
    const [minLng, minLat, maxLng, maxLat] = f.bbox;
    if (pt.lng < minLng || pt.lng > maxLng || pt.lat < minLat || pt.lat > maxLat) continue;
    if (pointInGeoJSONGeometry(pt, f.geometry)) return f.code;
  }
  return null;
}

export interface ProvinceSegment {
  provinceCode: number;
  entryKm: number;
  exitKm: number;
}

/**
 * Encoded polyline → geçilen illerin sıralı listesi.
 *
 * @param encodedPolyline Google Directions "overview_polyline.points"
 * @param sampleIntervalMeters Her N metrede bir nokta örneklenir (default 2km).
 *                             Küçük değer daha hassas ama yavaş.
 */
export function extractProvincesFromPolyline(
  encodedPolyline: string,
  sampleIntervalMeters = 2_000,
): ProvinceSegment[] {
  return extractProvincesFromCoords(decodePolyline(encodedPolyline), sampleIntervalMeters);
}

/**
 * Zaten decode edilmiş koordinat listesinden il segmentlerini çıkar.
 * RoutesService'deki `decodeStepsToCoords()` sonucunu re-encode etmeden kullanır.
 */
export function extractProvincesFromCoords(
  coords: LatLng[],
  sampleIntervalMeters = 2_000,
): ProvinceSegment[] {
  if (coords.length < 2) return [];

  // Kümülatif mesafe + her sampleInterval'da bir provinceCode
  const segments: ProvinceSegment[] = [];
  let cumMeters = 0;
  let lastSampleMeters = -Infinity;
  let currentCode: number | null = null;
  let currentEntryKm = 0;

  const push = (code: number | null, exitKm: number) => {
    if (currentCode == null) return;
    segments.push({ provinceCode: currentCode, entryKm: currentEntryKm, exitKm });
  };

  for (let i = 0; i < coords.length; i++) {
    if (i > 0) cumMeters += haversineMeters(coords[i - 1], coords[i]);
    const shouldSample =
      cumMeters - lastSampleMeters >= sampleIntervalMeters || i === 0 || i === coords.length - 1;
    if (!shouldSample) continue;
    lastSampleMeters = cumMeters;

    const code = pointToProvince(coords[i]);
    const km = cumMeters / 1000;
    if (code !== currentCode) {
      push(currentCode, km);
      currentCode = code;
      currentEntryKm = km;
    }
  }
  push(currentCode, cumMeters / 1000);

  // null provinceCode'ları (deniz, sınır dışı vs.) at.
  return segments.filter((s) => s.provinceCode != null);
}
