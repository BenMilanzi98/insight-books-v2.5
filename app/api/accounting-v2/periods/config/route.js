/**
 * /api/accounting-v2/periods/config
 *
 * GET — the business financial calendar configuration (defaults applied).
 * PUT — update configuration (audited; lock-date changes require a reason).
 */

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { guardAccountingRoute, accountingErrorResponse } from '@/lib/accountingV2/api/routeGuard.js';
import { ACCOUNTING_PERMISSIONS } from '@/lib/accountingV2/permissions.js';
import { getCalendarConfig, updateCalendarConfig } from '@/lib/accountingV2/periods/calendarConfigService.js';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const guard = await guardAccountingRoute(request, [
    ACCOUNTING_PERMISSIONS.PERIODS_VIEW,
    ACCOUNTING_PERMISSIONS.FY_CONFIGURE,
    ACCOUNTING_PERMISSIONS.VIEW,
  ]);
  if (guard.response) return guard.response;
  try {
    const config = await getCalendarConfig(prisma, guard.context);
    return NextResponse.json({ config });
  } catch (error) {
    return accountingErrorResponse(error, 'load calendar configuration');
  }
}

export async function PUT(request) {
  const guard = await guardAccountingRoute(request, [ACCOUNTING_PERMISSIONS.FY_CONFIGURE]);
  if (guard.response) return guard.response;
  try {
    const body = await request.json().catch(() => ({}));
    const config = await updateCalendarConfig(prisma, guard.context, body, { reason: body.reason ?? null });
    return NextResponse.json({ config });
  } catch (error) {
    if (error instanceof RangeError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return accountingErrorResponse(error, 'update calendar configuration');
  }
}
