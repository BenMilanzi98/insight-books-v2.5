/**
 * /api/accounting-v2/ledger/reconciliation — ledger reconciliation run.
 *
 * POST — runs the read-only reconciliation suite for the session business:
 * canonical double-entry invariant, stored-balance drift (GL-111), projection
 * staleness (GL-114), legacy trial-balance comparison (GL-115) and journal
 * structure checks (JRN-1xx). Body: { startDate?, endDate?,
 * compareLegacyTrialBalance? }. Nothing is mutated; every run is audited.
 */

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { guardAccountingRoute, accountingErrorResponse } from '@/lib/accountingV2/api/routeGuard.js';
import { ACCOUNTING_PERMISSIONS } from '@/lib/accountingV2/permissions.js';
import { runLedgerReconciliation } from '@/lib/accountingV2/ledger/ledgerReconciliationService.js';
import { getLegacyTrialBalance } from '@/lib/accountingV2/infrastructure/legacy/legacyTrialBalanceAdapter.js';

function parseDate(value) {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export async function POST(request) {
  const guard = await guardAccountingRoute(request, [
    ACCOUNTING_PERMISSIONS.LEDGER_RECONCILE,
    ACCOUNTING_PERMISSIONS.LEDGER_VIEW_INTEGRITY,
  ]);
  if (guard.response) return guard.response;
  const { context } = guard;
  try {
    const body = await request.json().catch(() => ({}));
    const report = await runLedgerReconciliation(prisma, context, {
      startDate: parseDate(body.startDate),
      endDate: parseDate(body.endDate),
      compareLegacyTrialBalance: body.compareLegacyTrialBalance !== false,
      legacyTrialBalanceFn: getLegacyTrialBalance,
    });
    return NextResponse.json({ report });
  } catch (error) {
    return accountingErrorResponse(error, 'ledger reconciliation');
  }
}
