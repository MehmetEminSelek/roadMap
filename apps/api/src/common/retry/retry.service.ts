import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Retry Service with Exponential Backoff
 *
 * Implements retry logic for transient API failures:
 * - Exponential backoff: delay = baseDelay * (2 ^ attempt)
 * - Jitter: random factor to prevent thundering herd
 * - Max retries: configurable per operation
 */

export interface RetryOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  jitter?: boolean;
  retryableErrors?: string[];
}

@Injectable()
export class RetryService {
  private readonly logger = new Logger(RetryService.name);

  private readonly defaultMaxRetries: number;
  private readonly defaultBaseDelayMs: number;
  private readonly defaultMaxDelayMs: number;

  constructor(private configService: ConfigService) {
    this.defaultMaxRetries = this.configService.get<number>('api.maxRetries', 3);
    this.defaultBaseDelayMs = this.configService.get<number>('api.baseDelayMs', 1000);
    this.defaultMaxDelayMs = this.configService.get<number>('api.maxDelayMs', 30000);
  }

  /**
   * Execute async operation with retry logic
   */
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    options: RetryOptions = {},
    context = 'unnamed',
  ): Promise<T> {
    const {
      maxRetries = this.defaultMaxRetries,
      baseDelayMs = this.defaultBaseDelayMs,
      maxDelayMs = this.defaultMaxDelayMs,
      jitter = true,
      retryableErrors = ['ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED', '5xx', '429'],
    } = options;

    let lastError: Error | unknown;
    let attempt = 0;

    while (attempt <= maxRetries) {
      try {
        return await operation();
      } catch (error: any) {
        lastError = error;
        attempt++;

        // Check if error is retryable
        const isRetryable = this.isRetryableError(error, retryableErrors);

        if (!isRetryable || attempt > maxRetries) {
          this.logger.error(
            `[Retry] ${context} failed after ${attempt} attempts: ${error?.message || error}`,
          );
          throw error;
        }

        // Calculate delay with exponential backoff
        const delay = this.calculateDelay(attempt, baseDelayMs, maxDelayMs, jitter);

        this.logger.warn(
          `[Retry] ${context} attempt ${attempt}/${maxRetries} failed. Retrying in ${delay}ms: ${error?.message || error}`,
        );

        await this.sleep(delay);
      }
    }

    throw lastError;
  }

  /**
   * Check if error is retryable
   */
  private isRetryableError(error: any, retryableErrors: string[]): boolean {
    // HTTP status codes
    if (error?.status) {
      const status = error.status;
      if (status === 429) return true; // Rate limited
      if (status >= 500 && status < 600) return true; // Server errors
      if (status >= 400 && status < 500) return false; // Client errors - don't retry
    }

    // Error codes
    const errorCode = error?.code || error?.response?.status;
    if (errorCode && retryableErrors.some(e => errorCode.toString().includes(e))) {
      return true;
    }

    // Network errors
    const message = error?.message || String(error);
    if (
      message.includes('ETIMEDOUT') ||
      message.includes('ECONNRESET') ||
      message.includes('ECONNREFUSED') ||
      message.includes('network') ||
      message.includes('timeout')
    ) {
      return true;
    }

    return false;
  }

  /**
   * Calculate delay with exponential backoff and optional jitter
   */
  private calculateDelay(
    attempt: number,
    baseDelayMs: number,
    maxDelayMs: number,
    jitter: boolean,
  ): number {
    // Exponential backoff: baseDelay * 2^(attempt-1)
    const exponentialDelay = baseDelayMs * Math.pow(2, attempt - 1);

    // Cap at maxDelayMs
    const cappedDelay = Math.min(exponentialDelay, maxDelayMs);

    // Add jitter: random factor between 0.5 and 1.5
    if (jitter) {
      const jitterFactor = 0.5 + Math.random();
      return Math.round(cappedDelay * jitterFactor);
    }

    return cappedDelay;
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
