// app/api/reports/expenses/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';

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
    
    // Build query filter
    const filter = {
      tenantId: user.tenantId,
      date: {
        gte: new Date(startDate),
        lte: new Date(endDate)
      }
    };
    
    // Add category filter if provided
    if (category) {
      filter.category = category;
    }
    
    // Get expenses
    const expenses = await prisma.expense.findMany({
      where: filter,
      select: {
        id: true,
        description: true,
        amount: true,
        date: true,
        category: true,
        status: true,
        merchant: true,
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
    
    // Get expense categories
    const categories = await prisma.expense.groupBy({
      by: ['category'],
      where: {
        tenantId: user.tenantId
      },
      _sum: {
        amount: true
      },
      _count: true
    });
    
    // Group expenses by category
    const expensesByCategory = {};
    expenses.forEach(expense => {
      if (!expensesByCategory[expense.category]) {
        expensesByCategory[expense.category] = {
          category: expense.category,
          total: 0,
          items: []
        };
      }
      
      expensesByCategory[expense.category].total += expense.amount;
      expensesByCategory[expense.category].items.push(expense);
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
        availableCategories: categories.map(c => ({
          name: c.category,
          count: c._count,
          amount: c._sum.amount
        }))
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