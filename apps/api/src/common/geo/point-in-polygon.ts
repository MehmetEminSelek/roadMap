import { LatLng } from './polyline-decode';

/**
 * Ray casting point-in-polygon testi.
 * `polygon` = [[lng, lat], ...] (GeoJSON convention).
 * `point` = { lat, lng }.
 */
export function pointInPolygon(point: LatLng, polygon: number[][]): boolean {
  const x = point.lng;
  const y = point.lat;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0], yi = polygon[i][1];
    const xj = polygon[j][0], yj = polygon[j][1];

    const intersect =
      ((yi > y) !== (yj > y)) &&
      (x < ((xj - xi) * (y - yi)) / (yj - yi + 1e-12) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Multipolygon desteği: herhangi bir ring içinde ise true.
 * GeoJSON "MultiPolygon" → coordinates = [[ [[lng,lat],...], holes... ], ...]
 * "Polygon" → coordinates = [ [[lng,lat],...], holes... ]
 */
export function pointInGeoJSONGeometry(
  point: LatLng,
  geometry: { type: string; coordinates: any },
): boolean {
  if (geometry.type === 'Polygon') {
    // İlk ring dış sınır; diğerleri delik (holes)
    const rings: number[][][] = geometry.coordinates;
    if (!rings?.length) return false;
    if (!pointInPolygon(point, rings[0])) return false;
    for (let i = 1; i < rings.length; i++) {
      if (pointInPolygon(point, rings[i])) return false;
    }
    return true;
  }
  if (geometry.type === 'MultiPolygon') {
    for (const poly of geometry.coordinates as number[][][][]) {
      if (!poly?.length) continue;
      if (!pointInPolygon(point, poly[0])) continue;
      let inHole = false;
      for (let i = 1; i < poly.length; i++) {
        if (pointInPolygon(point, poly[i])) { inHole = true; break; }
      }
      if (!inHole) return true;
    }
    return false;
  }
  return false;
}
