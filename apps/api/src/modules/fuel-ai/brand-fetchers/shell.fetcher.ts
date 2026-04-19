import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { BrandPriceFetcher, BrandPrices } from './base.fetcher';

/**
 * Shell Türkiye — NOT IMPLEMENTED (investigation complete, approach requires
 * headless browser).
 *
 * Araştırma sonuçları:
 *   - Ana sayfa (www.shell.com.tr/suruculer/...) sadece iframe barındırıyor.
 *   - Gerçek fiyat tablosu: https://www.turkiyeshell.com/pompatest/
 *   - ASP.NET WebForms + DevExpress ASPxClientGridView kullanılıyor.
 *   - Sayfa ilk yüklendiğinde fiyat yok ("Fiyatlar Yükleniyor…").
 *   - Fiyat tablosu (cb_all_grdPrices) bir DevExpress callback sonrası dolduruluyor.
 *   - `__CALLBACKID=cb_all` POST'u 200 dönüyor ama grid boş kalıyor (inner
 *     callback tetiklenmiyor). cb_all$grdPrices callback'i 'generalError: Unable
 *     to read beyond the end of the stream' veriyor — büyük ihtimalle
 *     CallbackState'in bir önceki postback sonrası dinamik değeri gerekli.
 *   - Reverse-engineering fizibil değil; Puppeteer/Playwright önerilir.
 *
 * Doğru yaklaşım seçenekleri:
 *   a) Puppeteer ile headless Chrome: sayfayı aç, il seç, tabloyu DOM'dan oku.
 *   b) Üçüncü parti aggregator (hepsiyakit.com, akaryakit-fiyatlari.com.tr).
 *   c) Shell Türkiye'nin yayınladığı günlük PDF/Excel (varsa).
 *
 * Şu an null dönüyor → orchestrator "marka default fiyat / OPET ortalaması"
 * fallback'ini kullanıyor. Kullanıcı Shell seçerse yaklaşık doğru fiyat görür.
 */
@Injectable()
export class ShellFetcher extends BrandPriceFetcher {
  readonly brandId = 'shell';
  readonly brandName = 'Shell';

  constructor(http: HttpService) {
    super(http);
  }

  async fetch(_provinceCode = 34): Promise<BrandPrices | null> {
    this.logger.debug(
      'Shell fetcher devre dışı: turkiyeshell.com/pompatest DevExpress callback gerektiriyor, headless browser şart.',
    );
    return null;
  }
}
