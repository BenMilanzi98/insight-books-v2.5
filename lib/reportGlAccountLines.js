/**
 * Build full period GL account lines (opening, movement, closing) for reports.
 */
import prisma from '@/lib/prisma.js';
import {
  fetchOfficialLedgerRows,
  fetchOfficialLedgerAsOfRows,
} from '@/lib/reportingEngine/fetchOfficialLedgerRows.js';
import { computeBalanceSheetAmount, computePeriodNetMovement } from '@/lib/reportingEngine/accountClassification.js';
import { toStandardReportLine } from '@/lib/reportLineFormatter.js';
import { addMoney, roundMoney } from '@/lib/money.js';

function dayBeforeYmd(ymd) {
  const d = new Date(`${ymd}T12:00:00`);
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
}

/**
 * @param {object} params
 * @param {string} params.tenantId
 * @param {string} params.startDate
 * @param {string} params.endDate
 * @param {string|null} [params.branchId]
 * @param {(account: object, row?: object) => boolean} [params.accountFilter]
 * @param {import('@prisma/client').PrismaClient} [params.prisma]
 */
export async function buildPeriodAccountLines({
  tenantId,
  startDate,
  endDate,
  branchId = null,
  accountFilter = () => true,
  prisma: db = prisma,
}) {
  const openingAsOf = dayBeforeYmd(startDate);
  const [{ rows: openingRows }, { rows: periodRows }, { rows: closingRows }] = await Promise.all([
    fetchOfficialLedgerAsOfRows({ tenantId, asOfDate: openingAsOf, branchId, prisma: db }),
    fetchOfficialLedgerRows({ tenantId, startDate, endDate, branchId, prisma: db }),
    fetchOfficialLedgerAsOfRows({ tenantId, asOfDate: endDate, branchId, prisma: db }),
  ]);

  const openingById = new Map(openingRows.map((r) => [r.accountId, r]));
  const periodById = new Map(periodRows.map((r) => [r.accountId, r]));
  const closingById = new Map(closingRows.map((r) => [r.accountId, r]));

  const accountIds = new Set([
    ...openingById.keys(),
    ...periodById.keys(),
    ...closingById.keys(),
  ]);

  const lines = [];
  for (const accountId of accountIds) {
    const account =
      periodById.get(accountId)?.account ||
      closingById.get(accountId)?.account ||
      openingById.get(accountId)?.account;
    if (!account || !accountFilter(account)) continue;

    const openRow = openingById.get(accountId);
    const periodRow = periodById.get(accountId);
    const closeRow = closingById.get(accountId);

    const openingBalance = openRow
      ? roundMoney(computeBalanceSheetAmount(account, openRow.debitTotal, openRow.creditTotal))
      : 0;
    const closingBalance = closeRow
      ? roundMoney(computeBalanceSheetAmount(account, closeRow.debitTotal, closeRow.creditTotal))
      : openingBalance;
    const periodDebit = periodRow?.debitTotal || 0;
    const periodCredit = periodRow?.creditTotal || 0;
    const netMovement = periodRow
      ? roundMoney(periodRow.netMovement)
      : roundMoney(closingBalance - openingBalance);

    if (
      Math.abs(openingBalance) < 0.01 &&
      Math.abs(closingBalance) < 0.01 &&
      Math.abs(periodDebit) < 0.01 &&
      Math.abs(periodCredit) < 0.01
    ) {
      continue;
    }

    lines.push(
      toStandardReportLine({
        account,
        openingBalance,
        periodDebit,
        periodCredit,
        netMovement,
        closingBalance,
        sourceCount: periodRow ? 1 : 0,
        sectionKey: 'gl',
      })
    );
  }

  lines.sort((a, b) => String(a.accountCode).localeCompare(String(b.accountCode)));
  return lines;
}

/**
 * Merge GL period totals across tenants.
 * @param {string[]} tenantIds
 * @param {object} params
 */
export async function mergeGlPeriodTotalsForTenants(tenantIds, params) {
  const { getGlPeriodTotals } = await import('@/lib/reportingEngine/buildOperationalGlReconciliation.js');
  let merged = null;
  for (const tenantId of tenantIds) {
    const t = await getGlPeriodTotals({ tenantId, ...params });
    if (!merged) {
      merged = { ...t, accountLines: [...(t.accountLines || [])] };
    } else {
      merged.revenue = addMoney(merged.revenue, t.revenue);
      merged.cogs = addMoney(merged.cogs, t.cogs);
      merged.operatingExpenses = addMoney(merged.operatingExpenses, t.operatingExpenses);
      merged.totalExpenses = addMoney(merged.totalExpenses, t.totalExpenses);
      merged.inventoryAssetMovement = addMoney(merged.inventoryAssetMovement, t.inventoryAssetMovement);
      merged.inventoryLoss = addMoney(merged.inventoryLoss, t.inventoryLoss);
      merged.hasGlActivity = merged.hasGlActivity || t.hasGlActivity;
      if (t.accountLines?.length) merged.accountLines.push(...t.accountLines);
    }
  }
  return merged;
}

/**
 * Income-account GL lines for sales report reconciliation.
 */
export async function buildSalesGlAccountLines(params) {
  const { isIncomeAccount } = await import('@/lib/reportingEngine/accountClassification.js');
  return buildPeriodAccountLines({
    ...params,
    accountFilter: (acc) => isIncomeAccount(acc),
  });
}

/**
 * Expense + COGS GL lines for expense report.
 */
export async function buildExpenseGlAccountLines(params) {
  const {
    isCostOfSalesAccount,
    isOperatingExpenseAccount,
    isOtherExpenseAccount,
  } = await import('@/lib/reportingEngine/accountClassification.js');
  return buildPeriodAccountLines({
    ...params,
    accountFilter: (acc) =>
      isOperatingExpenseAccount(acc) ||
      isCostOfSalesAccount(acc) ||
      isOtherExpenseAccount(acc),
  });
}

/**
 * Inventory asset + loss GL lines for stock reports.
 */
export async function buildInventoryGlAccountLines(params) {
  const { isInventoryAssetAccount, isInventoryLossAccount } = await import(
    '@/lib/reportingEngine/accountClassification.js'
  );
  return buildPeriodAccountLines({
    ...params,
    accountFilter: (acc) => isInventoryAssetAccount(acc) || isInventoryLossAccount(acc),
  });
}

/**
 * Cash + income GL lines for POS daily reconcile.
 */
export async function buildPosGlAccountLines(params) {
  const { isIncomeAccount } = await import('@/lib/reportingEngine/accountClassification.js');
  return buildPeriodAccountLines({
    ...params,
    accountFilter: (acc) => {
      const c = String(acc.accountCode || '');
      if (isIncomeAccount(acc)) return true;
      if (/^11(10|20|30|31|32|33|34|35|36|37|38|40|41)/.test(c)) return true;
      if (/^113[0-9]/.test(c)) return true;
      return false;
    },
  });
}
