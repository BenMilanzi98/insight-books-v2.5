/**
 * Phase 15 — Transmission reconciliation orchestrator.
 * Default: RECONCILE FIRST — DO NOT RETRY unknown outcomes.
 */

import prisma from '@/lib/prisma.js';
import {
  RECONCILIATION_CASE_STATUS,
  RECONCILIATION_OUTCOME,
  TRANSMISSION_STATUS,
  EIS_OUTBOX_EVENT,
  RETRY_AUTHORIZATION_STATE,
} from '../../domain/operationalEnums.js';
import { appendEisOutboxEvent } from '../../infrastructure/outbox/outboxService.js';
import { loadLocalReconciliationEvidence } from './localEvidence.js';
import { isDefinitelyNotSent } from './dispatchCertainty.js';
import {
  resolveLastTransactionContract,
  LAST_TX_ENDPOINT_TYPE,
} from './lastTransactionContractRegistry.js';
import { queryLastOnlineTransaction } from './lastTransactionClient.js';
import {
  compareLocalAndMraEvidence,
  normalizeMraReconciliationEvidence,
} from './localMraComparator.js';
import {
  evaluateRetryPolicyDecision,
  RETRY_POLICY_VERSION,
  computeBackoffDelayMs,
} from './retryPolicyRegistry.js';
import { classifyRejectedRemediation } from './rejectedRemediationRegistry.js';
import { getCircuitBreakerState, recordCircuitFailure, recordCircuitSuccess } from './circuitBreaker.js';
import { ReconciliationErrors } from './reconciliationErrors.js';
import { recoverMissingPhase14Event, recoverMissingFiscalReceipt } from './missingEvidenceRecovery.js';
import { emitMraEisTransactionAccepted } from '@/lib/admin/productAnalytics/producers.js';

async function transition(db, caseRow, nextState, extra = {}) {
  return db.mraEisTransmissionReconciliation.update({
    where: { id: caseRow.id, version: caseRow.version },
    data: {
      previousState: caseRow.state,
      state: nextState,
      version: { increment: 1 },
      ...extra,
    },
  });
}

/**
 * Create or reuse reconciliation case and run evidence-driven reconciliation.
 */
