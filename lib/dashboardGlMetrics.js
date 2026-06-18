/**
 * Dashboard KPI revenue and operating expenses from GL (reportingEngine),
 * with operational fallbacks when GL has no meaningful activity.
 */
import { buildProfitAndLossFromGl } from '@/lib/reportingEngine/buildProfitAndLossFromGl.js';
import {
  buildReconciliationItem,
  buildReconciliationSummary,
} from '@/lib/reportingEngine/reportReconciliation.js';
import { getControlAccountGlBalance } from '@/lib/reportingEngine/buildTaxSummaryFromGl.js';
import { fetchOfficialLedgerAsOfRows } from '@/lib/reportingEngine/fetchOfficialLedgerRows.js';
import {
  computeBalanceSheetAmount,
  hasMeaningfulAmount,
  isAssetAccount,
  roundReportAmount,
} from '@/lib/reportingEngine/accountClassification.js';
import { addMoney, parseMoney, roundMoney } from '@/lib/money';
import { sumNetCogsDebitMinusCredit } from '@/lib/dashboardCogsNet';
import { addBranchFilter, addBranchFilterIncludeUnassigned } from '@/lib/dashboardBranchFilter';
import { settledExpensePaymentOr, excludePayrollDashboardMirrorExpenses } from '@/lib/dashboardExpenseFilters';

const GL_EPS = 1e-6;

/**
 * Resolve COGS for a period — prefer GL COGS lines, else net debit-minus-credit aggregate.
 */
async function resolvePeriodCogs({ prisma, cogsAccountIds, transactionWhere, glCogs }) {
  let netCogs = 0;
  if (cogsAccountIds?.length > 0) {
    netCogs = await sumNetCogsDebitMinusCredit(prisma, {
      cogsAccountIds,
      transactionWhere,
    });
  }

  const glEngineCogsTotal = glCogs?.fromGeneralLedger ? roundMoney(glCogs.total) : 0;
  const glRounded = roundMoney(netCogs);
  const useGlCogs =
    (glCogs?.fromGeneralLedger && Math.abs(glEngineCogsTotal) > GL_EPS) ||
    (cogsAccountIds?.length > 0 && Math.abs(glRounded) > GL_EPS);

  if (!useGlCogs) return 0;
  return Math.abs(glEngineCogsTotal) > GL_EPS ? glEngineCogsTotal : glRounded;
}

/**
 * Operational fallback revenue (invoice payments + POS sales).
 */
async function fetchOperationalRevenue({
  prisma,
  tw,
  userQ,
  startDate,
  endDate,
  branchIdForPayments,
}) {
  const [invoices, sales] = await Promise.all([
    prisma.payment.aggregate({
      where: {
        ...tw,
        isReversal: false,
        invoiceId: { not: null },
        status: { equals: 'Completed', mode: 'insensitive' },
        paymentDate: { gte: startDate, lte: endDate },
        ...(branchIdForPayments
          ? {
              OR: [
                { branchId: branchIdForPayments },
                { invoice: { branchId: branchIdForPayments } },
              ],
            }
          : {}),
      },
      _sum: { amount: true },
    }),
    prisma.sale.aggregate({
      where: addBranchFilter(userQ, {
        ...tw,
        saleDate: { gte: startDate, lte: endDate },
        status: 'completed',
      }),
      _sum: { total: true },
    }),
  ]);

  return addMoney(invoices._sum.amount, sales._sum.total);
}

/**
 * Operational fallback operating expenses (settled expense register rows).
 */
async function fetchOperationalOperatingExpenses({
  prisma,
  tw,
  userQ,
  startDate,
  endDate,
}) {
  const result = await prisma.expense.aggregate({
    where: addBranchFilterIncludeUnassigned(userQ, {
      ...tw,
      status: 'Approved',
      isDeleted: false,
      isReversal: false,
      ...settledExpensePaymentOr(),
      ...excludePayrollDashboardMirrorExpenses(),
      date: { gte: startDate, lte: endDate },
    }),
    _sum: { amount: true },
  });

  return parseMoney(result._sum.amount);
}

/**
 * Aggregate GL P&L across scoped tenants for one dashboard period.
 */
