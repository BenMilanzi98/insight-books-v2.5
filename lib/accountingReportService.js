/**
 * Centralized ledger-backed reporting engine.
 * Single source of truth: Chart of Accounts structure + posted General Ledger movements.
 */
import prisma from '@/lib/prisma.js';
import { roundMoney, parseMoney, addMoney } from '@/lib/money.js';
import { buildProfitAndLossFromGl } from '@/lib/reportingEngine/buildProfitAndLossFromGl.js';
import { buildBalanceSheetFromGl } from '@/lib/reportingEngine/buildBalanceSheetFromGl.js';
import { buildTaxSummaryFromGl } from '@/lib/reportingEngine/buildTaxSummaryFromGl.js';
import { buildTrialBalance } from '@/lib/trialBalanceReport.js';
import { classifyCashFlowFromGl } from '@/lib/cashFlowGlService.js';
import { getBalanceSheetAccountTrace } from '@/lib/balanceSheetAccountTrace.js';
import { plLineToUiRow, bsLineToUiLineItem, toStandardReportLine } from '@/lib/reportLineFormatter.js';
import { buildProfitAnalysisFromPl } from '@/lib/reportingEngine/buildOperationalGlReconciliation.js';
import { generatePosDailyReport } from '@/lib/posDailyReportService.js';
import { buildPeriodAccountLines } from '@/lib/reportGlAccountLines.js';
import {
  isCostOfSalesAccount,
  isIncomeAccount,
  isOperatingExpenseAccount,
  isOtherExpenseAccount,
  isOtherIncomeAccount,
} from '@/lib/reportingEngine/accountClassification.js';

const REPORT_SOURCE = 'general_ledger';

/**
 * @param {object} glPl — output from buildProfitAndLossFromGl
 */
export function adaptProfitAndLossForUi(glPl) {
  const revenueLines = (glPl.revenue?.lineItems || []).map(plLineToUiRow);
  const otherIncomeLines = (glPl.revenue?.otherIncomeLineItems || []).map(plLineToUiRow);
  const cogsLines = (glPl.cogs?.lineItems || []).map(plLineToUiRow);
  const expenseLines = (glPl.operatingExpenses?.lineItems || []).map(plLineToUiRow);
  const otherExpenseLines = (glPl.otherIncomeExpenses?.otherExpenseLineItems || []).map(plLineToUiRow);

  const totalRevenue = parseMoney(glPl.totalRevenue);
  const pct = (v) => (totalRevenue > 0 ? (parseMoney(v) / totalRevenue) * 100 : 0);

  return {
    source: REPORT_SOURCE,
    sourcePolicy: glPl.sourcePolicy,
    period: glPl.period,
    companyName: glPl.companyName,
    totalRevenue,
    grossProfit: parseMoney(glPl.grossProfit),
    grossProfitMargin: glPl.grossProfitMargin,
    totalOperatingExpenses: parseMoney(glPl.operatingExpenses?.total),
    operatingIncome: parseMoney(glPl.operatingIncome),
    netIncome: parseMoney(glPl.netProfit),
    netProfit: parseMoney(glPl.netProfit),
    netProfitMargin: glPl.netProfitMargin,
    revenue: {
      total: totalRevenue,
      lineItems: revenueLines,
      otherIncome: parseMoney(glPl.revenue?.otherIncome),
      otherIncomeLineItems: otherIncomeLines,
    },
    cogs: {
      total: parseMoney(glPl.cogs?.total),
      costOfProductsSold: parseMoney(glPl.cogs?.total),
      fromGeneralLedger: true,
      lineItems: cogsLines,
    },
    operatingExpenses: {
      total: parseMoney(glPl.operatingExpenses?.total),
      accountLines: expenseLines.map((row) => ({
        ...row,
        label: row.accountCode ? `${row.accountCode} — ${row.accountName}` : row.accountName,
        percentage: pct(row.amount),
      })),
      categories: expenseLines.map((row) => ({
        accountId: row.accountId,
        accountCode: row.accountCode,
        accountName: row.accountName,
        name: row.accountName,
        amount: row.amount,
        percentage: pct(row.amount),
        drillDown: row.drillDown,
      })),
    },
    otherIncomeExpenses: {
      otherIncome: parseMoney(glPl.otherIncomeExpenses?.otherIncome),
      otherExpenses: parseMoney(glPl.otherIncomeExpenses?.otherExpenses),
      otherIncomeLineItems: otherIncomeLines,
      otherExpenseLineItems: otherExpenseLines,
      total: parseMoney(glPl.otherIncomeExpenses?.total),
    },
    metadata: {
      revenueAccounts: revenueLines.length,
      expenseAccounts: expenseLines.length,
      ledgerBacked: true,
    },
    reconciliation: {
      ledgerBacked: true,
      hasGlActivity: glPl.hasGlActivity,
    },
    accountLines: glPl.accountLines || [],
  };
}

