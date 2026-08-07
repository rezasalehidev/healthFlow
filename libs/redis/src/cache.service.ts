import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from './redis.service';

export interface CacheAsideOptions {
  /** Redis key */
  key: string;
  /** TTL in seconds */
  ttlSeconds: number;
}

/**
 * Cache-aside (lazy loading) helper.
 * On miss: loader() → SET with TTL. Caller invalidates on writes.
 */
@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);

  constructor(private readonly redis: RedisService) {}

  async getJson<T>(key: string): Promise<T | null> {
    try {
      const raw = await this.redis.client.get(key);
      if (!raw) {
        return null;
      }
      return JSON.parse(raw) as T;
    } catch (error: unknown) {
      this.logger.warn({
        message: 'Cache get failed — treating as miss',
        key,
        error: error instanceof Error ? error.message : error,
      });
      return null;
    }
  }

  async setJson(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    try {
      await this.redis.client.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    } catch (error: unknown) {
      this.logger.warn({
        message: 'Cache set failed — continuing without cache',
        key,
        error: error instanceof Error ? error.message : error,
      });
    }
  }

  async del(key: string): Promise<void> {
    try {
      await this.redis.client.del(key);
    } catch (error: unknown) {
      this.logger.warn({
        message: 'Cache delete failed',
        key,
        error: error instanceof Error ? error.message : error,
      });
    }
  }

  /**
   * Cache-aside read: return cached value or load, store, and return.
   */
  async getOrSet<T>(options: CacheAsideOptions, loader: () => Promise<T>): Promise<T> {
    const cached = await this.getJson<T>(options.key);
    if (cached !== null) {
      return cached;
    }

    const value = await loader();
    await this.setJson(options.key, value, options.ttlSeconds);
    return value;
  }
}

export function doctorProfileCacheKey(doctorId: string): string {
  return `doctor:profile:${doctorId}`;
}
