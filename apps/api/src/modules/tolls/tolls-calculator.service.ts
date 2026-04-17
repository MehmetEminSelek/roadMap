import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { DirectionsRoute } from '../routes/dto/google-maps.dto';
import { Vehicle } from '@prisma/client';
import { TollCalculationResult, TollDetail } from './dto/toll-calculation.dto';

type LatLng = { lat: number; lng: number };

type MatchedStation = {
  id: string;
  name: string;
  highway: string;
  lat: number;
  lng: number;
  amount: number;
  polylineIndex: number; // rota uzerindeki ilk eslesme sirasi (giris/cikis cikarimi icin)
};

/**
 * KGM seed verisine gore toll hesaplamasini yapan saf mantik servisi.
 * TollsService bu servisi orkestrator olarak kullanir; ayrismanin nedeni test edilebilirlik ve
 * gelecekteki harici kaynaklarla (TollGuru gibi) yan yana calisabilme.
 */
@Injectable()
export class TollsCalculatorService {
  private readonly logger = new Logger(TollsCalculatorService.name);

  // Eski 2 km cok genisti (paralel yolda yanlis eslesme). Polyline'a dikey mesafe ile 500 m.
  private readonly MATCH_RADIUS_KM = 0.5;

  // Gosterim icin snap-to-polyline ile marker'lari yol uzerine oturtuyoruz.
  private readonly DISPLAY_MATCH_RADIUS_KM = 1;

  constructor(private prisma: PrismaService) {}

  /**
   * Polyline eslesmesi + KGM kumulatif tarife mantigiyla hesaplama.
   * - Kopru/Tunel: noktasal, hepsi toplanir.
   * - Otoyol: ayni highway grubunda ilk eslesme giris, son eslesme cikis; fare = max(entry, exit).
   */
  async calculateFromLocalKGM(
    route: DirectionsRoute,
    vehicle: Vehicle | null,
  ): Promise<TollCalculationResult> {
    const stations = await this.prisma.tollStation.findMany({
      where: { isActive: true, lat: { not: null }, lng: { not: null } },
      include: { tolls: { where: { isActive: true } } },
    });

    const polyline = this.decodeRoutePolylines(route);
    if (stations.length === 0 || polyline.length < 2) {
      const estimated = this.estimateByDistance(route, vehicle);
      return this.buildEstimatedResult(estimated);
    }

    const vehicleType = this.getVehicleType(vehicle);

    // 1) Istasyonlari polyline'a dikey mesafe ile eslestir, eslesirse hangi segmentte olduguna isaretle.
    const matches: MatchedStation[] = [];
    for (const station of stations) {
      if (station.lat == null || station.lng == null) continue;
      const rate = station.tolls.find((r) => r.vehicleType === vehicleType);
      if (!rate || Number(rate.amount) <= 0) continue;

      const nearest = this.nearestSegmentToPoint(polyline, { lat: station.lat, lng: station.lng });
      if (nearest.distanceKm < this.MATCH_RADIUS_KM) {
        matches.push({
          id: station.id,
          name: station.name,
          highway: (station as any).highway || 'Diger',
          lat: station.lat,
          lng: station.lng,
          amount: Number(rate.amount),
          polylineIndex: nearest.segmentIndex,
        });
      }
    }

    if (matches.length === 0) {
      const estimated = this.estimateByDistance(route, vehicle);
      return this.buildEstimatedResult(estimated);
    }

    // 2) Highway bazli gruplama + polyline sirasina gore sirala.
    const groups = new Map<string, MatchedStation[]>();
    for (const m of matches) {
      const list = groups.get(m.highway) ?? [];
      list.push(m);
      groups.set(m.highway, list);
    }

    let totalCost = 0;
    const details: TollDetail[] = [];

    for (const [highway, list] of groups.entries()) {
      list.sort((a, b) => a.polylineIndex - b.polylineIndex);

      // Koprü/Tünel/Diger: hepsi noktasal, topla.
      if (this.isPointBasedHighway(highway)) {
        for (const m of list) {
          totalCost += m.amount;
          details.push({ name: m.name, highway, amount: m.amount, lat: m.lat, lng: m.lng });
        }
        continue;
      }

      // Otoyol: giris = ilk eslesme, cikis = son eslesme. Tarife = max(entry, exit).
      // Seed verideki "Gisele r arasi kumulatif ucretler" yaklasimina uygun: uzak olanin tarifesi kullanilir.
      const entry = list[0];
      const exit = list[list.length - 1];
      const billed = entry.amount >= exit.amount ? entry : exit;
      totalCost += billed.amount;
      details.push({
        name: entry === exit ? entry.name : `${entry.name} -> ${exit.name}`,
        highway,
        amount: billed.amount,
        lat: billed.lat,
        lng: billed.lng,
      });
    }

    if (process.env.NODE_ENV !== 'production') {
      this.logger.log(`KGM local: ${details.length} segment, toplam ${totalCost}TL`);
    }

    if (totalCost === 0) {
      const estimated = this.estimateByDistance(route, vehicle);
      return this.buildEstimatedResult(estimated);
    }

    return { totalCost, details, source: 'local-kgm' };
  }

