import prisma from '@/lib/prisma';
import { getBusinessLedgerSummary } from '@/lib/accountingV2/ledger/ledgerQueryService.js';
import { classifyAccountKind } from '../domain/variance.js';
import { minorToNumber } from '../domain/money.js';

/**
 * Authoritative Budget Actuals from posted Accounting V2 journals.
 * Never reads sales/expense operational tables. Never stores actuals.
 */
export async function resolveBudgetActuals({
  tenantId,
  businessId,
  startDate,
  endDate,
  branchId = null,
  accountIds = null,
  db = prisma,
} = {}) {
  if (!tenantId) {
    const err = new Error('tenantId required');
    err.status = 400;
    throw err;
  }
  const context = { businessId: businessId || tenantId, tenantId };

  let summary;
  try {
    summary = await getBusinessLedgerSummary(db, context, {
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      branchId: branchId || null,
      includeZeroActivity: false,
    });
  } catch (e) {
    const err = new Error(e?.message || 'Failed to resolve ledger actuals');
    err.status = 500;
    err.code = 'ACTUALS_RESOLUTION_FAILED';
    throw err;
  }

  const filterSet = accountIds ? new Set(accountIds) : null;
  const byAccount = new Map();

  for (const r of summary.accounts || []) {
    if (r.isHeader) continue;
    if (filterSet && !filterSet.has(r.accountId)) continue;

    const kind = classifyAccountKind(r.accountType, r.coaV2Category || r.accountCategory);
    const periodDebit = Number(r.periodDebitMinor || 0);
    const periodCredit = Number(r.periodCreditMinor || 0);
    // Natural-positive P&L: revenue credits positive; expenses debits positive
    const sign = kind === 'REVENUE' || kind === 'OTHER_INCOME' || kind === 'LIABILITY' || kind === 'EQUITY'
      ? -1
      : 1;
    const actualMinor = sign * (periodDebit - periodCredit);

    byAccount.set(r.accountId, {
      accountId: r.accountId,
      accountCode: r.accountCode,
      accountName: r.accountName,
      accountType: r.accountType,
      accountCategory: r.coaV2Category || r.accountCategory,
      kind,
      rawDebitMinor: periodDebit,
      rawCreditMinor: periodCredit,
      actualMinor,
      lineCount: r.lineCount || 0,
      isHeader: false,
    });
  }

  return {
    tenantId,
    businessId: context.businessId,
    startDate,
    endDate,
    branchId,
    calculationVersion: 'bf-actuals-v1',
    source: 'ACCOUNTING_V2_CANONICAL_JOURNAL',
    accounts: [...byAccount.values()],
    byAccount,
    freshness: new Date().toISOString(),
  };
}

export function sumActualsByKind(actualsResult) {
  const totals = { revenue: 0, expense: 0, cogs: 0, other: 0 };
  for (const a of actualsResult.accounts || []) {
    const n = minorToNumber(a.actualMinor);
    if (a.kind === 'REVENUE' || a.kind === 'OTHER_INCOME') totals.revenue += n;
    else if (a.kind === 'COST_OF_SALES') totals.cogs += n;
    else if (a.kind === 'EXPENSE' || a.kind === 'OTHER_EXPENSE') totals.expense += n;
    else totals.other += n;
  }
  return totals;
}