async function fetchGlProfitAndLossAggregate({
  prisma,
  tenantIds,
  branchId,
  startDate,
  endDate,
}) {
  let revenue = 0;
  let operatingExpenses = 0;
  let cogsTotal = 0;
  let cogsFromLedger = false;
  let hasGlActivity = false;
  let revenueLineCount = 0;
  let operatingExpenseLineCount = 0;

  for (const tenantId of tenantIds) {
    try {
      const pl = await buildProfitAndLossFromGl({
        tenantId,
        startDate,
        endDate,
        branchId: branchId || null,
        prisma,
      });

      if (pl.hasGlActivity) hasGlActivity = true;
      revenue = addMoney(revenue, pl.totalRevenue, pl.revenue.otherIncome);
      operatingExpenses = addMoney(operatingExpenses, pl.operatingExpenses.total);
      revenueLineCount += pl.revenue.lineItems.length + pl.revenue.otherIncomeLineItems.length;
      operatingExpenseLineCount += pl.operatingExpenses.lineItems.length;

      if (pl.cogs.fromGeneralLedger) {
        cogsFromLedger = true;
        cogsTotal = addMoney(cogsTotal, pl.cogs.total);
      }
    } catch (err) {
      console.warn(
        `[dashboardGlMetrics] GL P&L failed for tenant ${tenantId}:`,
        err?.message || err
      );
    }
  }

  return {
    revenue,
    operatingExpenses,
    cogs: { total: cogsTotal, fromGeneralLedger: cogsFromLedger },
    hasGlActivity,
    revenueLineCount,
    operatingExpenseLineCount,
  };
}

/**
 * Revenue, operating expenses, and COGS for one dashboard period.
 * Prefers GL/reportingEngine; falls back to operational aggregates when GL is inactive.
 *
 * @returns {Promise<{ revenue: number, operatingExpenses: number, cogs: number, source: 'gl' | 'operational' }>}
 */
export async function fetchDashboardPeriodMetrics({
  prisma,
  tenantIds,
  branchId,
  startDate,
  endDate,
  cogsAccountIds,
  userQ,
  tw,
  transactionBranchSlice,
  branchIdForPayments,
}) {
  if (branchId === false) {
    return { revenue: 0, operatingExpenses: 0, cogs: 0, source: 'gl' };
  }

  const transactionWhere = {
    ...tw,
    ...transactionBranchSlice,
    date: { gte: startDate, lte: endDate },
    status: 'posted',
  };

  const gl = await fetchGlProfitAndLossAggregate({
    prisma,
    tenantIds,
    branchId,
    startDate,
    endDate,
  });

  const useGlRevenue =
    gl.hasGlActivity && (gl.revenue > GL_EPS || gl.revenueLineCount > 0);
  const useGlOperatingExpenses =
    gl.hasGlActivity &&
    (Math.abs(gl.operatingExpenses) > GL_EPS || gl.operatingExpenseLineCount > 0);

  const cogs = await resolvePeriodCogs({
    prisma,
    cogsAccountIds,
    transactionWhere,
    glCogs: gl.cogs,
  });

  if (useGlRevenue && useGlOperatingExpenses) {
    return {
      revenue: roundMoney(gl.revenue),
      operatingExpenses: roundMoney(gl.operatingExpenses),
      cogs,
      source: 'gl',
    };
  }

  const [operationalRevenue, operationalOperatingExpenses] = await Promise.all([
    useGlRevenue
      ? Promise.resolve(roundMoney(gl.revenue))
      : fetchOperationalRevenue({
          prisma,
          tw,
          userQ,
          startDate,
          endDate,
          branchIdForPayments,
        }),
    useGlOperatingExpenses
      ? Promise.resolve(roundMoney(gl.operatingExpenses))
      : fetchOperationalOperatingExpenses({
          prisma,
          tw,
          userQ,
          startDate,
          endDate,
        }),
  ]);

  const usedGl = useGlRevenue || useGlOperatingExpenses;

  return {
    revenue: operationalRevenue,
    operatingExpenses: operationalOperatingExpenses,
    cogs,
    source: usedGl ? 'gl' : 'operational',
  };
}

/** Canonical GL codes surfaced on the financial-position dashboard. */
export const FINANCIAL_POSITION_GL_CODES = {
  accountsReceivable: '1200',
  accountsPayable: '2110',
  cashPrefixes: ['111', '112', '113'],
};

function isCashOrBankGlAccount(account) {
  const subtype = String(account?.accountSubtype ?? '').toLowerCase();
  const name = String(account?.accountName ?? account?.name ?? '').toLowerCase();
  const code = String(account?.accountCode ?? account?.code ?? '').trim();

  return (
    FINANCIAL_POSITION_GL_CODES.cashPrefixes.some((prefix) => code.startsWith(prefix)) ||
    subtype.includes('cash') ||
    name.includes('cash') ||
    name.includes('bank')
  );
}

