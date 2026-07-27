/**
 * Phase 18 — Permission-aware global EIS search (Tenant-isolated).
 */

import { AdminErrors } from './adminErrors.js';

const RATE = new Map();

export function __resetSearchRateForTests() {
  RATE.clear();
}

function assertRateLimit(actorId, limit = 60, windowMs = 60_000) {
  const key = actorId || 'anon';
  const now = Date.now();
  const bucket = RATE.get(key) || [];
  const recent = bucket.filter((t) => now - t < windowMs);
  if (recent.length >= limit) {
    throw AdminErrors.searchAuth({
      message: 'Search rate limit exceeded.',
      httpStatus: 429,
    });
  }
  recent.push(now);
  RATE.set(key, recent);
}

/**
 * Search across provided in-scope records only (caller loads Tenant-scoped data).
 */
export function searchEisEntities({
  context,
  query,
  records = [],
  maxResults = 25,
} = {}) {
  if (!context?.tenantId && !context?.isPlatformAdmin) {
    throw AdminErrors.searchAuth();
  }
  assertRateLimit(context.actorId);

  const q = String(query || '').trim().toLowerCase();
  if (!q || q.length < 2) {
    return { results: [], query: q, tenantIsolated: true };
  }

  const results = [];
  for (const r of records) {
    if (r.tenantId && context.tenantId && r.tenantId !== context.tenantId && !context.isPlatformAdmin) {
      continue; // never leak foreign tenant
    }
    if (
      r.businessId &&
      context.businessId &&
      r.businessId !== context.businessId &&
      !context.isPlatformAdmin
    ) {
      continue;
    }
    if (r.environment && context.environment && r.environment !== context.environment) {
      // environment-aware: skip mismatch unless platform browsing intentionally all
      if (!context.isPlatformAdmin) continue;
    }

    const hay = [
      r.type,
      r.id,
      r.terminalId,
      r.fiscalNumber,
      r.mraTransactionId,
      r.localTransactionNumber,
      r.correlationId,
      r.label,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    if (!hay.includes(q)) continue;

    results.push({
      type: r.type,
      id: r.id,
      label: r.label || r.id,
      environment: r.environment,
      href: r.href || null,
      // never include secrets
      redacted: true,
    });
    if (results.length >= maxResults) break;
  }

  return {
    results,
    query: q,
    tenantIsolated: true,
    businessIsolated: true,
    credentialsIndexed: false,
    foreignTenantResultCountHidden: true,
    resultCount: results.length,
  };
}
