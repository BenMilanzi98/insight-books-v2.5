/**
 * /api/accounting-v2/periods
 *
 * GET — canonical accounting periods for the session business, with the
 * calendar summary (current year/period, close position). Optional filters:
 * ?financialYearId= & ?status=
 */

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { guardAccountingRoute, accountingErrorResponse } from '@/lib/accountingV2/api/routeGuard.js';
import { ACCOUNTING_PERMISSIONS } from '@/lib/accountingV2/permissions.js';
import { getCalendarSummary } from '@/lib/accountingV2/periods/calendarIntegrityService.js';
import { getCalendarConfig } from '@/lib/accountingV2/periods/calendarConfigService.js';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const guard = await guardAccountingRoute(request, [
    ACCOUNTING_PERMISSIONS.PERIODS_VIEW,
    ACCOUNTING_PERMISSIONS.VIEW,
  ]);
  if (guard.response) return guard.response;
  try {
    const { searchParams } = new URL(request.url);
    const where = { tenantId: guard.context.businessId };
    if (searchParams.get('financialYearId')) where.financialYearId = searchParams.get('financialYearId');
    if (searchParams.get('status')) where.status = searchParams.get('status');

    const [periods, summary, config] = await Promise.all([
      prisma.acctV2AccountingPeriod.findMany({ where, orderBy: { startDate: 'asc' } }),
      getCalendarSummary(prisma, guard.context),
      getCalendarConfig(prisma, guard.context),
    ]);
    return NextResponse.json({
      periods,
      summary,
      config: {
        fyStartMonth: config.fyStartMonth,
        timezone: config.timezone,
        checklistTemplateId: config.checklistTemplateId,
        checklistTemplateVersion: config.checklistTemplateVersion,
      },
    });
  } catch (error) {
    return accountingErrorResponse(error, 'list accounting periods');
  }
}
