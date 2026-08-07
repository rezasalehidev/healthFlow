import { CacheService } from './cache.service';
import type { RedisService } from './redis.service';

describe('CacheService', () => {
  const store = new Map<string, string>();
  const get = jest.fn((key: string) => Promise.resolve(store.get(key) ?? null));
  const set = jest.fn((key: string, value: string, _mode: string, _ttl: number) => {
    store.set(key, value);
    return Promise.resolve('OK');
  });
  const del = jest.fn((key: string) => {
    store.delete(key);
    return Promise.resolve(1);
  });

  const redis = {
    client: { get, set, del },
  } as unknown as RedisService;

  const cache = new CacheService(redis);

  beforeEach(() => {
    store.clear();
    jest.clearAllMocks();
  });

  it('returns cached value on hit without calling loader', async () => {
    store.set('doctor:profile:1', JSON.stringify({ id: '1', name: 'cached' }));
    const loader = jest.fn();

    const result = await cache.getOrSet({ key: 'doctor:profile:1', ttlSeconds: 60 }, loader);

    expect(result).toEqual({ id: '1', name: 'cached' });
    expect(loader).not.toHaveBeenCalled();
  });

  it('loads, stores, and returns on miss', async () => {
    const loader = jest.fn().mockResolvedValue({ id: '2', name: 'fresh' });

    const result = await cache.getOrSet({ key: 'doctor:profile:2', ttlSeconds: 120 }, loader);

    expect(result).toEqual({ id: '2', name: 'fresh' });
    expect(loader).toHaveBeenCalledTimes(1);
    expect(set).toHaveBeenCalledWith(
      'doctor:profile:2',
      JSON.stringify({ id: '2', name: 'fresh' }),
      'EX',
      120,
    );
  });

  it('invalidates keys via del', async () => {
    store.set('doctor:profile:3', '{"id":"3"}');
    await cache.del('doctor:profile:3');
    expect(store.has('doctor:profile:3')).toBe(false);
  });

  it('treats get failures as cache miss', async () => {
    get.mockRejectedValueOnce(new Error('redis down'));
    const loader = jest.fn().mockResolvedValue({ id: '4' });

    const result = await cache.getOrSet({ key: 'k', ttlSeconds: 10 }, loader);
    expect(result).toEqual({ id: '4' });
    expect(loader).toHaveBeenCalled();
  });
});
