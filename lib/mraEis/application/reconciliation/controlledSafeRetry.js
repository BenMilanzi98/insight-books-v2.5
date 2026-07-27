/**
 * Phase 15 — controlled safe retry.
 * Same Transmission + Snapshot + fiscal number; new append-only Attempt via Phase 13 orchestrator.
 */

import prisma from '@/lib/prisma.js';
import {
  RETRY_AUTHORIZATION_STATE,
  RECONCILIATION_CASE_STATUS,
  TRANSMISSION_STATUS,
} from '../../domain/operationalEnums.js';
import { transmitFiscalSnapshotOnline } from '../salesTransmission/transmissionOrchestrator.js';
import { verifyFiscalSnapshotIntegrity } from '../fiscalSnapshot/snapshotOrchestrator.js';
import { ReconciliationErrors } from './reconciliationErrors.js';
import { getCircuitBreakerState } from './circuitBreaker.js';

export async function evaluateSafeRetryAuthorization({
  reconciliationId,
  transmissionId,
  proposedAttemptNumber = null,
  actorOrServiceContext = null,
  db = prisma,
} = {}) {
  void actorOrServiceContext;
  const auth = await db.mraEisRetryAuthorization.findFirst({
    where: {
      reconciliationId,
      transmissionId,
      ...(proposedAttemptNumber != null ? { proposedAttemptNumber } : {}),
      authorizationState: {
        in: [RETRY_AUTHORIZATION_STATE.AUTHORIZED, RETRY_AUTHORIZATION_STATE.APPROVAL_PENDING],
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  const blockers = [];
  if (!auth) {
    return {
      allowed: false,
      blockers: ['RETRY_AUTHORIZATION_MISSING'],
      policyVersion: null,
    };
  }

  const transmission = await db.mraEisTransmission.findFirst({
    where: {
      id: transmissionId,
      tenantId: auth.tenantId,
      businessId: auth.businessId,
    },
  });

  if (!transmission) blockers.push('TRANSMISSION_NOT_FOUND');
  if (
    transmission &&
    ['ACCEPTED_ONLINE', 'ACCEPTED_OFFLINE', 'RECONCILED_ACCEPTED'].includes(transmission.status)
  ) {
    blockers.push('TRANSMISSION_ACCEPTED');
  }
  if (transmission?.status === 'REJECTED') blockers.push('TRANSMISSION_REJECTED_NON_RETRYABLE');
  if (transmission?.shouldBlockTerminal || transmission?.status === 'BLOCKED') {
    blockers.push('TERMINAL_BLOCKED');
  }
  if (auth.authorizationState === RETRY_AUTHORIZATION_STATE.APPROVAL_PENDING) {
    blockers.push('APPROVAL_REQUIRED');
  }
  if (auth.expiresAt && new Date(auth.expiresAt) < new Date()) {
    blockers.push('RETRY_WINDOW_EXPIRED');
  }
  if (auth.earliestRetryAt && new Date(auth.earliestRetryAt) > new Date()) {
    blockers.push('RETRY_NOT_YET_ELIGIBLE');
  }
  if (auth.authorizationState === RETRY_AUTHORIZATION_STATE.CONSUMED) {
    blockers.push('AUTHORIZATION_CONSUMED');
  }

  const cb = await getCircuitBreakerState({
    tenantId: auth.tenantId,
    businessId: auth.businessId,
    environment: auth.environment,
    db,
  });
  if (cb.state === 'OPEN' || cb.state === 'FORCED_OPEN') {
    blockers.push('CIRCUIT_BREAKER_OPEN');
  }

  return {
    allowed: blockers.length === 0 && auth.authorizationState === RETRY_AUTHORIZATION_STATE.AUTHORIZED,
    policyVersion: auth.retryPolicyVersion,
    reconciliationOutcome: auth.reconciliationOutcome,
    sameSnapshotRequired: true,
    sameFiscalNumberRequired: true,
    approvalRequired: auth.authorizationState === RETRY_AUTHORIZATION_STATE.APPROVAL_PENDING,
    earliestRetryAt: auth.earliestRetryAt,
    authorizationExpiresAt: auth.expiresAt,
    authorizationId: auth.id,
    blockers,
    warnings: [],
  };
}

/**
 * Execute one authorized safe retry — reuses Phase 13 transmit path (same snapshot).
 */
export async function executeControlledSafeRetry({
  authorizationId,
  actorOrServiceContext = null,
  workerId = 'phase15-retry-worker',
  db = prisma,
} = {}) {
  const auth = await db.mraEisRetryAuthorization.findUnique({
    where: { id: authorizationId },
  });
  if (!auth) throw ReconciliationErrors.retryNotAuthorized();

  const evaluation = await evaluateSafeRetryAuthorization({
    reconciliationId: auth.reconciliationId,
    transmissionId: auth.transmissionId,
    proposedAttemptNumber: auth.proposedAttemptNumber,
    actorOrServiceContext,
    db,
  });
  if (!evaluation.allowed) {
    if (evaluation.blockers.includes('RETRY_WINDOW_EXPIRED')) {
      await db.mraEisRetryAuthorization.update({
        where: { id: auth.id },
        data: { authorizationState: RETRY_AUTHORIZATION_STATE.EXPIRED },
      });
      throw ReconciliationErrors.retryAuthExpired({ details: evaluation });
    }
    throw ReconciliationErrors.retryNotAuthorized({ details: evaluation });
  }

  const transmission = await db.mraEisTransmission.findFirst({
    where: {
      id: auth.transmissionId,
      tenantId: auth.tenantId,
      businessId: auth.businessId,
    },
  });
  if (!transmission) throw ReconciliationErrors.retryNotAuthorized();

  const snapshot = await db.mraEisSnapshot.findFirst({
    where: {
      id: transmission.snapshotId,
      tenantId: auth.tenantId,
      businessId: auth.businessId,
    },
  });
  if (!snapshot) throw ReconciliationErrors.localEvidenceInvalid();

  const integrity = await verifyFiscalSnapshotIntegrity(snapshot.id, { db });
  if (integrity.status !== 'VERIFIED') {
    throw ReconciliationErrors.localEvidenceInvalid({
      details: { blockers: ['SNAPSHOT_INTEGRITY_FAILURE'] },
    });
  }

  const fiscalNumber = snapshot.canonicalSnapshot?.fiscalNumber?.formatted;
  if (fiscalNumber !== auth.sameFiscalNumber) {
    throw ReconciliationErrors.localEvidenceInvalid({
      details: { blockers: ['FISCAL_NUMBER_MISMATCH'] },
    });
  }
  if (snapshot.snapshotChecksum !== auth.sameSnapshotChecksum) {
    throw ReconciliationErrors.localEvidenceInvalid({
      details: { blockers: ['SNAPSHOT_CHECKSUM_MISMATCH'] },
    });
  }

  // Consume authorization atomically
  const consumed = await db.mraEisRetryAuthorization.updateMany({
    where: {
      id: auth.id,
      authorizationState: RETRY_AUTHORIZATION_STATE.AUTHORIZED,
      consumedAt: null,
    },
    data: {
      authorizationState: RETRY_AUTHORIZATION_STATE.CONSUMED,
      consumedAt: new Date(),
    },
  });
  if (consumed.count !== 1) {
    throw ReconciliationErrors.retryNotAuthorized({
      details: { blockers: ['AUTHORIZATION_CONSUMED'] },
    });
  }

  await db.mraEisTransmissionReconciliation
    .updateMany({
      where: { id: auth.reconciliationId },
      data: {
        state: RECONCILIATION_CASE_STATUS.RETRY_IN_PROGRESS,
        version: { increment: 1 },
      },
    })
    .catch(() => {});

  // Reset transmission to QUEUED so Phase 13 orchestrator can create a new attempt
  // without cloning the Sale or allocating a new fiscal number.
  await db.mraEisTransmission.update({
    where: { id: transmission.id },
    data: {
      previousStatus: transmission.status,
      status: TRANSMISSION_STATUS.QUEUED,
      nextAttemptAt: null,
      version: { increment: 1 },
    },
  });

  const outcome = await transmitFiscalSnapshotOnline({
    tenantId: auth.tenantId,
    businessId: auth.businessId,
    fiscalSnapshotId: snapshot.id,
    expectedSnapshotChecksum: auth.sameSnapshotChecksum,
    actorOrServiceContext: { serviceId: workerId, ...(actorOrServiceContext || {}) },
    workerId,
    db,
  });

  await db.mraEisTransmissionReconciliation
    .updateMany({
      where: { id: auth.reconciliationId },
      data: {
        state: outcome.accepted
          ? RECONCILIATION_CASE_STATUS.RECOVERED_ACCEPTED
          : RECONCILIATION_CASE_STATUS.COMPLETED,
        completedAt: new Date(),
        version: { increment: 1 },
      },
    })
    .catch(() => {});

  return {
    outcome,
    authorizationId: auth.id,
    sameTransmission: true,
    sameSnapshot: true,
    sameFiscalNumber: true,
    newFiscalNumberAllocated: false,
    saleCloned: false,
    createsJournal: false,
    createsStockMovement: false,
    snapshotMutated: false,
  };
}