/**
 * @param {object} glBs — output from buildBalanceSheetFromGl
 * @param {object} [meta]
 */
export function adaptBalanceSheetForUi(glBs, meta = {}) {
  const mapLines = (lines) => (lines || []).map(bsLineToUiLineItem);
  const sumBalance = (lines) =>
    roundMoney((lines || []).reduce((s, l) => addMoney(s, l.balance || 0), 0));

  const currentAssetLines = mapLines(glBs.assets?.current);
  const nonCurrentAssetLines = mapLines(glBs.assets?.nonCurrent);
  const currentLiabLines = mapLines(glBs.liabilities?.current);
  const nonCurrentLiabLines = mapLines(glBs.liabilities?.nonCurrent);
  const equityLines = mapLines(glBs.equity?.lines);

  const currentAssetsTotal = sumBalance(glBs.assets?.current);
  const nonCurrentAssetsTotal = sumBalance(glBs.assets?.nonCurrent);
  const totalAssets = parseMoney(glBs.totals?.totalAssets);
  const currentLiabTotal = sumBalance(glBs.liabilities?.current);
  const nonCurrentLiabTotal = sumBalance(glBs.liabilities?.nonCurrent);
  const totalLiabilities = parseMoney(glBs.totals?.totalLiabilities);
  const totalEquity = parseMoney(glBs.totals?.totalEquity);

  return {
    source: REPORT_SOURCE,
    sourcePolicy: glBs.sourcePolicy,
    asOfDate: glBs.asOfDate,
    companyName: meta.companyName || 'Company',
    logoUrl: meta.logoUrl || null,
    accountLines: meta.accountLines || [],
    assets: {
      total: totalAssets,
      currentAssets: {
        total: currentAssetsTotal,
        lineItems: currentAssetLines,
        cashAndCashEquivalents: currentAssetLines
          .filter((l) => /cash|bank|mobile|mpamba|airtel/i.test(l.accountName || l.label || ''))
          .reduce((s, l) => addMoney(s, l.value || 0), 0),
        accountsReceivable: {
          total: glBs.controlAccounts?.accountsReceivable?.balance || 0,
          items: currentAssetLines.filter((l) => /receivable|1200/i.test(`${l.accountCode} ${l.accountName}`)),
        },
        inventory: {
          total: currentAssetLines
            .filter((l) => /inventory|stock|1300|1340/i.test(`${l.accountCode} ${l.accountName}`))
            .reduce((s, l) => addMoney(s, l.value || 0), 0),
          items: currentAssetLines.filter((l) => /inventory|stock|1300|1340/i.test(`${l.accountCode} ${l.accountName}`)),
        },
      },
      nonCurrentAssets: {
        total: nonCurrentAssetsTotal,
        lineItems: nonCurrentAssetLines,
        propertyPlantEquipment: { net: nonCurrentAssetsTotal, items: nonCurrentAssetLines },
      },
    },
    liabilities: {
      total: totalLiabilities,
      currentLiabilities: {
        total: currentLiabTotal,
        lineItems: currentLiabLines,
        accountsPayable: {
          total: glBs.controlAccounts?.accountsPayable?.balance || 0,
          items: currentLiabLines.filter((l) => /payable|2110|2000/i.test(`${l.accountCode} ${l.accountName}`)),
        },
      },
      nonCurrentLiabilities: {
        total: nonCurrentLiabTotal,
        lineItems: nonCurrentLiabLines,
      },
    },
    equity: {
      total: totalEquity,
      lineItems: equityLines,
      items: equityLines,
    },
    totalAssets,
    totalLiabilities,
    totalEquity,
    totalLiabilitiesAndEquity: parseMoney(glBs.totals?.totalLiabilitiesAndEquity),
    difference: parseMoney(glBs.totals?.difference),
    balanced: glBs.totals?.balanced ?? Math.abs(glBs.totals?.difference || 0) <= 0.01,
    controlAccounts: glBs.controlAccounts,
    reconciliation: {
      ledgerBacked: true,
      balanced: glBs.totals?.balanced,
      difference: glBs.totals?.difference,
    },
  };
}

