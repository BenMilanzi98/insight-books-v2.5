/**
 * Per-business concurrency / cost budgets (noisy-neighbour protection).
 * In-memory; multi-node requires shared store (documented).
 */

import { checkRateLimit } from '../securityGovernance/domain/rateLimit.js';

/** Workload class → default limits (requests per window). */
export const TENANT_QUOTAS = Object.freeze({
  FINANCIAL_WRITE: { limit: 120, windowMs: 60_000 },
  REPORT: { limit: 30, windowMs: 60_000 },
  EXPORT: { limit: 10, windowMs: 60_000 },
  IMPORT: { limit: 6, windowMs: 60_000 },
  FORECAST: { limit: 8, windowMs: 60_000 },
  LOAN_READINESS: { limit: 8, windowMs: 60_000 },
  AI: { limit: 10, windowMs: 60_000 },
  WEBHOOK: { limit: 200, windowMs: 60_000 },
});

/**
 * @returns {{ allowed: boolean, remaining: number, retryAfterSec: number, class: string }}
 */
export function checkTenantQuota(businessId, workloadClass = 'REPORT') {
  if (!businessId) {
    return { allowed: false, remaining: 0, retryAfterSec: 60, class: workloadClass, reason: 'MISSING_BUSINESS' };
  }
  const quota = TENANT_QUOTAS[workloadClass] || TENANT_QUOTAS.REPORT;
  const key = `tenant:${businessId}:${workloadClass}`;
  const result = checkRateLimit(key, quota);
  return { ...result, class: workloadClass };
}

/** In-flight concurrency slots per business+class. */
const inflight = new Map();

export function acquireTenantSlot(businessId, workloadClass = 'REPORT', maxConcurrent = 3) {
  if (!businessId) return { acquired: false, reason: 'MISSING_BUSINESS' };
  const key = `${businessId}:${workloadClass}`;
  const n = inflight.get(key) || 0;
  if (n >= maxConcurrent) {
    return { acquired: false, reason: 'TENANT_CONCURRENCY', current: n, maxConcurrent };
  }
  inflight.set(key, n + 1);
  return { acquired: true, current: n + 1, maxConcurrent };
}

export function releaseTenantSlot(businessId, workloadClass = 'REPORT') {
  const key = `${businessId}:${workloadClass}`;
  const n = inflight.get(key) || 0;
  if (n <= 1) inflight.delete(key);
  else inflight.set(key, n - 1);
}

export function _resetTenantFairness() {
  inflight.clear();
}
