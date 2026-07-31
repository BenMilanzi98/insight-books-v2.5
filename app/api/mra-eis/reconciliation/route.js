import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import {
  reconcileTransmissionOutcome,
  processTransmissionReconciliationOutboxBatch,
  processAuthorizedRetryBatch,
  evaluateSafeRetryAuthorization,
  executeControlledSafeRetry,
  recoverMissingFiscalReceipt,
  recoverMissingReconciliationEvents,
  reconcileFiscalSequenceEvidence,
  getLastTransactionContractDecision,
  getRetryPolicyRegistry,
  loadLocalReconciliationEvidence,
  classifyDispatchCertainty,
} from '@/lib/mraEis';
import { MraEisControlError } from '@/lib/mraEis/domain/errors.js';

function sanitizeCase(c) {
  if (!c) return null;
  return {
    id: c.id,
    transmissionId: c.transmissionId,
    triggeringAttemptId: c.triggeringAttemptId,
    fiscalNumber: c.fiscalNumber,
    environment: c.environment,
    reasonCode: c.reasonCode,
    state: c.state,
    matchOutcome: c.matchOutcome,
    matchConfidence: c.matchConfidence,
    dispatchCertainty: c.dispatchCertainty,
    retryAuthorizationId: c.retryAuthorizationId,
    nextEligibleActionAt: c.nextEligibleActionAt,
    safeStatusSummary: c.safeStatusSummary,
    localEvidenceChecksum: c.localEvidenceChecksum,
    mraEvidenceChecksum: c.mraEvidenceChecksum,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
    completedAt: c.completedAt,
  };
}