/**
 * @param {object} params
 */
export async function getProfitAndLossReport({
  tenantId,
  startDate,
  endDate,
  branchId = null,
  companyName = 'Company',
  prisma: db = prisma,
}) {
  const glPl = await buildProfitAndLossFromGl({
    tenantId,
    startDate,
    endDate,
    branchId,
    prisma: db,
  });
  let accountLines = [];
  try {
    accountLines = await buildPeriodAccountLines({
      tenantId,
      startDate,
      endDate,
      branchId,
      prisma: db,
      accountFilter: (acc) =>
        isIncomeAccount(acc) ||
        isOtherIncomeAccount(acc) ||
        isCostOfSalesAccount(acc) ||
        isOperatingExpenseAccount(acc) ||
        isOtherExpenseAccount(acc),
    });
  } catch (err) {
    console.warn('P&L account lines skipped:', err?.message);
  }
  return adaptProfitAndLossForUi({
    ...glPl,
    period: { startDate, endDate },
    companyName,
    accountLines,
  });
}

/**
 * @param {object} params
 */
export async function getBalanceSheetReport({
  tenantId,
  asOfDate,
  branchId = null,
  companyName = 'Company',
  logoUrl = null,
  prisma: db = prisma,
}) {
  const glBs = await buildBalanceSheetFromGl({
    tenantId,
    asOfDate,
    branchId,
    prisma: db,
  });
  let accountLines = [];
  try {
    accountLines = await buildPeriodAccountLines({
      tenantId,
      startDate: '1970-01-01',
      endDate: asOfDate,
      branchId,
      prisma: db,
      accountFilter: () => true,
    });
  } catch (err) {
    console.warn('Balance sheet account lines skipped:', err?.message);
  }
  return adaptBalanceSheetForUi(glBs, { companyName, logoUrl, accountLines });
}

/**
 * @param {object} params
 */
export async function getTrialBalanceReport(params) {
  const report = await buildTrialBalance(params);
  return {
    source: REPORT_SOURCE,
    ...report,
    rows: (report.rows || []).map((row) =>
      toStandardReportLine({
        account: {
          id: row.id,
          accountCode: row.code,
          accountName: row.name,
          accountType: row.type,
          normalBalance: row.normalBalance,
        },
        periodDebit: row.debitTotal,
        periodCredit: row.creditTotal,
        netMovement: row.debit - row.credit,
        closingBalance: row.debit || row.credit,
        sectionKey: 'tb',
      })
    ),
  };
}

/**
 * @param {object} params
 */
export async function getTaxSummaryReport(params) {
  const report = await buildTaxSummaryFromGl(params);
  return { source: REPORT_SOURCE, ...report };
}

/**
 * @param {object} params
 */
