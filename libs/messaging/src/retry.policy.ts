/**
 * Pure retry policy helpers — easy to unit test without RabbitMQ.
 */
export function nextRetryAttempt(current: number): number {
  return current + 1;
}

export function shouldDeadLetter(retryCount: number, maxAttempts: number): boolean {
  return retryCount >= maxAttempts;
}

export function retryDelayMs(retryCount: number, delays: readonly number[]): number {
  const index = Math.max(0, Math.min(retryCount - 1, delays.length - 1));
  return delays[index] ?? delays[delays.length - 1] ?? 5_000;
}

export function retryQueueForAttempt(
  retryCount: number,
  queues: { s5: string; s30: string; s120: string },
): string {
  if (retryCount <= 1) return queues.s5;
  if (retryCount === 2) return queues.s30;
  return queues.s120;
}
