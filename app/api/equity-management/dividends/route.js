import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { guardEquityRoute, accountingErrorResponse } from '@/lib/equityManagement/api/routeGuard.js';
import { EQUITY_PERMISSIONS } from '@/lib/equityManagement/permissions.js';
import {
  createDividendDeclaration,
  postDividendDeclaration,
  payDividendAllocation,
} from '@/lib/equityManagement/application/dividendService.js';

export async function GET(request) {
  const guard = await guardEquityRoute(request, EQUITY_PERMISSIONS.VIEW_DIVIDENDS);
  if (guard.response) return guard.response;
  try {
    const declarations = await prisma.eqV2DividendDeclaration.findMany({
      where: { tenantId: guard.context.businessId },
      include: { allocations: true, payments: true },
      orderBy: { declarationDate: 'desc' },
    });
    return NextResponse.json({ declarations });
  } catch (error) {
    return accountingErrorResponse(error, 'list dividends');
  }
}

export async function POST(request) {
  const guard = await guardEquityRoute(request, EQUITY_PERMISSIONS.DECLARE_DIVIDEND);
  if (guard.response) return guard.response;
  try {
    const body = await request.json();
    if (body.action === 'pay') {
      const result = await payDividendAllocation(prisma, guard.context, body, {
        hasPermission: guard.can,
      });
      return NextResponse.json(result, { status: 201 });
    }
    if (body.action === 'post' && body.declarationId) {
      const result = await postDividendDeclaration(prisma, guard.context, body.declarationId, {
        hasPermission: guard.can,
      });
      return NextResponse.json(result);
    }
    const declaration = await createDividendDeclaration(prisma, guard.context, body);
    return NextResponse.json({ declaration }, { status: 201 });
  } catch (error) {
    return accountingErrorResponse(error, 'dividend action');
  }
}