export async function getCashFlowReport({
  tenantId,
  startDate,
  endDate,
  branchId = null,
  companyName = 'Company',
  prisma: db = prisma,
}) {
  const [startBs, endBs, glCashFlow] = await Promise.all([
    getBalanceSheetReport({ tenantId, asOfDate: startDate, branchId, companyName, prisma: db }),
    getBalanceSheetReport({ tenantId, asOfDate: endDate, branchId, companyName, prisma: db }),
    classifyCashFlowFromGl(tenantId, startDate, endDate, branchId),
  ]);

  const openingCash = parseMoney(startBs.assets?.currentAssets?.cashAndCashEquivalents);
  const closingCash = parseMoney(endBs.assets?.currentAssets?.cashAndCashEquivalents);
  const netChange = roundMoney(closingCash - openingCash);

  return {
    source: REPORT_SOURCE,
    period: { startDate, endDate },
    companyName,
    openingCash,
    closingCash,
    netChange,
    operating: glCashFlow?.operating || {},
    investing: glCashFlow?.investing || {},
    financing: glCashFlow?.financing || {},
    unclassified: glCashFlow?.unclassified || 0,
    classificationGap: glCashFlow?.classificationGap || 0,
    reconciliation: {
      ledgerBacked: true,
      authoritativeNetChange: netChange,
    },
  };
}

/**
 * @param {object} params
 */
export async function getProfitAnalysisReport(params) {
  const pl = await getProfitAndLossReport(params);
  return buildProfitAnalysisFromPl(pl, params);
}

/**
 * @param {object} params
 * @param {string} params.tenantId
 * @param {string} params.date YYYY-MM-DD
 * @param {string|null} [params.branchId]
 * @param {object} [params.options]
 */
export async function getDailyPosReport({ tenantId, date, branchId = null, options = {} }) {
  const report = await generatePosDailyReport(tenantId, date, branchId, options);
  let accountLines = [];
  try {
    const { buildPosGlAccountLines } = await import('@/lib/reportGlAccountLines.js');
    accountLines = await buildPosGlAccountLines({
      tenantId,
      startDate: date,
      endDate: date,
      branchId,
    });
  } catch (err) {
    console.warn('POS GL account lines skipped:', err?.message);
  }
  return {
    source: REPORT_SOURCE,
    ...report,
    accountLines,
    metadata: {
      ...(report.metadata || {}),
      accountLineCount: accountLines.length,
    },
  };
}

/**
 * GL income account lines for sales report (ledger-backed section).
 */
export async function getSalesGlAccountLines(params) {
  const { buildSalesGlAccountLines, mergeGlPeriodTotalsForTenants } = await import(
    '@/lib/reportGlAccountLines.js'
  );
  const { buildSalesReconciliation } = await import(
    '@/lib/reportingEngine/buildOperationalGlReconciliation.js'
  );
  const tenantIds = params.tenantIds || [params.tenantId];
  const glTotals = await mergeGlPeriodTotalsForTenants(tenantIds, params);
  let accountLines = [];
  for (const tenantId of tenantIds) {
    const lines = await buildSalesGlAccountLines({ ...params, tenantId });
    accountLines = accountLines.concat(lines);
  }
  accountLines.sort((a, b) => String(a.accountCode).localeCompare(String(b.accountCode)));
  return {
    glTotals,
    accountLines,
    buildReconciliation: (operationalRevenue) =>
      glTotals ? buildSalesReconciliation(operationalRevenue, glTotals) : null,
  };
}

/**
 * GL expense account lines for expense report.
 */
export async function getExpenseGlAccountLines(params) {
  const { buildExpenseGlAccountLines, mergeGlPeriodTotalsForTenants } = await import(
    '@/lib/reportGlAccountLines.js'
  );
  const { buildExpenseReconciliation } = await import(
    '@/lib/reportingEngine/buildOperationalGlReconciliation.js'
  );
  const tenantIds = params.tenantIds || [params.tenantId];
  const glTotals = await mergeGlPeriodTotalsForTenants(tenantIds, params);
  let accountLines = [];
  for (const tenantId of tenantIds) {
    const lines = await buildExpenseGlAccountLines({ ...params, tenantId });
    accountLines = accountLines.concat(lines);
  }
  accountLines.sort((a, b) => String(a.accountCode).localeCompare(String(b.accountCode)));
  return {
    glTotals,
    accountLines,
    buildReconciliation: (operationalTotal) =>
      glTotals ? buildExpenseReconciliation(operationalTotal, glTotals) : null,
  };
}

