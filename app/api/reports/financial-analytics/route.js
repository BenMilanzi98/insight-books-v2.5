import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { addBranchFilter } from '@/lib/dashboardBranchFilter';
import { calculateDateRange, formatYmdInTimeZone } from '@/lib/dateUtils';
import { CHART_OF_ACCOUNTS_BLUEPRINT } from '@/lib/chartOfAccountsBlueprint';
import {
  lookupStandardExpenseCodeFromCategorySync,
  normalizeCategoryNameForReporting
} from '@/lib/expenseCategoryNormalization';
import { getEffectiveDashboardBranchId, normalizeBranchId } from '@/lib/branchAccess';
import { getCogsAccountIdsForExpenseRegister } from '@/lib/getCogsAccountIdsForExpenseRegister';
import { getCOGSTransactionStats } from '@/lib/cogsIntegration';
import { getSalesRevenueForPeriod } from '@/lib/incomeStatementService';

const VALID_GROUPS = ['day', 'week', 'month'];

function parseDate(value, fallback = null) {
  if (!value) return fallback;
  // Parse YYYY-MM-DD as local calendar date to avoid UTC day-shift issues.
  const date = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T00:00:00`)
    : new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : date;
}

function formatLabel(date, groupBy) {
  const d = new Date(date);
  if (groupBy === 'day') {
    return formatYmdInTimeZone(d);
  }
  if (groupBy === 'week') {
    const firstDayOfYear = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const pastDaysOfYear = (d - firstDayOfYear) / 86400000;
    const weekNumber = Math.ceil((pastDaysOfYear + firstDayOfYear.getUTCDay() + 1) / 7);
    return `${d.getUTCFullYear()}-W${String(weekNumber).padStart(2, '0')}`;
  }
  // month
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function addToBucket(map, label, field, amount) {
  if (!map.has(label)) {
    map.set(label, { label, revenue: 0, expenses: 0 });
  }
  map.get(label)[field] += amount;
}

function addToMap(map, key, amount) {
  if (!map.has(key)) {
    map.set(key, 0);
  }
  map.set(key, map.get(key) + amount);
}

function round2(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

/** @type {Map<string, string>} */
const BLUEPRINT_ACCOUNT_NAME_BY_CODE = new Map(
  CHART_OF_ACCOUNTS_BLUEPRINT.map((row) => [row.code, row.name])
);

/**
 * Parse account code for CoA-style sort (5000, 1130-01, cat:… last).
 * @param {string} key
 */
function accountCodeSortParts(key) {
  if (key.startsWith('cat:')) return [99999999, 99999999];
  return key.split('-').map((p) => parseInt(p, 10) || 0);
}

function compareExpenseBreakdownKeys(aKey, bKey) {
  const catA = aKey.startsWith('cat:');
  const catB = bKey.startsWith('cat:');
  if (catA !== catB) return catA ? 1 : -1;
  const pa = accountCodeSortParts(aKey);
  const pb = accountCodeSortParts(bKey);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const da = pa[i] ?? 0;
    const db = pb[i] ?? 0;
    if (da !== db) return da - db;
  }
  return aKey.localeCompare(bKey);
}

/** One row per GL / mapping bucket so custom category labels do not duplicate accounts. */
function expenseBreakdownBucketForExpense(expense) {
  const acc = expense.expenseAccount;
  if (acc?.accountCode) {
    const code = String(acc.accountCode).trim();
    const blueprintName = BLUEPRINT_ACCOUNT_NAME_BY_CODE.get(code);
    const displayName = blueprintName || acc.accountName?.trim() || code;
    return { key: code, label: `${code} — ${displayName}` };
  }
  const mapped = lookupStandardExpenseCodeFromCategorySync(expense.category);
  if (mapped) {
    const blueprintName = BLUEPRINT_ACCOUNT_NAME_BY_CODE.get(mapped);
    const fallback = expense.category?.trim() || 'Expense';
    const displayName = blueprintName || fallback;
    return { key: mapped, label: `${mapped} — ${displayName}` };
  }
  const raw = expense.category?.trim() || 'Unclassified';
  const norm = normalizeCategoryNameForReporting(raw) || 'unclassified';
  return { key: `cat:${norm}`, label: raw };
}

function safeVariancePercent(actual, budget) {
  const b = Number(budget) || 0;
  if (b === 0) return null;
  return round2(((Number(actual) || 0) - b) / b * 100);
}

function getDateRange(searchParams) {
  const startParam = searchParams.get('startDate');
  const endParam = searchParams.get('endDate');
  const timeframe = searchParams.get('timeframe') || searchParams.get('dateRange') || 'thisMonth';

  // If explicit dates are provided, treat as a custom range
  if (startParam && endParam) {
    const startDate = parseDate(startParam);
    const endDate = parseDate(endParam);
    if (!startDate || !endDate) throw new Error('Invalid startDate or endDate');
    if (startDate > endDate) throw new Error('Start date cannot be after end date');
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);
    return { startDate, endDate };
  }

  // Otherwise, use calendar-aligned timeframe boundaries (month = 1st–last day, quarter = calendar quarter, etc)
  const { startDate, endDate } = calculateDateRange(timeframe);
  return { startDate, endDate };
}

export async function GET(request) {
  try {
    const user = await getUserFromSession(request);
    if (!user || !user.tenantId) {
      return NextResponse.json(
        { error: 'Authentication required or no tenant associated' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const { startDate, endDate } = getDateRange(searchParams);
    const groupByParam = searchParams.get('groupBy') || 'month';
    const groupBy = VALID_GROUPS.includes(groupByParam) ? groupByParam : 'month';
    const categoryIdFilter = searchParams.get('categoryId');

    const accessEff = getEffectiveDashboardBranchId(user);
    /** Same argument as P&L → `getSalesRevenueForPeriod(tenant, …, branchId)` (`user.currentBranchId` normalized). */
    const plRevenueBranchId =
      accessEff === false ? null : normalizeBranchId(user.currentBranchId) ?? null;

    // Revenue: completed invoice payments by paymentDate + POS completed sales by saleDate (matches P&L).
    const [invoicePayments, sales, expenses, supplierBills, activeBudgets] = await Promise.all([
      accessEff === false
        ? Promise.resolve([])
        : prisma.payment.findMany({
            where: {
              tenantId: user.tenantId,
              isReversal: false,
              invoiceId: { not: null },
              status: { equals: 'Completed', mode: 'insensitive' },
              paymentDate: { gte: startDate, lte: endDate },
              invoice: {
                is: {
                  tenantId: user.tenantId,
                  voidedAt: null,
                  refundedAt: null
                }
              },
              ...(plRevenueBranchId
                ? {
                    OR: [
                      { branchId: plRevenueBranchId },
                      { invoice: { branchId: plRevenueBranchId } }
                    ]
                  }
                : {})
            },
            select: {
              amount: true,
              paymentDate: true,
              invoice: {
                select: {
                  total: true,
                  subtotal: true,
                  client: { select: { name: true } },
                  items: {
                    select: {
                      amount: true,
                      netAmount: true,
                      product: {
                        select: {
                          categoryId: true,
                          category: true,
                          inventoryCategory: { select: { id: true, name: true } }
                        }
                      }
                    }
                  }
                }
              }
            }
          }),
      accessEff === false
        ? Promise.resolve([])
        : prisma.sale.findMany({
            where: {
              tenantId: user.tenantId,
              status: 'completed',
              voidedAt: null,
              refundedAt: null,
              saleDate: { gte: startDate, lte: endDate },
              ...(plRevenueBranchId ? { branchId: plRevenueBranchId } : {})
            },
            select: {
              total: true,
              saleDate: true,
              taxAmount: true,
              client: { select: { name: true } },
              items: {
                select: {
                  amount: true,
                  product: {
                    select: {
                      categoryId: true,
                      category: true,
                      inventoryCategory: { select: { id: true, name: true } }
                    }
                  }
                }
              }
            }
          }),
      prisma.expense.findMany({
        where: addBranchFilter(user, {
          tenantId: user.tenantId,
          status: 'Approved',
          isDeleted: false,
          isReversal: false,
          date: { gte: startDate, lte: endDate }
        }),
        select: {
          amount: true,
          date: true,
          category: true,
          description: true,
          expenseAccount: {
            select: {
              accountCode: true,
              accountName: true
            }
          }
        }
      }),
      prisma.supplierBill.findMany({
        where: {
          tenantId: user.tenantId,
          billDate: { gte: startDate, lte: endDate },
          status: { notIn: ['Draft', 'Cancelled'] }
        },
        select: {
          id: true,
          billNumber: true,
          billDate: true,
          items: {
            select: {
              lineTotal: true,
              product: {
                select: {
                  categoryId: true,
                  category: true,
                  inventoryCategory: { select: { id: true, name: true } }
                }
              }
            }
          }
        }
      }),
      prisma.budget.findMany({
        where: {
          tenantId: user.tenantId,
          status: { in: ['active', 'draft'] },
          startDate: { lte: endDate },
          endDate: { gte: startDate }
        },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          budgetType: true,
          breakdowns: {
            where: { breakdownType: 'product_category' },
            select: {
              referenceId: true,
              referenceName: true,
              budgetedAmount: true
            }
          },
          items: {
            select: {
              categoryId: true,
              category: true,
              budgetedAmount: true
            }
          }
        }
      })
    ]);

    const trendMap = new Map();
    /** @type {Map<string, { label: string; value: number }>} */
    const expenseBreakdownBuckets = new Map();
    const revenueBySource = new Map([
      ['Invoice payments', 0],
      ['POS sales', 0]
    ]);
    const customerMap = new Map();
    const revenueByCategoryMap = new Map();
    const expenseByCategoryMap = new Map();
    const categoriesMap = new Map();
    const revenueBudgetMap = new Map();
    const expenseBudgetMap = new Map();

    const getCategoryDescriptor = (product) => {
      const id = product?.categoryId || null;
      const name =
        product?.inventoryCategory?.name ||
        product?.category ||
        'Uncategorized';
      const key = id || `legacy:${name}`;
      return { key, id, name };
    };

    const allocatePaymentToRevenueCategories = (paymentAmount, invoice) => {
      if (!invoice || !(Number(paymentAmount) > 0)) return;
      const lines = invoice.items || [];
      if (!lines.length) {
        const key = 'legacy:Uncategorized';
        categoriesMap.set(key, { id: null, name: 'Uncategorized' });
        addToMap(revenueByCategoryMap, key, Number(paymentAmount));
        return;
      }
      const invTotal = Math.max(Number(invoice.total) || 0, 0);
      let sumLines = 0;
      for (const it of lines) {
        sumLines +=
          Math.max(Number(it.netAmount) || 0, Number(it.amount) || 0) || 0;
      }
      const denom = invTotal > 0 ? invTotal : sumLines;
      if (!(denom > 0)) {
        const key = 'legacy:Uncategorized';
        categoriesMap.set(key, { id: null, name: 'Uncategorized' });
        addToMap(revenueByCategoryMap, key, Number(paymentAmount));
        return;
      }
      let allocated = 0;
      for (const item of lines) {
        const lineAmt =
          Math.max(Number(item.netAmount) || 0, Number(item.amount) || 0) || 0;
        if (!(lineAmt > 0)) continue;
        const alloc = (Number(paymentAmount) * lineAmt) / denom;
        if (!(alloc > 0)) continue;
        const category = getCategoryDescriptor(item.product);
        categoriesMap.set(category.key, { id: category.id, name: category.name });
        addToMap(revenueByCategoryMap, category.key, alloc);
        allocated += alloc;
      }
      const remainder = Number(paymentAmount) - allocated;
      if (remainder > 1e-4) {
        const key = 'legacy:Uncategorized';
        categoriesMap.set(key, { id: null, name: 'Uncategorized' });
        addToMap(revenueByCategoryMap, key, remainder);
      }
    };

    invoicePayments.forEach((payment) => {
      const payAmt = Number(payment.amount) || 0;
      if (!(payAmt > 0)) return;
      const label = formatLabel(payment.paymentDate, groupBy);
      addToBucket(trendMap, label, 'revenue', payAmt);
      addToMap(revenueBySource, 'Invoice payments', payAmt);
      const inv = payment.invoice;
      if (inv?.client?.name) addToMap(customerMap, inv.client.name, payAmt);
      allocatePaymentToRevenueCategories(payAmt, inv);
    });

    sales.forEach((sale) => {
      const amount = Number(sale.total) || 0;
      const label = formatLabel(sale.saleDate, groupBy);
      addToBucket(trendMap, label, 'revenue', amount);
      addToMap(revenueBySource, 'POS sales', amount);
      const customerName = sale.client?.name;
      if (customerName) addToMap(customerMap, customerName, amount);
      for (const item of sale.items || []) {
        const category = getCategoryDescriptor(item.product);
        categoriesMap.set(category.key, { id: category.id, name: category.name });
        const lineAmount = Number(item.amount || 0);
        addToMap(revenueByCategoryMap, category.key, lineAmount);
      }
    });

    expenses.forEach((expense) => {
      const amount = Number(expense.amount) || 0;
      const label = formatLabel(expense.date, groupBy);
      addToBucket(trendMap, label, 'expenses', amount);
      const { key, label: bucketLabel } = expenseBreakdownBucketForExpense(expense);
      if (!expenseBreakdownBuckets.has(key)) {
        expenseBreakdownBuckets.set(key, { label: bucketLabel, value: 0 });
      }
      const row = expenseBreakdownBuckets.get(key);
      row.value += amount;
    });

    /** COGS in trend + totals — aligned with P&L (GL net on COGS accounts, else activity fallback). */
    const operatingExpenseTotal = Array.from(trendMap.values()).reduce(
      (sum, item) => sum + (Number(item.expenses) || 0),
      0
    );
    let totalCogsApplied = 0;
    const cogsTransactionWhere = {
      tenantId: user.tenantId,
      date: { gte: startDate, lte: endDate },
      status: 'posted',
      isReversal: false
    };
    if (accessEff === false) {
      cogsTransactionWhere.branchId = { in: [] };
    } else if (plRevenueBranchId) {
      cogsTransactionWhere.OR = [{ branchId: plRevenueBranchId }, { branchId: null }];
    }

    let useGlCogs = false;
    let glPeriodTotal = 0;
    const cogsAccountIds = await getCogsAccountIdsForExpenseRegister(prisma, user.tenantId);
    if (cogsAccountIds.length > 0) {
      const cogsLines = await prisma.transactionLine.findMany({
        where: {
          accountId: { in: cogsAccountIds },
          transaction: cogsTransactionWhere
        },
        select: {
          debitAmount: true,
          creditAmount: true,
          transaction: { select: { date: true } }
        }
      });
      for (const line of cogsLines) {
        const net =
          (Number(line.debitAmount) || 0) - (Number(line.creditAmount) || 0);
        glPeriodTotal += net;
      }
      glPeriodTotal = round2(glPeriodTotal);
      useGlCogs = Math.abs(glPeriodTotal) > 1e-6;
      if (useGlCogs) {
        for (const line of cogsLines) {
          const net =
            (Number(line.debitAmount) || 0) - (Number(line.creditAmount) || 0);
          if (Math.abs(net) < 1e-9) continue;
          const label = formatLabel(line.transaction.date, groupBy);
          addToBucket(trendMap, label, 'expenses', net);
        }
        totalCogsApplied = glPeriodTotal;
      }
    }

    if (!useGlCogs && accessEff !== false) {
      try {
        const stats = await getCOGSTransactionStats(
          user.tenantId,
          startDate,
          endDate,
          plRevenueBranchId || undefined
        );
        const activityTotal = round2(Number(stats?.totalAmount ?? 0) || 0);
        if (activityTotal > 0) {
          const labels = Array.from(trendMap.keys());
          const revenues = labels.map((lb) => Number(trendMap.get(lb)?.revenue) || 0);
          const totalRev = revenues.reduce((a, b) => a + b, 0);
          if (totalRev > 0) {
            for (let i = 0; i < labels.length; i++) {
              const share = revenues[i] / totalRev;
              addToBucket(trendMap, labels[i], 'expenses', activityTotal * share);
            }
          } else {
            addToBucket(trendMap, formatLabel(startDate, groupBy), 'expenses', activityTotal);
          }
          totalCogsApplied = activityTotal;
        }
      } catch (cogsErr) {
        console.warn('Financial analytics: COGS activity fallback failed:', cogsErr?.message || cogsErr);
      }
    }

    supplierBills.forEach((bill) => {
      for (const item of bill.items || []) {
        if (!item.product) continue;
        const category = getCategoryDescriptor(item.product);
        categoriesMap.set(category.key, { id: category.id, name: category.name });
        const lineAmount = Number(item.lineTotal || 0);
        addToMap(expenseByCategoryMap, category.key, lineAmount);
      }
    });

    const latestRevenueBudget = activeBudgets.find((b) => b.budgetType === 'revenue');
    if (latestRevenueBudget) {
      for (const b of latestRevenueBudget.breakdowns || []) {
        const key = b.referenceId || `legacy:${b.referenceName || 'Uncategorized'}`;
        const name = b.referenceName || 'Uncategorized';
        categoriesMap.set(key, { id: b.referenceId || null, name });
        addToMap(revenueBudgetMap, key, Number(b.budgetedAmount || 0));
      }
    }
    const latestExpenseBudget = activeBudgets.find((b) => b.budgetType === 'expense');
    if (latestExpenseBudget) {
      for (const i of latestExpenseBudget.items || []) {
        const key = i.categoryId || `legacy:${i.category || 'Uncategorized'}`;
        const name = i.category || categoriesMap.get(key)?.name || 'Uncategorized';
        categoriesMap.set(key, { id: i.categoryId || null, name });
        addToMap(expenseBudgetMap, key, Number(i.budgetedAmount || 0));
      }
    }

    const trend = Array.from(trendMap.values())
      .map((item) => ({
        ...item,
        profit: item.revenue - item.expenses
      }))
      .sort((a, b) => (a.label > b.label ? 1 : -1));

    const expenseBreakdownArr = Array.from(expenseBreakdownBuckets.entries())
      .map(([key, row]) => ({
        key,
        name: row.label,
        value: round2(row.value)
      }))
      .sort((a, b) => {
        const byCode = compareExpenseBreakdownKeys(a.key, b.key);
        if (byCode !== 0) return byCode;
        return b.value - a.value;
      });

    if (totalCogsApplied > 0) {
      expenseBreakdownArr.push({
        key: '5100',
        name: '5100 — Cost of goods sold',
        value: round2(totalCogsApplied)
      });
      expenseBreakdownArr.sort((a, b) => {
        const byCode = compareExpenseBreakdownKeys(a.key, b.key);
        if (byCode !== 0) return byCode;
        return b.value - a.value;
      });
    }

    const revenueBySourceArr = Array.from(revenueBySource.entries()).map(([name, value]) => ({
      name,
      value
    }));

    const topCustomers = Array.from(customerMap.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    const totalRevenue = trend.reduce((sum, item) => sum + item.revenue, 0);
    const totalExpenses = trend.reduce((sum, item) => sum + item.expenses, 0);
    const totalProfit = totalRevenue - totalExpenses;

    let plSalesRevenueTotal = null;
    if (accessEff !== false) {
      plSalesRevenueTotal = await getSalesRevenueForPeriod(
        user.tenantId,
        formatYmdInTimeZone(startDate),
        formatYmdInTimeZone(endDate),
        plRevenueBranchId
      );
    }

    const avgRevenue = trend.length ? totalRevenue / trend.length : 0;
    const avgExpenses = trend.length ? totalExpenses / trend.length : 0;

    const categoryKeys = new Set([
      ...revenueByCategoryMap.keys(),
      ...expenseByCategoryMap.keys(),
      ...revenueBudgetMap.keys(),
      ...expenseBudgetMap.keys()
    ]);

    const todayCap = new Date();
    todayCap.setHours(23, 59, 59, 999);
    const periodEndCap = endDate.getTime() > todayCap.getTime() ? todayCap : endDate;
    const elapsedDays = Math.max(
      1,
      Math.floor((periodEndCap.getTime() - startDate.getTime()) / 86400000) + 1
    );
    const totalDays = Math.max(
      1,
      Math.floor((endDate.getTime() - startDate.getTime()) / 86400000) + 1
    );
    const projectionMultiplier = totalDays / elapsedDays;

    const revenueByCategory = [];
    const expenseByCategory = [];

    for (const key of categoryKeys) {
      const descriptor = categoriesMap.get(key) || { id: null, name: 'Uncategorized' };
      if (categoryIdFilter && descriptor.id !== categoryIdFilter) continue;

      const actualRevenue = round2(revenueByCategoryMap.get(key) || 0);
      const budgetRevenue = round2(revenueBudgetMap.get(key) || 0);
      const forecastRevenue = round2(actualRevenue * projectionMultiplier);
      revenueByCategory.push({
        categoryId: descriptor.id,
        categoryName: descriptor.name,
        actualAmount: actualRevenue,
        forecastAmount: forecastRevenue,
        budgetAmount: budgetRevenue,
        varianceToBudget: round2(actualRevenue - budgetRevenue),
        varianceToBudgetPercent: safeVariancePercent(actualRevenue, budgetRevenue),
        forecastVarianceToBudget: round2(forecastRevenue - budgetRevenue),
        forecastVarianceToBudgetPercent: safeVariancePercent(forecastRevenue, budgetRevenue)
      });

      const actualExpense = round2(expenseByCategoryMap.get(key) || 0);
      const budgetExpense = round2(expenseBudgetMap.get(key) || 0);
      const forecastExpense = round2(actualExpense * projectionMultiplier);
      expenseByCategory.push({
        categoryId: descriptor.id,
        categoryName: descriptor.name,
        actualAmount: actualExpense,
        forecastAmount: forecastExpense,
        budgetAmount: budgetExpense,
        varianceToBudget: round2(actualExpense - budgetExpense),
        varianceToBudgetPercent: safeVariancePercent(actualExpense, budgetExpense),
        forecastVarianceToBudget: round2(forecastExpense - budgetExpense),
        forecastVarianceToBudgetPercent: safeVariancePercent(forecastExpense, budgetExpense)
      });
    }

    revenueByCategory.sort((a, b) => b.actualAmount - a.actualAmount);
    expenseByCategory.sort((a, b) => b.actualAmount - a.actualAmount);

    const analytics = {
      period: {
        startDate: formatYmdInTimeZone(startDate),
        endDate: formatYmdInTimeZone(endDate)
      },
      groupBy,
      trend,
      expenseBreakdown: expenseBreakdownArr,
      revenueBySource: revenueBySourceArr,
      topCustomers,
      categoryForecasting: {
        projectionBasis: 'run_rate',
        elapsedDays,
        totalDays,
        categories: Array.from(categoriesMap.values())
          .filter((c) => !categoryIdFilter || c.id === categoryIdFilter)
          .sort((a, b) => String(a.name).localeCompare(String(b.name))),
        revenue: revenueByCategory,
        expenses: expenseByCategory
      },
      totals: {
        revenue: totalRevenue,
        /** Approved expense-register amounts only (excludes COGS). */
        operatingExpenses: round2(operatingExpenseTotal),
        cogs: round2(totalCogsApplied),
        /** Operating expenses + COGS (matches P&L cost side for profit). */
        expenses: totalExpenses,
        profit: totalProfit,
        avgRevenue,
        avgExpenses
      },
      metadata: {
        revenueBasis:
          'Invoice cash: completed payments by paymentDate; POS: completed sales by saleDate (same rules as P&L sales revenue).',
        plSalesRevenueTotal,
        analyticsRevenueTotal: round2(totalRevenue),
        revenueBranchId: plRevenueBranchId
      }
    };

    return NextResponse.json(analytics);
  } catch (error) {
    console.error('Error generating financial analytics:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate analytics. Please try again.' },
      { status: 500 }
    );
  }
}

