import { CacheModule } from '@nestjs/cache-manager';
import { redisStore } from 'cache-manager-redis-yet';
import { Module, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const logger = new Logger('CacheConfig');

@Module({
  imports: [
    CacheModule.registerAsync({
      isGlobal: true,
      inject: [ConfigService],
      useFactory: async (cfg: ConfigService) => {
        const url = cfg.get<string>('redis.url') || process.env.REDIS_URL;
        if (!url) {
          logger.warn('⚠️  REDIS_URL tanımlı değil — memory cache kullanılıyor (veriler restart\'ta silinir)');
          return { ttl: 0 };
        }
        try {
          const store = await redisStore({ url });
          logger.log(`✅ Redis bağlantısı başarılı: ${url}`);
          return {
            store,
            ttl: 60_000,
          };
        } catch (err) {
          logger.error(`❌ Redis bağlantısı başarısız (${url}): ${err}. Memory cache fallback aktif.`);
          return { ttl: 0 };
        }
      },
    }),
  ],
  exports: [CacheModule],
})
export class AppCacheModule {}

