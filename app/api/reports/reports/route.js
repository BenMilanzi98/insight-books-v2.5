// app/api/financial/reports/route.js
import { NextResponse } from 'next/server';
import { getUserFromSession } from '@/lib/auth';

// GET - Fetch available reports
export async function GET(request) {
  try {
    // Get user from session
    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    // Get current date for "last generated" timestamps
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const twoDaysAgo = new Date(today);
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
    const threeDaysAgo = new Date(today);
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    const fourDaysAgo = new Date(today);
    fourDaysAgo.setDate(fourDaysAgo.getDate() - 4);
    
    // Format dates as YYYY-MM-DD
    const formatDate = (date) => date.toISOString().split('T')[0];
    
    // Define available reports
    // In a real system, this would be pulled from a database
    const reports = [
      { 
        id: "profit-loss", 
        name: "Profit & Loss Statement", 
        icon: "FileBarChart",
        description: "View your revenue, expenses, and profit over a selected time period",
        lastGenerated: formatDate(today)
      },
      { 
        id: "balance-sheet", 
        name: "Balance Sheet", 
        icon: "FileText", 
        description: "Review your assets, liabilities, and equity at a specific point in time",
        lastGenerated: formatDate(today)
      },
      { 
        id: "cash-flow", 
        name: "Cash Flow Statement", 
        icon: "DollarSign", 
        description: "Track the movement of cash in and out of your business",
        lastGenerated: formatDate(today)
      },
      { 
        id: "tax-summary", 
        name: "Tax Summary", 
        icon: "FileMinus", 
        description: "Summary of your tax obligations and filing deadlines",
        lastGenerated: formatDate(yesterday)
      },
      { 
        id: "accounts-receivable", 
        name: "Accounts Receivable Aging", 
        icon: "TrendingUp", 
        description: "See outstanding customer invoices and how long they've been unpaid",
        lastGenerated: formatDate(twoDaysAgo)
      },
      { 
        id: "accounts-payable", 
        name: "Accounts Payable Aging", 
        icon: "TrendingDown", 
        description: "Track your unpaid bills and when they're due",
        lastGenerated: formatDate(twoDaysAgo)
      },
      { 
        id: "expense-report", 
        name: "Expense Report", 
        icon: "FileMinus", 
        description: "Detailed breakdown of your business expenses by category",
        lastGenerated: formatDate(threeDaysAgo)
      },
      { 
        id: "sales-report", 
        name: "Sales Report", 
        icon: "BarChart", 
        description: "Analysis of your sales performance by product, customer, or time period",
        lastGenerated: formatDate(threeDaysAgo)
      },
      { 
        id: "inventory-valuation", 
        name: "Inventory Valuation", 
        icon: "Package", 
        description: "Calculate the current value of your inventory",
        lastGenerated: formatDate(fourDaysAgo)
      },
      { 
        id: "financial-ratios", 
        name: "Financial Ratios", 
        icon: "PieChart", 
        description: "Key financial ratios to assess your business performance",
        lastGenerated: formatDate(fourDaysAgo)
      },
    ];
    
    // Return reports list
    return NextResponse.json({ reports });
  } catch (error) {
    console.error('Error fetching available reports:', error);
    return NextResponse.json(
      { error: 'Failed to fetch available reports. Please try again.' },
      { status: 500 }
    );
  }
}