export async function reconcileTransmissionOutcome({
  tenantId,
  businessId,
  transmissionId,
  triggeringAttemptId = null,
  reasonCode = 'UNKNOWN_OUTCOME',
  correlationId = null,
  workerId = 'phase15-recon-worker',
  actorOrServiceContext = null,
  db = prisma,
} = {}) {
  const local = await loadLocalReconciliationEvidence({
    tenantId,
    businessId,
    transmissionId,
    triggeringAttemptId,
    db,
  });

  const env = local.transmission.environment || 'SANDBOX';
  const mode = local.transmission.mode || 'MOCK';
  const attemptId = local.triggeringAttempt?.id;
  if (!attemptId) {
    throw ReconciliationErrors.localEvidenceInvalid({ message: 'No triggering attempt' });
  }

  // Idempotent case
  let caseRow = await db.mraEisTransmissionReconciliation.findFirst({
    where: {
      tenantId,
      businessId,
      transmissionId,
      triggeringAttemptId: attemptId,
      reasonCode,
      environment: env,
    },
  });

  if (
    caseRow &&
    [
      RECONCILIATION_CASE_STATUS.RECOVERED_ACCEPTED,
      RECONCILIATION_CASE_STATUS.RECOVERED_REJECTED,
      RECONCILIATION_CASE_STATUS.COMPLETED,
      RECONCILIATION_CASE_STATUS.ACCEPTED_CONFIRMED,
      RECONCILIATION_CASE_STATUS.REJECTED_CONFIRMED,
    ].includes(caseRow.state)
  ) {
    return { case: caseRow, duplicate: true, mraSalesCalled: false };
  }

  if (!caseRow) {
    try {
      caseRow = await db.mraEisTransmissionReconciliation.create({
        data: {
          tenantId,
          businessId,
          branchId: local.snapshot?.branchId || null,
          terminalId: local.transmission.terminalId,
          transmissionId,
          triggeringAttemptId: attemptId,
          fiscalSnapshotId: local.snapshot?.id || null,
          fiscalNumberAssignmentId: local.snapshot?.fiscalNumberAllocationId || null,
          fiscalNumber: local.evidence.fiscalNumber,
          environment: env,
          reasonCode,
          state: RECONCILIATION_CASE_STATUS.CREATED,
          retryPolicyVersion: RETRY_POLICY_VERSION,
          localEvidenceChecksum: local.localEvidenceChecksum,
          localEvidenceJson: local.evidence,
          dispatchCertainty: local.dispatch.certainty,
          correlationId,
          createdBy: actorOrServiceContext?.serviceId || actorOrServiceContext?.userId || workerId,
          claimOwner: workerId,
          claimExpiresAt: new Date(Date.now() + 5 * 60 * 1000),
        },
      });
    } catch {
      caseRow = await db.mraEisTransmissionReconciliation.findFirst({
        where: {
          tenantId,
          businessId,
          transmissionId,
          triggeringAttemptId: attemptId,
          reasonCode,
          environment: env,
        },
      });
      if (!caseRow) throw ReconciliationErrors.idempotencyConflict();
    }
  }

  // Mark transmission reconciling
  await db.mraEisTransmission
    .updateMany({
      where: {
        id: transmissionId,
        tenantId,
        businessId,
        status: {
          in: [
            TRANSMISSION_STATUS.UNKNOWN_OUTCOME,
            TRANSMISSION_STATUS.RECONCILIATION_QUEUED,
            TRANSMISSION_STATUS.RETRY_SCHEDULED,
          ],
        },
      },
      data: {
        previousStatus: local.transmission.status,
        status: TRANSMISSION_STATUS.RECONCILING,
        version: { increment: 1 },
      },
    })
    .catch(() => {});

  caseRow = await transition(db, caseRow, RECONCILIATION_CASE_STATUS.VALIDATING_LOCAL_EVIDENCE, {
    localEvidenceChecksum: local.localEvidenceChecksum,
    localEvidenceJson: local.evidence,
    dispatchCertainty: local.dispatch.certainty,
  });

  if (!local.valid) {
    caseRow = await transition(db, caseRow, RECONCILIATION_CASE_STATUS.LOCAL_EVIDENCE_INVALID, {
      safeStatusSummary: local.blockers.join(','),
      completedAt: new Date(),
    });
    await db.mraEisTransmission
      .updateMany({
        where: { id: transmissionId, tenantId, businessId },
        data: { status: TRANSMISSION_STATUS.MANUAL_REVIEW, version: { increment: 1 } },
      })
      .catch(() => {});
    throw ReconciliationErrors.localEvidenceInvalid({ details: { blockers: local.blockers } });
  }

  // Definitely not sent without needing MRA (pre-dispatch)
  if (isDefinitelyNotSent(local.dispatch.certainty)) {
    caseRow = await transition(db, caseRow, RECONCILIATION_CASE_STATUS.DEFINITELY_NOT_PROCESSED, {
      matchOutcome: RECONCILIATION_OUTCOME.DEFINITELY_NOT_PROCESSED,
      matchConfidence: 'CONCLUSIVE_MATCH',
      safeStatusSummary: 'Dispatch certainty proves request was not sent',
    });
    return finalizeRetryEligibility({
      caseRow,
      local,
      outcome: RECONCILIATION_OUTCOME.DEFINITELY_NOT_PROCESSED,
      tenantId,
      businessId,
      env,
      mode,
      workerId,
      db,
    });
  }

  const contractResult = resolveLastTransactionContract({
    endpointType: LAST_TX_ENDPOINT_TYPE.LAST_ONLINE_TRANSACTION,
    environment: env,
    mode,
  });

  if (!contractResult.allowsQuery) {
    caseRow = await transition(db, caseRow, RECONCILIATION_CASE_STATUS.RECONCILIATION_CONTRACT_PENDING, {
      reconciliationContractVersion: contractResult.contract.contractVersion,
      matchOutcome: RECONCILIATION_OUTCOME.CONTRACT_MISMATCH,
      safeStatusSummary: 'Last Online contract blocked — no production query',
    });
    caseRow = await transition(db, caseRow, RECONCILIATION_CASE_STATUS.STILL_UNKNOWN, {
      matchOutcome: RECONCILIATION_OUTCOME.STILL_UNKNOWN,
      completedAt: null,
    });
    await db.mraEisTransmission
      .updateMany({
        where: { id: transmissionId, tenantId, businessId },
        data: { status: TRANSMISSION_STATUS.MANUAL_REVIEW, version: { increment: 1 } },
      })
      .catch(() => {});
    return {
      case: caseRow,
      outcome: RECONCILIATION_OUTCOME.CONTRACT_MISMATCH,
      mraQueried: false,
      retryAllowed: false,
    };
  }

  const cb = await getCircuitBreakerState({
    tenantId,
    businessId,
    environment: env,
    db,
  });
  if (cb.state === 'OPEN' || cb.state === 'FORCED_OPEN') {
    throw ReconciliationErrors.circuitOpen({ details: { state: cb.state } });
  }

  caseRow = await transition(db, caseRow, RECONCILIATION_CASE_STATUS.READY_TO_QUERY_MRA, {
    reconciliationContractVersion: contractResult.contract.contractVersion,
  });
  caseRow = await transition(db, caseRow, RECONCILIATION_CASE_STATUS.QUERYING_MRA);

  const queryAttemptNumber = (caseRow.currentQueryAttempt || 0) + 1;
  const queryRow = await db.mraEisReconciliationQueryAttempt.create({
    data: {
      tenantId,
      businessId,
      reconciliationId: caseRow.id,
      terminalId: local.transmission.terminalId,
      environment: env,
      endpointType: LAST_TX_ENDPOINT_TYPE.LAST_ONLINE_TRANSACTION,
      endpointContractVersion: contractResult.contract.contractVersion,
      queryAttemptNumber,
      state: 'DISPATCHING',
      dispatchStartedAt: new Date(),
      workerId,
      correlationId,
    },
  });

  let queryResult;
  try {
    queryResult = await queryLastOnlineTransaction({
      environment: env,
      mode,
      terminalId: local.transmission.terminalId,
      fiscalNumber: local.evidence.fiscalNumber,
      expectedLocal: {
        fiscalNumber: local.evidence.fiscalNumber,
        sellerTin: local.evidence.snapshot?.sellerTin,
        currency: local.evidence.snapshot?.currency,
        grossTotal: local.evidence.snapshot?.grossTotal,
        taxTotal: local.evidence.snapshot?.taxTotal,
        levyTotal: local.evidence.snapshot?.levyTotal,
        localDocumentNumber: local.evidence.snapshot?.localDocumentNumber,
        transactionDate: local.evidence.snapshot?.transactionDate,
        siteMappingId: local.evidence.Site?.siteMappingId,
      },
    });
  } catch (err) {
    await db.mraEisReconciliationQueryAttempt.update({
      where: { id: queryRow.id },
      data: {
        state: 'TEMPORARY_FAILURE',
        safeErrorCode: err.code || 'QUERY_FAILED',
        safeErrorSummary: String(err.message || '').slice(0, 240),
        completedAt: new Date(),
      },
    });
    await recordCircuitFailure({ tenantId, businessId, environment: env, db }).catch(() => {});
    caseRow = await transition(db, caseRow, RECONCILIATION_CASE_STATUS.STILL_UNKNOWN, {
      currentQueryAttempt: queryAttemptNumber,
      matchOutcome: RECONCILIATION_OUTCOME.STILL_UNKNOWN,
      safeStatusSummary: 'MRA query failed — still unknown; no retry',
    });
    throw err;
  }

  if (!queryResult.ok) {
    await db.mraEisReconciliationQueryAttempt.update({
      where: { id: queryRow.id },
      data: {
        state: 'TEMPORARY_FAILURE',
        httpStatus: queryResult.httpResult?.httpStatus,
        safeErrorCode: queryResult.httpResult?.errorKind || 'QUERY_TEMP_FAILURE',
        completedAt: new Date(),
      },
    });
    await recordCircuitFailure({ tenantId, businessId, environment: env, db }).catch(() => {});
    caseRow = await transition(db, caseRow, RECONCILIATION_CASE_STATUS.STILL_UNKNOWN, {
      currentQueryAttempt: queryAttemptNumber,
      matchOutcome: RECONCILIATION_OUTCOME.STILL_UNKNOWN,
    });
    return { case: caseRow, outcome: RECONCILIATION_OUTCOME.STILL_UNKNOWN, retryAllowed: false };
  }

  await recordCircuitSuccess({ tenantId, businessId, environment: env, db }).catch(() => {});

  const mraEvidence = normalizeMraReconciliationEvidence({
    endpointType: LAST_TX_ENDPOINT_TYPE.LAST_ONLINE_TRANSACTION,
    contractVersion: contractResult.contract.contractVersion,
    environment: env,
    body: queryResult.httpResult.body,
    responseChecksum: queryResult.responseChecksum,
    terminalId: local.transmission.terminalId,
  });

  await db.mraEisReconciliationQueryAttempt.update({
    where: { id: queryRow.id },
    data: {
      state: 'COMPLETED',
      httpStatus: queryResult.httpResult.httpStatus,
      responseChecksum: queryResult.responseChecksum,
      responseSchemaVersion: '1',
      outcome: mraEvidence.applicationStatus || (mraEvidence.noTransactionReturned ? 'NO_TRANSACTION' : 'OK'),
      sanitizedResponse: {
        fiscalNumber: mraEvidence.fiscalNumber,
        mraTransactionId: mraEvidence.mraTransactionId,
        applicationStatus: mraEvidence.applicationStatus,
        noTransactionReturned: mraEvidence.noTransactionReturned,
        // no credentials
      },
      responseReceivedAt: new Date(),
      completedAt: new Date(),
    },
  });

  caseRow = await transition(db, caseRow, RECONCILIATION_CASE_STATUS.MRA_RESPONSE_RECEIVED, {
    currentQueryAttempt: queryAttemptNumber,
    mraEvidenceChecksum: queryResult.responseChecksum,
    mraEvidenceJson: mraEvidence,
  });
  caseRow = await transition(db, caseRow, RECONCILIATION_CASE_STATUS.COMPARING);

  const comparison = compareLocalAndMraEvidence({
    localEvidence: local.evidence,
    mraEvidence,
    contract: contractResult.contract,
  });

  return applyReconciliationOutcome({
    caseRow,
    local,
    mraEvidence,
    comparison,
    tenantId,
    businessId,
    env,
    mode,
    workerId,
    correlationId,
    db,
  });
}

