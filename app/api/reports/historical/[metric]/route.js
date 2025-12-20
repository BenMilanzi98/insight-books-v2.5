// app/api/financial/historical/[metric]/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { calculateDateRange } from '@/lib/dateUtils';

// GET - Fetch historical trend data for a given metric
export async function GET(request, { params }) {
  try {
    const metric = params.metric;
    
    // Get user from session
    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    // Get query parameters
    const { searchParams } = new URL(request.url);
    const timeframe = searchParams.get('timeframe') || 'thisMonth';
    const previousPeriod = searchParams.get('previousPeriod') === 'true';
    
    // Calculate date range
    const { startDate, endDate } = calculateDateRange(timeframe);
    
    // Get previous period date range if needed
    let prevStartDate, prevEndDate;
    if (previousPeriod) {
      const prevPeriod = calculateDateRange(timeframe, true);
      prevStartDate = prevPeriod.startDate;
      prevEndDate = prevPeriod.endDate;
    }
    
    // Get trend data based on metric type
    let data = [];
    let prevData = [];
    
    switch(metric) {
      case 'revenue':
        data = await getRevenueTrend(user.tenantId, startDate, endDate, timeframe);
        if (previousPeriod) {
          prevData = await getRevenueTrend(user.tenantId, prevStartDate, prevEndDate, timeframe);
        }
        break;
        
      case 'expenses':
        data = await getExpensesTrend(user.tenantId, startDate, endDate, timeframe);
        if (previousPeriod) {
          prevData = await getExpensesTrend(user.tenantId, prevStartDate, prevEndDate, timeframe);
        }
        break;
        
      case 'profit':
        data = await getProfitTrend(user.tenantId, startDate, endDate, timeframe);
        if (previousPeriod) {
          prevData = await getProfitTrend(user.tenantId, prevStartDate, prevEndDate, timeframe);
        }
        break;
        
      case 'expenseBreakdown':
        data = await getExpenseBreakdown(user.tenantId, startDate, endDate);
        break;
        
      case 'salesByCategory':
        data = await getSalesByCategory(user.tenantId, startDate, endDate);
        break;
        
      default:
        return NextResponse.json(
          { error: 'Unsupported metric' },
          { status: 400 }
        );
    }
    
    // Return the data
    return NextResponse.json({
      metric,
      timeframe,
      period: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString()
      },
      previousPeriod: previousPeriod ? {
        startDate: prevStartDate.toISOString(),
        endDate: prevEndDate.toISOString(),
        data: prevData
      } : null,
      data
    });
  } catch (error) {
    console.error(`Error fetching historical data for ${params.metric}:`, error);
    return NextResponse.json(
      { error: 'Failed to fetch historical data. Please try again.' },
      { status: 500 }
    );
  }
}

// Helper function to get revenue trend
async function getRevenueTrend(tenantId, startDate, endDate, timeframe) {
  // Determine the grouping interval based on timeframe
  let groupBy;
  if (timeframe === 'thisMonth' || timeframe === 'lastMonth') {
    groupBy = 'day';
  } else if (timeframe === 'thisQuarter' || timeframe === 'lastQuarter') {
    groupBy = 'week';
  } else {
    groupBy = 'month';
  }
  
  // Get all invoices in the date range
  const invoices = await prisma.invoice.findMany({
    where: {
      tenantId,
      issueDate: {
        gte: startDate,
        lte: endDate
      }
    }
  });
  
  // Get all sales in the date range
  const sales = await prisma.sale.findMany({
    where: {
      tenantId,
      saleDate: {
        gte: startDate,
        lte: endDate
      }
    }
  });
  
  // Combine and group by the specified interval
  return groupByTimePeriod([...invoices, ...sales], 
    item => item.issueDate || item.saleDate, 
    item => item.total, 
    groupBy, 
    startDate, 
    endDate
  );
}

// Helper function to get expenses trend
async function getExpensesTrend(tenantId, startDate, endDate, timeframe) {
  // Determine the grouping interval based on timeframe
  let groupBy;
  if (timeframe === 'thisMonth' || timeframe === 'lastMonth') {
    groupBy = 'day';
  } else if (timeframe === 'thisQuarter' || timeframe === 'lastQuarter') {
    groupBy = 'week';
  } else {
    groupBy = 'month';
  }
  
  // Get all expenses in the date range
  const expenses = await prisma.expense.findMany({
    where: {
      tenantId,
      date: {
        gte: startDate,
        lte: endDate
      },
      status: 'Approved'
    }
  });
  
  // Group by the specified interval
  return groupByTimePeriod(expenses, 
    expense => expense.date, 
    expense => expense.amount, 
    groupBy, 
    startDate, 
    endDate
  );
}

