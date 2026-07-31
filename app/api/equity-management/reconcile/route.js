import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { guardEquityRoute, accountingErrorResponse } from '@/lib/equityManagement/api/routeGuard.js';
import { EQUITY_PERMISSIONS } from '@/lib/equityManagement/permissions.js';
import { runEquityReconciliation } from '@/lib/equityManagement/application/reconciliationService.js';

export async function POST(request) {
  const guard = await guardEquityRoute(request, EQUITY_PERMISSIONS.RECONCILE);
  if (guard.response) return guard.response;
  try {
    const body = await request.json().catch(() => ({}));
    const run = await runEquityReconciliation(prisma, guard.context, {
      asOfDate: body.asOfDate,
    });
    return NextResponse.json({ run });
  } catch (error) {
    return accountingErrorResponse(error, 'equity reconciliation');
  }
}
