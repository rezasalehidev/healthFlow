import {
  nextRetryAttempt,
  retryDelayMs,
  retryQueueForAttempt,
  shouldDeadLetter,
} from './retry.policy';
import { MAX_RETRY_ATTEMPTS, QUEUES, RETRY_DELAYS_MS } from './topology';

describe('retry policy', () => {
  it('increments attempts and routes to DLQ after max', () => {
    expect(nextRetryAttempt(0)).toBe(1);
    expect(shouldDeadLetter(2, MAX_RETRY_ATTEMPTS)).toBe(false);
    expect(shouldDeadLetter(3, MAX_RETRY_ATTEMPTS)).toBe(true);
  });

  it('uses exponential-ish delay schedule', () => {
    expect(retryDelayMs(1, RETRY_DELAYS_MS)).toBe(5_000);
    expect(retryDelayMs(2, RETRY_DELAYS_MS)).toBe(30_000);
    expect(retryDelayMs(3, RETRY_DELAYS_MS)).toBe(120_000);
    expect(retryDelayMs(99, RETRY_DELAYS_MS)).toBe(120_000);
  });

  it('selects the correct TTL retry queue', () => {
    const queues = {
      s5: QUEUES.notificationsRetry5s,
      s30: QUEUES.notificationsRetry30s,
      s120: QUEUES.notificationsRetry120s,
    };
    expect(retryQueueForAttempt(1, queues)).toBe(QUEUES.notificationsRetry5s);
    expect(retryQueueForAttempt(2, queues)).toBe(QUEUES.notificationsRetry30s);
    expect(retryQueueForAttempt(3, queues)).toBe(QUEUES.notificationsRetry120s);
  });
});
