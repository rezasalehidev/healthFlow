import { DistributedLockService } from './distributed-lock.service';
import type { RedisService } from './redis.service';

describe('DistributedLockService', () => {
  const store = new Map<string, string>();
  const set = jest.fn((key: string, value: string, _ex: string, _ttl: number, nx?: string) => {
    if (nx === 'NX' && store.has(key)) {
      return Promise.resolve(null);
    }
    store.set(key, value);
    return Promise.resolve('OK');
  });
  const evalScript = jest.fn((_script: string, _num: number, key: string, token: string) => {
    if (store.get(key) === token) {
      store.delete(key);
      return Promise.resolve(1);
    }
    return Promise.resolve(0);
  });

  const redis = {
    client: { set, eval: evalScript },
  } as unknown as RedisService;

  const locks = new DistributedLockService(redis);

  beforeEach(() => {
    store.clear();
    jest.clearAllMocks();
  });

  it('acquires exclusive lock with NX', async () => {
    const first = await locks.acquire('lock:a', 5);
    const second = await locks.acquire('lock:a', 5);

    expect(first).not.toBeNull();
    expect(second).toBeNull();
  });

  it('releases only with matching token', async () => {
    const handle = await locks.acquire('lock:b', 5);
    expect(handle).not.toBeNull();

    const released = await locks.release(handle!);
    expect(released).toBe(true);

    const again = await locks.acquire('lock:b', 5);
    expect(again).not.toBeNull();
  });

  it('withLock runs critical section when acquired', async () => {
    const outcome = await locks.withLock('lock:c', 5, () => Promise.resolve(42));
    expect(outcome).toEqual({ acquired: true, result: 42 });
  });

  it('withLock reports not acquired when lock held', async () => {
    store.set('lock:d', 'other');
    const outcome = await locks.withLock('lock:d', 5, () => Promise.resolve(1));
    expect(outcome).toEqual({ acquired: false });
  });
});
