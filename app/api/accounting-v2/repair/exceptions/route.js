/**
 * /api/accounting-v2/repair/exceptions — exception register (read).
 *
 * GET — list exceptions for the session business. Exceptions are created via
 * the anomaly mark-exception action and stay visible to Phase 7 reporting.
 */

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { guardAccountingRoute, accountingErrorResponse } from '@/lib/accountingV2/api/routeGuard.js';
import { ACCOUNTING_PERMISSIONS } from '@/lib/accountingV2/permissions.js';

export async function GET(request) {
  const guard = await guardAccountingRoute(request, [ACCOUNTING_PERMISSIONS.REPAIR_VIEW]);
  if (guard.response) return guard.response;
  try {
    const { searchParams } = new URL(request.url);
    const exceptions = await prisma.acctV2RepairException.findMany({
      where: {
        tenantId: guard.context.businessId,
        ...(searchParams.get('status') ? { status: searchParams.get('status') } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return NextResponse.json({ exceptions });
  } catch (error) {
    return accountingErrorResponse(error, 'repair exceptions list');
  }
}
