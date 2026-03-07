# RoadMap - Türkiye Otoyol Hesaplama Uygulaması

Türkiye'de otoyol maliyeti hesaplama zor. Uzun yolculuklarda:
- Farklı otoyol ücretleri (KGM)
- Sürekli değişen yakıt fiyatları
- Gerçekçi tüketim tahmini yok
- Mola noktaları kolay bulunamıyor

**RoadMap** bu sorunlara çözüm sunar!

## Özellikler

- **Google Maps entegrasyonu** ile doğruluğu yüksek rota çizimi
- **AI destekli yakıt tahmini** (Gemini API)
- **KGM otoyol ücretleri** veritabanı
- **Dinamik maliyet hesaplama**
- **Mola noktası önerileri** (Google Places API)
- **Rota geçmişi** ve **favoriler**

## Tech Stack

### Backend
- NestJS
- Prisma ORM
- PostgreSQL
- Google Maps Platform API
- Google Gemini API

### Mobile
- Expo React Native
- React Navigation
- Google Maps SDK (iOS/Android)

## Kurulum

### Backend

```bash
cd apps/api

# Bağımlılıkları yükle
npm install

# Environment dosyası oluştur
cp .env.example .env
# .env dosyasını kendi ayarlarınızla doldurun

# Veritabanını oluştur
npx prisma migrate dev --name init

# Seed verilerini yükle
npx prisma db seed

# Sunucuyu başlat
npm run start:dev
```

Backend `http://localhost:3001` portunda çalışacaktır.

### Mobile

```bash
cd apps/mobile

# Bağımlılıkları yükle
npm install

# Uygulamayı başlat
npm start
```

## API Endpoints

### Routes
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/routes/calculate` | Rota hesapla (AI destekli) |
| GET | `/routes` | Kullanıcının rotaları |
| GET | `/routes/:id` | Rota detayı |
| DELETE | `/routes/:id` | Rota sil |

### Tolls
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/tolls/stations` | Tüm otoyol ücretleri |
| GET | `/tolls/rates` | Otoyol ücretleri (gruplu) |

### AI Fuel
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/ai/fuel/calculate` | AI ile yakıt tahmini |

### Places
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/places/nearby` | Rotaya yakın mola noktaları |

### Vehicles
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/vehicles` | Yeni araç ekle |
| GET | `/vehicles` | Kullanıcının araçları |
| GET | `/vehicles/brands` | Markalar |
| GET | `/vehicles/brands/:id/models` | Model列表 |

## Google Maps API

API key'i `.env` dosyasında ayarlayın:
```
GOOGLE_MAPS_API_KEY=your_google_maps_api_key
```

## Google Gemini API

Yakıt tahmini için:
```
GOOGLE_GENERATIVE_AI_API_KEY=your_gemini_api_key
```

## Veritabanı Şeması

### Ana Modeller
- **User** - Kullanıcı bilgileri
- **Vehicle** - Araç bilgileri
- **Route** - Hesaplanan rotalar
- **TollStation** - Otoyol ücretleri
- **FavoriteRoute** - Favori rotalar
- **FavoritePlace** - Favori yerler

## Kontribüsyon

1. Fork et
2. Branch oluştur (`git checkout -b feature/amazing-feature`)
3. Commit et (`git commit -m 'Add some amazing feature'`)
4. Push et (`git push origin feature/amazing-feature`)
5. Pull Request aç

## Lisans

MIT
