/**
 * In-memory sliding window rate limiter (per process).
 * Suitable for single-node / pilot; replace with Redis for multi-node.
 */

const buckets = new Map();

/**
 * @returns {{ allowed: boolean, remaining: number, retryAfterSec: number }}
 */
export function checkRateLimit(key, { limit = 20, windowMs = 60_000 } = {}) {
  const now = Date.now();
  const bucket = buckets.get(key) || { hits: [] };
  bucket.hits = bucket.hits.filter((t) => now - t < windowMs);
  if (bucket.hits.length >= limit) {
    const oldest = bucket.hits[0];
    const retryAfterSec = Math.max(1, Math.ceil((windowMs - (now - oldest)) / 1000));
    buckets.set(key, bucket);
    return { allowed: false, remaining: 0, retryAfterSec };
  }
  bucket.hits.push(now);
  buckets.set(key, bucket);
  return { allowed: true, remaining: limit - bucket.hits.length, retryAfterSec: 0 };
}

/** Test helper */
export function _resetRateLimits() {
  buckets.clear();
}
