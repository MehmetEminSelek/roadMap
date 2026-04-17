import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Google API Rate Limiter Service
 *
 * Google Maps Platform limits:
 * - Directions API: 60 requests/minute (Standard Plan)
 * - Geocoding API: 60 requests/minute
 * - Places API: 60 requests/minute (nearby search), 300 requests/minute (autocomplete)
 * - Timezone API: 60 requests/minute
 *
 * Gemini API limits:
 * - Free tier: 60 requests/minute
 * - Pay tier: 1500 requests/minute
 */

interface RateLimitState {
  count: number;
  resetAt: number;
  lastRequestTime: number;
}

@Injectable()
export class RateLimiterService {
  private readonly logger = new Logger(RateLimiterService.name);

  private readonly limits: Map<string, RateLimitState> = new Map();
  private readonly defaultWindowMs: number;
  private readonly defaultMaxRequests: number;
  private readonly minDelayMs: number;

  constructor(private configService: ConfigService) {
    // Default: 60 requests per minute (Google Maps Standard)
    this.defaultMaxRequests = this.configService.get<number>('googleMaps.rateLimit', 60);
    this.defaultWindowMs = 60000; // 1 minute
    this.minDelayMs = 1000; // Minimum 1 second between requests
  }

  /**
   * Check if request is allowed under rate limit
   * Returns delay in ms to wait before making request, or 0 if allowed now
   */
  async acquireLimit(key: string, maxRequests?: number, windowMs?: number): Promise<number> {
    const limit = maxRequests || this.defaultMaxRequests;
    const window = windowMs || this.defaultWindowMs;

    const state = this.limits.get(key) || {
      count: 0,
      resetAt: Date.now() + window,
      lastRequestTime: 0,
    };

    // Reset counter if window expired
    if (Date.now() >= state.resetAt) {
      state.count = 0;
      state.resetAt = Date.now() + window;
      this.logger.debug(`[RateLimiter] ${key} counter reset`);
    }

    // Check if we've hit the limit
    if (state.count >= limit) {
      const waitTime = state.resetAt - Date.now();
      this.logger.warn(
        `[RateLimiter] ${key} rate limit reached (${state.count}/${limit}). Waiting ${waitTime}ms`,
      );
      this.limits.set(key, state);
      return waitTime;
    }

    // Enforce minimum delay between requests
    const timeSinceLastRequest = Date.now() - state.lastRequestTime;
    const delayNeeded = Math.max(0, this.minDelayMs - timeSinceLastRequest);

    // Update state
    state.count++;
    state.lastRequestTime = Date.now() + delayNeeded;
    this.limits.set(key, state);

    this.logger.debug(
      `[RateLimiter] ${key}: ${state.count}/${limit} requests in window`,
    );

    return delayNeeded;
  }

  /**
   * Get current rate limit status for a key
   */
  getStatus(key: string): { count: number; remaining: number; resetAt: number } {
    const state = this.limits.get(key) || {
      count: 0,
      resetAt: Date.now() + this.defaultWindowMs,
      lastRequestTime: 0,
    };

    return {
      count: state.count,
      remaining: Math.max(0, this.defaultMaxRequests - state.count),
      resetAt: state.resetAt,
    };
  }

  /**
   * Reset rate limit counter for a key
   */
  reset(key: string): void {
    this.limits.delete(key);
    this.logger.log(`[RateLimiter] ${key} counter reset`);
  }

  /**
   * Reset all counters
   */
  resetAll(): void {
    this.limits.clear();
    this.logger.log('[RateLimiter] All counters reset');
  }
}
