/**
 * Multi-tenant financial report aggregation with group consolidation:
 * FX translation, harmonized CoA mapping, and inter-company eliminations.
 */
import { addMoney, parseMoney, roundMoney, subtractMoney } from '@/lib/money';
import { generateIncomeStatementFromAccounts } from '@/lib/incomeStatementService';
import { generateBalanceSheetFromAccounts } from '@/lib/balanceSheetService';
import { buildTrialBalance } from '@/lib/trialBalanceReport';
import {
  applyIncomeStatementCogsPolicy,
  tenantIncludesCogsInReports,
} from '@/lib/tenantCogsReporting';
import prisma from '@/lib/prisma';
import { buildReportScopeMetadata } from '@/lib/reportTenantScope';
import {
  applyEliminationToBalanceSheetTotals,
  buildConsolidationMetadata,
  computeIntercompanyElimination,
  extractIntercompanyBalances,
  harmonizedTrialBalanceKey,
  prepareConsolidationContext,
  scaleStatementAmounts,
  scaleTrialBalanceRow,
} from '@/lib/reportingEngine/consolidationEngine';
import { resolveHarmonizedAccountCode, classifyIntercompanyAccount } from '@/lib/reportingEngine/harmonizedCoaMap';

function tenantMap(tenants) {
  return new Map((tenants || []).map((t) => [t.id, t]));
}

function consolidateIncomeStatementTotals(statements) {
  let totalRevenue = 0;
  let grossProfit = 0;
  let totalOperatingExpenses = 0;
  let netIncome = 0;
  let cogsTotal = 0;

  for (const stmt of statements) {
    totalRevenue = addMoney(totalRevenue, parseMoney(stmt?.totalRevenue));
    grossProfit = addMoney(grossProfit, parseMoney(stmt?.grossProfit));
    totalOperatingExpenses = addMoney(
      totalOperatingExpenses,
      parseMoney(stmt?.totalOperatingExpenses)
    );
    netIncome = addMoney(netIncome, parseMoney(stmt?.netIncome ?? stmt?.operatingIncome));
    cogsTotal = addMoney(
      cogsTotal,
      parseMoney(stmt?.cogs?.total ?? stmt?.cogs?.costOfProductsSold ?? 0)
    );
  }

  return {
    totalRevenue: roundMoney(totalRevenue),
    grossProfit: roundMoney(grossProfit),
    totalOperatingExpenses: roundMoney(totalOperatingExpenses),
    netIncome: roundMoney(netIncome),
    cogs: { total: roundMoney(cogsTotal) },
  };
}

function consolidateBalanceSheetTotals(sheets) {
  let totalAssets = 0;
  let totalLiabilities = 0;
  let totalEquity = 0;

  for (const sheet of sheets) {
    totalAssets = addMoney(totalAssets, parseMoney(sheet?.totalAssets));
    totalLiabilities = addMoney(totalLiabilities, parseMoney(sheet?.totalLiabilities));
    totalEquity = addMoney(totalEquity, parseMoney(sheet?.totalEquity ?? sheet?.equity?.total));
  }

  const totalLiabilitiesAndEquity = addMoney(totalLiabilities, totalEquity);
  const difference = Math.abs(roundMoney(subtractMoney(totalAssets, totalLiabilitiesAndEquity)));

  return {
    totalAssets: roundMoney(totalAssets),
    totalLiabilities: roundMoney(totalLiabilities),
    totalEquity: roundMoney(totalEquity),
    totalLiabilitiesAndEquity: roundMoney(totalLiabilitiesAndEquity),
    difference,
    isBalanced: difference < 0.01,
  };
}

/**
 * Generate income statement for one or many tenants.
 */