  /**
   * Rota polyline'i boyunca tum KGM istasyonlarini dikey mesafe ile eslestirir,
   * polyline sirasina gore siralanmis liste doner. Amac: TollGuru'nun isimsiz
   * donen HGS toll'larina gercek gise ismi/koordinati eslemek.
   * Marker'lari yol uzerine oturtmak icin snap-to-polyline uygulanir.
   */
  async matchedStationsAlongRoute(
    route: DirectionsRoute,
  ): Promise<Array<{ name: string; highway: string; lat: number; lng: number; polylineIndex: number }>> {
    const stations = await this.prisma.tollStation.findMany({
      where: { isActive: true, lat: { not: null }, lng: { not: null } },
      select: { name: true, highway: true, lat: true, lng: true },
    });
    const polyline = this.decodeRoutePolylines(route);
    if (stations.length === 0 || polyline.length < 2) return [];

    const matches: Array<{ name: string; highway: string; lat: number; lng: number; polylineIndex: number }> = [];
    for (const s of stations) {
      if (s.lat == null || s.lng == null) continue;
      const nearest = this.nearestSegmentToPoint(polyline, { lat: s.lat, lng: s.lng });
      if (nearest.distanceKm < this.DISPLAY_MATCH_RADIUS_KM) {
        // Snap-to-polyline: marker'i yol uzerine oturt
        const snapped = polyline[nearest.segmentIndex] || polyline[nearest.segmentIndex + 1] || polyline[0];
        matches.push({
          name: s.name,
          highway: (s as any).highway || 'Otoyol',
          lat: snapped.lat,
          lng: snapped.lng,
          polylineIndex: nearest.segmentIndex,
        });
      }
    }
    matches.sort((a, b) => a.polylineIndex - b.polylineIndex);
    return matches;
  }

  /**
   * TollGuru details[] listesinde isimsiz / koordinatsiz olan girisleri, rota boyunca
   * sirali KGM istasyonlariyla eslestirir. TollGuru genelde toll'lari rota sirasiyla
   * dondurur; biz de KGM eslesmelerini sirayla "pop" ederek isim+koordinat yazariz.
   * Sadece `name` gerekli olmayan (bos/ "Gise N" placeholder) girisleri gunceller.
   */
  async mergeDetailsWithRouteStations(
    route: DirectionsRoute,
    details: TollDetail[],
  ): Promise<void> {
    if (details.length === 0) return;

    // Hangi detaylar eksik (isim placeholder veya koordinat 0)?
    const needsFix = (d: TollDetail) =>
      !d.lat || !d.lng || /^Gise\s*\d+$/i.test(d.name.trim()) || !d.name || d.highway === 'Otoyol';
    if (!details.some(needsFix)) return;

    const matches = await this.matchedStationsAlongRoute(route);
    if (matches.length === 0) return;

    // Ikiye bol: barrier (koordinati zaten gelmis) indisleri + fixable indisleri.
    // Barrier'lari koruyup KGM matches'i sadece fixable'lara uygula.
    const fixableIdx: number[] = [];
    for (let i = 0; i < details.length; i++) if (needsFix(details[i])) fixableIdx.push(i);
    if (fixableIdx.length === 0) return;

    // Eslesme sayisi fixable sayisiyla farkli olabilir: en yakin N eslesmeyi esit araliklarla sec.
    // Boylece 5 fixable vs 15 match durumunda da dengeli dagilir.
    const picked: typeof matches = [];
    if (matches.length <= fixableIdx.length) {
      picked.push(...matches);
    } else {
      const step = matches.length / fixableIdx.length;
      for (let i = 0; i < fixableIdx.length; i++) {
        picked.push(matches[Math.min(matches.length - 1, Math.floor(i * step + step / 2))]);
      }
    }

    for (let k = 0; k < fixableIdx.length && k < picked.length; k++) {
      const d = details[fixableIdx[k]];
      const m = picked[k];
      d.name = m.name;
      d.highway = m.highway;
      d.lat = m.lat;
      d.lng = m.lng;
    }
  }

