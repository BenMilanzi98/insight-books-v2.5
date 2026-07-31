import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { guardEquityRoute, accountingErrorResponse } from '@/lib/equityManagement/api/routeGuard.js';
import { EQUITY_PERMISSIONS } from '@/lib/equityManagement/permissions.js';
import {
  listActiveHoldings,
  buildCapitalizationTable,
  createShareClass,
  approveShareClass,
} from '@/lib/equityManagement/application/ownershipService.js';

export async function GET(request) {
  const guard = await guardEquityRoute(request, [
    EQUITY_PERMISSIONS.VIEW_HOLDINGS,
    EQUITY_PERMISSIONS.VIEW,
  ]);
  if (guard.response) return guard.response;
  try {
    const { searchParams } = new URL(request.url);
    const asOf = searchParams.get('asOfDate') || undefined;
    if (searchParams.get('capTable') === '1') {
      const table = await buildCapitalizationTable(prisma, guard.context.businessId, asOf);
      return NextResponse.json({ capitalizationTable: table });
    }
    const holdings = await listActiveHoldings(prisma, guard.context.businessId, asOf);
    return NextResponse.json({ holdings });
  } catch (error) {
    return accountingErrorResponse(error, 'list holdings');
  }
}

export async function POST(request) {
  const guard = await guardEquityRoute(request, EQUITY_PERMISSIONS.MANAGE_SHARE_CLASSES);
  if (guard.response) return guard.response;
  try {
    const body = await request.json();
    if (body.action === 'approveShareClass' && body.shareClassId) {
      const shareClass = await approveShareClass(prisma, guard.context, body.shareClassId);
      return NextResponse.json({ shareClass });
    }
    const shareClass = await createShareClass(prisma, guard.context, body);
    return NextResponse.json({ shareClass }, { status: 201 });
  } catch (error) {
    return accountingErrorResponse(error, 'share class / holdings');
  }
}
