import { Global, Module } from '@nestjs/common';
import { CacheService } from './cache.service';
import { DistributedLockService } from './distributed-lock.service';
import { RedisService } from './redis.service';

@Global()
@Module({
  providers: [RedisService, CacheService, DistributedLockService],
  exports: [RedisService, CacheService, DistributedLockService],
})
export class RedisModule {}