  /**
   * Harici saglayici (TollGuru vb.) koordinatsiz detaylar dondurebiliyor;
   * mobile tarafta marker filtresi `lat && lng` bekledigi icin eksik koordinatli
   * detaylar haritada gorunmez. Bu metod KGM seed verisinden fuzzy isim eslesmesiyle
   * koordinatlari tamamlar. In-place mutasyon yapar.
   */
  async enrichDetailsWithCoordinates(details: TollDetail[]): Promise<void> {
    const missing = details.filter((d) => !d.lat || !d.lng);
    if (missing.length === 0) return;

    const stations = await this.prisma.tollStation.findMany({
      where: { isActive: true, lat: { not: null }, lng: { not: null } },
      select: { name: true, highway: true, lat: true, lng: true },
    });
    if (stations.length === 0) return;

    const normalizedStations = stations.map((s) => ({
      name: s.name,
      highway: (s as any).highway || '',
      lat: s.lat!,
      lng: s.lng!,
      normName: normalizeTr(s.name),
    }));

    for (const d of missing) {
      const q = normalizeTr(d.name);
      if (!q) continue;

      let best: { lat: number; lng: number; score: number } | null = null;
      for (const s of normalizedStations) {
        const score = similarityScore(q, s.normName);
        if (score > 0 && (!best || score > best.score)) {
          best = { lat: s.lat, lng: s.lng, score };
        }
      }

      // Ciddi eslesme olursa koordinati yaz (0.5 esigi keyfi ama strict; yanlis koordinattansa bos kalir).
      if (best && best.score >= 0.5) {
        d.lat = best.lat;
        d.lng = best.lng;
      }
    }
  }

  estimateByDistance(route: DirectionsRoute, vehicle: Vehicle | null): number {
    const leg = route.legs[0];
    if (!leg) return 0;
    const distanceKm = leg.distance.value / 1000;
    const vehicleType = this.getVehicleType(vehicle);

    // KGM 2026 tahmini tarifeler (TL/km).
    const ratesPerKm: Record<string, number> = {
      MOTORCYCLE: 0.23,
      CAR: 0.38,
      VAN: 0.57,
      TRUCK: 0.95,
    };

    const ratePerKm = ratesPerKm[vehicleType] || 0.38;
    let tollCost = distanceKm * ratePerKm;

    // Minimum bir kopru gecisine esit alt sinir.
    if (tollCost < 50) tollCost = 50;

    return Math.round(tollCost * 100) / 100;
  }

  getVehicleType(vehicle: Vehicle | null): string {
    if (!vehicle) return 'CAR';
    if (vehicle.weight < 400) return 'MOTORCYCLE';
    if (vehicle.weight > 7500) return 'TRUCK';
    if (vehicle.weight > 3500) return 'VAN';
    return 'CAR';
  }

  /** Rota icerisindeki tum step polyline'larini tek bir koordinat dizisine acar. */
  decodeRoutePolylines(route: DirectionsRoute): LatLng[] {
    const points: LatLng[] = [];
    const leg = route.legs?.[0];
    if (leg?.steps) {
      for (const step of leg.steps) {
        const encoded = step.polyline?.points;
        if (encoded) points.push(...decodePolyline(encoded));
      }
    }
    if (points.length === 0 && route.overview_polyline?.points) {
      points.push(...decodePolyline(route.overview_polyline.points));
    }
    return points;
  }

