/** In-memory sliding window for anonymous mobile telemetry (best-effort; resets on cold start). */
const WINDOW_MS = 60 * 60 * 1000;
const MAX_POSTS_PER_WINDOW = 120;

/** @type {Map<string, { resetAt: number, count: number }>} */
const buckets = new Map();

export function telemetryRateLimitKey(clientIp, deviceId) {
  const ip = String(clientIp || 'unknown').slice(0, 64);
  const dev = String(deviceId || '').trim().slice(0, 128);
  return `${ip}|${dev}`;
}

/**
 * @param {string} key
 * @returns {boolean}
 */
export function allowTelemetryPost(key) {
  const now = Date.now();
  let b = buckets.get(key);
  if (!b || now > b.resetAt) {
    b = { resetAt: now + WINDOW_MS, count: 0 };
    buckets.set(key, b);
  }
  b.count += 1;
  return b.count <= MAX_POSTS_PER_WINDOW;
}
