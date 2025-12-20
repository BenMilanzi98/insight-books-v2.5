import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';

const VALID_GROUPS = ['day', 'week', 'month'];

function parseDate(value, fallback = null) {
  if (!value) return fallback;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : date;
}

function formatLabel(date, groupBy) {
  const d = new Date(date);
  if (groupBy === 'day') {
    return d.toISOString().split('T')[0];
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

function getDateRange(searchParams) {
  const startParam = searchParams.get('startDate');
  const endParam = searchParams.get('endDate');

  const endDate = parseDate(endParam, new Date());
  const startDate = parseDate(
    startParam,
    new Date(endDate.getUTCFullYear(), endDate.getUTCMonth(), 1)
  );

  if (startDate > endDate) {
    throw new Error('Start date cannot be after end date');
  }

  startDate.setHours(0, 0, 0, 0);
  endDate.setHours(23, 59, 59, 999);

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

    // Fetch data
    const [invoices, sales, expenses] = await Promise.all([
      prisma.invoice.findMany({
        where: {
          tenantId: user.tenantId,
          status: { in: ['Paid', 'Completed'] },
          issueDate: { gte: startDate, lte: endDate },
          voidedAt: null,
          refundedAt: null
        },
        select: {
          total: true,
          issueDate: true,
          taxAmount: true,
          client: { select: { name: true } }
        }
      }),
      prisma.sale.findMany({
        where: {
          tenantId: user.tenantId,
          status: 'completed',
          saleDate: { gte: startDate, lte: endDate },
          voidedAt: null,
          refundedAt: null
        },
        select: {
          total: true,
          saleDate: true,
          taxAmount: true,
          client: { select: { name: true } }
        }
      }),
      prisma.expense.findMany({
        where: {
          tenantId: user.tenantId,
          status: 'Approved',
          isDeleted: false,
          date: { gte: startDate, lte: endDate }
        },
        select: {
          amount: true,
          date: true,
          category: true,
          description: true
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

    invoices.forEach((invoice) => {
      const amount = Number(invoice.total) || 0;
      const label = formatLabel(invoice.issueDate, groupBy);
      addToBucket(trendMap, label, 'revenue', amount);
      addToMap(revenueBySource, 'Invoices', amount);
      if (invoice.client?.name) addToMap(customerMap, invoice.client.name, amount);
    });

    sales.forEach((sale) => {
      const amount = Number(sale.total) || 0;
      const label = formatLabel(sale.saleDate, groupBy);
      addToBucket(trendMap, label, 'revenue', amount);
      addToMap(revenueBySource, 'Sales', amount);
      const customerName = sale.client?.name;
      if (customerName) addToMap(customerMap, customerName, amount);
    });

    expenses.forEach((expense) => {
      const amount = Number(expense.amount) || 0;
      const label = formatLabel(expense.date, groupBy);
      addToBucket(trendMap, label, 'expenses', amount);
      const category = expense.category || 'Other';
      addToMap(expenseBreakdown, category, amount);
    });

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

    const analytics = {
      period: {
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0]
      },
      groupBy,
      trend,
      expenseBreakdown: expenseBreakdownArr,
      revenueBySource: revenueBySourceArr,
      topCustomers,
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

