/**
 * /api/accounting-v2/reports/cache — rebuild / reconcile the report cache.
 * POST { action: 'rebuild'|'reconcile', reportType? }
 */

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { guardAccountingRoute, accountingErrorResponse } from '@/lib/accountingV2/api/routeGuard.js';
import { ACCOUNTING_PERMISSIONS } from '@/lib/accountingV2/permissions.js';
import { rebuildReportCache, reconcileReportCache } from '@/lib/accountingV2/reporting/reportCacheService.js';
import { recordAccountingAudit } from '@/lib/accountingV2/infrastructure/auditTrail.js';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  const guard = await guardAccountingRoute(request, [ACCOUNTING_PERMISSIONS.REPORTS_REBUILD_CACHE]);
  if (guard.response) return guard.response;
  try {
    const body = await request.json().catch(() => ({}));
    let result;
    if (body.action === 'reconcile') {
      result = await reconcileReportCache(prisma, guard.context, null);
    } else {
      result = await rebuildReportCache(prisma, guard.context, { reportType: body.reportType ?? null });
    }
    await recordAccountingAudit(
      {
        action: 'acctv2.report.cacheRebuild',
        entityType: 'AcctV2ReportCache',
        entityId: guard.context.businessId,
        userId: guard.context.userId,
        tenantId: guard.context.businessId,
        newValues: { action: body.action ?? 'rebuild', reportType: body.reportType ?? null, result },
        requestId: guard.context.requestId,
      },
      prisma
    );
    return NextResponse.json(result);
  } catch (error) {
    return accountingErrorResponse(error, 'report cache maintenance');
  }
}
