import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { scanMissedSalesBridges } from '@/lib/mraEis/application/eligibility/missedBridgeReconciliation.js';
import { consumeFiscalSnapshotRequestedOutboxEvent } from '@/lib/mraEis/application/eligibility/salesBridgeService.js';
import { claimEisOutboxBatch, markEisOutboxProcessed } from '@/lib/mraEis/infrastructure/outbox/outboxService.js';
import { FISCAL_SNAPSHOT_REQUESTED_EVENT } from '@/lib/mraEis/application/eligibility/salesBridgeService.js';
import { projectTransactionEisStatus } from '@/lib/mraEis/application/eligibility/statusAndMessaging.js';
import { MraEisControlError } from '@/lib/mraEis/domain/errors.js';

export async function GET(request) {
  const user = await getUserFromSession(request);
  if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const sourceType = searchParams.get('sourceType');
  const sourceId = searchParams.get('sourceId');
  const bridgeId = searchParams.get('id');

  if (bridgeId) {
    const bridge = await prisma.mraEisSalesBridge.findFirst({
      where: { id: bridgeId, tenantId: user.tenantId, businessId: user.tenantId },
    });
    if (!bridge) return NextResponse.json({ error: 'Bridge not found' }, { status: 404 });
    return NextResponse.json({
      bridge,
      eisStatus: projectTransactionEisStatus({ bridgeStatus: bridge.status }),
      mraAccepted: false,
      fiscalNumber: null,
      qrPresent: false,
    });
  }

  if (sourceType && sourceId) {
    const bridges = await prisma.mraEisSalesBridge.findMany({
      where: {
        tenantId: user.tenantId,
        businessId: user.tenantId,
        sourceType,
        sourceId,
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
    return NextResponse.json({
      bridges,
      eisStatus: bridges[0]
        ? projectTransactionEisStatus({ bridgeStatus: bridges[0].status })
        : 'EIS_NOT_APPLICABLE',
      mraAccepted: false,
    });
  }

  const recent = await prisma.mraEisSalesBridge.findMany({
    where: { tenantId: user.tenantId, businessId: user.tenantId },
    orderBy: { createdAt: 'desc' },
    take: 25,
  });
  return NextResponse.json({ bridges: recent, mraAccepted: false });
}

export async function POST(request) {
  try {
    const user = await getUserFromSession(request);
    if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const action = body.action || new URL(request.url).searchParams.get('action');

    if (action === 'reconcile') {
      const result = await scanMissedSalesBridges({
        tenantId: user.tenantId,
        businessId: user.tenantId,
        environment: body.environment || 'SANDBOX',
        dryRun: body.dryRun !== false,
        limit: body.limit || 50,
        repairMissingBridge: Boolean(body.repairMissingBridge),
        repairMissingOutbox: Boolean(body.repairMissingOutbox),
        approvedBy: body.repairMissingBridge || body.repairMissingOutbox ? user.id : null,
      });
      return NextResponse.json({ success: true, ...result });
    }

    if (action === 'process-outbox') {
      const batch = await claimEisOutboxBatch({
        workerId: `phase11-${user.id}`,
        limit: body.limit || 10,
      });
      const results = [];
      for (const row of batch) {
        if (
          row.eventType !== FISCAL_SNAPSHOT_REQUESTED_EVENT &&
          row.eventType !== 'MRA_EIS_SNAPSHOT_REQUESTED'
        ) {
          continue;
        }
        const handled = await consumeFiscalSnapshotRequestedOutboxEvent({ outboxEvent: row });
        if (handled.handled) {
          await markEisOutboxProcessed({ id: row.id }).catch(() => {});
        }
        results.push({ id: row.id, ...handled });
      }
      return NextResponse.json({
        success: true,
        processed: results,
        note: 'Phase 11 consumer only marks READY_FOR_FISCAL_SNAPSHOT. Phase 12 creates snapshots.',
        mraApiCalls: false,
      });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err) {
    if (err instanceof MraEisControlError) {
      return NextResponse.json(err.toJSON(), { status: err.httpStatus || 400 });
    }
    console.error('sales-bridge:', err);
    return NextResponse.json({ error: 'Bridge action failed' }, { status: 500 });
  }
}
