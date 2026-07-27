/**
 * In-process rate limiter for activation-sensitive endpoints.
 * Suitable for single-node / mock; production should use shared store.
 */

const buckets = new Map();

function keyOf(parts) {
  return parts.filter(Boolean).join(':');
}

/**
 * @returns {{ allowed: boolean, remaining: number, retryAfterMs: number }}
 */
export function checkActivationRateLimit({
  action,
  tenantId,
  businessId,
  userId,
  terminalId,
  ip,
  limit = 20,
  windowMs = 60_000,
}) {
  const key = keyOf(['p7', action, tenantId, businessId, userId, terminalId, ip]);
  const now = Date.now();
  let bucket = buckets.get(key);
  if (!bucket || now - bucket.windowStart >= windowMs) {
    bucket = { windowStart: now, count: 0 };
  }
  bucket.count += 1;
  buckets.set(key, bucket);
  const allowed = bucket.count <= limit;
  return {
    allowed,
    remaining: Math.max(0, limit - bucket.count),
    retryAfterMs: allowed ? 0 : windowMs - (now - bucket.windowStart),
  };
}

export function resetActivationRateLimitsForTests() {
  buckets.clear();
}