/**
 * Stock movement report + inventory GL lines.
 */
export async function getStockMovementReport({
  tenantId,
  startDate,
  endDate,
  productId = null,
  branchId = null,
}) {
  const { generateStockMovementReport } = await import('@/lib/stockMovementService.js');
  const { buildInventoryGlAccountLines } = await import('@/lib/reportGlAccountLines.js');
  const { buildInventoryLossReconciliation } = await import(
    '@/lib/reportingEngine/buildOperationalGlReconciliation.js'
  );
  const { getGlPeriodTotals } = await import(
    '@/lib/reportingEngine/buildOperationalGlReconciliation.js'
  );

  const report = await generateStockMovementReport(
    tenantId,
    startDate,
    endDate,
    productId,
    branchId
  );
  const accountLines = await buildInventoryGlAccountLines({
    tenantId,
    startDate,
    endDate,
    branchId,
  });
  let glTotals = null;
  try {
    glTotals = await getGlPeriodTotals({ tenantId, startDate, endDate, branchId });
  } catch {
    /* optional */
  }
  const closingValue = report.metadata?.totalClosingValue ?? 0;
  return {
    source: REPORT_SOURCE,
    ...report,
    accountLines,
    metadata: {
      ...(report.metadata || {}),
      ledgerSource: REPORT_SOURCE,
      inventoryGlLines: accountLines,
      reconciliation: glTotals
        ? buildInventoryLossReconciliation(closingValue, glTotals)
        : report.metadata?.reconciliation,
    },
  };
}

/**
 * Inventory loss report enrichment (caller passes base report payload).
 */
export async function enrichInventoryLossReport(baseReport, params) {
  const { buildInventoryGlAccountLines } = await import('@/lib/reportGlAccountLines.js');
  const accountLines = await buildInventoryGlAccountLines(params);
  return {
    ...baseReport,
    source: REPORT_SOURCE,
    accountLines,
    metadata: {
      ...(baseReport.metadata || {}),
      ledgerSource: REPORT_SOURCE,
      accountLineCount: accountLines.length,
    },
  };
}

/**
 * Account drill-down — ledger lines + journal references.
 * @param {object} params
 */
export async function getAccountDrilldown({
  tenantId,
  accountId,
  asOfDate,
  startDate,
  endDate,
  branchId = null,
  prisma: db = prisma,
}) {
  const trace = await getBalanceSheetAccountTrace(db, tenantId, accountId, {
    asOfDate: asOfDate || endDate,
    branchId,
  });

  return {
    source: REPORT_SOURCE,
    account: trace.account,
    openingBalance: trace.openingBalance,
    closingBalance: trace.closingBalance,
    periodDebit: trace.periodDebit,
    periodCredit: trace.periodCredit,
    sourceCount: trace.ledgerLines?.length || 0,
    ledgerLines: trace.ledgerLines || [],
    balanceBreakdown: trace.balanceBreakdown,
    dateRange: startDate && endDate ? { startDate, endDate } : null,
    asOfDate: asOfDate || endDate || null,
  };
}

export const AccountingReportService = {
  getProfitAndLossReport,
  getBalanceSheetReport,
  getTrialBalanceReport,
  getTaxSummaryReport,
  getCashFlowReport,
  getProfitAnalysisReport,
  getDailyPosReport,
  getSalesGlAccountLines,
  getExpenseGlAccountLines,
  getStockMovementReport,
  enrichInventoryLossReport,
  getAccountDrilldown,
  adaptProfitAndLossForUi,
  adaptBalanceSheetForUi,
};

export default AccountingReportService;
