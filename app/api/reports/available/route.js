// app/api/reports/available/route.js
import { NextResponse } from 'next/server';
import { getUserFromSession } from '@/lib/auth';
import { getAccessibleTenantIdsForUser } from '@/lib/dashboardTenantScope';

export async function GET(request) {
  try {
    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const accessibleTenantIds = await getAccessibleTenantIdsForUser(user);
    
    // Define available reports
    const reports = [
      {
        id: 'profit-loss',
        name: 'Profit & Loss Statement',
        description: 'Income statement showing revenue, expenses, and profitability',
        icon: 'FileBarChart',
        category: 'Financial',
        lastGenerated: null,
        requiresTimeframe: true
      },
      {
        id: 'profit-analysis',
        name: 'Profit Analysis',
        description: 'Revenue, expenses, profit trends, expense breakdown, forecasts, and customer mix for the period',
        icon: 'PieChart',
        category: 'Financial',
        lastGenerated: null,
        requiresTimeframe: true
      },
      {
        id: 'balance-sheet',
        name: 'Balance Sheet',
        description: 'Shows assets, liabilities, and equity at a specific point in time',
        icon: 'FileText',
        category: 'Financial',
        lastGenerated: null,
        requiresTimeframe: true
      },
      {
        id: 'cash-flow',
        name: 'Cash Flow Statement',
        description: 'Tracks the flow of cash in and out of your business',
        icon: 'DollarSign',
        category: 'Financial',
        lastGenerated: null,
        requiresTimeframe: true
      },
      {
        id: 'tax-summary',
        name: 'Tax Summary',
        description: 'Summary of collected and paid taxes for compliance',
        icon: 'FileText',
        category: 'Financial',
        lastGenerated: null,
        requiresTimeframe: true
      },
      {
        id: 'sales-report',
        name: 'Sales Report',
        description: 'Analysis of sales performance by product, customer, and time',
        icon: 'TrendingUp',
        category: 'Sales',
        lastGenerated: null,
        requiresTimeframe: true
      },
      {
        id: 'expense-report',
        name: 'Expense Report',
        description: 'Breakdown of expenses by category and time period',
        icon: 'TrendingDown',
        category: 'Financial',
        lastGenerated: null,
        requiresTimeframe: true
      },
      {
        id: 'stock-movement',
        name: 'Stock Movement Report',
        description: 'Track inventory changes over time by product',
        icon: 'Package',
        category: 'Inventory',
        lastGenerated: null,
        requiresTimeframe: true
      },
      {
        id: 'inventory-loss-report',
        name: 'Inventory Loss Report',
        description: 'Write-off and stock-out losses with amounts, trends, and references',
        icon: 'TrendingDown',
        category: 'Inventory',
        lastGenerated: null,
        requiresTimeframe: true
      },
      {
        id: 'pos-daily',
        name: 'Daily POS Report',
        description: 'Quick daily snapshot of POS sales, transactions, and payment breakdown',
        icon: 'TrendingUp',
        category: 'Sales',
        lastGenerated: null,
        requiresTimeframe: false
      },
    ];
    
    return NextResponse.json({
      reports,
      multiBusiness: accessibleTenantIds.length > 1,
      accessibleBusinessCount: accessibleTenantIds.length,
    });
  } catch (error) {
    console.error('Error fetching available reports:', error);
    return NextResponse.json(
      { error: 'Failed to fetch available reports. Please try again.' },
      { status: 500 }
    );
  }
}