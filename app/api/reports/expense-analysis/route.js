// app/api/reports/expense-analysis/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { addBranchFilter } from '@/lib/dashboardBranchFilter';

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
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const groupBy = searchParams.get('groupBy') || 'category'; // category, month
    
    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: 'Start date and end date are required' },
        { status: 400 }
      );
    }
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    
    // Get tenant name
    const tenant = await prisma.tenant.findUnique({
      where: { id: user.tenantId },
      select: { name: true }
    });
    
    let reportData = {};
    
    if (groupBy === 'category') {
      // Get expenses for current period
      let currentExpenses = [];
      try {
        currentExpenses = await prisma.expense.findMany({
          where: addBranchFilter(user, {
            tenantId: user.tenantId,
            date: { gte: start, lte: end },
            isDeleted: false
          })
        });
      } catch (expenseQueryError) {
        console.error('Error fetching current expenses for expense analysis:', expenseQueryError);
        console.error('Expense query error details:', {
          message: expenseQueryError.message,
          code: expenseQueryError.code,
          meta: expenseQueryError.meta
        });
        currentExpenses = [];
      }
      
      // Calculate period before (for comparison)
      const periodLength = end.getTime() - start.getTime();
      const previousStart = new Date(start.getTime() - periodLength);
      const previousEnd = new Date(start.getTime() - 1);
      
      let previousExpenses = [];
      try {
        previousExpenses = await prisma.expense.findMany({
          where: addBranchFilter(user, {
            tenantId: user.tenantId,
            date: { gte: previousStart, lte: previousEnd },
            isDeleted: false
          })
        });
      } catch (expenseQueryError) {
        console.error('Error fetching previous expenses for expense analysis:', expenseQueryError);
        previousExpenses = [];
      }
      
      // Group by category
      const categoryData = {};
      
      currentExpenses.forEach(expense => {
        const category = expense.category || 'Uncategorized';
        if (!categoryData[category]) {
          categoryData[category] = {
            category,
            thisPeriod: 0,
            lastPeriod: 0,
            change: 0,
            percentChange: 0,
            percentOfTotal: 0
          };
        }
        categoryData[category].thisPeriod += expense.amount || 0;
      });
      
      previousExpenses.forEach(expense => {
        const category = expense.category || 'Uncategorized';
        if (!categoryData[category]) {
          categoryData[category] = {
            category,
            thisPeriod: 0,
            lastPeriod: 0,
            change: 0,
            percentChange: 0,
            percentOfTotal: 0
          };
        }
        categoryData[category].lastPeriod += expense.amount || 0;
      });
      
      // Calculate changes and percentages
      const totalThisPeriod = Object.values(categoryData).reduce((sum, c) => sum + c.thisPeriod, 0);
      
      Object.values(categoryData).forEach(cat => {
        cat.change = cat.thisPeriod - cat.lastPeriod;
        cat.percentChange = cat.lastPeriod > 0 
          ? ((cat.thisPeriod - cat.lastPeriod) / cat.lastPeriod) * 100 
          : (cat.thisPeriod > 0 ? 100 : 0);
        cat.percentOfTotal = totalThisPeriod > 0 ? (cat.thisPeriod / totalThisPeriod) * 100 : 0;
      });
      
      reportData = {
        groupBy: 'category',
        data: Object.values(categoryData).sort((a, b) => b.thisPeriod - a.thisPeriod),
        totals: {
          thisPeriod: totalThisPeriod,
          lastPeriod: Object.values(categoryData).reduce((sum, c) => sum + c.lastPeriod, 0),
          change: totalThisPeriod - Object.values(categoryData).reduce((sum, c) => sum + c.lastPeriod, 0),
          percentChange: Object.values(categoryData).reduce((sum, c) => sum + c.lastPeriod, 0) > 0
            ? ((totalThisPeriod - Object.values(categoryData).reduce((sum, c) => sum + c.lastPeriod, 0)) / 
               Object.values(categoryData).reduce((sum, c) => sum + c.lastPeriod, 0)) * 100
            : 0
        }
      };
    } else if (groupBy === 'month') {
      // Group by month
      let expenses = [];
      try {
        expenses = await prisma.expense.findMany({
          where: addBranchFilter(user, {
            tenantId: user.tenantId,
            date: { gte: start, lte: end },
            isDeleted: false
          })
        });
      } catch (expenseQueryError) {
        console.error('Error fetching expenses for monthly analysis:', expenseQueryError);
        expenses = [];
      }
      
      // Get all unique categories
      const categories = [...new Set(expenses.map(e => e.category || 'Uncategorized'))];
      
      // Group by month and category
      const monthlyData = {};
      
      expenses.forEach(expense => {
        const date = expense.date;
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const monthName = date.toLocaleString('default', { month: 'short' });
        const category = expense.category || 'Uncategorized';
        
        if (!monthlyData[monthKey]) {
          monthlyData[monthKey] = {
            month: monthName,
            categories: {},
            total: 0
          };
          categories.forEach(cat => {
            monthlyData[monthKey].categories[cat] = 0;
          });
        }
        
        monthlyData[monthKey].categories[category] = (monthlyData[monthKey].categories[category] || 0) + (expense.amount || 0);
        monthlyData[monthKey].total += expense.amount || 0;
      });
      
      reportData = {
        groupBy: 'month',
        data: Object.keys(monthlyData).sort().map(key => ({
          ...monthlyData[key],
          monthKey: key
        })),
        categories,
        totals: {
          total: Object.values(monthlyData).reduce((sum, m) => sum + m.total, 0)
        }
      };
    }
    
    return NextResponse.json({
      companyName: tenant?.name || 'Company',
      period: {
        startDate,
        endDate
      },
      ...reportData
    });
  } catch (error) {
    console.error('Error generating expense analysis report:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
      code: error.code,
      meta: error.meta
    });
    return NextResponse.json(
      { 
        error: 'Failed to generate expense analysis report. Please try again.',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      },
      { status: 500 }
    );
  }
}

