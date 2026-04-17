# RoadMap API Test Suite

## Kurulum

### Integration Tests (Jest)

```bash
cd apps/api
npm run test:e2e
```

### Stress Tests (k6)

1. k6 kurulumu:
```bash
# macOS
brew install k6

# Linux
sudo apt-get install k6

# Windows
choco install k6
```

2. Stress test çalıştırma:
```bash
cd apps/api
k6 run stress-tests/api-stress-test.ts
```

3. Belirli senaryo ile:
```bash
BASE_URL=http://localhost:3001 SCENARIO=load k6 run stress-tests/api-stress-test.ts
```

## Test Senaryoları

### Smoke Test (30 saniye)
- 5 VUW (Virtual Users)
- Basit endpoint erişimi
- Rate limiting doğrulama

### Load Test (5 dakika)
- 10 → 50 → 100 → 0 VUW
- Concurrent route creation
- Google API rate limiting testi

### Stress Test (3 dakika)
- 100 → 200 → 0 VUW
- Maximum load altında davranış
- Error rate monitoring

## Metrikler

| Metrik | Threshold |
|--------|-----------|
| p50 response time | < 500ms |
| p90 response time | < 1000ms |
| p95 response time | < 2000ms |
| Error rate | < 10% |
| Check pass rate | > 90% |

## Test Coverage

### Endpoint Testleri
- `POST /auth/register` - Kullanım kaydı
- `POST /auth/login` - Kullanıcı girişi
- `POST /routes` - Rota hesaplama
- `GET /routes` - Kullanıcı rotaları
- `GET /routes/:id` - Rota detayı
- `GET /routes/stats` - Rota istatistikleri
- `DELETE /routes/:id` - Rota silme
- `POST /vehicles` - Araç ekleme
- `GET /vehicles` - Araç listesi
- `GET /tolls/stations` - Gişe istasyonları
- `GET /tolls/rates` - Gişe tarifeleri
- `POST /favorites/routes` - Favori ekleme
- `GET /favorites/routes` - Favoriler

### Stress Testleri
- Rate limiting doğrulama
- Concurrent request handling
- Google API quota management
- Memory leak detection
- Connection pool exhaustion