export async function GET(request) {
  const user = await getUserFromSession(request);
  if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  const transmissionId = searchParams.get('transmissionId');

  if (id) {
    const row = await prisma.mraEisTransmissionReconciliation.findFirst({
      where: { id, tenantId: user.tenantId, businessId: user.tenantId },
      include: {
        queryAttempts: { orderBy: { queryAttemptNumber: 'asc' } },
        retryAuthorizations: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({
      case: sanitizeCase(row),
      comparisonSummary: row.comparisonSummary,
      queryAttempts: row.queryAttempts.map((q) => ({
        id: q.id,
        queryAttemptNumber: q.queryAttemptNumber,
        endpointType: q.endpointType,
        state: q.state,
        httpStatus: q.httpStatus,
        outcome: q.outcome,
        responseChecksum: q.responseChecksum,
        // sanitized only
        sanitizedResponse: q.sanitizedResponse,
      })),
      retryAuthorizations: row.retryAuthorizations.map((a) => ({
        id: a.id,
        proposedAttemptNumber: a.proposedAttemptNumber,
        authorizationState: a.authorizationState,
        earliestRetryAt: a.earliestRetryAt,
        expiresAt: a.expiresAt,
        sameFiscalNumber: a.sameFiscalNumber,
        reconciliationOutcome: a.reconciliationOutcome,
      })),
      // never return credentials
    });
  }

  if (transmissionId) {
    const rows = await prisma.mraEisTransmissionReconciliation.findMany({
      where: {
        transmissionId,
        tenantId: user.tenantId,
        businessId: user.tenantId,
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
    return NextResponse.json({ cases: rows.map(sanitizeCase) });
  }

  const recent = await prisma.mraEisTransmissionReconciliation.findMany({
    where: { tenantId: user.tenantId, businessId: user.tenantId },
    orderBy: { createdAt: 'desc' },
    take: 25,
  });

  return NextResponse.json({
    cases: recent.map(sanitizeCase),
    lastTransactionContract: getLastTransactionContractDecision(),
    retryPolicy: getRetryPolicyRegistry(),
    note: 'RECONCILE FIRST — DO NOT RETRY unknown outcomes. Absence from Last Online is not conclusive.',
  });
}

export async function POST(request) {
  try {
    const user = await getUserFromSession(request);
    if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const action = body.action;
    const tenantId = user.tenantId;
    const businessId = user.tenantId;

    // Reject client-forced outcomes / evidence / endpoints
    if (
      body.forceAccepted ||
      body.forceRejected ||
      body.mraEvidence ||
      body.endpoint ||
      body.jwt ||
      body.fiscalNumber ||
      body.blindRetry
    ) {
      return NextResponse.json(
        {
          error:
            'Client cannot force acceptance/rejection, supply MRA evidence, choose endpoints/JWT, change fiscal numbers, or blind-retry.',
          code: 'CLIENT_RECONCILIATION_FIELDS_REJECTED',
        },
        { status: 400 }
      );
    }

    if (action === 'reconcile') {
      const result = await reconcileTransmissionOutcome({
        tenantId,
        businessId,
        transmissionId: body.transmissionId,
        triggeringAttemptId: body.attemptId || null,
        reasonCode: body.reasonCode || 'UNKNOWN_OUTCOME',
        actorOrServiceContext: { userId: user.id },
      });
      return NextResponse.json({
        case: sanitizeCase(result.case),
        outcome: result.outcome || result.case?.matchOutcome,
        retryAllowed: Boolean(result.retryAllowed),
        mraSalesCalled: false,
        saleResubmitted: false,
      });
    }

    if (action === 'process-outbox') {
      const result = await processTransmissionReconciliationOutboxBatch({
        limit: Math.min(Number(body.limit) || 10, 50),
        workerId: `api-phase15-${user.id}`,
      });
      return NextResponse.json(result);
    }

    if (action === 'process-retries') {
      const result = await processAuthorizedRetryBatch({
        limit: Math.min(Number(body.limit) || 10, 25),
        tenantId,
        businessId,
        workerId: `api-phase15-retry-${user.id}`,
      });
      return NextResponse.json(result);
    }

    if (action === 'evaluate-retry') {
      const result = await evaluateSafeRetryAuthorization({
        reconciliationId: body.reconciliationId,
        transmissionId: body.transmissionId,
        proposedAttemptNumber: body.proposedAttemptNumber || null,
        actorOrServiceContext: { userId: user.id },
      });
      return NextResponse.json(result);
    }

    if (action === 'execute-retry') {
      const result = await executeControlledSafeRetry({
        authorizationId: body.authorizationId,
        actorOrServiceContext: { userId: user.id },
        workerId: `api-phase15-retry-${user.id}`,
      });
      return NextResponse.json(result);
    }

    if (action === 'recover-receipts') {
      const result = await recoverMissingFiscalReceipt({
        tenantId,
        businessId,
        transmissionId: body.transmissionId || null,
      });
      return NextResponse.json(result);
    }

    if (action === 'recover-recon-events') {
      const result = await recoverMissingReconciliationEvents({
        tenantId,
        businessId,
        limit: Math.min(Number(body.limit) || 20, 50),
      });
      return NextResponse.json(result);
    }

    if (action === 'sequence-reconcile') {
      const result = await reconcileFiscalSequenceEvidence({
        tenantId,
        businessId,
        terminalId: body.terminalId || null,
        environment: body.environment || 'SANDBOX',
      });
      return NextResponse.json(result);
    }

    if (action === 'local-evidence') {
      const result = await loadLocalReconciliationEvidence({
        tenantId,
        businessId,
        transmissionId: body.transmissionId,
        triggeringAttemptId: body.attemptId || null,
      });
      return NextResponse.json({
        valid: result.valid,
        blockers: result.blockers,
        localEvidenceChecksum: result.localEvidenceChecksum,
        dispatch: result.dispatch,
        fiscalNumber: result.evidence.fiscalNumber,
        transmissionStatus: result.transmission.status,
        // omit full evidence dump with potential PII beyond what's needed
      });
    }

    if (action === 'dispatch-certainty') {
      const attempt = await prisma.mraEisTransmissionAttempt.findFirst({
        where: {
          id: body.attemptId,
          tenantId,
          businessId,
        },
      });
      const response = attempt
        ? await prisma.mraEisResponse.findFirst({
            where: { attemptId: attempt.id, tenantId, businessId },
          })
        : null;
      return NextResponse.json(classifyDispatchCertainty(attempt, response));
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err) {
    if (err instanceof MraEisControlError) {
      return NextResponse.json(
        {
          error: {
            code: err.code,
            message: err.message,
            requiredAction: err.requiredAction,
            retryable: err.retryable,
            details: err.details || null,
          },
        },
        { status: err.httpStatus || 400 }
      );
    }
    console.error('reconciliation API error', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
