/**
 * Bearing + headwind helpers.
 *
 * `computeBearing`  → iki lat/lng noktası arasındaki initial bearing (derece,
 *                     0=N, saat yönünde).
 * `headwindComponent` → araç yönü + meteorolojik rüzgâr verisinden headwind
 *                       komponentini (km/h) hesaplar. Pozitif = head,
 *                       negatif = tail.
 *
 * OpenWeatherMap `wind_deg` meteorolojik konvansiyonda: rüzgârın NEREDEN
 * geldiği (0=kuzeyden esiyor, 90=doğudan esiyor vs.). Bearing ile direkt
 * açı farkından cos alırsak, 0 farkta +1.0 çıkar — yani bu aynı zamanda
 * "kuzeye giderken, kuzeyden rüzgâr → max headwind" anlamına gelir, doğru.
 */

const toRad = (d: number) => (d * Math.PI) / 180;
const toDeg = (r: number) => (r * 180) / Math.PI;

export interface LatLng {
  lat: number;
  lng: number;
}

/**
 * Great-circle initial bearing from `from` to `to`, in degrees clockwise
 * from north. Source: https://www.movable-type.co.uk/scripts/latlong.html
 */
export function computeBearing(from: LatLng, to: LatLng): number {
  const φ1 = toRad(from.lat);
  const φ2 = toRad(to.lat);
  const Δλ = toRad(to.lng - from.lng);

  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  const θ = Math.atan2(y, x);
  return (toDeg(θ) + 360) % 360;
}

/**
 * Araç seyahat yönü (bearing) ve meteorolojik rüzgâr yönü (wind_deg: rüzgârın
 * nereden geldiği) verildiğinde, yakıt modeline gidecek **headwind**
 * komponentini hesapla.
 *
 *   + = head (drag artar, yakıt artar)
 *   - = tail (drag azalır, yakıt azalır)
 *
 * Örnek:
 *   - Kuzeye (0°) giderken, kuzeyden (0°) esen 20 km/h →  +20 (head)
 *   - Kuzeye (0°) giderken, güneyden (180°) esen 20 km/h → -20 (tail)
 *   - Kuzeye (0°) giderken, doğudan (90°) esen 20 km/h → ~0 (yan)
 */
export function headwindComponent(
  travelBearingDeg: number,
  windFromDeg: number,
  windSpeedKph: number,
): number {
  const Δ = toRad(travelBearingDeg - windFromDeg);
  return windSpeedKph * Math.cos(Δ);
}
