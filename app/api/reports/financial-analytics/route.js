import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { addBranchFilter } from '@/lib/dashboardBranchFilter';
import { calculateDateRange, formatYmdInTimeZone } from '@/lib/dateUtils';

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

    // Fetch data - filter by branch
    const [invoices, sales, expenses, supplierBills, activeBudgets] = await Promise.all([
      prisma.invoice.findMany({
        where: addBranchFilter(user, {
          tenantId: user.tenantId,
          status: { in: ['Paid', 'Completed'] },
          issueDate: { gte: startDate, lte: endDate },
          voidedAt: null,
          refundedAt: null
        }),
        select: {
          total: true,
          issueDate: true,
          taxAmount: true,
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
      }),
      prisma.sale.findMany({
        where: addBranchFilter(user, {
          tenantId: user.tenantId,
          status: 'completed',
          saleDate: { gte: startDate, lte: endDate },
          voidedAt: null,
          refundedAt: null
        }),
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
          date: { gte: startDate, lte: endDate }
        }),
        select: {
          amount: true,
          date: true,
          category: true,
          description: true
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
    const expenseBreakdown = new Map();
    const revenueBySource = new Map([
      ['Invoices', 0],
      ['Sales', 0]
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

    invoices.forEach((invoice) => {
      const amount = Number(invoice.total) || 0;
      const label = formatLabel(invoice.issueDate, groupBy);
      addToBucket(trendMap, label, 'revenue', amount);
      addToMap(revenueBySource, 'Invoices', amount);
      if (invoice.client?.name) addToMap(customerMap, invoice.client.name, amount);
      for (const item of invoice.items || []) {
        const category = getCategoryDescriptor(item.product);
        categoriesMap.set(category.key, { id: category.id, name: category.name });
        const net = Number(item.netAmount || item.amount || 0);
        addToMap(revenueByCategoryMap, category.key, net);
      }
    });

    sales.forEach((sale) => {
      const amount = Number(sale.total) || 0;
      const label = formatLabel(sale.saleDate, groupBy);
      addToBucket(trendMap, label, 'revenue', amount);
      addToMap(revenueBySource, 'Sales', amount);
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
      const category = expense.category || 'Other';
      addToMap(expenseBreakdown, category, amount);
    });

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

    const expenseBreakdownArr = Array.from(expenseBreakdown.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);

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

    const avgRevenue = trend.length ? totalRevenue / trend.length : 0;
    const avgExpenses = trend.length ? totalExpenses / trend.length : 0;

    const categoryKeys = new Set([
      ...revenueByCategoryMap.keys(),
      ...expenseByCategoryMap.keys(),
      ...revenueBudgetMap.keys(),
      ...expenseBudgetMap.keys()
    ]);

    const elapsedDays = Math.max(
      1,
      Math.floor((Date.now() - startDate.getTime()) / 86400000) + 1
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
        expenses: totalExpenses,
        profit: totalProfit,
        avgRevenue,
        avgExpenses
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