async function applyReconciliationOutcome({
  caseRow,
  local,
  mraEvidence,
  comparison,
  tenantId,
  businessId,
  env,
  mode,
  workerId,
  correlationId,
  db,
}) {
  const outcome = comparison.outcome;
  const transmissionId = local.transmission.id;

  const stateByOutcome = {
    [RECONCILIATION_OUTCOME.ACCEPTED_CONFIRMED]: RECONCILIATION_CASE_STATUS.ACCEPTED_CONFIRMED,
    [RECONCILIATION_OUTCOME.DUPLICATE_ACCEPTED_CONFIRMED]: RECONCILIATION_CASE_STATUS.DUPLICATE_CONFIRMED,
    [RECONCILIATION_OUTCOME.REJECTED_CONFIRMED]: RECONCILIATION_CASE_STATUS.REJECTED_CONFIRMED,
    [RECONCILIATION_OUTCOME.DEFINITELY_NOT_PROCESSED]: RECONCILIATION_CASE_STATUS.DEFINITELY_NOT_PROCESSED,
    [RECONCILIATION_OUTCOME.MRA_AHEAD]: RECONCILIATION_CASE_STATUS.MRA_AHEAD,
    [RECONCILIATION_OUTCOME.LOCAL_AHEAD]: RECONCILIATION_CASE_STATUS.LOCAL_AHEAD,
    [RECONCILIATION_OUTCOME.TERMINAL_BLOCKED]: RECONCILIATION_CASE_STATUS.TERMINAL_BLOCKED,
    [RECONCILIATION_OUTCOME.CONFIGURATION_REFRESH_REQUIRED]:
      RECONCILIATION_CASE_STATUS.CONFIGURATION_REFRESH_REQUIRED,
    [RECONCILIATION_OUTCOME.EVIDENCE_CONFLICT]: RECONCILIATION_CASE_STATUS.MANUAL_REVIEW,
    [RECONCILIATION_OUTCOME.DUPLICATE_WITHOUT_ACCEPTANCE_PROOF]: RECONCILIATION_CASE_STATUS.MANUAL_REVIEW,
    [RECONCILIATION_OUTCOME.TARGET_NOT_RETURNED]: RECONCILIATION_CASE_STATUS.STILL_UNKNOWN,
    [RECONCILIATION_OUTCOME.RESPONSE_WINDOW_INSUFFICIENT]: RECONCILIATION_CASE_STATUS.STILL_UNKNOWN,
    [RECONCILIATION_OUTCOME.STILL_UNKNOWN]: RECONCILIATION_CASE_STATUS.STILL_UNKNOWN,
    [RECONCILIATION_OUTCOME.MANUAL_REVIEW_REQUIRED]: RECONCILIATION_CASE_STATUS.MANUAL_REVIEW,
  };

  caseRow = await transition(db, caseRow, stateByOutcome[outcome] || RECONCILIATION_CASE_STATUS.STILL_UNKNOWN, {
    matchOutcome: outcome,
    matchConfidence: comparison.confidence,
    comparisonSummary: {
      fields: comparison.fields,
      mismatches: comparison.mismatches,
      comparatorVersion: comparison.comparatorVersion,
    },
    safeStatusSummary: `Outcome ${outcome} confidence ${comparison.confidence}`,
  });

  // Acceptance recovery — no new Sale request
  if (
    outcome === RECONCILIATION_OUTCOME.ACCEPTED_CONFIRMED ||
    outcome === RECONCILIATION_OUTCOME.DUPLICATE_ACCEPTED_CONFIRMED
  ) {
    const reconciledAt = local.transmission.acceptedAt || new Date();
    await db.mraEisTransmission.update({
      where: { id: transmissionId },
      data: {
        previousStatus: local.transmission.status,
        status: TRANSMISSION_STATUS.RECONCILED_ACCEPTED,
        acceptedAt: reconciledAt,
        validationUrl: mraEvidence.validationUrl || local.transmission.validationUrl,
        mraApplicationStatus: mraEvidence.applicationStatus,
        version: { increment: 1 },
      },
    });

    // Product Analytics (Phase 9): first accept via reconciliation recovery (idempotent on transmissionId)
    try {
      await emitMraEisTransactionAccepted(db, {
        tenantId,
        transmissionId,
        accepted: true,
        isRetry: false,
        isReprint: false,
        snapshotId: local.snapshot?.id || local.transmission.snapshotId || null,
        outcome: TRANSMISSION_STATUS.RECONCILED_ACCEPTED,
        occurredAt: reconciledAt,
      });
    } catch (analyticsErr) {
      console.warn('[productAnalytics] MRA reconciled-accepted emit failed:', analyticsErr?.message);
    }

    caseRow = await transition(db, caseRow, RECONCILIATION_CASE_STATUS.RECOVERED_ACCEPTED, {
      completedAt: new Date(),
      claimOwner: null,
      claimExpiresAt: null,
    });

    await recoverMissingPhase14Event({
      tenantId,
      businessId,
      transmissionId,
      attemptId: local.triggeringAttempt.id,
      snapshot: local.snapshot,
      mraEvidence,
      responseChecksum: caseRow.mraEvidenceChecksum,
      correlationId,
      db,
    });

    await recoverMissingFiscalReceipt({
      tenantId,
      businessId,
      transmissionId,
      db,
    });

    return {
      case: caseRow,
      outcome,
      confidence: comparison.confidence,
      mraSalesCalled: false,
      saleResubmitted: false,
      fiscalNumberChanged: false,
      snapshotMutated: false,
      createsJournal: false,
      createsStockMovement: false,
      retryAllowed: false,
    };
  }

  if (outcome === RECONCILIATION_OUTCOME.REJECTED_CONFIRMED) {
    const remediation = classifyRejectedRemediation({
      responseCode: mraEvidence.applicationStatus,
    });
    await db.mraEisTransmission.update({
      where: { id: transmissionId },
      data: {
        previousStatus: local.transmission.status,
        status: TRANSMISSION_STATUS.REJECTED,
        rejectedAt: new Date(),
        mraApplicationStatus: mraEvidence.applicationStatus,
        safeErrorSummary: remediation.class,
        version: { increment: 1 },
      },
    });
    caseRow = await transition(db, caseRow, RECONCILIATION_CASE_STATUS.RECOVERED_REJECTED, {
      completedAt: new Date(),
      comparisonSummary: {
        ...(caseRow.comparisonSummary || {}),
        remediation,
      },
      claimOwner: null,
      claimExpiresAt: null,
    });
    return {
      case: caseRow,
      outcome,
      remediation,
      retryAllowed: false,
      accountingReversed: false,
      inventoryReversed: false,
      mraSalesCalled: false,
    };
  }

  if (outcome === RECONCILIATION_OUTCOME.TERMINAL_BLOCKED) {
    await db.mraEisTransmission.updateMany({
      where: { id: transmissionId, tenantId, businessId },
      data: { status: TRANSMISSION_STATUS.BLOCKED, shouldBlockTerminal: true, version: { increment: 1 } },
    });
    await db.mraEisTerminal
      .updateMany({
        where: { id: local.transmission.terminalId, tenantId, businessId },
        data: { status: 'BLOCKED', blockedAt: new Date() },
      })
      .catch(() => {});
    return { case: caseRow, outcome, retryAllowed: false, terminalBlocked: true };
  }

  if (outcome === RECONCILIATION_OUTCOME.DEFINITELY_NOT_PROCESSED) {
    return finalizeRetryEligibility({
      caseRow,
      local,
      outcome,
      tenantId,
      businessId,
      env,
      mode,
      workerId,
      db,
    });
  }

  if (outcome === RECONCILIATION_OUTCOME.MRA_AHEAD) {
    await db.mraEisTransmission.updateMany({
      where: { id: transmissionId, tenantId, businessId },
      data: { status: TRANSMISSION_STATUS.MANUAL_REVIEW, version: { increment: 1 } },
    });
    return { case: caseRow, outcome, retryAllowed: false, pauseTerminalRecommended: true };
  }

  // STILL_UNKNOWN / TARGET_NOT_RETURNED / window insufficient — NO RETRY
  await db.mraEisTransmission.updateMany({
    where: { id: transmissionId, tenantId, businessId },
    data: {
      status: TRANSMISSION_STATUS.UNKNOWN_OUTCOME,
      unknownOutcomeAt: new Date(),
      version: { increment: 1 },
    },
  }).catch(() => {});

  caseRow = await transition(db, caseRow, RECONCILIATION_CASE_STATUS.STILL_UNKNOWN, {
    claimOwner: null,
    claimExpiresAt: null,
    safeStatusSummary:
      'Still unknown — absence from latest Last Online response is not conclusive. No retry.',
  });

  return {
    case: caseRow,
    outcome: RECONCILIATION_OUTCOME.STILL_UNKNOWN,
    retryAllowed: false,
    mraSalesCalled: false,
  };
}

