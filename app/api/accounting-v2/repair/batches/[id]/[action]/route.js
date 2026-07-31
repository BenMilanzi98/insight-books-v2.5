/**
 * /api/accounting-v2/repair/batches/[id]/[action]
 *
 * POST actions (permission-gated; separation of duties in the services):
 *   transition   { status, details? }         — batch status machine
 *   snapshot     { phase: BEFORE|AFTER }      — capture accounting snapshot
 *   dry-run      { anomalyId, repairType, … } — mandatory preview, zero writes
 *   execute      { anomalyId, repairType, … } — idempotent repair execution
 *   verify       {}                           — post-repair verification
 *   rollback-action { actionId }              — metadata-repair rollback
 *
 * GET (action = detail): batch with its actions and snapshots.
 */

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { guardAccountingRoute, accountingErrorResponse } from '@/lib/accountingV2/api/routeGuard.js';
import { ACCOUNTING_PERMISSIONS } from '@/lib/accountingV2/permissions.js';
import {
  getBatch,
  transitionBatch,
  captureSnapshot,
} from '@/lib/accountingV2/repair/repairBatchService.js';
import {
  dryRunRepair,
  executeRepair,
  rollbackMetadataRepair,
} from '@/lib/accountingV2/repair/repairExecutionService.js';
import { verifyBatch } from '@/lib/accountingV2/repair/repairVerificationService.js';

const ACTION_PERMISSIONS = {
  transition: ACCOUNTING_PERMISSIONS.REPAIR_MANAGE_BATCHES,
  snapshot: ACCOUNTING_PERMISSIONS.REPAIR_MANAGE_BATCHES,
  'dry-run': ACCOUNTING_PERMISSIONS.REPAIR_PREVIEW,
  execute: ACCOUNTING_PERMISSIONS.REPAIR_EXECUTE,
  verify: ACCOUNTING_PERMISSIONS.REPAIR_VERIFY,
  'rollback-action': ACCOUNTING_PERMISSIONS.REPAIR_ROLLBACK,
};

export async function GET(request, { params }) {
  const guard = await guardAccountingRoute(request, [ACCOUNTING_PERMISSIONS.REPAIR_VIEW]);
  if (guard.response) return guard.response;
  try {
    const { id } = await params;
    const batch = await getBatch(prisma, guard.context, id);
    const [actions, snapshots] = await Promise.all([
      prisma.acctV2RepairAction.findMany({ where: { batchId: id }, orderBy: { createdAt: 'asc' } }),
      prisma.acctV2RepairSnapshot.findMany({ where: { batchId: id } }),
    ]);
    return NextResponse.json({ batch, actions, snapshots });
  } catch (error) {
    return accountingErrorResponse(error, 'repair batch detail');
  }
}

export async function POST(request, { params }) {
  const { id, action } = await params;
  const permission = ACTION_PERMISSIONS[action];
  if (!permission) {
    return NextResponse.json(
      { error: `Unknown action: ${action}. Supported: ${Object.keys(ACTION_PERMISSIONS).join(', ')}` },
      { status: 400 }
    );
  }
  const guard = await guardAccountingRoute(request, [permission]);
  if (guard.response) return guard.response;
  const { context, can } = guard;
  try {
    const body = await request.json().catch(() => ({}));
    switch (action) {
      case 'transition':
        return NextResponse.json({
          batch: await transitionBatch(prisma, context, id, body.status, body.details ?? {}),
        });
      case 'snapshot':
        return NextResponse.json({
          snapshot: await captureSnapshot(prisma, context, id, body.phase ?? 'BEFORE'),
        });
      case 'dry-run':
        return NextResponse.json({
          preview: await dryRunRepair(prisma, context, { ...body, repairBatchId: id }),
        });
      case 'execute':
        return NextResponse.json({
          result: await executeRepair(
            prisma,
            context,
            { ...body, repairBatchId: id },
            { hasPermission: can }
          ),
        });
      case 'verify':
        return NextResponse.json({ verification: await verifyBatch(prisma, context, id, body) });
      case 'rollback-action':
        return NextResponse.json({
          action: await rollbackMetadataRepair(prisma, context, body.actionId),
        });
      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 404 });
    }
  } catch (error) {
    return accountingErrorResponse(error, `repair batch ${action}`);
  }
}
