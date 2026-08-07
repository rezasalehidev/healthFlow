/**
 * In-memory idempotency store for consumers.
 * Production can swap for Redis SET NX with TTL.
 */
export class InMemoryIdempotencyStore {
  private readonly seen = new Map<string, number>();

  constructor(private readonly ttlMs = 24 * 60 * 60 * 1000) {}

  /** @returns true if this is the first time seeing the key */
  tryClaim(key: string, now = Date.now()): boolean {
    this.evictExpired(now);
    if (this.seen.has(key)) {
      return false;
    }
    this.seen.set(key, now + this.ttlMs);
    return true;
  }

  has(key: string, now = Date.now()): boolean {
    this.evictExpired(now);
    return this.seen.has(key);
  }

  size(): number {
    return this.seen.size;
  }

  private evictExpired(now: number): void {
    for (const [key, expiresAt] of this.seen.entries()) {
      if (expiresAt <= now) {
        this.seen.delete(key);
      }
    }
  }
}
