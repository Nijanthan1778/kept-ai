import { setTimeout as sleep } from "node:timers/promises";

export interface RetryPolicy {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  isRetryable: (err: unknown) => boolean;
  /** Server-requested wait (e.g. a Retry-After header), if the error carries one. */
  retryAfterMs?: (err: unknown) => number | undefined;
}

export interface RetryEvent {
  attempt: number;
  delayMs: number;
  err: unknown;
}

/** Exponential backoff (base, 2×base, 4×base…) with ±20% jitter so parallel callers don't retry in sync. */
function backoffDelay(policy: RetryPolicy, attempt: number, err: unknown): number {
  const requested = policy.retryAfterMs?.(err);
  const exponential = policy.baseDelayMs * 2 ** (attempt - 1) * (0.8 + Math.random() * 0.4);
  return Math.min(requested ?? exponential, policy.maxDelayMs);
}

/** Calls `fn`, retrying retryable failures; rethrows the last error once attempts run out. */
export async function withRetry<T>(
  fn: () => Promise<T>,
  policy: RetryPolicy,
  onRetry?: (event: RetryEvent) => void,
): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt >= policy.maxAttempts || !policy.isRetryable(err)) throw err;
      const delayMs = Math.round(backoffDelay(policy, attempt, err));
      onRetry?.({ attempt, delayMs, err });
      await sleep(delayMs);
    }
  }
}
