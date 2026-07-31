/**
 * POST /api/coa-v2/consolidation-plans/[id] — approve or execute a plan.
 *
 * Body: { action: 'approve' | 'execute' }
 * Approval requires coa.approveConsolidation and a different user than the
 * plan creator. Execution deprecates + aliases the duplicate for FUTURE
 * postings only; historical journal lines are never rewritten.
 */

import { NextResponse } from 'next/server';
import { guardCoaRoute, coaErrorResponse } from '@/lib/coaV2/api/routeGuard.js';
import { ACCOUNTING_PERMISSIONS } from '@/lib/accountingV2/permissions.js';
import {
  approveConsolidationPlan,
  executeConsolidationPlan,
} from '@/lib/coaV2/application/lifecycleService.js';
import { recordCoaAudit, COA_AUDIT_ACTIONS } from '@/lib/coaV2/infrastructure/coaAudit.js';

export async function POST(request, { params }) {
  const resolvedParams = typeof params.then === 'function' ? await params : params;
  const { id } = resolvedParams;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const action = String(body?.action || '').toLowerCase();
  if (action !== 'approve' && action !== 'execute') {
    return NextResponse.json(
      { error: `Unknown action "${action}". Expected approve or execute.` },
      { status: 400 }
    );
  }

  const guard = await guardCoaRoute(request, [
    ACCOUNTING_PERMISSIONS.COA_APPROVE_CONSOLIDATION,
    ACCOUNTING_PERMISSIONS.COA_MANAGE,
  ]);
  if (guard.response) return guard.response;
  const { context } = guard;

  try {
    if (action === 'approve') {
      const plan = await approveConsolidationPlan({ context, planId: id });
      await recordCoaAudit({
        action: COA_AUDIT_ACTIONS.CONSOLIDATION_APPROVE,
        context,
        entityType: 'CoaV2ConsolidationPlan',
        entityId: plan.id,
        newValues: { status: plan.status },
        approvedBy: context.userId,
      });
      return NextResponse.json({ plan, message: 'Consolidation plan approved' });
    }

    const result = await executeConsolidationPlan({ context, planId: id });
    await recordCoaAudit({
      action: COA_AUDIT_ACTIONS.CONSOLIDATION_EXECUTE,
      context,
      entityType: 'CoaV2ConsolidationPlan',
      entityId: result.plan.id,
      newValues: {
        status: result.plan.status,
        deprecatedAccountId: result.deprecatedAccount?.id ?? null,
        aliasId: result.alias?.id ?? null,
        phase6RepairRequired: result.plan.phase6RepairRequired,
      },
    });
    return NextResponse.json({
      plan: result.plan,
      deprecatedAccount: result.deprecatedAccount,
      alias: result.alias,
      message:
        'Consolidation executed: duplicate deprecated for future postings; historical journal lines untouched.',
    });
  } catch (error) {
    return coaErrorResponse(error, `${action} consolidation plan`);
  }
}
