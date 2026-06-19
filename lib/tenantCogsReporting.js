/**
 * Whether financial reports should show Cost of Goods Sold.
 * Service / non-inventory tenants should not see COGS (misleading gross profit).
 */

import { parseMoney, subtractMoney } from './money.js';

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {string} tenantId
 * @returns {Promise<boolean>}
 */
export async function tenantIncludesCogsInReports(prisma, tenantId) {
  const settings = await prisma.tenantSettings.findUnique({
    where: { tenantId },
    select: { setupWizardState: true, enabledModules: true },
  });

  const reports = settings?.setupWizardState?.reports;
  if (reports && typeof reports.includeCogsInReports === 'boolean') {
    return reports.includeCogsInReports;
  }

  return tenantTracksInventoryForResale(prisma, tenantId, settings?.enabledModules);
}

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {string} tenantId
 * @param {string[]|null|undefined} enabledModules
 */
async function tenantTracksInventoryForResale(prisma, tenantId, enabledModules) {
  if (
    Array.isArray(enabledModules) &&
    enabledModules.length > 0 &&
    !enabledModules.includes('inventory')
  ) {
    return false;
  }

  const stockedProducts = await prisma.product.count({
    where: {
      tenantId,
      isDeleted: false,
      isService: false,
      OR: [{ inventoryAccountId: { not: null } }, { stockLevel: { gt: 0 } }],
    },
  });
  if (stockedProducts > 0) return true;

  const purchaseOrders = await prisma.purchaseOrder.count({
    where: {
      tenantId,
      status: {
        in: ['Received', 'PartiallyReceived', 'Completed', 'Approved', 'Partially Received'],
      },
    },
  });
  return purchaseOrders > 0;
}

/**
 * @param {Record<string, unknown>|null|undefined} statement
 * @param {boolean} includeCogs
 */
export function applyIncomeStatementCogsPolicy(statement, includeCogs) {
  if (!statement) return statement;
  if (includeCogs) {
    return {
      ...statement,
      reporting: { ...(statement.reporting || {}), includeCogsInReports: true },
    };
  }

  const totalRevenue = parseMoney(statement.totalRevenue);
  const totalOperatingExpenses = parseMoney(statement.totalOperatingExpenses);
  const taxExpense = parseMoney(statement.taxExpense);

  const grossProfit = totalRevenue;
  const operatingIncome = subtractMoney(grossProfit, totalOperatingExpenses);
  const netIncome = subtractMoney(operatingIncome, taxExpense);

  return {
    ...statement,
    cogs: {
      costOfProductsSold: 0,
      freightShippingCosts: 0,
      lineItems: [],
      total: 0,
      excludedFromReports: true,
    },
    grossProfit,
    grossProfitMargin: totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0,
    operatingIncome,
    operatingMargin: totalRevenue > 0 ? (operatingIncome / totalRevenue) * 100 : 0,
    incomeBeforeTax: operatingIncome,
    netIncome,
    netProfitMargin: totalRevenue > 0 ? (netIncome / totalRevenue) * 100 : 0,
    reporting: {
      includeCogsInReports: false,
      cogsNote:
        'Cost of goods sold is not shown because this business does not track inventory purchases for resale.',
    },
    metadata: {
      ...(statement.metadata || {}),
      includeCogsInReports: false,
    },
  };
}

/**
 * @param {Record<string, unknown>} analytics
 * @param {boolean} includeCogs
 */
export function applyFinancialAnalyticsCogsPolicy(analytics, includeCogs) {
  if (!analytics || includeCogs) {
    return {
      ...analytics,
      reporting: { ...(analytics.reporting || {}), includeCogsInReports: true },
    };
  }

  const totals = analytics.totals || {};
  const operatingExpenses = parseMoney(totals.operatingExpenses);
  const revenue = parseMoney(totals.revenue);
  const profit = subtractMoney(revenue, operatingExpenses);

  const expenseBreakdown = (analytics.expenseBreakdown || []).filter(
    (row) =>
      !String(row?.key || '').startsWith('5100') &&
      !/cost of goods|cogs/i.test(String(row?.name || ''))
  );

  const trend = (analytics.trend || []).map((row) => ({
    ...row,
    expenses: parseMoney(row.operatingExpenses ?? row.expenses) - parseMoney(row.cogs),
    cogs: 0,
    operatingExpenses: parseMoney(row.operatingExpenses ?? subtractMoney(row.expenses, row.cogs)),
    profit: subtractMoney(row.revenue, parseMoney(row.operatingExpenses ?? row.expenses) - parseMoney(row.cogs)),
  }));

  return {
    ...analytics,
    trend,
    expenseBreakdown,
    totals: {
      ...totals,
      cogs: 0,
      expenses: operatingExpenses,
      profit,
    },
    reporting: {
      includeCogsInReports: false,
      cogsNote:
        'Cost of goods sold is not shown because this business does not track inventory purchases for resale.',
    },
  };
}
