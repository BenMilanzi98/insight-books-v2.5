/**
 * Phase 18 — Rebuildable operational read models (not financial source of truth).
 */

import { FRESHNESS } from './statusDesignSystem.js';

const PROJECTIONS = new Map();

export function __resetReadModelsForTests() {
  PROJECTIONS.clear();
}

function key({ tenantId, businessId, environment, name }) {
  return `${name}:${tenantId || 'platform'}:${businessId || '-'}:${environment || 'SANDBOX'}`;
}

export function upsertReadModel({
  name,
  tenantId,
  businessId = null,
  environment = 'SANDBOX',
  payload = {},
  version = 1,
} = {}) {
  const k = key({ tenantId, businessId, environment, name });
  const row = {
    name,
    tenantId,
    businessId,
    environment,
    payload,
    version,
    financialSourceOfTruth: false,
    updatedAt: new Date().toISOString(),
    rebuildable: true,
  };
  PROJECTIONS.set(k, row);
  return row;
}

export function getReadModel({ name, tenantId, businessId = null, environment = 'SANDBOX', maxAgeMs = 30 * 60_000 } = {}) {
  const k = key({ tenantId, businessId, environment, name });
  const row = PROJECTIONS.get(k);
  if (!row) {
    return {
      found: false,
      freshness: FRESHNESS.UNAVAILABLE,
      financialSourceOfTruth: false,
    };
  }
  const age = Date.now() - new Date(row.updatedAt).getTime();
  let freshness = FRESHNESS.CURRENT;
  if (age > maxAgeMs) freshness = FRESHNESS.STALE;
  else if (age < 30_000) freshness = FRESHNESS.LIVE;
  return { found: true, freshness, ...row };
}

export function rebuildReadModel({ name, tenantId, businessId, environment, builder }) {
  const payload = typeof builder === 'function' ? builder() : builder;
  return upsertReadModel({
    name,
    tenantId,
    businessId,
    environment,
    payload,
    version: (getReadModel({ name, tenantId, businessId, environment }).version || 0) + 1,
  });
}

export function invalidateTenantReadModels({ tenantId }) {
  for (const [k, v] of PROJECTIONS.entries()) {
    if (v.tenantId === tenantId) PROJECTIONS.delete(k);
  }
}
