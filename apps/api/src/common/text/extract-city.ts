import { normalizeTr } from './normalize-tr';

/**
 * Türkiye'deki 81 ilin listesi (normalize edilmiş).
 * Adres stringinden il adını çıkarmak için kullanılır.
 */
const CITIES = [
  'adana','adiyaman','afyonkarahisar','agri','aksaray','amasya','ankara','antalya',
  'ardahan','artvin','aydin','balikesir','bartin','batman','bayburt','bilecik',
  'bingol','bitlis','bolu','burdur','bursa','canakkale','cankiri','corum',
  'denizli','diyarbakir','duzce','edirne','elazig','erzincan','erzurum','eskisehir',
  'gaziantep','giresun','gumushane','hakkari','hatay','igdir','isparta','istanbul',
  'izmir','kahramanmaras','karabuk','karaman','kars','kastamonu','kayseri','kilis',
  'kirikkale','kirklareli','kirsehir','kocaeli','konya','kutahya','malatya','manisa',
  'mardin','mersin','mugla','mus','nevsehir','nigde','ordu','osmaniye',
  'rize','sakarya','samsun','sanliurfa','siirt','sinop','sirnak','sivas',
  'tekirdag','tokat','trabzon','tunceli','usak','van','yalova','yozgat','zonguldak',
];

/**
 * Bir adresten il adını çıkarır.
 * Örn: "Bakırköy/İstanbul, Türkiye" → "istanbul"
 *      "Kadıköy, İstanbul" → "istanbul"
 *      "Ankara, Türkiye" → "ankara"
 *
 * Bulunamazsa tüm adres normalize edilerek döner (fallback).
 */
export function extractCity(address: string): string {
  const normalized = normalizeTr(address);

  // Adresi parçalara ayır (virgül, /, boşluk)
  const tokens = normalized.split(/[,\/\s]+/).filter(Boolean);

  // Her token'ı il listesinde ara
  for (const token of tokens) {
    if (CITIES.includes(token)) {
      return token;
    }
  }

  // 2-gram denemesi (çok kelimeli iller: kahramanmaras, afyonkarahisar vb. zaten tek kelime normalize sonrasında)
  // Eğer direkt bulunamadıysa, tüm normalize string içinde arama yap
  for (const city of CITIES) {
    if (normalized.includes(city)) {
      return city;
    }
  }

  // İl bulunamadıysa fallback: ilk anlamlı parçayı kullan
  return tokens[0] || normalized;
}

/**
 * İki adres için il-bazlı (city-level) cache key oluşturur.
 * Aynı iller arası tüm rotalar aynı cache key'i paylaşır.
 *
 * Örn:
 *   "Bakırköy, İstanbul" → "Ankara" = "route:city:istanbul|ankara"
 *   "Kadıköy, İstanbul" → "Ankara" = "route:city:istanbul|ankara"  (AYNI!)
 */
export function buildCityCacheKey(origin: string, destination: string): string {
  const originCity = extractCity(origin);
  const destCity = extractCity(destination);
  return `route:city:v1:${originCity}|${destCity}`;
}
