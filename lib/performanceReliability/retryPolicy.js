/**
 * Bounded retry policy — coordinates with accounting idempotency.
 */

export const RETRYABLE_CODES = new Set([
  'P2034', // write conflict
  'P2024', // pool timeout
  '40P01', // deadlock
  '40001', // serialization
  'TIMEOUT',
  'ECONNRESET',
  'ETIMEDOUT',
]);

export const NON_RETRYABLE_CODES = new Set([
  'VALIDATION',
  'PERMISSION_DENIED',
  'CROSS_BUSINESS',
  'CLOSED_PERIOD',
  'IDEMPOTENCY_CONFLICT',
  'UNBALANCED_JOURNAL',
  'APPROVAL_DENIED',
  'SOD_VIOLATION',
]);

export function isRetryableError(err) {
  if (!err) return false;
  const code = err.code || err.meta?.code || err.name;
  if (NON_RETRYABLE_CODES.has(code)) return false;
  if (RETRYABLE_CODES.has(code)) return true;
  const msg = String(err.message || '');
  if (/deadlock|serialization|timeout|connection/i.test(msg)) return true;
  return false;
}

/**
 * @param {() => Promise<T>} fn
 * @param {{ maxAttempts?: number, baseDelayMs?: number, label?: string }} opts
 */
export async function withBoundedRetry(fn, opts = {}) {
  const maxAttempts = opts.maxAttempts ?? 3;
  const baseDelayMs = opts.baseDelayMs ?? 50;
  let lastErr;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn(attempt);
    } catch (err) {
      lastErr = err;
      if (!isRetryableError(err) || attempt === maxAttempts) throw err;
      const jitter = Math.floor(Math.random() * baseDelayMs);
      await sleep(baseDelayMs * attempt + jitter);
    }
  }
  throw lastErr;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
