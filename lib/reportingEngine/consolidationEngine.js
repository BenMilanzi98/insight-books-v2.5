/**
 * Group consolidation: FX translation, harmonized CoA keys, inter-company eliminations.
 */
import prisma from '@/lib/prisma';
import { getExchangeRate } from '@/lib/currencyService';
import { addMoney, multiplyMoney, parseMoney, roundMoney, subtractMoney } from '@/lib/money';
import {
  classifyIntercompanyAccount,
  resolveHarmonizedAccountCode,
} from '@/lib/reportingEngine/harmonizedCoaMap';

/**
 * @param {string[]} tenantIds
 * @returns {Promise<Map<string, string>>} tenantId → currency code
 */
export async function loadTenantCurrencyMap(tenantIds) {
  const settings = await prisma.tenantSettings.findMany({
    where: { tenantId: { in: tenantIds } },
    select: { tenantId: true, currencyCode: true },
  });
  const map = new Map();
  for (const tid of tenantIds) {
    const row = settings.find((s) => s.tenantId === tid);
    map.set(tid, row?.currencyCode || 'MWK');
  }
  return map;
}

/**
 * Pick reporting currency: explicit param, else primary tenant currency, else MWK.
 * @param {string[]} tenantIds
 * @param {string|null|undefined} requested
 * @param {Map<string, string>} currencyMap
 */
export function resolveReportingCurrency(tenantIds, requested, currencyMap) {
  const normalized = String(requested || '').trim().toUpperCase();
  if (normalized.length === 3) return normalized;
  const primary = tenantIds[0];
  return currencyMap.get(primary) || 'MWK';
}

/**
 * Convert a single amount to reporting currency.
 */
export async function convertAmountForReporting(
  amount,
  fromCurrency,
  reportingCurrency,
  asOfDate = null
) {
  const value = parseMoney(amount);
  if (!value || fromCurrency === reportingCurrency) return value;
  const rate = await getExchangeRate(fromCurrency, reportingCurrency, asOfDate);
  return roundMoney(multiplyMoney(value, rate));
}

/**
 * Multiply all numeric top-level statement fields by FX rate (in-place copy).
 */
export function scaleStatementAmounts(statement, fxRate) {
  if (!statement || Math.abs(fxRate - 1) < 1e-9) return statement;
  const scale = (n) => roundMoney(multiplyMoney(parseMoney(n), fxRate));

  const scaled = { ...statement };
  if (scaled.totalRevenue != null) scaled.totalRevenue = scale(scaled.totalRevenue);
  if (scaled.grossProfit != null) scaled.grossProfit = scale(scaled.grossProfit);
  if (scaled.totalOperatingExpenses != null) {
    scaled.totalOperatingExpenses = scale(scaled.totalOperatingExpenses);
  }
  if (scaled.netIncome != null) scaled.netIncome = scale(scaled.netIncome);
  if (scaled.operatingIncome != null) scaled.operatingIncome = scale(scaled.operatingIncome);
  if (scaled.cogs?.total != null) {
    scaled.cogs = { ...scaled.cogs, total: scale(scaled.cogs.total) };
  }
  if (scaled.totalAssets != null) scaled.totalAssets = scale(scaled.totalAssets);
  if (scaled.totalLiabilities != null) scaled.totalLiabilities = scale(scaled.totalLiabilities);
  if (scaled.totalEquity != null) scaled.totalEquity = scale(scaled.totalEquity);
  return scaled;
}

/**
 * Scale trial balance row debits/credits.
 */
export function scaleTrialBalanceRow(row, fxRate) {
  if (Math.abs(fxRate - 1) < 1e-9) return row;
  const scale = (n) => roundMoney(multiplyMoney(parseMoney(n), fxRate));
  return {
    ...row,
    debit: scale(row.debit ?? row.debitBalance ?? row.debitTotal ?? 0),
    credit: scale(row.credit ?? row.creditBalance ?? row.creditTotal ?? 0),
    debitBalance: scale(row.debitBalance ?? row.debit ?? 0),
    creditBalance: scale(row.creditBalance ?? row.credit ?? 0),
    debitTotal: scale(row.debitTotal ?? row.debit ?? 0),
    creditTotal: scale(row.creditTotal ?? row.credit ?? 0),
  };
}

/**
 * Extract inter-company receivable/payable balances from trial balance accounts.
 * @param {object[]} accounts
 * @returns {{ icReceivable: number, icPayable: number, items: object[] }}
 */
export function extractIntercompanyBalances(accounts) {
  let icReceivable = 0;
  let icPayable = 0;
  const items = [];

  for (const row of accounts || []) {
    const icType = classifyIntercompanyAccount(row);
    if (!icType) continue;

    const debit = parseMoney(row.debitBalance ?? row.debit ?? row.debitTotal ?? 0);
    const credit = parseMoney(row.creditBalance ?? row.credit ?? row.creditTotal ?? 0);
    const net = icType === 'receivable' ? subtractMoney(debit, credit) : subtractMoney(credit, debit);
    const amount = Math.max(0, net);

    if (amount <= 0) continue;

    if (icType === 'receivable') {
      icReceivable = addMoney(icReceivable, amount);
    } else {
      icPayable = addMoney(icPayable, amount);
    }

    items.push({
      accountCode: row.accountCode || row.code,
      accountName: row.accountName || row.name,
      type: icType,
      amount,
    });
  }

  return {
    icReceivable: roundMoney(icReceivable),
    icPayable: roundMoney(icPayable),
    items,
  };
}

