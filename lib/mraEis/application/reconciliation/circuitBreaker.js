/**
 * Phase 15 — per-tenant/environment circuit breaker.
 * Probes must never use accepted or unknown-outcome Sales.
 */

import prisma from '@/lib/prisma.js';
import { CIRCUIT_BREAKER_STATE } from '../../domain/operationalEnums.js';

const FAILURE_THRESHOLD = 5;
const COOLDOWN_MS = 60_000;
const SUCCESS_THRESHOLD = 2;

export async function getCircuitBreakerState({
  tenantId,
  businessId,
  environment,
  scopeKey = 'default',
  endpointGroup = 'SALES',
  db = prisma,
} = {}) {
  const row = await db.mraEisCircuitBreaker
    .findUnique({
      where: {
        tenantId_businessId_scopeKey_environment_endpointGroup: {
          tenantId,
          businessId,
          scopeKey,
          environment,
          endpointGroup,
        },
      },
    })
    .catch(() => null);

  if (!row) {
    return { state: CIRCUIT_BREAKER_STATE.CLOSED, row: null };
  }

  if (
    row.state === CIRCUIT_BREAKER_STATE.OPEN &&
    row.nextProbeAt &&
    new Date(row.nextProbeAt) <= new Date()
  ) {
    const updated = await db.mraEisCircuitBreaker.update({
      where: { id: row.id },
      data: {
        state: CIRCUIT_BREAKER_STATE.HALF_OPEN,
        halfOpenedAt: new Date(),
        version: { increment: 1 },
      },
    });
    return { state: updated.state, row: updated };
  }

  return { state: row.state, row };
}

export async function recordCircuitFailure({
  tenantId,
  businessId,
  environment,
  scopeKey = 'default',
  endpointGroup = 'SALES',
  db = prisma,
} = {}) {
  const existing = await getCircuitBreakerState({
    tenantId,
    businessId,
    environment,
    scopeKey,
    endpointGroup,
    db,
  });

  if (!existing.row) {
    const created = await db.mraEisCircuitBreaker.create({
      data: {
        tenantId,
        businessId,
        scopeKey,
        environment,
        endpointGroup,
        state: CIRCUIT_BREAKER_STATE.CLOSED,
        failureCount: 1,
        lastFailureAt: new Date(),
      },
    });
    return created;
  }

  const failureCount = (existing.row.failureCount || 0) + 1;
  const open = failureCount >= FAILURE_THRESHOLD;
  return db.mraEisCircuitBreaker.update({
    where: { id: existing.row.id },
    data: {
      failureCount,
      lastFailureAt: new Date(),
      state: open ? CIRCUIT_BREAKER_STATE.OPEN : existing.row.state,
      openedAt: open ? new Date() : existing.row.openedAt,
      nextProbeAt: open ? new Date(Date.now() + COOLDOWN_MS) : existing.row.nextProbeAt,
      version: { increment: 1 },
    },
  });
}

export async function recordCircuitSuccess({
  tenantId,
  businessId,
  environment,
  scopeKey = 'default',
  endpointGroup = 'SALES',
  db = prisma,
} = {}) {
  const existing = await getCircuitBreakerState({
    tenantId,
    businessId,
    environment,
    scopeKey,
    endpointGroup,
    db,
  });
  if (!existing.row) return null;

  const successCount = (existing.row.successCount || 0) + 1;
  const close =
    existing.row.state === CIRCUIT_BREAKER_STATE.HALF_OPEN &&
    successCount >= SUCCESS_THRESHOLD;

  return db.mraEisCircuitBreaker.update({
    where: { id: existing.row.id },
    data: {
      successCount: close ? 0 : successCount,
      failureCount: close ? 0 : existing.row.failureCount,
      lastSuccessAt: new Date(),
      state: close ? CIRCUIT_BREAKER_STATE.CLOSED : existing.row.state,
      version: { increment: 1 },
    },
  });
}

export function getCircuitBreakerProbePolicy() {
  return {
    acceptedSalesForbidden: true,
    unknownOutcomesForbidden: true,
    rejectedSalesForbidden: true,
    syntheticProductionSaleForbidden: true,
    preferNonTransactionalPing: true,
    offlineModeNeverAutoEnabled: true,
    liveProbeBlockedUntilVerified: true,
  };
}

export function isSalesProbeForbidden() {
  return true;
}

/** Safe probe = non-transactional mock ping only; never accepted/unknown Sales. */
export async function runSafeCircuitProbe({
  tenantId,
  businessId,
  environment,
  mode = 'MOCK',
  db = prisma,
} = {}) {
  const { state } = await getCircuitBreakerState({
    tenantId,
    businessId,
    environment,
    db,
  });
  if (state !== CIRCUIT_BREAKER_STATE.HALF_OPEN && state !== CIRCUIT_BREAKER_STATE.PROBING) {
    return { probed: false, reason: 'NOT_HALF_OPEN', state };
  }

  // Non-transactional availability signal for mock only
  if (mode === 'MOCK' || process.env.MRA_EIS_USE_MOCK === '1') {
    await recordCircuitSuccess({ tenantId, businessId, environment, db });
    return {
      probed: true,
      ok: true,
      usedSalesTransaction: false,
      usedAcceptedSale: false,
      usedUnknownSale: false,
    };
  }

  return {
    probed: false,
    reason: 'LIVE_PROBE_BLOCKED',
    usedSalesTransaction: false,
  };
}
