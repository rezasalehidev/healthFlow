import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { RedisService } from './redis.service';

export interface LockHandle {
  key: string;
  token: string;
}

/**
 * Redis SET NX EX distributed lock.
 * Token-based release prevents deleting another holder's lock after expiry.
 */
@Injectable()
export class DistributedLockService {
  private readonly logger = new Logger(DistributedLockService.name);

  constructor(private readonly redis: RedisService) {}

  async acquire(key: string, ttlSeconds: number): Promise<LockHandle | null> {
    const token = randomUUID();
    try {
      const result = await this.redis.client.set(key, token, 'EX', ttlSeconds, 'NX');
      if (result !== 'OK') {
        return null;
      }
      return { key, token };
    } catch (error: unknown) {
      this.logger.error({
        message: 'Failed to acquire lock',
        key,
        error: error instanceof Error ? error.message : error,
      });
      throw error;
    }
  }

  async release(handle: LockHandle): Promise<boolean> {
    const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;
    try {
      const result = await this.redis.client.eval(script, 1, handle.key, handle.token);
      return result === 1;
    } catch (error: unknown) {
      this.logger.warn({
        message: 'Failed to release lock',
        key: handle.key,
        error: error instanceof Error ? error.message : error,
      });
      return false;
    }
  }

  async withLock<T>(
    key: string,
    ttlSeconds: number,
    fn: () => Promise<T>,
  ): Promise<{ acquired: false; result?: undefined } | { acquired: true; result: T }> {
    const handle = await this.acquire(key, ttlSeconds);
    if (!handle) {
      return { acquired: false };
    }
    try {
      const result = await fn();
      return { acquired: true, result };
    } finally {
      await this.release(handle);
    }
  }
}

export function appointmentSlotLockKey(doctorId: string, startsAtIso: string): string {
  return `lock:appointment:${doctorId}:${startsAtIso}`;
}