/**
 * GL-backed cash, AR (1200), and AP (2110) balances as-of a date.
 *
 * @returns {Promise<{
 *   source: 'general_ledger',
 *   asOfDate: Date,
 *   totalCash: number,
 *   accountsReceivable: number,
 *   accountsPayable: number,
 *   cashAccounts: Array<{ accountCode: string, accountName: string, balance: number }>,
 *   controlAccounts: { accountsReceivable: object, accountsPayable: object },
 * }>}
 */
export async function fetchGlFinancialPositionMetrics({
  prisma,
  tenantIds,
  branchId,
  asOfDate,
}) {
  const empty = {
    source: 'general_ledger',
    asOfDate,
    totalCash: 0,
    accountsReceivable: 0,
    accountsPayable: 0,
    cashAccounts: [],
    controlAccounts: {
      accountsReceivable: { accountCode: FINANCIAL_POSITION_GL_CODES.accountsReceivable, balance: 0, found: false },
      accountsPayable: { accountCode: FINANCIAL_POSITION_GL_CODES.accountsPayable, balance: 0, found: false },
    },
  };

  if (branchId === false || !tenantIds?.length) {
    return empty;
  }

  let totalCash = 0;
  let accountsReceivable = 0;
  let accountsPayable = 0;
  const cashByCode = new Map();
  let arMeta = empty.controlAccounts.accountsReceivable;
  let apMeta = empty.controlAccounts.accountsPayable;

  for (const tenantId of tenantIds) {
    try {
      const [arGl, apGl, { rows }] = await Promise.all([
        getControlAccountGlBalance({
          tenantId,
          accountCode: FINANCIAL_POSITION_GL_CODES.accountsReceivable,
          asOfDate,
          branchId: branchId || null,
          prisma,
        }),
        getControlAccountGlBalance({
          tenantId,
          accountCode: FINANCIAL_POSITION_GL_CODES.accountsPayable,
          asOfDate,
          branchId: branchId || null,
          prisma,
        }),
        fetchOfficialLedgerAsOfRows({
          tenantId,
          asOfDate,
          branchId: branchId || null,
          prisma,
        }),
      ]);

      accountsReceivable = addMoney(accountsReceivable, arGl.balance);
      accountsPayable = addMoney(accountsPayable, apGl.balance);
      if (arGl.found) arMeta = arGl;
      if (apGl.found) apMeta = apGl;

      for (const row of rows) {
        if (!isAssetAccount(row.account) || !isCashOrBankGlAccount(row.account)) continue;
        const balance = roundReportAmount(
          computeBalanceSheetAmount(row.account, row.debitTotal, row.creditTotal)
        );
        if (!hasMeaningfulAmount(balance)) continue;

        totalCash = addMoney(totalCash, balance);
        const code = row.accountCode || row.accountId;
        const existing = cashByCode.get(code);
        if (existing) {
          existing.balance = addMoney(existing.balance, balance);
        } else {
          cashByCode.set(code, {
            accountCode: row.accountCode,
            accountName: row.accountName,
            balance,
          });
        }
      }
    } catch (err) {
      console.warn(
        `[dashboardGlMetrics] GL financial position failed for tenant ${tenantId}:`,
        err?.message || err
      );
    }
  }

  const cashAccounts = [...cashByCode.values()]
    .map((line) => ({ ...line, balance: roundMoney(line.balance) }))
    .sort((a, b) => String(a.accountCode).localeCompare(String(b.accountCode)));

  return {
    source: 'general_ledger',
    asOfDate,
    totalCash: roundMoney(totalCash),
    accountsReceivable: roundMoney(accountsReceivable),
    accountsPayable: roundMoney(accountsPayable),
    cashAccounts,
    controlAccounts: {
      accountsReceivable: arMeta,
      accountsPayable: apMeta,
    },
  };
}

/**
 * Compare GL control balances to operational sub-ledger totals.
 */
export function buildFinancialPositionReconciliation({
  glMetrics,
  operationalReceivables,
  operationalPayables,
  operationalCash,
}) {
  const items = [
    buildReconciliationItem({
      label: `Accounts receivable (${FINANCIAL_POSITION_GL_CODES.accountsReceivable})`,
      glAmount: glMetrics?.accountsReceivable ?? 0,
      operationalAmount: operationalReceivables ?? 0,
    }),
    buildReconciliationItem({
      label: `Accounts payable (${FINANCIAL_POSITION_GL_CODES.accountsPayable})`,
      glAmount: glMetrics?.accountsPayable ?? 0,
      operationalAmount: operationalPayables ?? 0,
    }),
    buildReconciliationItem({
      label: 'Cash and bank',
      glAmount: glMetrics?.totalCash ?? 0,
      operationalAmount: operationalCash ?? 0,
    }),
  ];

  return buildReconciliationSummary(items);
}
