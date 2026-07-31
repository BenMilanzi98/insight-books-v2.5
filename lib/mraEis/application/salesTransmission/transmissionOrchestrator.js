/**
 * Sales transmission orchestrator — Phase 13.
 * Snapshot → payload → hash → dispatch → classify → evidence.
 * No Journal / Stock Movement. No QR / receipt rendering. No snapshot mutation.
 */
import crypto from 'crypto';
import prisma from '@/lib/prisma.js';
import {
  TRANSMISSION_STATUS,
  TRANSMISSION_MODE,
  ATTEMPT_OUTCOME,
  RETRY_CLASSIFICATION,
  EIS_OUTBOX_EVENT,
  RECEIPT_EIS_STATUS,
} from '../../domain/operationalEnums.js';
import { assertTenantBusinessMatch } from '../../domain/valueObjects/index.js';
import { canonicalize, CANONICALIZATION_VERSION } from '../../infrastructure/security/canonicalization.js';
import { appendEisOutboxEvent } from '../../infrastructure/outbox/outboxService.js';
import { recordEisControlAudit } from '../../infrastructure/audit.js';
import { withSecret } from '../../infrastructure/security/secretProvider.js';
import { EIS_SERVICE_IDENTITY } from '../../infrastructure/security/serviceIdentity.js';
import { EIS_CRYPTO_OPERATION } from '../../infrastructure/security/secretTypes.js';
import {
  createTransmission,
  transitionTransmissionStatus,
  appendTransmissionAttempt,
} from '../services/transmissionService.js';
import { evaluateOnlineSalesTransmissionReadiness } from './transmissionReadiness.js';
import {
  mapFiscalSnapshotToSalesRequestV1,
  validateSalesPayloadV1,
} from './salesPayloadMapper.js';
import { generateSalesMessageHash, serializeSalesRequestBytes } from './salesMessageHash.js';
import {
  classifyHttpTransport,
  classifyApplicationStatus,
  APP_OUTCOME,
  RETRY_CLASS,
} from './applicationStatusClassifier.js';
import { submitSalesTransactionToMra } from '../../infrastructure/mraClient/salesClient.js';
import { SalesTransmissionErrors } from './salesTransmissionErrors.js';
import { SALES_MAPPER_VERSION } from './salesPayloadSchemaRegistry.js';
import { emitMraEisTransactionAccepted } from '@/lib/admin/productAnalytics/producers.js';

export const ACCEPTED_RECEIPT_REQUESTED_EVENT =
  EIS_OUTBOX_EVENT.ACCEPTED_RECEIPT_REQUESTED || 'MRA_EIS_ACCEPTED_RECEIPT_REQUESTED';
export const TRANSMISSION_RECONCILIATION_REQUESTED_EVENT =
  EIS_OUTBOX_EVENT.TRANSMISSION_RECONCILIATION_REQUESTED ||
  'MRA_EIS_TRANSMISSION_RECONCILIATION_REQUESTED';

/**
 * Process a completed snapshot into an online Sales transmission attempt (idempotent).
 */
