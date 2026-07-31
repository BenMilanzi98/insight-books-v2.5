import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import {
  evaluateFiscalSnapshotReadiness,
  createFiscalSnapshotFromBridge,
  verifyFiscalSnapshotIntegrity,
  processFiscalSnapshotOutboxBatch,
  claimReadyBridgesForSnapshot,
} from '@/lib/mraEis';
import { MraEisControlError } from '@/lib/mraEis/domain/errors.js';

export async function GET(request) {
  const user = await getUserFromSession(request);
  if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  const bridgeRecordId = searchParams.get('bridgeRecordId');

  if (id) {
    const snapshot = await prisma.mraEisSnapshot.findFirst({
      where: { id, tenantId: user.tenantId, businessId: user.tenantId },
      include: { lines: true, payments: true },
    });
    if (!snapshot) return NextResponse.json({ error: 'Snapshot not found' }, { status: 404 });
    return NextResponse.json({
      snapshot: sanitizeSnapshot(snapshot),
      message: 'Fiscal snapshot created locally. Not yet submitted to MRA.',
      mraAccepted: false,
      qrGenerated: false,
    });
  }

  if (bridgeRecordId) {
    const snapshot = await prisma.mraEisSnapshot.findFirst({
      where: {
        bridgeRecordId,
        tenantId: user.tenantId,
        businessId: user.tenantId,
      },
      include: { lines: true, payments: true },
    });
    return NextResponse.json({
      snapshot: snapshot ? sanitizeSnapshot(snapshot) : null,
      mraAccepted: false,
    });
  }

  const recent = await prisma.mraEisSnapshot.findMany({
    where: { tenantId: user.tenantId, businessId: user.tenantId },
    orderBy: { createdAt: 'desc' },
    take: 25,
  });
  return NextResponse.json({
    snapshots: recent.map(sanitizeSnapshot),
    message: 'Local fiscal snapshot evidence only. Not MRA acceptance.',
    mraAccepted: false,
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

    if (action === 'readiness') {
      if (!body.bridgeRecordId) {
        return NextResponse.json({ error: 'bridgeRecordId required' }, { status: 400 });
      }
      const readiness = await evaluateFiscalSnapshotReadiness({
        tenantId,
        businessId,
        bridgeRecordId: body.bridgeRecordId,
        expectedBridgeVersion: body.expectedBridgeVersion ?? null,
        environment: body.environment,
        actorOrServiceContext: { userId: user.id },
      });
      return NextResponse.json({
        success: true,
        readiness: sanitizeReadiness(readiness),
        mraAccepted: false,
      });
    }

    if (action === 'create') {
      if (!body.bridgeRecordId) {
        return NextResponse.json({ error: 'bridgeRecordId required' }, { status: 400 });
      }
      // Reject client-supplied canonical content / fiscal numbers
      if (body.canonicalSnapshot || body.fiscalNumber || body.snapshotChecksum || body.nextValue) {
        return NextResponse.json(
          {
            error: 'Client cannot supply canonical snapshot, checksum, or fiscal number.',
            code: 'CLIENT_SNAPSHOT_FIELDS_REJECTED',
          },
          { status: 400 }
        );
      }
      const result = await createFiscalSnapshotFromBridge({
        tenantId,
        businessId,
        bridgeRecordId: body.bridgeRecordId,
        expectedBridgeVersion: body.expectedBridgeVersion ?? null,
        actorOrServiceContext: { userId: user.id },
        correlationId: body.correlationId || null,
        requestId: body.requestId || null,
      });
      return NextResponse.json({
        success: true,
        ...result,
        snapshot: result.snapshot ? sanitizeSnapshot(result.snapshot) : null,
        readiness: result.readiness ? sanitizeReadiness(result.readiness) : undefined,
      });
    }

    if (action === 'verify-integrity') {
      if (!body.snapshotId) {
        return NextResponse.json({ error: 'snapshotId required' }, { status: 400 });
      }
      const owned = await prisma.mraEisSnapshot.findFirst({
        where: { id: body.snapshotId, tenantId, businessId },
      });
      if (!owned) return NextResponse.json({ error: 'Snapshot not found' }, { status: 404 });
      const integrity = await verifyFiscalSnapshotIntegrity(body.snapshotId);
      return NextResponse.json({ success: true, integrity, mraAccepted: false });
    }

    if (action === 'process-outbox') {
      const result = await processFiscalSnapshotOutboxBatch({
        workerId: `phase12-${user.id}`,
        limit: body.limit || 10,
      });
      return NextResponse.json({
        success: true,
        ...result,
        note: 'Phase 12 snapshot worker. No MRA Sales API calls.',
      });
    }

    if (action === 'claim-ready') {
      const result = await claimReadyBridgesForSnapshot({
        tenantId,
        limit: body.limit || 10,
      });
      return NextResponse.json({ success: true, ...result });
    }

    if (action === 'export') {
      if (!body.snapshotId) {
        return NextResponse.json({ error: 'snapshotId required' }, { status: 400 });
      }
      const snapshot = await prisma.mraEisSnapshot.findFirst({
        where: { id: body.snapshotId, tenantId, businessId },
        include: { lines: true, payments: true },
      });
      if (!snapshot) return NextResponse.json({ error: 'Snapshot not found' }, { status: 404 });
      return NextResponse.json({
        success: true,
        exportLabel: 'LOCAL_FISCAL_SNAPSHOT_EVIDENCE',
        disclaimer: 'Fiscal snapshot created locally. Not yet submitted to MRA. Not MRA acceptance.',
        package: sanitizeSnapshot(snapshot),
        mraAccepted: false,
        qrGenerated: false,
      });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err) {
    if (err instanceof MraEisControlError || err?.code) {
      return NextResponse.json(
        err.toJSON?.() || {
          error: err.message,
          code: err.code,
          details: err.details,
        },
        { status: err.httpStatus || 400 }
      );
    }
    console.error('fiscal-snapshots:', err);
    return NextResponse.json({ error: 'Fiscal snapshot action failed' }, { status: 500 });
  }
}

function sanitizeSnapshot(snapshot) {
  if (!snapshot) return null;
  const text = JSON.stringify(snapshot.canonicalSnapshot || {});
  if (/(authorization|bearer\s|secretKey|jwt|tac\b|buyerAuthorizationCode)/i.test(text)) {
    return {
      ...snapshot,
      canonicalSnapshot: { redacted: true, reason: 'Sensitive fields stripped' },
      mraAccepted: false,
      qrGenerated: false,
    };
  }
  return {
    ...snapshot,
    mraAccepted: false,
    qrGenerated: false,
  };
}

function sanitizeReadiness(readiness) {
  if (!readiness) return null;
  const {
    bridge,
    decision,
    source,
    lines,
    payments,
    customer,
    terminal,
    accounting,
    inventory,
    checksumResult,
    scope,
    numberContract,
    ...safe
  } = readiness;
  return {
    ...safe,
    bridgeId: bridge?.id,
    sourceId: bridge?.sourceId,
    sourceType: bridge?.sourceType,
    sourceChecksum: checksumResult?.sourceChecksum,
    scopeKey: scope?.scopeKey,
    numberContractStatus: numberContract?.contract?.contractStatus,
  };
}
