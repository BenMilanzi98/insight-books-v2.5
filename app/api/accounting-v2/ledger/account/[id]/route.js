/**
 * /api/accounting-v2/ledger/account/[id] — canonical account activity.
 *
 * GET — opening balance, canonical posted lines with chronological running
 * balances, period totals and closing balance for one account (merge-survivor
 * rollup). Query params: startDate, endDate, branchId, currency, dimensionKey,
 * dimensionValue, page, pageSize, order=asc|desc.
 */

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { guardAccountingRoute, accountingErrorResponse } from '@/lib/accountingV2/api/routeGuard.js';
import { ACCOUNTING_PERMISSIONS } from '@/lib/accountingV2/permissions.js';
import { getAccountLedger } from '@/lib/accountingV2/ledger/ledgerQueryService.js';

function parseDate(value, label) {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw Object.assign(new Error(`Invalid ${label}: ${value}`), { httpStatus: 400 });
  }
  return date;
}

export async function GET(request, { params }) {
  const guard = await guardAccountingRoute(request, [ACCOUNTING_PERMISSIONS.LEDGER_VIEW]);
  if (guard.response) return guard.response;
  const { context } = guard;

  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const result = await getAccountLedger(prisma, context, {
      accountId: id,
      startDate: parseDate(searchParams.get('startDate'), 'startDate'),
      endDate: parseDate(searchParams.get('endDate'), 'endDate'),
      branchId: searchParams.get('branchId') || null,
      currency: searchParams.get('currency') || null,
      dimensionKey: searchParams.get('dimensionKey') || null,
      dimensionValue: searchParams.get('dimensionValue') || null,
      page: Number(searchParams.get('page') ?? 1),
      pageSize: Number(searchParams.get('pageSize') ?? 50),
      order: searchParams.get('order') === 'desc' ? 'desc' : 'asc',
    });
    return NextResponse.json(result);
  } catch (error) {
    return accountingErrorResponse(error, 'account ledger');
  }
}