// Helper function to get profit trend
async function getProfitTrend(tenantId, startDate, endDate, timeframe) {
  // Get revenue and expenses
  const revenueTrend = await getRevenueTrend(tenantId, startDate, endDate, timeframe);
  const expensesTrend = await getExpensesTrend(tenantId, startDate, endDate, timeframe);
  
  // Calculate profit for each period
  const profitTrend = [];
  
  // Create a map of dates to revenue values
  const revenueMap = {};
  revenueTrend.forEach(item => {
    revenueMap[item.date] = item.value;
  });
  
  // Create a map of dates to expense values
  const expenseMap = {};
  expensesTrend.forEach(item => {
    expenseMap[item.date] = item.value;
  });
  
  // Combine all unique dates
  const allDates = [...new Set([...Object.keys(revenueMap), ...Object.keys(expenseMap)])];
  allDates.sort(); // Sort dates chronologically
  
  // Calculate profit for each date
  allDates.forEach(date => {
    const revenue = revenueMap[date] || 0;
    const expenses = expenseMap[date] || 0;
    const profit = revenue - expenses;
    
    profitTrend.push({
      date,
      value: profit
    });
  });
  
  return profitTrend;
}

// Helper function to get expense breakdown
async function getExpenseBreakdown(tenantId, startDate, endDate) {
  // Get all expenses in the date range
  const expenses = await prisma.expense.findMany({
    where: {
      tenantId,
      date: {
        gte: startDate,
        lte: endDate
      },
      status: 'Approved'
    }
  });
  
  // Group by category
  const categoryTotals = {};
  
  expenses.forEach(expense => {
    if (!categoryTotals[expense.category]) {
      categoryTotals[expense.category] = 0;
    }
    categoryTotals[expense.category] += expense.amount;
  });
  
  // Convert to array format
  return Object.entries(categoryTotals).map(([category, amount]) => ({
    category,
    amount
  }));
}

// Helper function to get sales by category
async function getSalesByCategory(tenantId, startDate, endDate) {
  // Get all sales items in the date range
  const sales = await prisma.sale.findMany({
    where: {
      tenantId,
      saleDate: {
        gte: startDate,
        lte: endDate
      }
    },
    include: {
      items: {
        include: {
          product: true
        }
      }
    }
  });
  
  // Group by product category
  const categoryTotals = {};
  
  sales.forEach(sale => {
    sale.items.forEach(item => {
      const category = item.product?.category || 'Uncategorized';
      
      if (!categoryTotals[category]) {
        categoryTotals[category] = 0;
      }
      categoryTotals[category] += item.amount;
    });
  });
  
  // Convert to array format
  return Object.entries(categoryTotals).map(([category, amount]) => ({
    category,
    amount
  }));
}

// Helper function to group data by time period
function groupByTimePeriod(items, dateAccessor, valueAccessor, groupBy, startDate, endDate) {
  // Create a map to hold period totals
  const periodTotals = {};
  
  // Helper function to get the period key from a date
  const getPeriodKey = (date) => {
    const d = new Date(date);
    
    if (groupBy === 'day') {
      return d.toISOString().split('T')[0]; // YYYY-MM-DD
    } else if (groupBy === 'week') {
      // Get the week number (ISO week)
      const firstDayOfYear = new Date(d.getFullYear(), 0, 1);
      const pastDaysOfYear = (d - firstDayOfYear) / 86400000;
      const weekNum = Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
      
      return `${d.getFullYear()}-W${weekNum.toString().padStart(2, '0')}`;
    } else if (groupBy === 'month') {
      return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`;
    } else {
      // Default to day
      return d.toISOString().split('T')[0];
    }
  };
  
  // Group items by period
  items.forEach(item => {
    const date = dateAccessor(item);
    const periodKey = getPeriodKey(date);
    
    if (!periodTotals[periodKey]) {
      periodTotals[periodKey] = 0;
    }
    
    periodTotals[periodKey] += valueAccessor(item);
  });
  
  // Generate all periods in the range
  const allPeriods = [];
  const currentDate = new Date(startDate);
  
  while (currentDate <= endDate) {
    const periodKey = getPeriodKey(currentDate);
    
    if (!periodTotals[periodKey]) {
      periodTotals[periodKey] = 0;
    }
    
    if (!allPeriods.includes(periodKey)) {
      allPeriods.push(periodKey);
    }
    
    // Increment the date based on the grouping
    if (groupBy === 'day') {
      currentDate.setDate(currentDate.getDate() + 1);
    } else if (groupBy === 'week') {
      currentDate.setDate(currentDate.getDate() + 7);
    } else if (groupBy === 'month') {
      currentDate.setMonth(currentDate.getMonth() + 1);
    }
  }
  
  // Sort periods chronologically
  allPeriods.sort();
  
  // Format periods for display
  const formatPeriod = (periodKey) => {
    if (groupBy === 'day') {
      return new Date(periodKey).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } else if (groupBy === 'week') {
      const [year, week] = periodKey.split('-W');
      return `Week ${week}`;
    } else if (groupBy === 'month') {
      const [year, month] = periodKey.split('-');
      return new Date(year, parseInt(month) - 1, 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    }
    return periodKey;
  };
  
  // Return the trend data
  return allPeriods.map(periodKey => ({
    date: periodKey,
    periodLabel: formatPeriod(periodKey),
    value: periodTotals[periodKey]
  }));
}