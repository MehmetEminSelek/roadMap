import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import * as cheerio from 'cheerio';
import { BrandPriceFetcher, BrandPrices } from './base.fetcher';

/**
 * Petrol Ofisi — SSR yaklaşımı.
 *
 * https://www.petrolofisi.com.tr/akaryakit-fiyatlari sayfası tüm illerin
 * fiyatlarını tek HTML response içinde dönüyor. İl seçimi client-side filter
 * olduğu için XHR endpoint'i yok — sadece <table class="table-prices"> parse et.
 *
 * Kolonlar:
 *   0: Şehir
 *   1: V/Max Kurşunsuz 95  → petrol
 *   2: V/Max Diesel        → diesel
 *   6: PO/gaz Otogaz       → lpg
 *
 * Hücre formatı: "62.70 52.25 TL/LT +KDV" — ilk sayı KDV dahil perakende.
 * Istanbul iki satır olarak geliyor (AVRUPA + ANADOLU), ortalamasını alıyoruz.
 */
@Injectable()
export class PetrolOfisiFetcher extends BrandPriceFetcher {
  readonly brandId = 'po';
  readonly brandName = 'Petrol Ofisi';

  private readonly PAGE_URL = 'https://www.petrolofisi.com.tr/akaryakit-fiyatlari';

  // PO'nun ASCII-upper il isimlerinden plaka koduna eşleme.
  // PROVINCE_NAMES'den türetilemiyor çünkü PO aksansız yazıyor ve bazı ayarlar var
  // (AFYON→Afyonkarahisar, MERSIN→İçel/Mersin, KAHRAMANMARAS vs.).
  private readonly CITY_TO_CODE: Record<string, number> = {
    ADANA: 1, ADIYAMAN: 2, AFYON: 3, AGRI: 4, AMASYA: 5,
    ANKARA: 6, ANTALYA: 7, ARTVIN: 8, AYDIN: 9, BALIKESIR: 10,
    BILECIK: 11, BINGOL: 12, BITLIS: 13, BOLU: 14, BURDUR: 15,
    BURSA: 16, CANAKKALE: 17, CANKIRI: 18, CORUM: 19, DENIZLI: 20,
    DIYARBAKIR: 21, EDIRNE: 22, ELAZIG: 23, ERZINCAN: 24, ERZURUM: 25,
    ESKISEHIR: 26, GAZIANTEP: 27, GIRESUN: 28, GUMUSHANE: 29, HAKKARI: 30,
    HATAY: 31, ISPARTA: 32, MERSIN: 33, ISTANBUL: 34, IZMIR: 35,
    KARS: 36, KASTAMONU: 37, KAYSERI: 38, KIRKLARELI: 39, KIRSEHIR: 40,
    KOCAELI: 41, KONYA: 42, KUTAHYA: 43, MALATYA: 44, MANISA: 45,
    KAHRAMANMARAS: 46, MARDIN: 47, MUGLA: 48, MUS: 49, NEVSEHIR: 50,
    NIGDE: 51, ORDU: 52, RIZE: 53, SAKARYA: 54, SAMSUN: 55,
    SIIRT: 56, SINOP: 57, SIVAS: 58, TEKIRDAG: 59, TOKAT: 60,
    TRABZON: 61, TUNCELI: 62, SANLIURFA: 63, USAK: 64, VAN: 65,
    YOZGAT: 66, ZONGULDAK: 67, AKSARAY: 68, BAYBURT: 69, KARAMAN: 70,
    KIRIKKALE: 71, BATMAN: 72, SIRNAK: 73, BARTIN: 74, ARDAHAN: 75,
    IGDIR: 76, YALOVA: 77, KARABUK: 78, KILIS: 79, OSMANIYE: 80,
    DUZCE: 81,
  };

  constructor(http: HttpService) {
    super(http);
  }

  async fetch(provinceCode = 34): Promise<BrandPrices | null> {
    const all = await this.fetchAll();
    return all?.get(provinceCode) ?? null;
  }

  async fetchAll(): Promise<Map<number, BrandPrices> | null> {
    try {
      const res = await firstValueFrom(
        this.http.get(this.PAGE_URL, {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'tr-TR,tr;q=0.9,en;q=0.8',
          },
          timeout: 15_000,
        }),
      );

      const $ = cheerio.load(res.data as string);
      const rows = $('tr.price-row');
      if (rows.length === 0) {
        this.logger.warn('PO: tr.price-row bulunamadı, HTML yapısı değişmiş olabilir.');
        return null;
      }

      // İstanbul iki satır (AVRUPA + ANADOLU) → topla, sonra ortala
      const istanbulPrices: BrandPrices[] = [];
      const out = new Map<number, BrandPrices>();

      rows.each((_, row) => {
        const cells = $(row).find('td');
        if (cells.length < 7) return;

        const rawCity = $(cells[0]).text().replace(/\s+/g, ' ').trim().toUpperCase();
        // "ISTANBUL (AVRUPA)" → "ISTANBUL"
        const city = rawCity.replace(/\s*\([^)]*\)\s*/g, '').trim();
        const code = this.CITY_TO_CODE[city];
        if (!code) {
          this.logger.debug(`PO: '${rawCity}' plaka koduna eşlenemedi, atlandı.`);
          return;
        }

        const prices: BrandPrices = {
          petrol: this.parseFirstNumber($(cells[1]).text()),
          diesel: this.parseFirstNumber($(cells[2]).text()),
          lpg: this.parseFirstNumber($(cells[6]).text()),
        };

        if (code === 34) {
          istanbulPrices.push(prices);
        } else {
          out.set(code, prices);
        }
      });

      if (istanbulPrices.length > 0) {
        out.set(34, this.averagePrices(istanbulPrices));
      }

      this.logger.log(`PO: ${out.size}/81 il için fiyat çekildi.`);
      return out.size > 0 ? out : null;
    } catch (e: any) {
      this.logger.warn(`PO fetch başarısız: ${e.message}`);
      return null;
    }
  }

  /**
   * "62.70 52.25 TL/LT +KDV" → 62.70 (KDV dahil ilk sayı).
   * Türkçe lokal ondalık virgülse de nokta da çalışıyor.
   */
  private parseFirstNumber(raw: string): number | null {
    const match = raw.replace(',', '.').match(/(\d{1,3}\.\d{1,2})/);
    if (!match) return null;
    const n = parseFloat(match[1]);
    return n > 0 ? n : null;
  }

  private averagePrices(list: BrandPrices[]): BrandPrices {
    const avg = (key: keyof BrandPrices) => {
      const vals = list.map((p) => p[key]).filter((v): v is number => v != null);
      return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
    };
    return { petrol: avg('petrol'), diesel: avg('diesel'), lpg: avg('lpg') };
  }
}
