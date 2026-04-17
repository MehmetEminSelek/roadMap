import { CacheModule } from '@nestjs/cache-manager';
import { redisStore } from 'cache-manager-redis-yet';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Module({
  imports: [
    CacheModule.registerAsync({
      isGlobal: true,
      inject: [ConfigService],
      useFactory: async (cfg: ConfigService) => {
        const url = cfg.get<string>('redis.url');
        if (!url) {
          // Redis yoksa no-op — local fallback (memory store)
          return { ttl: 0 };
        }
        return {
          store: await redisStore({ url }),
          ttl: 60_000, // default 1 min, per-call overrides apply
        };
      },
    }),
  ],
  exports: [CacheModule],
})
export class AppCacheModule {}