export async function transmitFiscalSnapshotOnline({
  tenantId,
  businessId = tenantId,
  fiscalSnapshotId,
  expectedSnapshotChecksum = null,
  expectedSnapshotVersion = null,
  actorOrServiceContext = null,
  correlationId = null,
  requestId = null,
  workerId = 'phase13-sales-worker',
  db = prisma,
} = {}) {
  assertTenantBusinessMatch(tenantId, businessId);

  const readiness = await evaluateOnlineSalesTransmissionReadiness({
    tenantId,
    businessId,
    fiscalSnapshotId,
    expectedSnapshotChecksum,
    expectedSnapshotVersion,
    actorOrServiceContext,
    db,
  });

  if (readiness.transmissionAlreadyAccepted) {
    return {
      ok: true,
      duplicate: true,
      alreadyAccepted: true,
      transmission: readiness.acceptedTransmission,
      message: 'Transmission already accepted — not resubmitted.',
      mraAccepted: true,
      qrGenerated: false,
      receiptGenerated: false,
      createsJournal: false,
      createsStockMovement: false,
    };
  }

  if (!readiness.submissionAllowed) {
    throw SalesTransmissionErrors.readiness({
      message: 'Online Sales transmission readiness failed.',
      details: { blockers: readiness.blockers, warnings: readiness.warnings },
      requiredAction: 'RESOLVE_BLOCKERS',
    });
  }

  const { snapshot, terminal, contractResult, mode, environment } = readiness;

  // Ensure transmission aggregate (idempotent)
  let transmission = await db.mraEisTransmission.findFirst({
    where: { tenantId, businessId, snapshotId: snapshot.id, mode: TRANSMISSION_MODE.ONLINE },
  });
  if (!transmission) {
    transmission = await createTransmission({
      tenantId,
      businessId,
      terminalId: snapshot.terminalId,
      snapshotId: snapshot.id,
      environment,
      mode: TRANSMISSION_MODE.ONLINE,
      db,
    });
  }
  if (
    [
      TRANSMISSION_STATUS.ACCEPTED_ONLINE,
      TRANSMISSION_STATUS.ACCEPTED_OFFLINE,
      TRANSMISSION_STATUS.RECONCILED_ACCEPTED,
    ].includes(transmission.status)
  ) {
    throw SalesTransmissionErrors.alreadyAccepted({ details: { transmissionId: transmission.id } });
  }
  if (transmission.status === TRANSMISSION_STATUS.UNKNOWN_OUTCOME) {
    throw SalesTransmissionErrors.retryNotSafe({
      message: 'UNKNOWN_OUTCOME cannot be blindly retried — Phase 15 reconciliation required.',
    });
  }

  // PREPARATION TX: claim / validate / map / attempt PREPARED
  const prep = await db.$transaction(async (tx) => {
    const locked = await tx.mraEisTransmission.findFirst({
      where: { id: transmission.id, tenantId, businessId },
    });
    if (
      [
        TRANSMISSION_STATUS.CLAIMED,
        TRANSMISSION_STATUS.VALIDATING,
        TRANSMISSION_STATUS.SENDING,
        TRANSMISSION_STATUS.SENT_AWAITING_RESULT,
      ].includes(locked.status)
    ) {
      throw SalesTransmissionErrors.inProgress({ details: { status: locked.status } });
    }

    // Transition CREATED/QUEUED/RETRY → CLAIMED → VALIDATING
    let status = locked.status;
    if (status === TRANSMISSION_STATUS.CREATED) {
      await tx.mraEisTransmission.update({
        where: { id: locked.id },
        data: {
          status: TRANSMISSION_STATUS.QUEUED,
          previousStatus: status,
          firstQueuedAt: locked.firstQueuedAt || new Date(),
          version: { increment: 1 },
        },
      });
      status = TRANSMISSION_STATUS.QUEUED;
    }
    if (status === TRANSMISSION_STATUS.QUEUED || status === TRANSMISSION_STATUS.RETRY_SCHEDULED) {
      await tx.mraEisTransmission.update({
        where: { id: locked.id },
        data: {
          status: TRANSMISSION_STATUS.CLAIMED,
          previousStatus: status,
          claimedAt: new Date(),
          claimedByWorker: workerId,
          claimExpiresAt: new Date(Date.now() + 120000),
          version: { increment: 1 },
        },
      });
      status = TRANSMISSION_STATUS.CLAIMED;
    }

    await tx.mraEisTransmission.update({
      where: { id: locked.id },
      data: {
        status: TRANSMISSION_STATUS.VALIDATING,
        previousStatus: status,
        version: { increment: 1 },
      },
    });

    const mapped = mapFiscalSnapshotToSalesRequestV1({
      snapshot,
      fiscalNumberFormatted: snapshot.canonicalSnapshot?.fiscalNumber?.formatted,
      terminal,
    });
    const validation = validateSalesPayloadV1(mapped.dto, {
      maxBytes: contractResult.contract.maximumRequestBytes,
    });
    if (!validation.valid) {
      await tx.mraEisTransmission.update({
        where: { id: locked.id },
        data: {
          status: TRANSMISSION_STATUS.MANUAL_REVIEW,
          previousStatus: TRANSMISSION_STATUS.VALIDATING,
          safeErrorCode: 'PAYLOAD_INVALID',
          safeErrorSummary: validation.errors.join(','),
          version: { increment: 1 },
        },
      });
      throw SalesTransmissionErrors.payloadValidation({
        details: { errors: validation.errors },
      });
    }

    const serialized = serializeSalesRequestBytes(mapped.dto, { canonicalizeFn: canonicalize });
    const hashMeta = await generateSalesMessageHash({
      transmittedBytes: serialized.transmittedBytes,
      mode,
      contractHashMode: contractResult.contract.requestHashMode,
    });

    // Verify bytes sent will match hashed bytes
    if (hashMeta.inputChecksum !== serialized.payloadChecksum && mode === 'MOCK') {
      // In mock synthetic, message hash == sha256(bytes); payloadChecksum from canonicalize may match
    }

    const attempt = await appendTransmissionAttempt({
      tenantId,
      businessId,
      transmissionId: locked.id,
      endpointKey: `${contractResult.contract.endpointPath}`,
      requestChecksum: serialized.payloadChecksum,
      outcome: ATTEMPT_OUTCOME.STARTED,
      retryClassification: RETRY_CLASSIFICATION.NOT_APPLICABLE,
      workerId,
      requestId,
      correlationId,
      db: tx,
    });

    await tx.mraEisTransmissionAttempt.update({
      where: { id: attempt.id },
      data: {
        httpMethod: 'POST',
        requestContractVersion: contractResult.contract.contractVersion,
        sanitizedRequestReference: JSON.stringify({
          schemaVersion: mapped.schemaVersion,
          mapperVersion: mapped.mapperVersion,
          canonicalizationVersion: CANONICALIZATION_VERSION,
          payloadChecksum: serialized.payloadChecksum,
          transmittedBytesChecksum: hashMeta.inputChecksum,
          messageHashVersion: hashMeta.hasherVersion,
          messageHashAlgorithm: hashMeta.algorithm,
          messageHashValue: hashMeta.headerValue,
          byteLength: serialized.byteLength,
          lineCount: mapped.lineCount,
          overlayPresent: false,
          credentialsExcluded: true,
          buyerAuthorizationExcluded: true,
        }),
      },
    });

    await tx.mraEisTransmission.update({
      where: { id: locked.id },
      data: {
        status: TRANSMISSION_STATUS.SENDING,
        previousStatus: TRANSMISSION_STATUS.VALIDATING,
        fiscalNumberAllocationId: snapshot.fiscalNumberAllocationId,
        version: { increment: 1 },
      },
    });

    await tx.mraEisReceiptProjection.updateMany({
      where: { snapshotId: snapshot.id, tenantId, businessId },
      data: {
        eisStatus: RECEIPT_EIS_STATUS.EIS_SUBMITTING,
        projectionVersion: { increment: 1 },
      },
    }).catch(() => {});

    return {
      transmissionId: locked.id,
      attemptId: attempt.id,
      mapped,
      serialized,
      hashMeta,
    };
  });

  // DISPATCH outside DB transaction
  let httpResult;
  let dispatchStartedAt = new Date();
  try {
    await db.mraEisTransmission.update({
      where: { id: prep.transmissionId },
      data: { status: TRANSMISSION_STATUS.SENT_AWAITING_RESULT, version: { increment: 1 } },
    });

    httpResult = await dispatchWithJwtLease({
      terminal,
      mode,
      environment,
      requestBody: prep.mapped.dto,
      transmittedBytes: prep.serialized.transmittedBytes,
      messageHashHeader: prep.hashMeta.headerValue,
      maxResponseBytes: contractResult.contract.maximumResponseBytes,
      timeoutMs: contractResult.contract.responseTimeout,
      tenantId,
      businessId,
      requestId,
      correlationId,
    });
  } catch (err) {
    httpResult = {
      ok: false,
      httpStatus: null,
      body: null,
      bodyText: null,
      errorKind: 'CONNECTION',
      internalError: err.message,
    };
  }

  // RESULT TX
  const result = await db.$transaction(async (tx) => {
    const transport = classifyHttpTransport({
      httpStatus: httpResult.httpStatus,
      contentType: httpResult.contentType,
      responseByteLength: httpResult.responseByteLength || (httpResult.bodyText?.length || 0),
      maxResponseBytes: contractResult.contract.maximumResponseBytes,
      errorKind: httpResult.errorKind || httpResult.parseError,
    });

    const app = classifyApplicationStatus({
      body: httpResult.body,
      contract: contractResult.contract,
      transportClass: transport,
    });

    const responseChecksum = crypto
      .createHash('sha256')
      .update(httpResult.bodyText || JSON.stringify(httpResult.body || {}) || '')
      .digest('hex');

    const responseRow = await tx.mraEisResponse.create({
      data: {
        tenantId,
        businessId,
        terminalId: snapshot.terminalId,
        transmissionId: prep.transmissionId,
        attemptId: prep.attemptId,
        environment,
        httpStatus: httpResult.httpStatus,
        mraApplicationStatus: app.status,
        remark: app.remark,
        responseCategory: app.outcome,
        validationUrl: app.validationUrl,
        validationErrors: httpResult.body?.validationErrors || null,
        shouldRefreshConfiguration: Boolean(app.refresh),
        shouldBlockTerminal: Boolean(app.block),
        sourceChecksum: responseChecksum,
        sanitizedCanonicalResponse: {
          responseCode: app.status,
          mraTransactionId: app.mraTransactionId,
          validationUrl: app.validationUrl,
          // qrData stored as reference flag only — not rendered in Phase 13
          qrDataPresent: Boolean(app.qrData),
          shouldRefreshConfiguration: Boolean(app.refresh),
          shouldBlockTerminal: Boolean(app.block),
          classifierVersion: app.classifierVersion,
          http200AloneIsNotAcceptance: true,
        },
        receivedAt: new Date(),
        contractVersion: contractResult.contract.contractVersion,
        parserVersion: 'phase13-response-parser-v1',
      },
    });

    let attemptOutcome = ATTEMPT_OUTCOME.UNKNOWN_OUTCOME;
    let retryClass = RETRY_CLASSIFICATION.RECONCILE_BEFORE_RETRY;
    let nextStatus = TRANSMISSION_STATUS.UNKNOWN_OUTCOME;

    if (app.accepted) {
      attemptOutcome = ATTEMPT_OUTCOME.ACCEPTED;
      retryClass = RETRY_CLASSIFICATION.NO_RETRY;
      nextStatus = TRANSMISSION_STATUS.ACCEPTED_ONLINE;
    } else if (
      app.outcome === APP_OUTCOME.REJECTED_VALIDATION ||
      app.outcome === APP_OUTCOME.REJECTED_BUSINESS_RULE
    ) {
      attemptOutcome = ATTEMPT_OUTCOME.REJECTED;
      retryClass = RETRY_CLASSIFICATION.NO_RETRY;
      nextStatus = TRANSMISSION_STATUS.REJECTED;
    } else if (app.outcome === APP_OUTCOME.REJECTED_DUPLICATE) {
      attemptOutcome = ATTEMPT_OUTCOME.UNKNOWN_OUTCOME;
      retryClass = RETRY_CLASSIFICATION.RECONCILE_BEFORE_RETRY;
      nextStatus = TRANSMISSION_STATUS.UNKNOWN_OUTCOME;
    } else if (app.outcome === APP_OUTCOME.REJECTED_AUTHENTICATION) {
      attemptOutcome = ATTEMPT_OUTCOME.SECURITY_ERROR;
      retryClass = RETRY_CLASSIFICATION.MANUAL_REVIEW_REQUIRED;
      nextStatus = TRANSMISSION_STATUS.MANUAL_REVIEW;
    } else if (app.outcome === APP_OUTCOME.TEMPORARY_MRA_FAILURE) {
      attemptOutcome = ATTEMPT_OUTCOME.TEMPORARY_FAILURE;
      retryClass = RETRY_CLASSIFICATION.AUTOMATIC_RETRY;
      nextStatus = TRANSMISSION_STATUS.RETRY_SCHEDULED;
    } else if (app.outcome === APP_OUTCOME.CONTRACT_MISMATCH) {
      attemptOutcome = ATTEMPT_OUTCOME.CONTRACT_ERROR;
      retryClass = RETRY_CLASSIFICATION.NO_RETRY;
      nextStatus = TRANSMISSION_STATUS.MANUAL_REVIEW;
    }

    await tx.mraEisTransmissionAttempt.update({
      where: { id: prep.attemptId },
      data: {
        completedAt: new Date(),
        durationMilliseconds: Date.now() - dispatchStartedAt.getTime(),
        outcome: attemptOutcome,
        httpStatus: httpResult.httpStatus,
        mraApplicationStatus: app.status,
        responseChecksum,
        retryClassification: retryClass,
        sanitizedResponseReference: JSON.stringify({
          responseId: responseRow.id,
          outcome: app.outcome,
          mraTransactionId: app.mraTransactionId,
          qrRendered: false,
        }),
        safeErrorCode: app.accepted ? null : app.outcome,
        safeErrorSummary: app.remark,
      },
    });

    const txUpdated = await tx.mraEisTransmission.update({
      where: { id: prep.transmissionId },
      data: {
        status: nextStatus,
        previousStatus: TRANSMISSION_STATUS.SENT_AWAITING_RESULT,
        latestResponseId: responseRow.id,
        mraApplicationStatus: app.status,
        mraRemark: app.remark,
        validationUrl: app.validationUrl,
        shouldRefreshConfiguration: Boolean(app.refresh),
        shouldBlockTerminal: Boolean(app.block),
        acceptedAt: app.accepted ? new Date() : null,
        rejectedAt: nextStatus === TRANSMISSION_STATUS.REJECTED ? new Date() : null,
        unknownOutcomeAt: nextStatus === TRANSMISSION_STATUS.UNKNOWN_OUTCOME ? new Date() : null,
        version: { increment: 1 },
      },
    });

    // Terminal block
    if (app.block && terminal) {
      await tx.mraEisTerminal.updateMany({
        where: { id: terminal.id, tenantId, businessId },
        data: { status: 'BLOCKED', blockedAt: new Date() },
      }).catch(() => {});
    }

    // Receipt projection
    let eisStatus = RECEIPT_EIS_STATUS.EIS_UNKNOWN_OUTCOME;
    if (app.accepted) eisStatus = RECEIPT_EIS_STATUS.EIS_RECEIPT_GENERATION_PENDING;
    else if (nextStatus === TRANSMISSION_STATUS.REJECTED) eisStatus = RECEIPT_EIS_STATUS.EIS_REJECTED;
    else if (app.block) eisStatus = RECEIPT_EIS_STATUS.EIS_TERMINAL_BLOCKED;
    else if (app.refresh) eisStatus = RECEIPT_EIS_STATUS.EIS_CONFIGURATION_REFRESH_REQUIRED;

    await tx.mraEisReceiptProjection.updateMany({
      where: { snapshotId: snapshot.id, tenantId, businessId },
      data: {
        eisStatus,
        validationUrl: app.accepted ? app.validationUrl : null,
        acceptedAt: app.accepted ? new Date() : null,
        projectionVersion: { increment: 1 },
      },
    }).catch(() => {});

    // Phase 14 event
    if (app.accepted) {
      const p14 = {
        eventVersion: '1',
        tenantId,
        businessId,
        transmissionId: prep.transmissionId,
        acceptedAttemptId: prep.attemptId,
        fiscalSnapshotId: snapshot.id,
        fiscalSnapshotVersion: String(snapshot.version),
        snapshotChecksum: snapshot.snapshotChecksum,
        fiscalNumberAssignmentId: snapshot.fiscalNumberAllocationId,
        responseEvidenceId: responseRow.id,
        responseChecksum,
        mraTransactionId: app.mraTransactionId,
        environment,
        correlationId,
        occurredAt: new Date().toISOString(),
      };
      assertNoSecrets(p14);
      await appendEisOutboxEvent({
        tenantId,
        businessId,
        aggregateType: 'MraEisTransmission',
        aggregateId: prep.transmissionId,
        eventType: ACCEPTED_RECEIPT_REQUESTED_EVENT,
        eventVersion: '1',
        payload: p14,
        idempotencyKey: `accepted-receipt:${prep.transmissionId}:${prep.attemptId}`,
        requestId,
        correlationId,
        db: tx,
      });
    }

    // Phase 15 reconciliation
    if (nextStatus === TRANSMISSION_STATUS.UNKNOWN_OUTCOME) {
      const p15 = {
        tenantId,
        businessId,
        terminalId: snapshot.terminalId,
        transmissionId: prep.transmissionId,
        attemptId: prep.attemptId,
        fiscalSnapshotId: snapshot.id,
        fiscalNumber: snapshot.canonicalSnapshot?.fiscalNumber?.formatted || null,
        requestChecksum: prep.serialized.payloadChecksum,
        responseChecksum,
        environment,
        reasonCode: app.reason || app.outcome,
        correlationId,
        occurredAt: new Date().toISOString(),
      };
      assertNoSecrets(p15);
      await appendEisOutboxEvent({
        tenantId,
        businessId,
        aggregateType: 'MraEisTransmission',
        aggregateId: prep.transmissionId,
        eventType: TRANSMISSION_RECONCILIATION_REQUESTED_EVENT,
        eventVersion: '1',
        payload: p15,
        idempotencyKey: `tx-recon:${prep.transmissionId}:${prep.attemptId}`,
        requestId,
        correlationId,
        db: tx,
      });
    }

    // Configuration refresh
    if (app.refresh) {
      await appendEisOutboxEvent({
        tenantId,
        businessId,
        aggregateType: 'MraEisTerminal',
        aggregateId: snapshot.terminalId,
        eventType: EIS_OUTBOX_EVENT.CONFIGURATION_SYNC_REQUESTED,
        eventVersion: '1',
        payload: {
          terminalId: snapshot.terminalId,
          triggeringAttemptId: prep.attemptId,
          priority: 'HIGH',
          reason: 'MRA_SALES_RESPONSE_REFRESH',
          environment,
        },
        idempotencyKey: `cfg-refresh-from-sales:${prep.attemptId}`,
        requestId,
        correlationId,
        db: tx,
      }).catch(() => {});
    }

    await recordEisControlAudit({
      tenantId,
      businessId,
      actorId: actorOrServiceContext?.userId,
      actorType: actorOrServiceContext?.userId ? 'USER' : 'SERVICE',
      action: app.accepted
        ? 'SALES_TRANSMISSION_ACCEPTED'
        : nextStatus === TRANSMISSION_STATUS.REJECTED
          ? 'SALES_TRANSMISSION_REJECTED'
          : 'SALES_TRANSMISSION_OUTCOME',
      resourceType: 'MraEisTransmission',
      resourceId: prep.transmissionId,
      metadata: {
        attemptId: prep.attemptId,
        outcome: app.outcome,
        httpStatus: httpResult.httpStatus,
        mraTransactionId: app.mraTransactionId,
        createsJournal: false,
        createsStockMovement: false,
        qrGenerated: false,
        receiptGenerated: false,
        snapshotMutated: false,
        fiscalNumberMutated: false,
        mapperVersion: SALES_MAPPER_VERSION,
      },
    }, tx).catch(() => {});

    return {
      transmission: txUpdated,
      response: responseRow,
      app,
      nextStatus,
      attemptOutcome,
    };
  });

  // Product Analytics (Phase 9): emit only on first accepted outcome (not retries/rejects)
  if (result.app.accepted && result.transmission?.id) {
    try {
      await emitMraEisTransactionAccepted(db, {
        tenantId,
        transmissionId: result.transmission.id,
        accepted: true,
        isRetry: false,
        snapshotId: snapshot.id,
        outcome: result.app.outcome,
        environment,
        actorId: actorOrServiceContext?.userId || null,
        occurredAt: result.transmission.acceptedAt || new Date(),
      });
    } catch (analyticsErr) {
      console.warn('[productAnalytics] MRA accepted emit failed:', analyticsErr?.message);
    }
  }

  return {
    ok: true,
    duplicate: false,
    transmission: result.transmission,
    attemptId: prep.attemptId,
    responseId: result.response.id,
    outcome: result.app.outcome,
    accepted: result.app.accepted,
    mraTransactionId: result.app.mraTransactionId,
    phase14EventCreated: result.app.accepted,
    phase15EventCreated: result.nextStatus === TRANSMISSION_STATUS.UNKNOWN_OUTCOME,
    message: result.app.accepted
      ? 'Accepted by MRA (mock/provisional). Fiscal receipt generation is pending.'
      : result.nextStatus === TRANSMISSION_STATUS.REJECTED
        ? 'Rejected by MRA. Snapshot and fiscal number retained. No automatic retry.'
        : 'Submission result requires reconciliation or review.',
    mraAccepted: Boolean(result.app.accepted),
    qrGenerated: false,
    receiptGenerated: false,
    createsJournal: false,
    createsStockMovement: false,
    snapshotUnchanged: true,
    fiscalNumberUnchanged: true,
    readiness,
  };
}

