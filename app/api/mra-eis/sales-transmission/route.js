import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import {
  evaluateOnlineSalesTransmissionReadiness,
  transmitFiscalSnapshotOnline,
  processSalesPayloadOutboxBatch,
  getSalesEndpointContractDecision,
  resolveSalesEndpointContract,
} from '@/lib/mraEis';
import { MraEisControlError } from '@/lib/mraEis/domain/errors.js';
import { resolveActivationMode } from '@/lib/mraEis/infrastructure/mraClient/environmentConfig.js';

export async function GET(request) {
  const user = await getUserFromSession(request);
  if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  const snapshotId = searchParams.get('snapshotId');

  if (id) {
    const transmission = await prisma.mraEisTransmission.findFirst({
      where: { id, tenantId: user.tenantId, businessId: user.tenantId },
    });
    if (!transmission) return NextResponse.json({ error: 'Transmission not found' }, { status: 404 });
    const attempts = await prisma.mraEisTransmissionAttempt.findMany({
      where: { transmissionId: transmission.id, tenantId: user.tenantId },
      orderBy: { attemptNumber: 'asc' },
    });
    const response = transmission.latestResponseId
      ? await prisma.mraEisResponse.findFirst({
          where: { id: transmission.latestResponseId, tenantId: user.tenantId },
        })
      : null;
    return NextResponse.json({
      transmission: sanitizeTransmission(transmission),
      attempts: attempts.map(sanitizeAttempt),
      response: response ? sanitizeResponse(response) : null,
      qrGenerated: false,
      receiptGenerated: false,
    });
  }

  if (snapshotId) {
    const transmission = await prisma.mraEisTransmission.findFirst({
      where: {
        snapshotId,
        tenantId: user.tenantId,
        businessId: user.tenantId,
      },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json({
      transmission: transmission ? sanitizeTransmission(transmission) : null,
      qrGenerated: false,
    });
  }

  const recent = await prisma.mraEisTransmission.findMany({
    where: { tenantId: user.tenantId, businessId: user.tenantId },
    orderBy: { createdAt: 'desc' },
    take: 25,
  });

  return NextResponse.json({
    transmissions: recent.map(sanitizeTransmission),
    contractDecision: getSalesEndpointContractDecision(),
    note: 'HTTP 200 alone is not MRA acceptance. No QR/receipt in Phase 13.',
  });
}

export async function POST(request) {
  try {
    const user = await getUserFromSession(request);
    if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const action = body.action || new URL(request.url).searchParams.get('action');
    const tenantId = user.tenantId;
    const businessId = user.tenantId;

    // Reject client-supplied payload / JWT / endpoint
    if (
      body.payload ||
      body.canonicalRequest ||
      body.authorization ||
      body.jwt ||
      body.endpoint ||
      body.httpMethod ||
      body.fiscalNumber ||
      body.forceAccepted
    ) {
      return NextResponse.json(
        {
          error: 'Client cannot supply payload, JWT, endpoint, fiscal number, or force acceptance.',
          code: 'CLIENT_TRANSMISSION_FIELDS_REJECTED',
        },
        { status: 400 }
      );
    }

    if (action === 'readiness') {
      if (!body.fiscalSnapshotId) {
        return NextResponse.json({ error: 'fiscalSnapshotId required' }, { status: 400 });
      }
      const readiness = await evaluateOnlineSalesTransmissionReadiness({
        tenantId,
        businessId,
        fiscalSnapshotId: body.fiscalSnapshotId,
        expectedSnapshotChecksum: body.expectedSnapshotChecksum || null,
        environment: body.environment,
        actorOrServiceContext: { userId: user.id },
      });
      return NextResponse.json({
        success: true,
        readiness: sanitizeReadiness(readiness),
        contract: resolveSalesEndpointContract({
          environment: readiness.environment,
          mode: resolveActivationMode(readiness.environment),
        }),
      });
    }

    if (action === 'submit' || action === 'manual-submit') {
      if (!body.fiscalSnapshotId) {
        return NextResponse.json({ error: 'fiscalSnapshotId required' }, { status: 400 });
      }
      if (action === 'manual-submit' && !body.reason) {
        return NextResponse.json({ error: 'reason required for manual submit' }, { status: 400 });
      }
      const result = await transmitFiscalSnapshotOnline({
        tenantId,
        businessId,
        fiscalSnapshotId: body.fiscalSnapshotId,
        expectedSnapshotChecksum: body.expectedSnapshotChecksum || null,
        actorOrServiceContext: { userId: user.id },
        correlationId: body.correlationId || null,
        requestId: body.requestId || null,
        workerId: `phase13-manual-${user.id}`,
      });
      return NextResponse.json({
        success: true,
        ...result,
        transmission: result.transmission ? sanitizeTransmission(result.transmission) : null,
        readiness: result.readiness ? sanitizeReadiness(result.readiness) : undefined,
      });
    }

    if (action === 'process-outbox') {
      const result = await processSalesPayloadOutboxBatch({
        workerId: `phase13-${user.id}`,
        limit: body.limit || 10,
      });
      return NextResponse.json({ success: true, ...result });
    }

    if (action === 'retry') {
      return NextResponse.json(
        {
          error:
            'Blind retry of UNKNOWN_OUTCOME / REJECTED is prohibited. Use Phase 15 reconciliation at /api/mra-eis/reconciliation (reconcile → authorize → process-retries).',
          code: 'MRA_EIS_SALES_RETRY_NOT_SAFE',
          phase15: '/settings/integrations/mra-eis/reconciliation',
        },
        { status: 409 }
      );
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err) {
    if (err instanceof MraEisControlError || err?.code) {
      return NextResponse.json(
        err.toJSON?.() || { error: err.message, code: err.code, details: err.details },
        { status: err.httpStatus || 400 }
      );
    }
    console.error('sales-transmission:', err);
    return NextResponse.json({ error: 'Sales transmission action failed' }, { status: 500 });
  }
}

function sanitizeTransmission(t) {
  return {
    ...t,
    qrGenerated: false,
    receiptGenerated: false,
  };
}

function sanitizeAttempt(a) {
  let req = a.sanitizedRequestReference;
  try {
    req = typeof req === 'string' ? JSON.parse(req) : req;
  } catch {
    /* keep */
  }
  return {
    id: a.id,
    attemptNumber: a.attemptNumber,
    outcome: a.outcome,
    httpStatus: a.httpStatus,
    mraApplicationStatus: a.mraApplicationStatus,
    requestChecksum: a.requestChecksum,
    responseChecksum: a.responseChecksum,
    retryClassification: a.retryClassification,
    safeErrorCode: a.safeErrorCode,
    safeErrorSummary: a.safeErrorSummary,
    sanitizedRequestReference: req,
    startedAt: a.startedAt,
    completedAt: a.completedAt,
  };
}

function sanitizeResponse(r) {
  return {
    id: r.id,
    httpStatus: r.httpStatus,
    mraApplicationStatus: r.mraApplicationStatus,
    remark: r.remark,
    responseCategory: r.responseCategory,
    validationUrl: r.validationUrl,
    shouldRefreshConfiguration: r.shouldRefreshConfiguration,
    shouldBlockTerminal: r.shouldBlockTerminal,
    sourceChecksum: r.sourceChecksum,
    sanitizedCanonicalResponse: r.sanitizedCanonicalResponse,
    receivedAt: r.receivedAt,
    qrRendered: false,
  };
}

function sanitizeReadiness(r) {
  if (!r) return null;
  const { snapshot, terminal, integrity, contractResult, acceptedTransmission, activeTransmission, ...safe } = r;
  return {
    ...safe,
    snapshotId: snapshot?.id,
    terminalId: terminal?.id,
    integrityStatus: integrity?.status,
    contractDecision: contractResult?.decision,
  };
}