export async function generateScopedIncomeStatement({
  tenantIds,
  tenants,
  startDate,
  endDate,
  branchId = null,
  scope,
  reportingCurrency = null,
}) {
  const tMap = tenantMap(tenants);
  const byTenant = [];
  const consolidationCtx = await prepareConsolidationContext({
    tenantIds,
    reportingCurrency,
    asOfDate: endDate,
  });

  for (const tenantId of tenantIds) {
    const tenant = tMap.get(tenantId);
    const includeCogs = await tenantIncludesCogsInReports(prisma, tenantId);
    const raw = await generateIncomeStatementFromAccounts(
      tenantId,
      startDate,
      endDate,
      tenant?.name || 'Company',
      tenant?.logoUrl || null,
      branchId
    );
    let statement = applyIncomeStatementCogsPolicy(raw, includeCogs);
    const fxRate = consolidationCtx.fxRatesByTenant.get(tenantId) || 1;
    statement = scaleStatementAmounts(statement, fxRate);

    byTenant.push({
      tenantId,
      tenantName: tenant?.name || tenantId,
      statement,
      reportingCurrency: consolidationCtx.reportingCurrency,
      sourceCurrency: consolidationCtx.currencyMap.get(tenantId) || 'MWK',
      fxRate,
    });
  }

  if (tenantIds.length === 1) {
    return {
      ...byTenant[0].statement,
      scope: scope || buildReportScopeMetadata(tenants, { tenantIds, branchScoped: true }),
      byTenant: null,
      consolidation: buildConsolidationMetadata({
        reportingCurrency: consolidationCtx.reportingCurrency,
        currencyByTenant: consolidationCtx.currencyMap,
        fxApplied: false,
        intercompanyElimination: null,
      }),
    };
  }

  const consolidated = consolidateIncomeStatementTotals(byTenant.map((b) => b.statement));
  const primary = byTenant[0]?.statement || {};

  return {
    ...primary,
    ...consolidated,
    company: `Consolidated — Multiple Businesses (${consolidationCtx.reportingCurrency})`,
    scope: scope || buildReportScopeMetadata(tenants, { tenantIds, branchScoped: false }),
    byTenant: byTenant.map(({ tenantId, tenantName, statement, sourceCurrency, fxRate }) => ({
      tenantId,
      tenantName,
      totalRevenue: parseMoney(statement.totalRevenue),
      grossProfit: parseMoney(statement.grossProfit),
      totalOperatingExpenses: parseMoney(statement.totalOperatingExpenses),
      netIncome: parseMoney(statement.netIncome ?? statement.operatingIncome),
      cogs: parseMoney(statement?.cogs?.total ?? 0),
      sourceCurrency,
      fxRate,
    })),
    metadata: {
      ...(primary.metadata || {}),
      multiTenant: true,
      tenantCount: tenantIds.length,
    },
    consolidation: buildConsolidationMetadata({
      reportingCurrency: consolidationCtx.reportingCurrency,
      currencyByTenant: consolidationCtx.currencyMap,
      fxApplied: consolidationCtx.fxApplied,
      intercompanyElimination: null,
    }),
  };
}

