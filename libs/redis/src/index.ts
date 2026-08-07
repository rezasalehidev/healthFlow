export { RedisModule } from './redis.module';
export { RedisService } from './redis.service';
export { CacheService, doctorProfileCacheKey } from './cache.service';
export type { CacheAsideOptions } from './cache.service';
export { DistributedLockService, appointmentSlotLockKey } from './distributed-lock.service';
export type { LockHandle } from './distributed-lock.service';
