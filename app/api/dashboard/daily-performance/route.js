// app/api/dashboard/daily-performance/route.js
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
    const { searchParams } = new URL(request.url);
    const dateRange = searchParams.get('dateRange') || 'today';

    // Get current time - use UTC for consistency with database
    const now = new Date();
    
    // Calculate date ranges based on the selected timeframe
    // Use UTC dates to match database storage
    let currentPeriodStart, currentPeriodEnd, previousPeriodStart, previousPeriodEnd;

    switch (dateRange) {
      case 'today': {
        // Use UTC dates to match database dates
        const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
        const todayEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999));
        const yesterdayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1, 0, 0, 0, 0));
        const yesterdayEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1, 23, 59, 59, 999));
        
        currentPeriodStart = todayStart;
        currentPeriodEnd = todayEnd;
        previousPeriodStart = yesterdayStart;
        previousPeriodEnd = yesterdayEnd;
        break;
      }
      case 'yesterday': {
        currentPeriodStart = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0, 0, 0));
        currentPeriodEnd = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59, 999));
        previousPeriodStart = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate() - 2, 0, 0, 0, 0));
        previousPeriodEnd = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate() - 2, 23, 59, 59, 999));
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
          currentPeriodStart = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0));
          currentPeriodEnd = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999));
          previousPeriodStart = new Date(Date.UTC(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0));
          previousPeriodEnd = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999));
        }
        break;
      }
      
      default: {
        currentPeriodStart = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0));
        currentPeriodEnd = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999));
        previousPeriodStart = new Date(Date.UTC(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0));
        previousPeriodEnd = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999));
      }
    }
    
    // Use UTC dates for consistency
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const yesterday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1));
    
    const pastWeek = Array.from({ length: 7 }, (_, i) => {
      const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - i));
      return date;
    }).reverse();

    // Get current period's actual revenue from sales and invoices
    const [todaySales, todayInvoices] = await Promise.all([
      // Revenue from sales created today
      prisma.sale.aggregate({
        where: addBranchFilter(user, {
          tenantId,
          saleDate: { 
            gte: currentPeriodStart,
            lte: currentPeriodEnd
          },
          status: 'completed'
        }),
        _sum: { total: true }
      }),
      // Revenue from invoice payments received today
      prisma.payment.aggregate({
        where: addBranchFilter(user, {
          tenantId,
          type: 'invoice',
          status: 'Completed',
          paymentDate: { 
            gte: currentPeriodStart,
            lte: currentPeriodEnd
          }
        }),
        _sum: { amount: true }
      })
    ]);

    // Get previous period's actual revenue (only completed payments received)
    const [yesterdayInvoices, yesterdaySales] = await Promise.all([
      // Revenue should only include actual payments received, not pending invoices
      prisma.payment.aggregate({
        where: addBranchFilter(user, {
          tenantId,
          type: { in: ['invoice', 'sale'] },
          status: 'Completed',
          paymentDate: { 
            gte: previousPeriodStart,
            lte: previousPeriodEnd
          }
        }),
        _sum: { amount: true }
      }),
      prisma.sale.aggregate({
        where: addBranchFilter(user, {
          tenantId,
          saleDate: { 
            gte: previousPeriodStart,
            lte: previousPeriodEnd
          },
          status: 'completed'
        }),
        _sum: { total: true }
      })
    ]);

    // Get current period's transactions count (invoices + sales)
    const [todayInvoiceCount, todaySaleCount] = await Promise.all([
      prisma.invoice.count({
        where: addBranchFilter(user, {
          tenantId,
          issueDate: { 
            gte: currentPeriodStart,
            lte: currentPeriodEnd
          }
        })
      }),
      prisma.sale.count({
        where: addBranchFilter(user, {
          tenantId,
          saleDate: { 
            gte: currentPeriodStart,
            lte: currentPeriodEnd
          },
          status: 'completed'
        })
      })
    ]);

    const weeklyRevenue = await Promise.all(
      pastWeek.map(async (date) => {
        // Create UTC date range for this day
        const dayStart = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0));
        const dayEnd = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 59, 999));
        
        const [invoices] = await Promise.all([
          // Revenue should only include actual payments received, not pending invoices
          prisma.payment.aggregate({
            where: addBranchFilter(user, {
              tenantId,
              type: { in: ['invoice', 'sale'] },
              status: 'Completed',
              paymentDate: { gte: dayStart, lte: dayEnd }
            }),
            _sum: { amount: true }
          })
        ]);

        const grossRevenue = (invoices._sum.amount || 0);
        return grossRevenue; // Only actual payments received
      })
    );

    // Find COGS account(s) for this tenant
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
      select: { id: true }
    });
    const cogsAccountIds = cogsAccounts.map(acc => acc.id);

    // Count expenses from expense records created today
    const [todayExpenses, todayCOGS] = await Promise.all([
      // Expenses created today
      prisma.expense.aggregate({
        where: addBranchFilter(user, {
          tenantId,
          date: {
            gte: currentPeriodStart,
            lte: currentPeriodEnd
          },
          isDeleted: false
        }),
        _sum: { amount: true }
      }),
      // Get COGS from transaction lines for today - filter by transaction branchId
      cogsAccountIds.length > 0 ? prisma.transactionLine.aggregate({
        where: {
          accountId: { in: cogsAccountIds },
          debitAmount: { gt: 0 },
          transaction: {
            tenantId,
            ...(user?.currentBranchId ? { branchId: user.currentBranchId } : {}),
            date: {
              gte: currentPeriodStart,
              lte: currentPeriodEnd
            },
            status: 'posted'
          }
        },
        _sum: { debitAmount: true }
      }) : Promise.resolve({ _sum: { debitAmount: 0 } })
    ]);

    const [yesterdayExpenses, yesterdayCOGS] = await Promise.all([
      // Expenses created yesterday
      prisma.expense.aggregate({
        where: addBranchFilter(user, {
          tenantId,
          date: {
            gte: previousPeriodStart,
            lte: previousPeriodEnd
          },
          isDeleted: false
        }),
        _sum: { amount: true }
      }),
      // Get COGS from transaction lines for yesterday - filter by transaction branchId
      cogsAccountIds.length > 0 ? prisma.transactionLine.aggregate({
        where: {
          accountId: { in: cogsAccountIds },
          debitAmount: { gt: 0 },
          transaction: {
            tenantId,
            ...(user?.currentBranchId ? { branchId: user.currentBranchId } : {}),
            date: {
              gte: previousPeriodStart,
              lte: previousPeriodEnd
            },
            status: 'posted'
          }
        },
        _sum: { debitAmount: true }
      }) : Promise.resolve({ _sum: { debitAmount: 0 } })
    ]);

    const weeklyExpenses = await Promise.all(
      pastWeek.map(async (date) => {
        // Create UTC date range for this day
        const dayStart = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0));
        const dayEnd = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 59, 999));
        
        const [expenses, cogs] = await Promise.all([
          // Expenses created on this date
          prisma.expense.aggregate({
            where: addBranchFilter(user, {
              tenantId,
              date: {
                gte: dayStart,
                lte: dayEnd
              },
              isDeleted: false
            }),
            _sum: { amount: true }
          }),
          // Get COGS from transaction lines for this date - filter by transaction branchId
          cogsAccountIds.length > 0 ? prisma.transactionLine.aggregate({
            where: {
              accountId: { in: cogsAccountIds },
              debitAmount: { gt: 0 },
              transaction: {
                tenantId,
                ...(user?.currentBranchId ? { branchId: user.currentBranchId } : {}),
                date: {
                  gte: dayStart,
                  lte: dayEnd
                },
                status: 'posted'
              }
            },
            _sum: { debitAmount: true }
          }) : Promise.resolve({ _sum: { debitAmount: 0 } })
        ]);
        
        const expenseAmount = expenses._sum.amount || 0;
        const cogsAmount = Number(cogs._sum.debitAmount || 0);
        return expenseAmount + cogsAmount;
      })
    );

    // Calculate revenue: sales + invoice payments (avoid double counting sales that have payments)
    const saleRevenue = (todaySales._sum.total || 0);
    const invoicePaymentRevenue = (todayInvoices._sum.amount || 0);
    // Total revenue is sales + invoice payments (they don't overlap)
    const todayRevenue = saleRevenue + invoicePaymentRevenue;
    
    const yesterdayRevenue = (yesterdayInvoices._sum.amount || 0);

    const todayExpensesTotal = (todayExpenses._sum.amount || 0) + Number(todayCOGS._sum.debitAmount || 0);
    const yesterdayExpensesTotal = (yesterdayExpenses._sum.amount || 0) + Number(yesterdayCOGS._sum.debitAmount || 0);

    return NextResponse.json({
      dailyMetrics: {
        today: {
          date: today.toISOString().split('T')[0],
          revenue: todayRevenue,
          expenses: todayExpensesTotal,
          transactions: todayInvoiceCount + todaySaleCount
        },
        yesterday: {
          date: yesterday.toISOString().split('T')[0],
          revenue: yesterdayRevenue,
          expenses: yesterdayExpensesTotal,
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