  private buildEstimatedResult(amount: number): TollCalculationResult {
    if (amount <= 0) return { totalCost: 0, details: [], source: 'estimate' };
    return {
      totalCost: amount,
      details: [
        {
          name: 'Otoyol / Kopru Kullanim Tahmini',
          highway: 'KGM Istasyon Eslesmesi Kurulamadi',
          amount,
          lat: 0,
          lng: 0,
        },
      ],
      source: 'estimate',
    };
  }

  private isPointBasedHighway(highway: string): boolean {
    return (
      highway.includes('Kopru') ||
      highway.includes('Köprü') ||
      highway.includes('Tunel') ||
      highway.includes('Tünel') ||
      highway === 'Diger' ||
      highway === 'Diğer'
    );
  }

  /**
   * Bir noktadan polyline'daki her segmente (A-B) dikey uzakligi hesaplar,
   * en yakin segmenti ve mesafeyi dondurur. Haversine (nokta-nokta) yerine
   * segment icin projeksiyon yapilir (clamped).
   */
  private nearestSegmentToPoint(
    polyline: LatLng[],
    point: LatLng,
  ): { distanceKm: number; segmentIndex: number } {
    let best = { distanceKm: Infinity, segmentIndex: 0 };
    for (let i = 0; i < polyline.length - 1; i++) {
      const d = pointToSegmentDistanceKm(point, polyline[i], polyline[i + 1]);
      if (d < best.distanceKm) best = { distanceKm: d, segmentIndex: i };
    }
    return best;
  }
}

// ---------- helpers ----------

function decodePolyline(encoded: string): LatLng[] {
  const points: LatLng[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let shift = 0;
    let result = 0;
    let byte: number;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;

    shift = 0;
    result = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;

    points.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }

  return points;
}

/**
 * Kucuk mesafelerde duzlem-yaklasimi yeterli (Turkiye bolgesinde < 1 km hata ihmal edilebilir).
 * Enlem farkindalikli olceklemeyle lat/lng'yi metre benzeri birime cevirir, sonra dogru parcasina
 * dikey uzakligi hesaplar ve km olarak dondurur.
 */
function pointToSegmentDistanceKm(p: LatLng, a: LatLng, b: LatLng): number {
  const KM_PER_DEG_LAT = 111.32;
  const meanLat = ((a.lat + b.lat) / 2) * (Math.PI / 180);
  const kmPerDegLng = 111.32 * Math.cos(meanLat);

  const ax = a.lng * kmPerDegLng;
  const ay = a.lat * KM_PER_DEG_LAT;
  const bx = b.lng * kmPerDegLng;
  const by = b.lat * KM_PER_DEG_LAT;
  const px = p.lng * kmPerDegLng;
  const py = p.lat * KM_PER_DEG_LAT;

  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;

  if (lenSq === 0) {
    const ex = px - ax;
    const ey = py - ay;
    return Math.sqrt(ex * ex + ey * ey);
  }

  let t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));

  const cx = ax + t * dx;
  const cy = ay + t * dy;
  const ex = px - cx;
  const ey = py - cy;
  return Math.sqrt(ex * ex + ey * ey);
}

/** Turkce karakterleri normalize edip kucuk harfe cevirir, parantez/noktalama atar. */
function normalizeTr(s: string): string {
  if (!s) return '';
  return s
    .toLocaleLowerCase('tr')
    .replace(/ı/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Basit kelime-tabanli Jaccard benzerligi: ortak kelime sayisi / toplam essiz kelime.
 * "Gebze" vs "Gebze Gisesi" -> yuksek puan; "Mahmutbey" vs "Halkali" -> 0.
 */
function similarityScore(a: string, b: string): number {
  if (!a || !b) return 0;
  const ta = new Set(a.split(' ').filter((w) => w.length >= 2));
  const tb = new Set(b.split(' ').filter((w) => w.length >= 2));
  if (ta.size === 0 || tb.size === 0) return 0;
  let common = 0;
  for (const t of ta) if (tb.has(t)) common++;
  const union = ta.size + tb.size - common;
  return union === 0 ? 0 : common / union;
}
