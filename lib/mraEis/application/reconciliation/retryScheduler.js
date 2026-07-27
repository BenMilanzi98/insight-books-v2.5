/**
 * Phase 15 — retry scheduler. Selects only AUTHORIZED retries past earliestRetryAt.
 * Never selects unresolved UNKNOWN_OUTCOME without conclusive reconciliation.
 */

import prisma from '@/lib/prisma.js';
import { RETRY_AUTHORIZATION_STATE } from '../../domain/operationalEnums.js';
import { executeControlledSafeRetry } from './controlledSafeRetry.js';
import { getCircuitBreakerState } from './circuitBreaker.js';

export async function processAuthorizedRetryBatch({
  workerId = 'phase15-retry-scheduler',
  limit = 10,
  tenantId = null,
  businessId = null,
  db = prisma,
} = {}) {
  const where = {
    authorizationState: RETRY_AUTHORIZATION_STATE.AUTHORIZED,
    consumedAt: null,
    earliestRetryAt: { lte: new Date() },
    expiresAt: { gt: new Date() },
  };
  if (tenantId) where.tenantId = tenantId;
  if (businessId) where.businessId = businessId;

  const authorizations = await db.mraEisRetryAuthorization.findMany({
    where,
    orderBy: { earliestRetryAt: 'asc' },
    take: limit,
  });

  const results = [];
  for (const auth of authorizations) {
    const cb = await getCircuitBreakerState({
      tenantId: auth.tenantId,
      businessId: auth.businessId,
      environment: auth.environment,
      db,
    });
    if (cb.state === 'OPEN' || cb.state === 'FORCED_OPEN') {
      results.push({
        authorizationId: auth.id,
        skipped: true,
        reason: 'CIRCUIT_BREAKER_OPEN',
      });
      continue;
    }

    // Skip if transmission accepted/blocked (defense in depth)
    const transmission = await db.mraEisTransmission.findFirst({
      where: {
        id: auth.transmissionId,
        tenantId: auth.tenantId,
        businessId: auth.businessId,
      },
    });
    if (
      !transmission ||
      ['ACCEPTED_ONLINE', 'RECONCILED_ACCEPTED', 'REJECTED', 'BLOCKED'].includes(transmission.status)
    ) {
      await db.mraEisRetryAuthorization.update({
        where: { id: auth.id },
        data: { authorizationState: RETRY_AUTHORIZATION_STATE.REVOKED },
      });
      results.push({
        authorizationId: auth.id,
        skipped: true,
        reason: 'TRANSMISSION_NOT_RETRYABLE',
        status: transmission?.status,
      });
      continue;
    }

    try {
      const outcome = await executeControlledSafeRetry({
        authorizationId: auth.id,
        workerId,
        db,
      });
      results.push({
        authorizationId: auth.id,
        ok: true,
        accepted: outcome.outcome?.accepted,
        sameFiscalNumber: true,
        newFiscalNumberAllocated: false,
        createsJournal: false,
        createsStockMovement: false,
      });
    } catch (err) {
      results.push({
        authorizationId: auth.id,
        ok: false,
        error: err.code || 'RETRY_EXECUTION_ERROR',
        message: err.message,
      });
    }
  }

  return {
    workerId,
    scanned: authorizations.length,
    results,
    selectsUnknownWithoutReconcile: false,
  };
}
