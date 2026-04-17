import { Module, Global } from '@nestjs/common';
import { RateLimiterService } from './rate-limiter/rate-limiter.service';
import { RetryService } from './retry/retry.service';

@Global()
@Module({
  providers: [RateLimiterService, RetryService],
  exports: [RateLimiterService, RetryService],
})
export class CommonModule {}