/**
 * Compute net inter-company elimination (min of total IC receivable vs payable across entities).
 * @param {{ tenantId: string, tenantName: string, icReceivable: number, icPayable: number }[]} perTenant
 */
export function computeIntercompanyElimination(perTenant) {
  let totalReceivable = 0;
  let totalPayable = 0;

  for (const row of perTenant) {
    totalReceivable = addMoney(totalReceivable, row.icReceivable);
    totalPayable = addMoney(totalPayable, row.icPayable);
  }

  const eliminationAmount = roundMoney(Math.min(totalReceivable, totalPayable));

  return {
    totalIntercompanyReceivable: roundMoney(totalReceivable),
    totalIntercompanyPayable: roundMoney(totalPayable),
    eliminationAmount,
    perTenant,
    applied: eliminationAmount > 0,
  };
}

/**
 * Apply elimination to consolidated balance sheet totals.
 */
export function applyEliminationToBalanceSheetTotals(totals, eliminationAmount) {
  if (!eliminationAmount || eliminationAmount <= 0) return totals;

  const totalAssets = subtractMoney(totals.totalAssets, eliminationAmount);
  const totalLiabilities = subtractMoney(totals.totalLiabilities, eliminationAmount);
  const totalLiabilitiesAndEquity = addMoney(totalLiabilities, totals.totalEquity);
  const difference = Math.abs(roundMoney(subtractMoney(totalAssets, totalLiabilitiesAndEquity)));

  return {
    ...totals,
    totalAssets: roundMoney(Math.max(0, totalAssets)),
    totalLiabilities: roundMoney(Math.max(0, totalLiabilities)),
    totalLiabilitiesAndEquity: roundMoney(totalLiabilitiesAndEquity),
    difference,
    isBalanced: difference < 0.01,
  };
}

/**
 * Build harmonized consolidation key for trial balance merge.
 */
export function harmonizedTrialBalanceKey(row) {
  const code = resolveHarmonizedAccountCode(row.accountCode || row.code);
  const type = row.accountType || row.type || 'Other';
  return `${type}::${code}`;
}

/**
 * Build consolidation metadata for report UI and exports.
 */
export function buildConsolidationMetadata({
  reportingCurrency,
  currencyByTenant,
  fxApplied,
  intercompanyElimination,
  harmonizedCoa = true,
}) {
  const currenciesUsed = [...new Set(currencyByTenant?.values?.() || [])];
  return {
    reportingCurrency,
    currenciesUsed,
    fxTranslationApplied: Boolean(fxApplied && currenciesUsed.length > 1),
    harmonizedCoa,
    intercompanyElimination: intercompanyElimination?.applied
      ? {
          eliminationAmount: intercompanyElimination.eliminationAmount,
          totalIntercompanyReceivable: intercompanyElimination.totalIntercompanyReceivable,
          totalIntercompanyPayable: intercompanyElimination.totalIntercompanyPayable,
          perTenant: intercompanyElimination.perTenant,
        }
      : null,
    notes: buildConsolidationNotes({
      reportingCurrency,
      currenciesUsed,
      fxApplied,
      intercompanyElimination,
      harmonizedCoa,
    }),
  };
}

function buildConsolidationNotes({
  reportingCurrency,
  currenciesUsed,
  fxApplied,
  intercompanyElimination,
  harmonizedCoa,
}) {
  const notes = [];
  if (harmonizedCoa) {
    notes.push('Account codes harmonized to group chart before aggregation.');
  }
  if (fxApplied && currenciesUsed.length > 1) {
    notes.push(
      `Amounts translated to ${reportingCurrency} using exchange rates on the report date.`
    );
  }
  if (intercompanyElimination?.applied) {
    notes.push(
      `Inter-company elimination of ${intercompanyElimination.eliminationAmount} applied (due from/to related entities).`
    );
  }
  return notes;
}

/**
 * Prepare consolidation context for multi-tenant reports.
 */
export async function prepareConsolidationContext({
  tenantIds,
  reportingCurrency: requestedCurrency,
  asOfDate,
}) {
  const currencyMap = await loadTenantCurrencyMap(tenantIds);
  const reportingCurrency = resolveReportingCurrency(
    tenantIds,
    requestedCurrency,
    currencyMap
  );

  const fxRatesByTenant = new Map();
  for (const tid of tenantIds) {
    const from = currencyMap.get(tid) || 'MWK';
    if (from === reportingCurrency) {
      fxRatesByTenant.set(tid, 1);
    } else {
      const rate = await getExchangeRate(from, reportingCurrency, asOfDate);
      fxRatesByTenant.set(tid, rate);
    }
  }

  const fxApplied = [...currencyMap.values()].some((c) => c !== reportingCurrency);

  return {
    reportingCurrency,
    currencyMap,
    fxRatesByTenant,
    fxApplied,
  };
}
