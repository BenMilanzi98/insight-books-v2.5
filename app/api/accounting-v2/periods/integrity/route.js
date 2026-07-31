/**
 * /api/accounting-v2/periods/integrity
 *
 * GET — calendar integrity audit (PER-101…PER-110), business readiness
 * assessment and monitoring findings for the session business.
 */

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { guardAccountingRoute, accountingErrorResponse } from '@/lib/accountingV2/api/routeGuard.js';
import { ACCOUNTING_PERMISSIONS } from '@/lib/accountingV2/permissions.js';
import { runCalendarIntegrityAudit } from '@/lib/accountingV2/periods/calendarIntegrityService.js';
import { assessPeriodReadiness } from '@/lib/accountingV2/periods/periodReadinessService.js';
import { runPeriodMonitoring } from '@/lib/accountingV2/periods/periodMonitoringService.js';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const guard = await guardAccountingRoute(request, [
    ACCOUNTING_PERMISSIONS.PERIODS_VIEW,
    ACCOUNTING_PERMISSIONS.PERIODS_VIEW_AUDIT,
    ACCOUNTING_PERMISSIONS.DIAGNOSTICS_VIEW,
  ]);
  if (guard.response) return guard.response;
  try {
    const [integrity, readiness, monitoring] = await Promise.all([
      runCalendarIntegrityAudit(prisma, guard.context),
      assessPeriodReadiness(prisma, guard.context),
      runPeriodMonitoring(prisma, guard.context),
    ]);
    return NextResponse.json({ integrity, readiness, monitoring });
  } catch (error) {
    return accountingErrorResponse(error, 'run period integrity audit');
  }
}
