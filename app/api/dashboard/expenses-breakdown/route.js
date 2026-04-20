// app/api/dashboard/expenses-breakdown/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { addBranchFilter, addBranchFilterIncludeUnassigned } from '@/lib/dashboardBranchFilter';
import { endOfLocalDay } from '@/lib/dateUtils';
import { settledExpensePaymentOr } from '@/lib/dashboardExpenseFilters';
import {
  getAccessibleTenantIdsForUser,
  parseDashboardTenantScope,
  tenantWhereIn,
  userForDashboardBranchFilter,
} from '@/lib/dashboardTenantScope';
import { sumNetCogsDebitMinusCredit } from '@/lib/dashboardCogsNet';

// Prevent caching to ensure fresh data on branch switch
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request) {
  try {
    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    const { searchParams } = new URL(request.url);
    const accessible = await getAccessibleTenantIdsForUser(user);
    const scope = parseDashboardTenantScope(searchParams, user, accessible);
    if (!scope.ok) {
      return NextResponse.json(
        { error: scope.error || 'Invalid business scope' },
        { status: 400 }
      );
    }
    const { tenantIds, branchScoped } = scope;
    const tw = tenantWhereIn(tenantIds);
    const userQ = userForDashboardBranchFilter(user, branchScoped);
    const dateRange = searchParams.get('dateRange') || 'thisMonth';
    
    // Calculate date range based on the parameter
    let startDate, endDate;
    const today = new Date();
    
    switch (dateRange) {
      case 'today':
        startDate = new Date(today);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(today);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'yesterday':
        startDate = new Date(today);
        startDate.setDate(startDate.getDate() - 1);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(today);
        endDate.setDate(endDate.getDate() - 1);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'week':
      case 'thisWeek':
        startDate = new Date(today);
        startDate.setDate(startDate.getDate() - startDate.getDay());
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 6);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'lastWeek':
        startDate = new Date(today);
        startDate.setDate(startDate.getDate() - startDate.getDay() - 7);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 6);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'thisMonth':
      case 'month':
        startDate = new Date(today.getFullYear(), today.getMonth(), 1);
        endDate = endOfLocalDay(new Date(today.getFullYear(), today.getMonth() + 1, 0));
        break;
      case 'lastMonth':
        startDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        endDate = new Date(today.getFullYear(), today.getMonth(), 0);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'thisQuarter':
      case 'quarter':
        const currentQuarter = Math.floor(today.getMonth() / 3);
        startDate = new Date(today.getFullYear(), currentQuarter * 3, 1);
        endDate = new Date(today.getFullYear(), (currentQuarter + 1) * 3, 0);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'lastQuarter':
        const lastQuarter = Math.floor(today.getMonth() / 3) - 1;
        const lastQuarterYear = lastQuarter < 0 ? today.getFullYear() - 1 : today.getFullYear();
        const lastQuarterMonth = lastQuarter < 0 ? 9 : lastQuarter * 3;
        startDate = new Date(lastQuarterYear, lastQuarterMonth, 1);
        endDate = new Date(lastQuarterYear, lastQuarterMonth + 3, 0);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'thisYear':
      case 'year':
        startDate = new Date(today.getFullYear(), 0, 1);
        endDate = new Date(today.getFullYear(), 11, 31);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'lastYear':
        startDate = new Date(today.getFullYear() - 1, 0, 1);
        endDate = new Date(today.getFullYear() - 1, 11, 31);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'last7Days':
        startDate = new Date(today);
        startDate.setDate(startDate.getDate() - 7);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(today);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'last30Days':
        startDate = new Date(today);
        startDate.setDate(startDate.getDate() - 30);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(today);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'last90Days':
        startDate = new Date(today);
        startDate.setDate(startDate.getDate() - 90);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(today);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'last365Days':
        startDate = new Date(today);
        startDate.setDate(startDate.getDate() - 365);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(today);
        endDate.setHours(23, 59, 59, 999);
        break;
      default:
        startDate = new Date(today.getFullYear(), today.getMonth(), 1);
        endDate = endOfLocalDay(new Date(today.getFullYear(), today.getMonth() + 1, 0));
    }
    
    // Get all expenses for the selected period, grouped by category.
    // Use date range only so this works with DBs that may not have isHistorical.
    const expenseWhere = addBranchFilterIncludeUnassigned(userQ, {
      ...tw,
      isReversal: false,
      date: { gte: startDate, lte: endDate },
      // Only count expenses that have been paid (or partially paid).
      // Pending liabilities (e.g. PAYE/NPS created during payroll) should not inflate dashboard expenses.
      status: { in: ['Approved'] },
      ...settledExpensePaymentOr(),
      isDeleted: false
    });

    // Aggregate in JS — avoids Prisma groupBy edge cases and works if category is null in legacy rows
    let expenses;
    try {
      const rows = await prisma.expense.findMany({
        where: expenseWhere,
        select: { category: true, amount: true }
      });
      const byCategory = new Map();
      for (const row of rows) {
        const key = row.category ?? 'Uncategorized';
        byCategory.set(key, (byCategory.get(key) || 0) + (Number(row.amount) || 0));
      }
      expenses = Array.from(byCategory.entries()).map(([category, sum]) => ({
        category,
        _sum: { amount: sum }
      }));
    } catch (err) {
      console.error('expenses-breakdown expense aggregation failed:', err?.message || err);
      throw err;
    }

    // COGS: find cost accounts (optional; skip if schema/DB differs)
    let cogsAccountIds = [];
    try {
      const cogsAccounts = await prisma.account.findMany({
        where: {
          ...tw,
          isActive: true,
          accountType: 'Expense',
          OR: [
            { accountCode: '5000' },
            { code: '5000' },
            { accountCode: '5100' },
            { code: '5100' },
            { accountName: { contains: 'cost of goods', mode: 'insensitive' } },
            { accountName: { contains: 'cogs', mode: 'insensitive' } },
            { name: { contains: 'cost of goods', mode: 'insensitive' } },
            { name: { contains: 'cogs', mode: 'insensitive' } }
          ]
        },
        select: { id: true }
      });
      cogsAccountIds = cogsAccounts.map(acc => acc.id);
    } catch (accountErr) {
      console.error('expenses-breakdown cogs accounts lookup failed:', accountErr?.message || accountErr);
      // Continue without COGS if Account query fails (e.g. missing column in restored DB)
    }

    let cogsTotal = 0;
    if (cogsAccountIds.length > 0) {
      try {
        const txFilter = { ...tw, date: { gte: startDate, lte: endDate }, status: 'posted' };
        const branchFilter = addBranchFilter(userQ, {});
        if (Object.keys(branchFilter).length > 0) Object.assign(txFilter, branchFilter);
        cogsTotal = await sumNetCogsDebitMinusCredit(prisma, {
          cogsAccountIds,
          transactionWhere: txFilter,
        });
      } catch (cogsErr) {
        console.error('expenses-breakdown COGS aggregate failed:', cogsErr?.message || cogsErr);
        // Continue with cogsTotal 0
      }
    }
    
    // Calculate the total to get percentages (including COGS); guard against null _sum.amount
    const totalExpenses = expenses.reduce((sum, expense) => sum + (Number(expense._sum?.amount) || 0), 0) + cogsTotal;
    
    // Format the response
    const expensesBreakdown = expenses.map(expense => {
      const amount = Number(expense._sum?.amount) || 0;
      return {
        category: expense.category ?? 'Uncategorized',
        amount,
        percentage: totalExpenses > 0 ? ((amount / totalExpenses) * 100).toFixed(1) : '0.0'
      };
    });
    
    // Add COGS as a separate category when net COGS is non-zero (void/refunds can make it negative)
    if (cogsTotal !== 0) {
      expensesBreakdown.push({
        category: 'Cost of Goods Sold',
        amount: cogsTotal,
        percentage: totalExpenses > 0 ? ((cogsTotal / totalExpenses) * 100).toFixed(1) : '0.0'
      });
    }
    
    return NextResponse.json({
      expensesBreakdown
    });
  } catch (error) {
    console.error('Error getting expenses breakdown:', error?.message || error);
    return NextResponse.json(
      { error: 'Failed to fetch expenses breakdown data', details: error?.message },
      { status: 500 }
    );
  }
}