export async function generateScopedBalanceSheet({
  tenantIds,
  tenants,
  asOfDate,
  branchId = null,
  scope,
  reportingCurrency = null,
}) {
  const tMap = tenantMap(tenants);
  const byTenant = [];
  const icPerTenant = [];

  const consolidationCtx = await prepareConsolidationContext({
    tenantIds,
    reportingCurrency,
    asOfDate,
  });

  for (const tenantId of tenantIds) {
    const tenant = tMap.get(tenantId);
    let sheet = await generateBalanceSheetFromAccounts(
      tenantId,
      asOfDate,
      tenant?.name || 'Company',
      tenant?.logoUrl || null,
      branchId
    );
    const fxRate = consolidationCtx.fxRatesByTenant.get(tenantId) || 1;
    sheet = scaleStatementAmounts(sheet, fxRate);

    const tbForIc = await buildTrialBalance({
      tenantId,
      branchId,
      startDate: asOfDate,
      endDate: asOfDate,
      includeZero: false,
    });
    const ic = extractIntercompanyBalances(tbForIc.accounts || []);
    icPerTenant.push({
      tenantId,
      tenantName: tenant?.name || tenantId,
      icReceivable: ic.icReceivable,
      icPayable: ic.icPayable,
    });

    byTenant.push({
      tenantId,
      tenantName: tenant?.name || tenantId,
      balanceSheet: sheet,
      sourceCurrency: consolidationCtx.currencyMap.get(tenantId) || 'MWK',
      fxRate,
    });
  }

  if (tenantIds.length === 1) {
    return {
      ...byTenant[0].balanceSheet,
      scope: scope || buildReportScopeMetadata(tenants, { tenantIds, branchScoped: true }),
      byTenant: null,
      consolidation: buildConsolidationMetadata({
        reportingCurrency: consolidationCtx.reportingCurrency,
        currencyByTenant: consolidationCtx.currencyMap,
        fxApplied: false,
        intercompanyElimination: null,
      }),
    };
  }

  let consolidated = consolidateBalanceSheetTotals(byTenant.map((b) => b.balanceSheet));
  const icElimination = computeIntercompanyElimination(icPerTenant);
  if (icElimination.applied) {
    consolidated = applyEliminationToBalanceSheetTotals(
      consolidated,
      icElimination.eliminationAmount
    );
  }

  const primary = byTenant[0]?.balanceSheet || {};

  return {
    ...primary,
    ...consolidated,
    company: `Consolidated — Multiple Businesses (${consolidationCtx.reportingCurrency})`,
    scope: scope || buildReportScopeMetadata(tenants, { tenantIds, branchScoped: false }),
    byTenant: byTenant.map(({ tenantId, tenantName, balanceSheet, sourceCurrency, fxRate }) => ({
      tenantId,
      tenantName,
      totalAssets: parseMoney(balanceSheet.totalAssets),
      totalLiabilities: parseMoney(balanceSheet.totalLiabilities),
      totalEquity: parseMoney(balanceSheet.totalEquity ?? balanceSheet.equity?.total),
      isBalanced: Boolean(balanceSheet.isBalanced),
      difference: parseMoney(balanceSheet.difference ?? balanceSheet.balanceDifference),
      sourceCurrency,
      fxRate,
    })),
    metadata: {
      ...(primary.metadata || {}),
      multiTenant: true,
      tenantCount: tenantIds.length,
    },
    consolidation: buildConsolidationMetadata({
      reportingCurrency: consolidationCtx.reportingCurrency,
      currencyByTenant: consolidationCtx.currencyMap,
      fxApplied: consolidationCtx.fxApplied,
      intercompanyElimination: icElimination,
    }),
  };
}

