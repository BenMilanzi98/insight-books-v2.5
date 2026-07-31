/**
 * /api/accounting-v2/ledger — canonical General Ledger summary.
 *
 * GET — per-account opening / period movement / closing balances for the
 * session business, derived exclusively from canonical posted journal lines.
 * Query params: startDate, endDate, branchId, includeZero=true|false,
 * view=summary|hierarchy.
 */

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { guardAccountingRoute, accountingErrorResponse } from '@/lib/accountingV2/api/routeGuard.js';
import { ACCOUNTING_PERMISSIONS } from '@/lib/accountingV2/permissions.js';
import {
  getBusinessLedgerSummary,
  getLedgerHierarchy,
} from '@/lib/accountingV2/ledger/ledgerQueryService.js';

function parseDate(value, label) {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw Object.assign(new Error(`Invalid ${label}: ${value}`), { httpStatus: 400 });
  }
  return date;
}

export async function GET(request) {
  const guard = await guardAccountingRoute(request, [ACCOUNTING_PERMISSIONS.LEDGER_VIEW]);
  if (guard.response) return guard.response;
  const { context } = guard;

  try {
    const { searchParams } = new URL(request.url);
    const options = {
      startDate: parseDate(searchParams.get('startDate'), 'startDate'),
      endDate: parseDate(searchParams.get('endDate'), 'endDate'),
      branchId: searchParams.get('branchId') || null,
      includeZeroActivity: searchParams.get('includeZero') === 'true',
    };
    const view = searchParams.get('view') ?? 'summary';
    const result =
      view === 'hierarchy'
        ? await getLedgerHierarchy(prisma, context, options)
        : await getBusinessLedgerSummary(prisma, context, options);
    return NextResponse.json(result);
  } catch (error) {
    return accountingErrorResponse(error, 'ledger summary');
  }
}
