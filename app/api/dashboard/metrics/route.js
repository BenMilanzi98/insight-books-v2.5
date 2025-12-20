// app/api/dashboard/metrics/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';

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
    const { searchParams } = new URL(request.url);
    const dateRange = searchParams.get('dateRange') || 'month';
    const now = new Date();
    
    // Calculate date ranges
    let currentPeriodStart, currentPeriodEnd, previousPeriodStart, previousPeriodEnd;
    
    switch (dateRange) {
      case 'today': {
        // Today's data
        currentPeriodStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        currentPeriodEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
        // Yesterday's data
        previousPeriodStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
        previousPeriodEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59, 999);
        break;
      }
      
      case 'yesterday': {
        // Yesterday's data
        currentPeriodStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
        currentPeriodEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59, 999);
        // Day before yesterday's data
        previousPeriodStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 2);
        previousPeriodEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 2, 23, 59, 59, 999);
        break;
      }
      
      case 'thisWeek': {
        const dayOfWeek = now.getDay();
        const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        currentPeriodStart = new Date(now);
        currentPeriodStart.setDate(now.getDate() - daysToMonday);
        // Previous week
        previousPeriodStart = new Date(currentPeriodStart);
        previousPeriodStart.setDate(currentPeriodStart.getDate() - 7);
        previousPeriodEnd = new Date(currentPeriodStart);
        previousPeriodEnd.setDate(currentPeriodStart.getDate() - 1);
        break;
      }
      
      case 'lastWeek': {
        const dayOfWeek = now.getDay();
        const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        const thisWeekStart = new Date(now);
        thisWeekStart.setDate(now.getDate() - daysToMonday);
        // Last week's data
        currentPeriodStart = new Date(thisWeekStart);
        currentPeriodStart.setDate(thisWeekStart.getDate() - 7);
        currentPeriodEnd = new Date(thisWeekStart);
        currentPeriodEnd.setDate(thisWeekStart.getDate() - 1);
        // Week before last week
        previousPeriodStart = new Date(currentPeriodStart);
        previousPeriodStart.setDate(currentPeriodStart.getDate() - 7);
        previousPeriodEnd = new Date(currentPeriodStart);
        previousPeriodEnd.setDate(currentPeriodStart.getDate() - 1);
        break;
      }
      
      case 'thisMonth': {
        currentPeriodStart = new Date(now.getFullYear(), now.getMonth(), 1);
        // Previous month
        previousPeriodStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        previousPeriodEnd = new Date(now.getFullYear(), now.getMonth(), 0);
        break;
      }
      
      case 'lastMonth': {
        // Last month's data
        currentPeriodStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        currentPeriodEnd = new Date(now.getFullYear(), now.getMonth(), 0);
        // Month before last month
        previousPeriodStart = new Date(now.getFullYear(), now.getMonth() - 2, 1);
        previousPeriodEnd = new Date(now.getFullYear(), now.getMonth() - 1, 0);
        break;
      }
      
      case 'thisQuarter': {
        const currentQuarter = Math.floor(now.getMonth() / 3);
        currentPeriodStart = new Date(now.getFullYear(), currentQuarter * 3, 1);
        // Previous quarter
        const prevQuarter = currentQuarter === 0 ? 3 : currentQuarter - 1;
        const prevQuarterYear = currentQuarter === 0 ? now.getFullYear() - 1 : now.getFullYear();
        previousPeriodStart = new Date(prevQuarterYear, prevQuarter * 3, 1);
        previousPeriodEnd = new Date(now.getFullYear(), currentQuarter * 3, 0);
        break;
      }
      
      case 'lastQuarter': {
        const currentQuarter = Math.floor(now.getMonth() / 3);
        const lastQuarter = currentQuarter === 0 ? 3 : currentQuarter - 1;
        const lastQuarterYear = currentQuarter === 0 ? now.getFullYear() - 1 : now.getFullYear();
        // Last quarter's data
        currentPeriodStart = new Date(lastQuarterYear, lastQuarter * 3, 1);
        currentPeriodEnd = new Date(lastQuarterYear, (lastQuarter + 1) * 3, 0);
        // Quarter before last quarter
        const prevQuarter = lastQuarter === 0 ? 3 : lastQuarter - 1;
        const prevQuarterYear = lastQuarter === 0 ? lastQuarterYear - 1 : lastQuarterYear;
        previousPeriodStart = new Date(prevQuarterYear, prevQuarter * 3, 1);
        previousPeriodEnd = new Date(lastQuarterYear, lastQuarter * 3, 0);
        break;
      }
      
      case 'thisYear': {
        // This year's data
        currentPeriodStart = new Date(now.getFullYear(), 0, 1);
        currentPeriodEnd = new Date(now.getFullYear(), 11, 31);
        // Previous year
        previousPeriodStart = new Date(now.getFullYear() - 1, 0, 1);
        previousPeriodEnd = new Date(now.getFullYear() - 1, 11, 31);
        break;
      }
      
      case 'lastYear': {
        // Last year's data
        currentPeriodStart = new Date(now.getFullYear() - 1, 0, 1);
        currentPeriodEnd = new Date(now.getFullYear() - 1, 11, 31);
        // Year before last year
        previousPeriodStart = new Date(now.getFullYear() - 2, 0, 1);
        previousPeriodEnd = new Date(now.getFullYear() - 2, 11, 31);
        break;
      }
      
      case 'last7Days': {
        currentPeriodStart = new Date(now);
        currentPeriodStart.setDate(now.getDate() - 7);
        // Previous 7 days
        previousPeriodStart = new Date(now);
        previousPeriodStart.setDate(now.getDate() - 14);
        previousPeriodEnd = new Date(now);
        previousPeriodEnd.setDate(now.getDate() - 8);
        break;
      }
      
      case 'last30Days': {
        currentPeriodStart = new Date(now);
        currentPeriodStart.setDate(now.getDate() - 30);
        // Previous 30 days
        previousPeriodStart = new Date(now);
        previousPeriodStart.setDate(now.getDate() - 60);
        previousPeriodEnd = new Date(now);
        previousPeriodEnd.setDate(now.getDate() - 31);
        break;
      }
      
      case 'last90Days': {
        currentPeriodStart = new Date(now);
        currentPeriodStart.setDate(now.getDate() - 90);
        // Previous 90 days
        previousPeriodStart = new Date(now);
        previousPeriodStart.setDate(now.getDate() - 180);
        previousPeriodEnd = new Date(now);
        previousPeriodEnd.setDate(now.getDate() - 91);
        break;
      }
      
      case 'last365Days': {
        currentPeriodStart = new Date(now);
        currentPeriodStart.setDate(now.getDate() - 365);
        // Previous 365 days
        previousPeriodStart = new Date(now);
        previousPeriodStart.setDate(now.getDate() - 730);
        previousPeriodEnd = new Date(now);
        previousPeriodEnd.setDate(now.getDate() - 366);
        break;
      }
      
      case 'custom': {
        // Handle custom date range from query parameters
        const startDate = searchParams.get('startDate');
        const endDate = searchParams.get('endDate');
        
        if (startDate && endDate) {
          currentPeriodStart = new Date(startDate);
          currentPeriodEnd = new Date(endDate);
          currentPeriodStart.setHours(0, 0, 0, 0);
          currentPeriodEnd.setHours(23, 59, 59, 999);
          
          // For custom ranges, we don't calculate previous period automatically
          // as it would be complex to determine what "previous" means for arbitrary ranges
          previousPeriodStart = currentPeriodStart;
          previousPeriodEnd = currentPeriodEnd;
        } else {
          // Default to this month if custom dates not provided
          currentPeriodStart = new Date(now.getFullYear(), now.getMonth(), 1);
          currentPeriodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
          previousPeriodStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
          previousPeriodEnd = new Date(now.getFullYear(), now.getMonth(), 0);
        }
        break;
      }
      
      default: { // month
        currentPeriodStart = new Date(now.getFullYear(), now.getMonth(), 1);
        currentPeriodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        previousPeriodStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        previousPeriodEnd = new Date(now.getFullYear(), now.getMonth(), 0);
      }
    }
    
    // Get current period data with refund calculations
    const currentPeriodEndDate = currentPeriodEnd || new Date(); // Use currentPeriodEnd if defined, otherwise use now
    
    const [currentInvoices, currentSales, currentExpensesData] = await Promise.all([
      // Revenue should only include actual payments received, not pending invoices
      prisma.payment.aggregate({
        where: {
          tenantId,
          type: { in: ['invoice', 'sale'] },
          status: 'Completed',
          paymentDate: { 
            gte: currentPeriodStart,
            lte: currentPeriodEndDate
          }
        },
        _sum: { amount: true }
      }),
      prisma.sale.aggregate({
        where: {
          tenantId,
          saleDate: { 
            gte: currentPeriodStart,
            lte: currentPeriodEndDate
          },
          status: 'completed'
        },
        _sum: { total: true }
      }),
      // Only count actual payments made for expenses, not pending expenses
      // Exclude payments linked to deleted expenses
      prisma.payment.aggregate({
        where: {
          tenantId,
          type: 'expense',
          status: 'Completed',
          paymentDate: { 
            gte: currentPeriodStart,
            lte: currentPeriodEndDate
          },
          expense: {
            isDeleted: false
          }
        },
        _sum: { amount: true }
      })
    ]);

    // Get previous period data with refund calculations
    const [previousInvoices, previousSales, previousExpensesData] = await Promise.all([
      // Revenue should only include actual payments received, not pending invoices
      prisma.payment.aggregate({
        where: {
          tenantId,
          type: { in: ['invoice', 'sale'] },
          status: 'Completed',
          paymentDate: { 
            gte: previousPeriodStart,
            lte: previousPeriodEnd
          }
        },
        _sum: { amount: true }
      }),
      prisma.sale.aggregate({
        where: {
          tenantId,
          saleDate: { 
            gte: previousPeriodStart,
            lte: previousPeriodEnd
          },
          status: 'completed'
        },
        _sum: { total: true }
      }),
      // Only count actual payments made for expenses, not pending expenses
      // Exclude payments linked to deleted expenses
      prisma.payment.aggregate({
        where: {
          tenantId,
          type: 'expense',
          status: 'Completed',
          paymentDate: { 
            gte: previousPeriodStart,
            lte: previousPeriodEnd
          },
          expense: {
            isDeleted: false
          }
        },
        _sum: { amount: true }
      })
    ]);

    // Get outstanding invoices (Accounts Receivable)
    const [outstandingInvoicesData, previousOutstandingInvoicesData] = await Promise.all([
      prisma.invoice.aggregate({
        where: {
          tenantId,
          status: { in: ['Pending', 'Partially Paid'] }
        },
        _sum: { total: true }
      }),
      prisma.invoice.aggregate({
        where: {
          tenantId,
          status: { in: ['Pending', 'Partially Paid'] },
          issueDate: { 
            gte: previousPeriodStart,
            lte: previousPeriodEnd
          }
        },
        _sum: { total: true }
      })
    ]);

    // Calculate revenue from actual payments only to avoid double-counting sales
    const currentRevenue = (currentInvoices._sum.amount || 0);
    const previousRevenue = (previousInvoices._sum.amount || 0);
    
    const currentExpenses = currentExpensesData._sum.amount || 0;
    const previousExpenses = previousExpensesData._sum.amount || 0;
    const currentProfit = currentRevenue - currentExpenses;
    const previousProfit = previousRevenue - previousExpenses;
    // Calculate actual receivables (remaining balances)
    const [currentReceivables, previousReceivables] = await Promise.all([
      // Current receivables - sum of remaining balances
      prisma.invoice.findMany({
        where: {
          tenantId,
          status: { in: ['Pending', 'Partially Paid'] }
        },
        select: {
          total: true,
          totalPaid: true
        }
      }).then(invoices => 
        invoices.reduce((sum, invoice) => {
          const remaining = (invoice.total || 0) - (invoice.totalPaid || 0);
          return sum + Math.max(0, remaining);
        }, 0)
      ),
      // Previous receivables
      prisma.invoice.findMany({
        where: {
          tenantId,
          status: { in: ['Pending', 'Partially Paid'] },
          issueDate: { 
            gte: previousPeriodStart,
            lte: previousPeriodEnd
          }
        },
        select: {
          total: true,
          totalPaid: true
        }
      }).then(invoices => 
        invoices.reduce((sum, invoice) => {
          const remaining = (invoice.total || 0) - (invoice.totalPaid || 0);
          return sum + Math.max(0, remaining);
        }, 0)
      )
    ]);
    
    const currentOutstandingInvoices = currentReceivables;
    const previousOutstandingInvoices = previousReceivables;

    // Get cash flow data for current and previous periods
    const [currentCashFlow, previousCashFlow] = await Promise.all([
      // Current period cash flow
      Promise.all([
        // Cash in (invoice and sales payments)
        prisma.payment.aggregate({
          where: {
            tenantId,
            type: { in: ['invoice', 'sale'] },
            status: 'Completed',
            paymentDate: { gte: currentPeriodStart, lte: currentPeriodEnd }
          },
          _sum: { amount: true }
        }),
        // Cash out (expense payments)
        prisma.payment.aggregate({
          where: {
            tenantId,
            type: 'expense',
            status: 'Completed',
            paymentDate: { gte: currentPeriodStart, lte: currentPeriodEnd }
          },
          _sum: { amount: true }
        })
      ]),
      // Previous period cash flow
      Promise.all([
        // Cash in (invoice and sales payments)
        prisma.payment.aggregate({
          where: {
            tenantId,
            type: { in: ['invoice', 'sale'] },
            status: 'Completed',
            paymentDate: { gte: previousPeriodStart, lte: previousPeriodEnd }
          },
          _sum: { amount: true }
        }),
        // Cash out (expense payments)
        prisma.payment.aggregate({
          where: {
            tenantId,
            type: 'expense',
            status: 'Completed',
            paymentDate: { gte: previousPeriodStart, lte: previousPeriodEnd }
          },
          _sum: { amount: true }
        })
      ])
    ]);

    const currentCashIn = currentCashFlow[0]._sum.amount || 0;
    const currentCashOut = currentCashFlow[1]._sum.amount || 0;
    const currentNetCashFlow = currentCashIn - currentCashOut;
    
    const previousCashIn = previousCashFlow[0]._sum.amount || 0;
    const previousCashOut = previousCashFlow[1]._sum.amount || 0;
    const previousNetCashFlow = previousCashIn - previousCashOut;

    // Calculate percentage changes
    const calculateChange = (current, previous) => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return ((current - previous) / previous * 100).toFixed(1);
    };
    
    const revenueChange = calculateChange(currentRevenue, previousRevenue);
    const expensesChange = calculateChange(currentExpenses, previousExpenses);
    const profitChange = calculateChange(currentProfit, previousProfit);
    const outstandingInvoicesChange = calculateChange(currentOutstandingInvoices, previousOutstandingInvoices);
    const cashFlowChange = calculateChange(currentNetCashFlow, previousNetCashFlow);
    
    return NextResponse.json({
      financialSummary: {
        revenue: {
          current: currentRevenue,
          previous: previousRevenue,
          change: parseFloat(revenueChange)
        },
        expenses: {
          current: currentExpenses,
          previous: previousExpenses,
          change: parseFloat(expensesChange)
        },
        profit: {
          current: currentProfit,
          previous: previousProfit,
          change: parseFloat(profitChange)
        },
        outstandingInvoices: {
          current: currentOutstandingInvoices,
          previous: previousOutstandingInvoices,
          change: parseFloat(outstandingInvoicesChange)
        },
        cashFlow: {
          current: {
            cashIn: currentCashIn,
            cashOut: currentCashOut,
            netFlow: currentNetCashFlow
          },
          previous: {
            cashIn: previousCashIn,
            cashOut: previousCashOut,
            netFlow: previousNetCashFlow
          },
          change: parseFloat(cashFlowChange)
        }
      }
    });
  } catch (error) {
    console.error('Error getting dashboard metrics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dashboard metrics' },
      { status: 500 }
    );
  }
}