export async function generateScopedTrialBalance({
  tenantIds,
  tenants,
  startDate,
  endDate,
  branchId = null,
  includeZero = false,
  scope,
  reportingCurrency = null,
}) {
  const tMap = tenantMap(tenants);
  const byTenant = [];
  const consolidatedMap = new Map();
  const icPerTenant = [];

  const consolidationCtx = await prepareConsolidationContext({
    tenantIds,
    reportingCurrency,
    asOfDate: endDate,
  });

  for (const tenantId of tenantIds) {
    const tenant = tMap.get(tenantId);
    const report = await buildTrialBalance({
      tenantId,
      branchId,
      startDate,
      endDate,
      includeZero,
    });

    const fxRate = consolidationCtx.fxRatesByTenant.get(tenantId) || 1;
    const scaledAccounts = (report.accounts || []).map((row) => scaleTrialBalanceRow(row, fxRate));
    const ic = extractIntercompanyBalances(scaledAccounts);
    icPerTenant.push({
      tenantId,
      tenantName: tenant?.name || tenantId,
      icReceivable: ic.icReceivable,
      icPayable: ic.icPayable,
    });

    byTenant.push({
      tenantId,
      tenantName: tenant?.name || tenantId,
      report: { ...report, accounts: scaledAccounts },
    });

    for (const row of scaledAccounts) {
      const groupCode = resolveHarmonizedAccountCode(row.accountCode || row.code);
      const key = harmonizedTrialBalanceKey({ ...row, accountCode: groupCode });
      const existing = consolidatedMap.get(key) || {
        accountCode: groupCode,
        accountName: row.accountName || row.name,
        accountType: row.accountType || row.type,
        code: groupCode,
        name: row.accountName || row.name,
        type: row.accountType || row.type,
        debitBalance: 0,
        creditBalance: 0,
        debitTotal: 0,
        creditTotal: 0,
        debit: 0,
        credit: 0,
        tenantCount: 0,
        tenantNames: [],
        sourceCodes: [],
      };
      existing.debitBalance = addMoney(
        existing.debitBalance,
        parseMoney(row.debitBalance ?? row.debit)
      );
      existing.creditBalance = addMoney(
        existing.creditBalance,
        parseMoney(row.creditBalance ?? row.credit)
      );
      existing.debitTotal = addMoney(existing.debitTotal, parseMoney(row.debitTotal ?? row.debit));
      existing.creditTotal = addMoney(
        existing.creditTotal,
        parseMoney(row.creditTotal ?? row.credit)
      );
      existing.debit = existing.debitBalance;
      existing.credit = existing.creditBalance;
      existing.tenantCount += 1;
      existing.tenantNames.push(tenant?.name || tenantId);
      existing.sourceCodes.push(row.accountCode || row.code);
      consolidatedMap.set(key, existing);
    }
  }

  const icElimination = computeIntercompanyElimination(icPerTenant);
  if (icElimination.applied && icElimination.eliminationAmount > 0) {
    applyIcEliminationToTrialBalanceMap(consolidatedMap, icElimination.eliminationAmount);
  }

  const accounts = [...consolidatedMap.values()].sort((a, b) =>
    String(a.accountCode).localeCompare(String(b.accountCode))
  );

  const totalDebits = roundMoney(
    accounts.reduce((sum, r) => addMoney(sum, parseMoney(r.debitBalance ?? r.debit)), 0)
  );
  const totalCredits = roundMoney(
    accounts.reduce((sum, r) => addMoney(sum, parseMoney(r.creditBalance ?? r.credit)), 0)
  );

  const base = byTenant[0]?.report || {};

  if (tenantIds.length === 1) {
    return {
      ...base,
      scope: scope || buildReportScopeMetadata(tenants, { tenantIds, branchScoped: true }),
      byTenant: null,
      consolidation: buildConsolidationMetadata({
        reportingCurrency: consolidationCtx.reportingCurrency,
        currencyByTenant: consolidationCtx.currencyMap,
        fxApplied: false,
        intercompanyElimination: null,
      }),
    };
  }

  return {
    ...base,
    accounts,
    totals: {
      totalDebits,
      totalCredits,
      difference: roundMoney(Math.abs(totalDebits - totalCredits)),
      isBalanced: Math.abs(totalDebits - totalCredits) < 0.01,
    },
    scope: scope || buildReportScopeMetadata(tenants, { tenantIds, branchScoped: false }),
    byTenant: byTenant.map(({ tenantId, tenantName, report }) => ({
      tenantId,
      tenantName,
      totalDebits: parseMoney(report.totals?.totalDebits),
      totalCredits: parseMoney(report.totals?.totalCredits),
      accountCount: report.accounts?.length || 0,
      totals: report.totals,
      sourceCurrency: consolidationCtx.currencyMap.get(tenantId) || 'MWK',
    })),
    metadata: { multiTenant: true, tenantCount: tenantIds.length },
    consolidation: buildConsolidationMetadata({
      reportingCurrency: consolidationCtx.reportingCurrency,
      currencyByTenant: consolidationCtx.currencyMap,
      fxApplied: consolidationCtx.fxApplied,
      intercompanyElimination: icElimination,
    }),
  };
}

/**
 * Reduce IC receivable/payable lines in consolidated trial balance by elimination amount.
 */
function applyIcEliminationToTrialBalanceMap(consolidatedMap, eliminationAmount) {
  let remaining = eliminationAmount;
  const rows = [...consolidatedMap.values()];

  for (const row of rows) {
    if (remaining <= 0) break;
    const icType = classifyIntercompanyAccount(row);
    if (icType !== 'receivable') continue;
    const debit = parseMoney(row.debitBalance ?? row.debit ?? 0);
    const reduce = Math.min(debit, remaining);
    if (reduce <= 0) continue;
    row.debitBalance = subtractMoney(debit, reduce);
    row.debit = row.debitBalance;
    remaining = subtractMoney(remaining, reduce);
  }

  remaining = eliminationAmount;
  for (const row of rows) {
    if (remaining <= 0) break;
    const icType = classifyIntercompanyAccount(row);
    if (icType !== 'payable') continue;
    const credit = parseMoney(row.creditBalance ?? row.credit ?? 0);
    const reduce = Math.min(credit, remaining);
    if (reduce <= 0) continue;
    row.creditBalance = subtractMoney(credit, reduce);
    row.credit = row.creditBalance;
    remaining = subtractMoney(remaining, reduce);
  }
}
