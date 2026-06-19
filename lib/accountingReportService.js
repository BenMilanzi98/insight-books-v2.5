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
  return adaptProfitAndLossForUi({ ...glPl, period: { startDate, endDate }, companyName });
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
  return adaptBalanceSheetForUi(glBs, { companyName, logoUrl });
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
 */
export async function getDailyPosReport(params) {
  const report = await generatePosDailyReport(params);
  return { source: REPORT_SOURCE, ...report };
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
  getAccountDrilldown,
  adaptProfitAndLossForUi,
  adaptBalanceSheetForUi,
};

export default AccountingReportService;
