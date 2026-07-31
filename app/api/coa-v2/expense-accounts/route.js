/**
 * GET /api/coa-v2/expense-accounts — valid expense posting accounts only
 * (Phase 3 §21). Governed replacement for name-matched expense selectors.
 *
 * ?includeCostOfSales=true opts purchase flows into COST_OF_SALES accounts.
 */

import { NextResponse } from 'next/server';
import { guardCoaRoute, coaErrorResponse } from '@/lib/coaV2/api/routeGuard.js';
import { ACCOUNTING_PERMISSIONS } from '@/lib/accountingV2/permissions.js';
import { getValidExpensePostingAccounts } from '@/lib/coaV2/application/expenseAccountQuery.js';

export async function GET(request) {
  const guard = await guardCoaRoute(request, [
    ACCOUNTING_PERMISSIONS.COA_VIEW,
    'accounts.view',
    'expenses.view',
  ]);
  if (guard.response) return guard.response;
  const { context } = guard;

  try {
    const { searchParams } = new URL(request.url);
    const includeCostOfSales = searchParams.get('includeCostOfSales') === 'true';
    const accounts = await getValidExpensePostingAccounts(context, { includeCostOfSales });
    return NextResponse.json({ accounts, total: accounts.length });
  } catch (error) {
    return coaErrorResponse(error, 'list valid expense accounts');
  }
}
