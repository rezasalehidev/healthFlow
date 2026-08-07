import { InMemoryIdempotencyStore } from './idempotency.store';

describe('InMemoryIdempotencyStore', () => {
  it('claims a key only once within TTL', () => {
    const store = new InMemoryIdempotencyStore(60_000);
    expect(store.tryClaim('evt-1')).toBe(true);
    expect(store.tryClaim('evt-1')).toBe(false);
  });

  it('allows reclaim after TTL expiry', () => {
    const store = new InMemoryIdempotencyStore(1_000);
    const t0 = 1_000_000;
    expect(store.tryClaim('evt-2', t0)).toBe(true);
    expect(store.tryClaim('evt-2', t0 + 2_000)).toBe(true);
  });
});
