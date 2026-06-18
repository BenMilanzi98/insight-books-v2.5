/**
 * Operational vs GL reconciliation helpers for sales, expense, inventory, and POS reports.
 */
import { addMoney, roundMoney } from '@/lib/money.js';
import { fetchOfficialLedgerRows } from './fetchOfficialLedgerRows.js';
import {
  hasMeaningfulAmount,
  isCostOfSalesAccount,
  isIncomeAccount,
  isInventoryAssetAccount,
  isInventoryLossAccount,
  isOperatingExpenseAccount,
  roundReportAmount,
} from './accountClassification.js';
import { buildReconciliationItem, buildReconciliationSummary } from './reportReconciliation.js';

function sumMatchingRows(rows, predicate) {
  return roundReportAmount(
    rows
      .filter((r) => predicate(r.account, r))
      .reduce((s, r) => addMoney(s, Math.abs(r.netMovement)), 0)
  );
}

/**
 * @param {object} params
 * @param {string} params.tenantId
 * @param {string|Date} params.startDate
 * @param {string|Date} params.endDate
 * @param {string|null} [params.branchId]
 * @param {import('@prisma/client').PrismaClient} [params.prisma]
 */
export async function getGlPeriodTotals({
  tenantId,
  startDate,
  endDate,
  branchId = null,
  prisma,
}) {
  const { rows, sourcePolicy } = await fetchOfficialLedgerRows({
    tenantId,
    startDate,
    endDate,
    branchId,
    prisma,
  });

  const revenue = sumMatchingRows(rows, (acc) => isIncomeAccount(acc));
  const cogs = sumMatchingRows(rows, (acc) => isCostOfSalesAccount(acc));
  const operatingExpenses = sumMatchingRows(rows, (acc) => isOperatingExpenseAccount(acc));
  const inventoryAssetMovement = sumMatchingRows(rows, (acc) => isInventoryAssetAccount(acc));
  const inventoryLoss = sumMatchingRows(rows, (acc) => isInventoryLossAccount(acc));

  return {
    sourcePolicy,
    revenue,
    cogs,
    operatingExpenses,
    totalExpenses: roundMoney(addMoney(cogs, operatingExpenses)),
    inventoryAssetMovement,
    inventoryLoss,
    hasGlActivity: rows.some((r) => hasMeaningfulAmount(r.netMovement)),
    accountLines: rows
      .filter((r) => hasMeaningfulAmount(r.netMovement))
      .map((r) => ({
        accountId: r.accountId,
        accountCode: r.accountCode,
        accountName: r.accountName,
        netMovement: roundReportAmount(r.netMovement),
        amount: roundReportAmount(Math.abs(r.netMovement)),
      })),
  };
}

export function buildSalesReconciliation(operationalRevenue, glTotals) {
  return buildReconciliationSummary([
    buildReconciliationItem({
      label: 'Net sales revenue',
      glAmount: glTotals?.revenue ?? 0,
      operationalAmount: operationalRevenue,
    }),
  ]);
}

export function buildExpenseReconciliation(operationalTotal, glTotals) {
  return buildReconciliationSummary([
    buildReconciliationItem({
      label: 'Total expenses (incl. COGS)',
      glAmount: glTotals?.totalExpenses ?? 0,
      operationalAmount: operationalTotal,
    }),
    buildReconciliationItem({
      label: 'Operating expenses',
      glAmount: glTotals?.operatingExpenses ?? 0,
      operationalAmount: operationalTotal,
    }),
  ]);
}

export function buildInventoryLossReconciliation(operationalTotal, glTotals) {
  return buildReconciliationSummary([
    buildReconciliationItem({
      label: 'Inventory loss expense',
      glAmount: glTotals?.inventoryLoss ?? 0,
      operationalAmount: operationalTotal,
    }),
  ]);
}

export function buildProfitAnalysisFromPl(plStatement, analyticsTotals = {}) {
  if (!plStatement) return null;

  const totalRevenue = roundMoney(plStatement.totalRevenue ?? 0);
  const totalCogs = roundMoney(plStatement.cogs?.total ?? plStatement.cogs?.costOfProductsSold ?? 0);
  const grossProfit = roundMoney(plStatement.grossProfit ?? subtractSafe(totalRevenue, totalCogs));
  const totalOperatingExpenses = roundMoney(plStatement.totalOperatingExpenses ?? 0);
  const netProfit = roundMoney(plStatement.netIncome ?? 0);

  return {
    totalRevenue,
    totalCogs,
    grossProfit,
    grossProfitMargin: totalRevenue > 0 ? roundMoney((grossProfit / totalRevenue) * 100) : 0,
    totalOperatingExpenses,
    netProfit,
    netProfitMargin: totalRevenue > 0 ? roundMoney((netProfit / totalRevenue) * 100) : 0,
    fromGeneralLedger: plStatement.metadata?.fromGeneralLedger ?? null,
    reconciliation: plStatement.metadata?.reconciliation ?? null,
    analyticsRevenueTotal: analyticsTotals.revenue ?? null,
    revenueAlignedWithPl:
      analyticsTotals.revenue == null ||
      Math.abs(roundMoney(analyticsTotals.revenue) - totalRevenue) <= 0.01,
  };
}

function subtractSafe(a, b) {
  return roundMoney(Number(a) - Number(b));
}

export { buildReconciliationItem, buildReconciliationSummary };
