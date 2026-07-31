/**
 * /api/coa-v2/consolidation-plans — safe account consolidation workflow.
 *
 * GET  — list plans for the session business.
 * POST — create a plan (impact analysis captured; nothing changes until a
 *        DIFFERENT user approves and the plan is executed).
 */

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { guardCoaRoute, coaErrorResponse } from '@/lib/coaV2/api/routeGuard.js';
import { ACCOUNTING_PERMISSIONS } from '@/lib/accountingV2/permissions.js';
import { createConsolidationPlan } from '@/lib/coaV2/application/lifecycleService.js';
import { recordCoaAudit, COA_AUDIT_ACTIONS } from '@/lib/coaV2/infrastructure/coaAudit.js';

export async function GET(request) {
  const guard = await guardCoaRoute(request, [
    ACCOUNTING_PERMISSIONS.COA_VIEW,
    'accounts.view',
  ]);
  if (guard.response) return guard.response;
  const { context } = guard;

  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const plans = await prisma.coaV2ConsolidationPlan.findMany({
      where: { tenantId: context.businessId, ...(status ? { status } : {}) },
      include: {
        duplicateAccount: { select: { id: true, accountCode: true, accountName: true } },
        canonicalAccount: { select: { id: true, accountCode: true, accountName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json({ plans, total: plans.length });
  } catch (error) {
    return coaErrorResponse(error, 'list consolidation plans');
  }
}

export async function POST(request) {
  const guard = await guardCoaRoute(request, [
    ACCOUNTING_PERMISSIONS.COA_MANAGE,
    ACCOUNTING_PERMISSIONS.COA_DEPRECATE,
  ]);
  if (guard.response) return guard.response;
  const { context } = guard;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  if (!body?.duplicateAccountId || !body?.canonicalAccountId) {
    return NextResponse.json(
      { error: 'duplicateAccountId and canonicalAccountId are required' },
      { status: 400 }
    );
  }

  try {
    const plan = await createConsolidationPlan({
      context,
      duplicateAccountId: body.duplicateAccountId,
      canonicalAccountId: body.canonicalAccountId,
      duplicateClass: body.duplicateClass ?? null,
      reason: body.reason ?? null,
    });
    await recordCoaAudit({
      action: COA_AUDIT_ACTIONS.CONSOLIDATION_CREATE,
      context,
      entityType: 'CoaV2ConsolidationPlan',
      entityId: plan.id,
      newValues: {
        duplicateAccountId: plan.duplicateAccountId,
        canonicalAccountId: plan.canonicalAccountId,
        status: plan.status,
      },
      reason: body.reason ?? null,
    });
    return NextResponse.json({ plan, message: 'Consolidation plan created (pending approval)' }, { status: 201 });
  } catch (error) {
    return coaErrorResponse(error, 'create consolidation plan');
  }
}
