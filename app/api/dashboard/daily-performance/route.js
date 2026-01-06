// app/api/dashboard/daily-performance/route.js
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
    const dateRange = searchParams.get('dateRange') || 'today';

    // Get current time in Africa/Blantyre timezone (UTC+2)
    const utc = new Date();
    const offset = 2 * 60 * 60 * 1000; // Africa/Blantyre is UTC+2
    const now = new Date(utc.getTime() + offset);
    
    // Calculate date ranges based on the selected timeframe
    let currentPeriodStart, currentPeriodEnd, previousPeriodStart, previousPeriodEnd;
    
    switch (dateRange) {
      case 'today': {
        currentPeriodStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        currentPeriodStart.setHours(0, 0, 0, 0);
        currentPeriodEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        currentPeriodEnd.setHours(23, 59, 59, 999);
        previousPeriodStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
        previousPeriodStart.setHours(0, 0, 0, 0);
        previousPeriodEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
        previousPeriodEnd.setHours(23, 59, 59, 999);
        break;
      }
      case 'yesterday': {
        currentPeriodStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
        currentPeriodStart.setHours(0, 0, 0, 0);
        currentPeriodEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
        currentPeriodEnd.setHours(23, 59, 59, 999);
        previousPeriodStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 2);
        previousPeriodStart.setHours(0, 0, 0, 0);
        previousPeriodEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 2);
        previousPeriodEnd.setHours(23, 59, 59, 999);
        break;
      }
      case 'thisWeek': {
        const dayOfWeek = now.getDay();
        const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        currentPeriodStart = new Date(now);
        currentPeriodStart.setDate(now.getDate() - daysToMonday);
        currentPeriodEnd = new Date(now);
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
        currentPeriodStart = new Date(thisWeekStart);
        currentPeriodStart.setDate(thisWeekStart.getDate() - 7);
        currentPeriodEnd = new Date(thisWeekStart);
        currentPeriodEnd.setDate(thisWeekStart.getDate() - 1);
        previousPeriodStart = new Date(currentPeriodStart);
        previousPeriodStart.setDate(currentPeriodStart.getDate() - 7);
        previousPeriodEnd = new Date(currentPeriodStart);
        previousPeriodEnd.setDate(currentPeriodStart.getDate() - 1);
        break;
      }
      case 'thisMonth': {
        currentPeriodStart = new Date(now.getFullYear(), now.getMonth(), 1);
        currentPeriodEnd = new Date(now);
        previousPeriodStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        previousPeriodEnd = new Date(now.getFullYear(), now.getMonth(), 0);
        break;
      }
      case 'lastMonth': {
        currentPeriodStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        currentPeriodEnd = new Date(now.getFullYear(), now.getMonth(), 0);
        previousPeriodStart = new Date(now.getFullYear(), now.getMonth() - 2, 1);
        previousPeriodEnd = new Date(now.getFullYear(), now.getMonth() - 1, 0);
        break;
      }
      case 'thisQuarter': {
        const currentQuarter = Math.floor(now.getMonth() / 3);
        currentPeriodStart = new Date(now.getFullYear(), currentQuarter * 3, 1);
        currentPeriodEnd = new Date(now);
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
        currentPeriodStart = new Date(lastQuarterYear, lastQuarter * 3, 1);
        currentPeriodEnd = new Date(lastQuarterYear, (lastQuarter + 1) * 3, 0);
        const prevQuarter = lastQuarter === 0 ? 3 : lastQuarter - 1;
        const prevQuarterYear = lastQuarter === 0 ? lastQuarterYear - 1 : lastQuarterYear;
        previousPeriodStart = new Date(prevQuarterYear, prevQuarter * 3, 1);
        previousPeriodEnd = new Date(lastQuarterYear, lastQuarter * 3, 0);
        break;
      }
      case 'thisYear': {
        currentPeriodStart = new Date(now.getFullYear(), 0, 1);
        currentPeriodEnd = new Date(now);
        previousPeriodStart = new Date(now.getFullYear() - 1, 0, 1);
        previousPeriodEnd = new Date(now.getFullYear() - 1, 11, 31);
        break;
      }
      case 'lastYear': {
        currentPeriodStart = new Date(now.getFullYear() - 1, 0, 1);
        currentPeriodEnd = new Date(now.getFullYear() - 1, 11, 31);
        previousPeriodStart = new Date(now.getFullYear() - 2, 0, 1);
        previousPeriodEnd = new Date(now.getFullYear() - 2, 11, 31);
        break;
      }
      case 'last7Days': {
        currentPeriodStart = new Date(now);
        currentPeriodStart.setDate(now.getDate() - 7);
        currentPeriodEnd = new Date(now);
        previousPeriodStart = new Date(now);
        previousPeriodStart.setDate(now.getDate() - 14);
        previousPeriodEnd = new Date(now);
        previousPeriodEnd.setDate(now.getDate() - 8);
        break;
      }
      case 'last30Days': {
        currentPeriodStart = new Date(now);
        currentPeriodStart.setDate(now.getDate() - 30);
        currentPeriodEnd = new Date(now);
        previousPeriodStart = new Date(now);
        previousPeriodStart.setDate(now.getDate() - 60);
        previousPeriodEnd = new Date(now);
        previousPeriodEnd.setDate(now.getDate() - 31);
        break;
      }
      case 'last90Days': {
        currentPeriodStart = new Date(now);
        currentPeriodStart.setDate(now.getDate() - 90);
        currentPeriodEnd = new Date(now);
        previousPeriodStart = new Date(now);
        previousPeriodStart.setDate(now.getDate() - 180);
        previousPeriodEnd = new Date(now);
        previousPeriodEnd.setDate(now.getDate() - 91);
        break;
      }
      case 'last365Days': {
        currentPeriodStart = new Date(now);
        currentPeriodStart.setDate(now.getDate() - 365);
        currentPeriodEnd = new Date(now);
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
          previousPeriodStart = currentPeriodStart;
          previousPeriodEnd = currentPeriodEnd;
        } else {
          // Default to this month if custom dates not provided
          currentPeriodStart = new Date(now.getFullYear(), now.getMonth(), 1);
          currentPeriodEnd = new Date(now);
          previousPeriodStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
          previousPeriodEnd = new Date(now.getFullYear(), now.getMonth(), 0);
        }
        break;
      }
      
      default: {
        currentPeriodStart = new Date(now.getFullYear(), now.getMonth(), 1);
        currentPeriodEnd = new Date(now);
        previousPeriodStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        previousPeriodEnd = new Date(now.getFullYear(), now.getMonth(), 0);
      }
    }
    
    const today = now; // Use Africa/Blantyre time
    const yesterday = previousPeriodStart;
    
    const pastWeek = Array.from({ length: 7 }, (_, i) => {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      return date;
    }).reverse();

    // Get current period's actual revenue (only completed payments received)
    const [todayInvoices, todaySales] = await Promise.all([
      // Revenue should only include actual payments received, not pending invoices
      prisma.payment.aggregate({
        where: {
          tenantId,
          type: { in: ['invoice', 'sale'] },
          status: 'Completed',
          paymentDate: { 
            gte: currentPeriodStart,
            lte: currentPeriodEnd
          }
        },
        _sum: { amount: true }
      }),
      prisma.sale.aggregate({
        where: {
          tenantId,
          saleDate: { 
            gte: currentPeriodStart,
            lte: currentPeriodEnd
          },
          status: 'completed'
        },
        _sum: { total: true }
      })
    ]);

    // Get previous period's actual revenue (only completed payments received)
    const [yesterdayInvoices, yesterdaySales] = await Promise.all([
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
      })
    ]);

    // Get current period's transactions count (invoices + sales)
    const [todayInvoiceCount, todaySaleCount] = await Promise.all([
      prisma.invoice.count({
        where: {
          tenantId,
          issueDate: { 
            gte: currentPeriodStart,
            lte: currentPeriodEnd
          }
        }
      }),
      prisma.sale.count({
        where: {
          tenantId,
          saleDate: { 
            gte: currentPeriodStart,
            lte: currentPeriodEnd
          },
          status: 'completed'
        }
      })
    ]);

    const weeklyRevenue = await Promise.all(
      pastWeek.map(async (date) => {
        const nextDay = new Date(date);
        nextDay.setDate(date.getDate() + 1);
        
        const [invoices] = await Promise.all([
          // Revenue should only include actual payments received, not pending invoices
          prisma.payment.aggregate({
            where: {
              tenantId,
              type: { in: ['invoice', 'sale'] },
              status: 'Completed',
              paymentDate: { gte: date, lt: nextDay }
            },
            _sum: { amount: true }
          })
        ]);

        const grossRevenue = (invoices._sum.amount || 0);
        return grossRevenue; // Only actual payments received
      })
    );

    // Only count actual payments made for expenses, not pending expenses
    const [todayExpensePayments] = await Promise.all([
      // Regular expense payments
      prisma.payment.aggregate({
        where: {
          tenantId,
          type: 'expense',
          status: 'Completed',
          paymentDate: {
            gte: currentPeriodStart,
            lte: currentPeriodEnd
          },
          expense: {
            isDeleted: false
          }
        },
        _sum: { amount: true }
      })
    ]);

    const [yesterdayExpensePayments] = await Promise.all([
      // Regular expense payments
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

    const weeklyExpenses = await Promise.all(
      pastWeek.map(async (date) => {
        const nextDay = new Date(date);
        nextDay.setDate(date.getDate() + 1);
        
        const [expensePayment] = await Promise.all([
          // Regular expense payments
          prisma.payment.aggregate({
            where: {
              tenantId,
              type: 'expense',
              status: 'Completed',
              paymentDate: {
                gte: date,
                lt: nextDay
              },
              expense: {
                isDeleted: false
              }
            },
            _sum: { amount: true }
          })
        ]);
        
        return (expensePayment._sum.amount || 0);
      })
    );

    // Calculate revenue from payments only to avoid double-counting sales
    const todayRevenue = (todayInvoices._sum.amount || 0);
    const yesterdayRevenue = (yesterdayInvoices._sum.amount || 0);

    return NextResponse.json({
      dailyMetrics: {
        today: {
          date: today.toISOString().split('T')[0],
          revenue: todayRevenue,
          expenses: (todayExpensePayments._sum.amount || 0),
          transactions: todayInvoiceCount + todaySaleCount
        },
        yesterday: {
          date: yesterday.toISOString().split('T')[0],
          revenue: yesterdayRevenue,
          expenses: (yesterdayExpensePayments._sum.amount || 0),
          transactions: 0 // Add similar count if needed
        },
        weeklyTrend: {
          revenue: weeklyRevenue,
          expenses: weeklyExpenses
        }
      }
    });
  } catch (error) {
    console.error('Error getting daily performance:', error);
    return NextResponse.json(
      { error: 'Failed to fetch daily performance data' },
      { status: 500 }
    );
  }
}