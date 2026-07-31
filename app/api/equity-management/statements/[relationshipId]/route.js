import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { guardEquityRoute, accountingErrorResponse } from '@/lib/equityManagement/api/routeGuard.js';
import { EQUITY_PERMISSIONS } from '@/lib/equityManagement/permissions.js';
import { getOwnerCapitalStatement } from '@/lib/equityManagement/application/capitalAccountService.js';

export async function GET(request, { params }) {
  const guard = await guardEquityRoute(request, [
    EQUITY_PERMISSIONS.VIEW_STATEMENTS,
    EQUITY_PERMISSIONS.VIEW,
  ]);
  if (guard.response) return guard.response;
  try {
    const { relationshipId } = await params;
    const { searchParams } = new URL(request.url);
    const statement = await getOwnerCapitalStatement(prisma, guard.context, relationshipId, {
      fromDate: searchParams.get('fromDate') || undefined,
      toDate: searchParams.get('toDate') || undefined,
    });
    return NextResponse.json({ statement });
  } catch (error) {
    return accountingErrorResponse(error, 'owner capital statement');
  }
}