async function finalizeRetryEligibility({
  caseRow,
  local,
  outcome,
  tenantId,
  businessId,
  env,
  mode,
  workerId,
  db,
}) {
  const cb = await getCircuitBreakerState({ tenantId, businessId, environment: env, db });
  const policy = evaluateRetryPolicyDecision({
    transmissionStatus: local.transmission.status,
    reconciliationOutcome: outcome,
    dispatchCertainty: local.dispatch.certainty,
    terminalBlocked: false,
    configurationReady: true,
    credentialsReady: true,
    circuitBreakerState: cb.state,
    attemptCount: local.transmission.attemptCount || 0,
    environment: env,
    mode,
  });

  if (!policy.allowed) {
    caseRow = await transition(db, caseRow, RECONCILIATION_CASE_STATUS.MANUAL_REVIEW, {
      safeStatusSummary: `Retry not allowed: ${(policy.blockers || []).join(',')}`,
      claimOwner: null,
      claimExpiresAt: null,
    });
    return { case: caseRow, outcome, retryAllowed: false, policy };
  }

  const proposedAttemptNumber = (local.transmission.attemptCount || 0) + 1;
  const earliestRetryAt = new Date(
    Date.now() + computeBackoffDelayMs({ attemptNumber: proposedAttemptNumber })
  );
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  let auth = await db.mraEisRetryAuthorization.findFirst({
    where: {
      transmissionId: local.transmission.id,
      reconciliationId: caseRow.id,
      proposedAttemptNumber,
    },
  });

  if (!auth) {
    auth = await db.mraEisRetryAuthorization.create({
      data: {
        tenantId,
        businessId,
        reconciliationId: caseRow.id,
        transmissionId: local.transmission.id,
        triggeringAttemptId: local.triggeringAttempt.id,
        proposedAttemptNumber,
        retryPolicyVersion: RETRY_POLICY_VERSION,
        reconciliationOutcome: outcome,
        authorizationState:
          policy.decision === 'RETRY_ALLOWED_WITH_APPROVAL'
            ? RETRY_AUTHORIZATION_STATE.APPROVAL_PENDING
            : RETRY_AUTHORIZATION_STATE.AUTHORIZED,
        authorizedAt: new Date(),
        authorizedBy: workerId,
        expiresAt,
        earliestRetryAt,
        sameSnapshotChecksum: local.snapshot.snapshotChecksum,
        sameFiscalNumber: local.evidence.fiscalNumber,
        terminalId: local.transmission.terminalId,
        environment: env,
        reason: outcome,
      },
    });
  }

  caseRow = await transition(
    db,
    caseRow,
    auth.authorizationState === RETRY_AUTHORIZATION_STATE.APPROVAL_PENDING
      ? RECONCILIATION_CASE_STATUS.RETRY_AUTHORIZATION_PENDING
      : RECONCILIATION_CASE_STATUS.RETRY_ELIGIBLE,
    {
      retryAuthorizationId: auth.id,
      nextEligibleActionAt: earliestRetryAt,
      claimOwner: null,
      claimExpiresAt: null,
    }
  );

  if (auth.authorizationState === RETRY_AUTHORIZATION_STATE.AUTHORIZED) {
    caseRow = await transition(db, caseRow, RECONCILIATION_CASE_STATUS.RETRY_SCHEDULED, {
      nextEligibleActionAt: earliestRetryAt,
    });
    await db.mraEisTransmission.updateMany({
      where: { id: local.transmission.id, tenantId, businessId },
      data: {
        status: TRANSMISSION_STATUS.RETRY_SCHEDULED,
        nextAttemptAt: earliestRetryAt,
        version: { increment: 1 },
      },
    });
  }

  return {
    case: caseRow,
    outcome,
    retryAllowed: auth.authorizationState === RETRY_AUTHORIZATION_STATE.AUTHORIZED,
    authorization: auth,
    policy,
    sameSnapshot: true,
    sameFiscalNumber: true,
    mraSalesCalled: false,
  };
}
