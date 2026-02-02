// app/api/dashboard/expenses-breakdown/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { addBranchFilter } from '@/lib/dashboardBranchFilter';

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
    
    const tenantId = user.tenantId;
    
    // Get date range from query parameters
    const { searchParams } = new URL(request.url);
    const dateRange = searchParams.get('dateRange') || 'month';
    
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
      case 'month':
        startDate = new Date(today.getFullYear(), today.getMonth(), 1);
        endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'lastMonth':
        startDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        endDate = new Date(today.getFullYear(), today.getMonth(), 0);
        endDate.setHours(23, 59, 59, 999);
        break;
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
        endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        endDate.setHours(23, 59, 59, 999);
    }
    
    // Get all expenses for the selected period, grouped by category
    // Include loan principal and interest as separate categories
    // Exclude deleted expenses
    // Include historical expenses regardless of date filter
    const expenses = await prisma.expense.groupBy({
      by: ['category'],
      where: addBranchFilter(user, {
        tenantId,
        OR: [
          // Include expenses within the selected date range
          {
            date: {
              gte: startDate,
              lte: endDate
            }
          },
          // ALWAYS include historical expenses (they might have dates outside the range)
          {
            isHistorical: true
          }
        ],
        status: { in: ['Approved', 'Pending'] },
        isDeleted: false
      }),
      _sum: {
        amount: true
      }
    });
    
    // Find COGS account(s) for this tenant to include in expenses
    const cogsAccounts = await prisma.account.findMany({
      where: {
        tenantId,
        isActive: true,
        accountType: 'Expense',
        OR: [
          { accountCode: '5000' },
          { code: '5000' },
          { accountName: { contains: 'cost of goods', mode: 'insensitive' } },
          { accountName: { contains: 'cogs', mode: 'insensitive' } },
          { name: { contains: 'cost of goods', mode: 'insensitive' } },
          { name: { contains: 'cogs', mode: 'insensitive' } }
        ]
      },
      select: { id: true, accountName: true, name: true }
    });
    const cogsAccountIds = cogsAccounts.map(acc => acc.id);
    
    // Get COGS transactions for the selected period
    let cogsTotal = 0;
    if (cogsAccountIds.length > 0) {
      const cogsData = await prisma.transactionLine.aggregate({
        where: {
          accountId: { in: cogsAccountIds },
          debitAmount: { gt: 0 },
          transaction: {
            tenantId,
            ...addBranchFilter(user, {}),
            date: {
              gte: startDate,
              lte: endDate
            },
            status: 'posted'
          }
        },
        _sum: { debitAmount: true }
      });
      cogsTotal = Number(cogsData._sum.debitAmount || 0);
    }
    
    // Calculate the total to get percentages (including COGS)
    const totalExpenses = expenses.reduce((sum, expense) => sum + expense._sum.amount, 0) + cogsTotal;
    
    // Format the response
    const expensesBreakdown = expenses.map(expense => ({
      category: expense.category,
      amount: expense._sum.amount,
      percentage: totalExpenses > 0 ? ((expense._sum.amount / totalExpenses) * 100).toFixed(1) : '0.0'
    }));
    
    // Add COGS as a separate category if there are COGS transactions
    if (cogsTotal > 0) {
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
    console.error('Error getting expenses breakdown:', error);
    return NextResponse.json(
      { error: 'Failed to fetch expenses breakdown data' },
      { status: 500 }
    );
  }
}