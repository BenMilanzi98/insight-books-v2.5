/**
 * Central timeout policy (ms) — Phase 17.
 * Align reverse-proxy timeouts above the largest synchronous API timeout.
 */

export const TIMEOUTS_MS = Object.freeze({
  HTTP_API: 30_000,
  HTTP_REPORT: 60_000,
  HTTP_EXPORT_SYNC: 90_000,
  DB_ACQUIRE: 5_000,
  DB_QUERY: 30_000,
  EXTERNAL_HTTP: 10_000,
  WEBHOOK_ACK: 5_000,
  JOB_DEFAULT: 300_000,
  JOB_FORECAST: 600_000,
  JOB_EXPORT: 900_000,
  AI_CALL: 45_000,
  HEALTH_DB_PING: 2_000,
});

export function withTimeout(promise, ms, label = 'operation') {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const err = new Error(`Timeout after ${ms}ms: ${label}`);
      err.code = 'TIMEOUT';
      err.retryable = true;
      reject(err);
    }, ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}
