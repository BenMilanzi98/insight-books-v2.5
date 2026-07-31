/**
 * GET /api/coa-v2/validate — run the CoA Integrity Service (COA-001..COA-025)
 * for the session business and return grouped findings.
 */

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { guardCoaRoute, coaErrorResponse } from '@/lib/coaV2/api/routeGuard.js';
import { ACCOUNTING_PERMISSIONS } from '@/lib/accountingV2/permissions.js';
import { runCoaIntegrityAudit } from '@/lib/accountingAudit/coaIntegrityAudit.js';
import { recordCoaAudit, COA_AUDIT_ACTIONS } from '@/lib/coaV2/infrastructure/coaAudit.js';

export async function GET(request) {
  const guard = await guardCoaRoute(request, [
    ACCOUNTING_PERMISSIONS.COA_RUN_VALIDATION,
    ACCOUNTING_PERMISSIONS.COA_VIEW,
    'accounts.view',
  ]);
  if (guard.response) return guard.response;
  const { context } = guard;

  try {
    const result = await runCoaIntegrityAudit(prisma, { tenantId: context.businessId });
    const findings = result.findings ?? [];

    const bySeverity = {};
    const byCheck = {};
    for (const f of findings) {
      bySeverity[f.severity] = (bySeverity[f.severity] ?? 0) + 1;
      byCheck[f.ruleCode] = (byCheck[f.ruleCode] ?? 0) + 1;
    }

    await recordCoaAudit({
      action: COA_AUDIT_ACTIONS.VALIDATION_RUN,
      context,
      entityType: 'ChartOfAccounts',
      entityId: context.businessId,
      newValues: { findingCount: findings.length, bySeverity },
    });

    return NextResponse.json({
      businessId: context.businessId,
      findingCount: findings.length,
      bySeverity,
      byCheck,
      summary: result.summary ?? null,
      findings,
    });
  } catch (error) {
    return coaErrorResponse(error, 'validate chart of accounts');
  }
}
