import type { LatLng } from 'react-native-maps';

export interface RouteStep {
  encodedPolyline: string;
  congestion: 'FREE' | 'LIGHT' | 'MEDIUM' | 'HEAVY';
}

const COLOR = {
  FREE: '#4A90E2',    // Mavi - trafiksiz
  LIGHT: '#2ECC71',   // Yeşil - hafif
  MEDIUM: '#F39C12',  // Turuncu - orta
  HEAVY: '#E74C3C',   // Kırmızı - yoğun
};

export function decodePolyline(encoded: string): LatLng[] {
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

    points.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
  }

  return points;
}

export function buildStrokeColors(steps: RouteStep[]): { coords: LatLng[]; colors: string[] } {
  const coords: LatLng[] = [];
  const colors: string[] = [];

  for (const step of steps) {
    const pts = decodePolyline(step.encodedPolyline);
    const color = COLOR[step.congestion];
    for (const p of pts) {
      coords.push(p);
      colors.push(color);
    }
  }

  return { coords, colors };
}
