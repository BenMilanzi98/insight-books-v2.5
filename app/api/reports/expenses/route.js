// app/api/reports/expenses/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { addBranchFilter } from '@/lib/dashboardBranchFilter';
import { parseInclusiveApiYmdRange } from '@/lib/dateUtils';

export async function GET(request) {
  try {
    // Get user from session
    const user = await getUserFromSession(request);
    if (!user || !user.tenantId) {
      return NextResponse.json(
        { error: 'Authentication required or no tenant associated' },
        { status: 401 }
      );
    }
    
    // Get query parameters
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const category = searchParams.get('category');
    
    // Validate dates
    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: 'Start date and end date are required' },
        { status: 400 }
      );
    }

    const { start, end } = parseInclusiveApiYmdRange(startDate, endDate);
    
    // Build query filter — approved register only (aligned with P&L operating expenses)
    const filter = addBranchFilter(user, {
      tenantId: user.tenantId,
      status: 'Approved',
      isDeleted: false,
      isReversal: false,
      date: {
        gte: start,
        lte: end
      }
    });
    
    // Add category filter if provided
    if (category) {
      filter.category = category;
    }
    
    // Get expenses with account code via ExpenseCategory
    const expenses = await prisma.expense.findMany({
      where: filter,
      select: {
        id: true,
        description: true,
        amount: true,
        date: true,
        category: true,
        categoryId: true,
        status: true,
        merchant: true,
        expenseCategory: {
          select: {
            accountCode: true,
            name: true,
          }
        },
        submittedBy: {
          select: {
            name: true
          }
        }
      },
      orderBy: {
        date: 'desc'
      }
    });

    // Build a lookup of category name → account code from ExpenseCategory table
    const categoryCodeMap = {};
    try {
      const expenseCategories = await prisma.expenseCategory.findMany({
        where: { tenantId: user.tenantId },
        select: { name: true, accountCode: true },
      });
      expenseCategories.forEach((ec) => {
        if (ec.name) categoryCodeMap[ec.name] = ec.accountCode || '';
      });
    } catch (_) { /* non-fatal */ }

    // Attach accountCode to each expense
    expenses.forEach((exp) => {
      exp.accountCode =
        exp.expenseCategory?.accountCode ||
        categoryCodeMap[exp.category] ||
        '';
    });
    
    // Get expense categories - filter by branch
    const categories = await prisma.expense.groupBy({
      by: ['category'],
      where: addBranchFilter(user, {
        tenantId: user.tenantId,
        status: 'Approved',
        isDeleted: false,
        isReversal: false,
        date: {
          gte: start,
          lte: end
        }
      }),
      _sum: {
        amount: true
      },
      _count: true
    });
    
    // Group expenses by category, include account code
    const expensesByCategory = {};
    expenses.forEach(expense => {
      const key = expense.category;
      if (!expensesByCategory[key]) {
        expensesByCategory[key] = {
          category: expense.category,
          accountCode: expense.accountCode || categoryCodeMap[key] || '',
          total: 0,
          items: []
        };
      }
      
      expensesByCategory[key].total += expense.amount;
      expensesByCategory[key].items.push(expense);
    });
    
    // Group expenses by month
    const expensesByMonth = {};
    expenses.forEach(expense => {
      const date = new Date(expense.date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const monthName = date.toLocaleString('default', { month: 'long', year: 'numeric' });
      
      if (!expensesByMonth[monthKey]) {
        expensesByMonth[monthKey] = {
          month: monthName,
          total: 0
        };
      }
      
      expensesByMonth[monthKey].total += expense.amount;
    });
    
    // Calculate totals
    const totalExpenses = expenses.reduce((sum, expense) => sum + expense.amount, 0);
    
    // Format the final report
    return NextResponse.json({
      period: {
        startDate,
        endDate
      },
      summary: {
        totalExpenses,
        expenseCount: expenses.length,
        availableCategories: categories.map((c) => {
          const codeFromMap = categoryCodeMap[c.category] || '';
          const codeFromLine =
            expenses.find((e) => e.category === c.category)?.accountCode || '';
          return {
            name: c.category,
            accountCode: codeFromMap || codeFromLine,
            count: c._count,
            amount: c._sum.amount,
          };
        }),
      },
      expensesByCategory: Object.values(expensesByCategory),
      expensesByMonth: Object.values(expensesByMonth).sort((a, b) => 
        a.month.localeCompare(b.month)
      ),
      expenses
    });
  } catch (error) {
    console.error('Error generating expense report:', error);
    return NextResponse.json(
      { error: 'Failed to generate expense report. Please try again.' },
      { status: 500 }
    );
  }
}
