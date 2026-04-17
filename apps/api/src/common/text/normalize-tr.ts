/**
 * Türkçe karakterleri normalize edip küçük harfe çevirir, parantez/noktalama atar.
 */
export function normalizeTr(s: string): string {
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
