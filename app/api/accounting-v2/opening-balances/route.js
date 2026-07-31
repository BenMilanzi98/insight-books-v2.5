/**
 * /api/accounting-v2/opening-balances — controlled opening-balance batches.
 *
 * GET  — list batches for the session business.
 * POST — create a batch (balanced lines + mandatory evidence reference).
 */

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { guardAccountingRoute, accountingErrorResponse } from '@/lib/accountingV2/api/routeGuard.js';
import { ACCOUNTING_PERMISSIONS } from '@/lib/accountingV2/permissions.js';
import { createOpeningBalanceBatch } from '@/lib/accountingV2/application/openingBalanceService.js';

export async function GET(request) {
  const guard = await guardAccountingRoute(request, [
    ACCOUNTING_PERMISSIONS.OPENING_BALANCES_CREATE,
    ACCOUNTING_PERMISSIONS.OPENING_BALANCES_APPROVE,
    ACCOUNTING_PERMISSIONS.POSTING_VIEW,
  ]);
  if (guard.response) return guard.response;
  const { context } = guard;

  try {
    const batches = await prisma.acctV2OpeningBalanceBatch.findMany({
      where: { tenantId: context.businessId },
      orderBy: [{ effectiveDate: 'desc' }, { version: 'desc' }],
    });
    return NextResponse.json({ batches, total: batches.length });
  } catch (error) {
    return accountingErrorResponse(error, 'list opening-balance batches');
  }
}

export async function POST(request) {
  const guard = await guardAccountingRoute(request, ACCOUNTING_PERMISSIONS.OPENING_BALANCES_CREATE);
  if (guard.response) return guard.response;
  const { context, can } = guard;

  try {
    const body = await request.json();
    const batch = await createOpeningBalanceBatch(
      context,
      {
        effectiveDate: body.effectiveDate,
        version: body.version,
        description: body.description,
        evidenceReference: body.evidenceReference,
        currency: body.currency,
        lines: body.lines,
      },
      { hasPermission: can }
    );
    return NextResponse.json({ batch }, { status: 201 });
  } catch (error) {
    return accountingErrorResponse(error, 'create opening-balance batch');
  }
}
