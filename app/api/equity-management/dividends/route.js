import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { guardEquityRoute, accountingErrorResponse } from '@/lib/equityManagement/api/routeGuard.js';
import { EQUITY_PERMISSIONS } from '@/lib/equityManagement/permissions.js';
import {
  declareAndPostDividend,
  payDividendDeclaration,
  payDividendAllocation,
  createDividendDeclaration,
  postDividendDeclaration,
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
  const guard = await guardEquityRoute(request, [
    EQUITY_PERMISSIONS.DECLARE_DIVIDEND,
    EQUITY_PERMISSIONS.APPROVE_DIVIDEND,
    EQUITY_PERMISSIONS.PAY_DIVIDEND,
  ]);
  if (guard.response) return guard.response;
  try {
    const body = await request.json();
    const opts = { hasPermission: guard.can };

    // Simple UI: declare+post
    if (body.action === 'declare' || body.action === 'declareAndPost') {
      const result = await declareAndPostDividend(prisma, guard.context, body, opts);
      return NextResponse.json(result, { status: 201 });
    }

    // Simple UI: pay entire declaration
    if (body.action === 'payDeclaration' || (body.action === 'pay' && body.declarationId && !body.allocationId)) {
      const result = await payDividendDeclaration(prisma, guard.context, body, opts);
      return NextResponse.json(result, { status: 201 });
    }

    if (body.action === 'pay' && body.allocationId) {
      const result = await payDividendAllocation(prisma, guard.context, body, opts);
      return NextResponse.json(result, { status: 201 });
    }

    if (body.action === 'post' && body.declarationId) {
      const result = await postDividendDeclaration(prisma, guard.context, body.declarationId, opts);
      return NextResponse.json(result);
    }

    // Legacy: create draft only
    const declaration = await createDividendDeclaration(prisma, guard.context, body);
    return NextResponse.json({ declaration }, { status: 201 });
  } catch (error) {
    return accountingErrorResponse(error, 'dividend action');
  }
}
