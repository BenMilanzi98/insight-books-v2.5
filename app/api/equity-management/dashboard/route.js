import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { guardEquityRoute, accountingErrorResponse } from '@/lib/equityManagement/api/routeGuard.js';
import { EQUITY_PERMISSIONS } from '@/lib/equityManagement/permissions.js';
import { getEquityDashboard } from '@/lib/equityManagement/application/capitalAccountService.js';

export async function GET(request) {
  const guard = await guardEquityRoute(request, [
    EQUITY_PERMISSIONS.VIEW_DASHBOARD,
    EQUITY_PERMISSIONS.VIEW,
  ]);
  if (guard.response) return guard.response;
  try {
    const dashboard = await getEquityDashboard(prisma, guard.context);
    return NextResponse.json({ dashboard });
  } catch (error) {
    return accountingErrorResponse(error, 'equity dashboard');
  }
}