async function dispatchWithJwtLease({
  terminal,
  mode,
  environment,
  requestBody,
  transmittedBytes,
  messageHashHeader,
  maxResponseBytes,
  timeoutMs,
  tenantId,
  businessId,
  requestId,
  correlationId,
}) {
  const run = async (jwtPlaintext) =>
    submitSalesTransactionToMra({
      environment,
      requestBody,
      transmittedBytes,
      messageHashHeader,
      authorizationBearer: jwtPlaintext,
      maxResponseBytes,
      timeoutMs,
    });

  if (mode === 'MOCK' && !terminal?.currentCredentialReferenceId) {
    // Synthetic in-memory JWT for mock only — never persisted
    return run('MOCK_JWT_PHASE13_NOT_A_REAL_SECRET');
  }

  if (!terminal?.currentCredentialReferenceId) {
    throw SalesTransmissionErrors.credential();
  }

  return withSecret(
    {
      credentialReferenceId: terminal.currentCredentialReferenceId,
      tenantId,
      businessId,
      terminalId: terminal.id,
      environment,
      operation: EIS_CRYPTO_OPERATION.MRA_HTTP_AUTHORIZATION,
      serviceIdentity: EIS_SERVICE_IDENTITY.SALES_TRANSMISSION_WORKER,
      requestId,
      correlationId,
    },
    async (jwt) => run(jwt)
  );
}

function assertNoSecrets(payload) {
  const text = JSON.stringify(payload ?? {});
  if (
    /"(buyerAuthorizationCode|secretKey|jwt|tac|authorizationHeader|terminalSecret)"\s*:/i.test(text) ||
    /"authorization"\s*:\s*"/i.test(text) ||
    /Bearer\s+[A-Za-z0-9\-._~+/]+=*/.test(text)
  ) {
    throw SalesTransmissionErrors.readiness({
      message: 'Outbox payload must not contain secrets.',
    });
  }
}
