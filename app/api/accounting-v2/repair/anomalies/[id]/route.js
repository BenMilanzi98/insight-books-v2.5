/**
 * /api/accounting-v2/repair/anomalies/[id]
 *
 * GET  — anomaly detail with evidence and repair actions.
 * POST — workflow actions, permission-gated per action:
 *   add-evidence     { evidenceType, description, payload?, reference?, strength? }
 *   transition       { status, details? }
 *   propose          { repairType, reason, repairData? }
 *   approve / reject { reason? }
 *   mark-exception   { evidenceGap, reasonBlocked, ... }
 *
 * Separation of duties and the anomaly status machine are enforced in the
 * registry service; this route only maps permissions.
 */

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { guardAccountingRoute, accountingErrorResponse } from '@/lib/accountingV2/api/routeGuard.js';
import { ACCOUNTING_PERMISSIONS } from '@/lib/accountingV2/permissions.js';
import {
  getAnomaly,
  addEvidence,
  transitionAnomaly,
  proposeRepair,
  decideRepair,
  markException,
} from '@/lib/accountingV2/repair/anomalyRegistryService.js';

const ACTION_PERMISSIONS = {
  'add-evidence': ACCOUNTING_PERMISSIONS.REPAIR_ADD_EVIDENCE,
  transition: ACCOUNTING_PERMISSIONS.REPAIR_INVESTIGATE,
  propose: ACCOUNTING_PERMISSIONS.REPAIR_PROPOSE,
  approve: ACCOUNTING_PERMISSIONS.REPAIR_APPROVE,
  reject: ACCOUNTING_PERMISSIONS.REPAIR_APPROVE,
  'mark-exception': ACCOUNTING_PERMISSIONS.REPAIR_ACCEPT_EXCEPTION,
};

export async function GET(request, { params }) {
  const guard = await guardAccountingRoute(request, [ACCOUNTING_PERMISSIONS.REPAIR_VIEW]);
  if (guard.response) return guard.response;
  try {
    const { id } = await params;
    const anomaly = await getAnomaly(prisma, guard.context, id);
    const [evidence, actions] = await Promise.all([
      prisma.acctV2RepairEvidence.findMany({ where: { anomalyId: id }, orderBy: { recordedAt: 'asc' } }),
      prisma.acctV2RepairAction.findMany({ where: { anomalyId: id }, orderBy: { createdAt: 'asc' } }),
    ]);
    return NextResponse.json({ anomaly, evidence, actions });
  } catch (error) {
    return accountingErrorResponse(error, 'repair anomaly detail');
  }
}

export async function POST(request, { params }) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const action = body.action;
  const permission = ACTION_PERMISSIONS[action];
  if (!permission) {
    return NextResponse.json(
      { error: `Unknown action: ${action}. Supported: ${Object.keys(ACTION_PERMISSIONS).join(', ')}` },
      { status: 400 }
    );
  }
  const guard = await guardAccountingRoute(request, [permission]);
  if (guard.response) return guard.response;
  const { context } = guard;
  try {
    switch (action) {
      case 'add-evidence':
        return NextResponse.json({ evidence: await addEvidence(prisma, context, id, body) });
      case 'transition':
        return NextResponse.json({
          anomaly: await transitionAnomaly(prisma, context, id, body.status, body.details ?? {}),
        });
      case 'propose':
        return NextResponse.json({ anomaly: await proposeRepair(prisma, context, id, body) });
      case 'approve':
        return NextResponse.json({
          anomaly: await decideRepair(prisma, context, id, { approve: true, reason: body.reason }),
        });
      case 'reject':
        return NextResponse.json({
          anomaly: await decideRepair(prisma, context, id, { approve: false, reason: body.reason }),
        });
      case 'mark-exception':
        return NextResponse.json({ exception: await markException(prisma, context, id, body) });
      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 404 });
    }
  } catch (error) {
    return accountingErrorResponse(error, `repair anomaly ${action}`);
  }
}
