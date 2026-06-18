// app/api/dashboard/daily-performance/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { addBranchFilter } from '@/lib/dashboardBranchFilter';
import {
  dashboardLocalThisWeekBounds,
  dashboardLocalTodayBounds,
  dashboardLocalYesterdayBounds,
} from '@/lib/dashboardDatePeriods';
import { endOfLocalDay } from '@/lib/dateUtils';
import { getEffectiveDashboardBranchId, normalizeBranchId } from '@/lib/branchAccess';
import {
  getAccessibleTenantIdsForUser,
  parseDashboardTenantScope,
  tenantWhereIn,
  userForDashboardBranchFilter,
} from '@/lib/dashboardTenantScope';
import { getCogsAccountIdsForExpenseRegister } from '@/lib/getCogsAccountIdsForExpenseRegister';
import { fetchDashboardPeriodMetrics } from '@/lib/dashboardGlMetrics';
import { addMoney } from '@/lib/money';

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

    const { searchParams } = new URL(request.url);
    const accessible = await getAccessibleTenantIdsForUser(user);
    const scope = parseDashboardTenantScope(searchParams, user, accessible);
    if (!scope.ok) {
      return NextResponse.json(
        { error: scope.error || 'Invalid business scope' },
        { status: 400 }
      );
    }
    const { tenantIds, branchScoped } = scope;
    const tw = tenantWhereIn(tenantIds);
    const userQ = userForDashboardBranchFilter(user, branchScoped);

    const txBranchEff = getEffectiveDashboardBranchId(userQ);
    const transactionBranchSlice =
      txBranchEff === false
        ? { branchId: { in: [] } }
        : txBranchEff
          ? { branchId: txBranchEff }
          : {};

    const dateRange = searchParams.get('dateRange') || 'today';

    // Get current time - use UTC for consistency with database
    const now = new Date();
    
    // Calculate date ranges based on the selected timeframe
    // Use UTC dates to match database storage
    let currentPeriodStart, currentPeriodEnd, previousPeriodStart, previousPeriodEnd;

    switch (dateRange) {
      case 'today': {
        const cur = dashboardLocalTodayBounds(now);
        currentPeriodStart = cur.start;
        currentPeriodEnd = cur.end;
        const prev = dashboardLocalYesterdayBounds(now);
        previousPeriodStart = prev.start;
        previousPeriodEnd = prev.end;
        break;
      }
      case 'yesterday': {
        const cur = dashboardLocalYesterdayBounds(now);
        currentPeriodStart = cur.start;
        currentPeriodEnd = cur.end;
        const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 2);
        previousPeriodStart = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
        previousPeriodEnd = endOfLocalDay(d);
        break;
      }
      case 'thisWeek': {
        const cur = dashboardLocalThisWeekBounds(now);
        currentPeriodStart = cur.start;
        currentPeriodEnd = cur.end;
        const prevStart = new Date(cur.start);
        prevStart.setDate(cur.start.getDate() - 7);
        const prevEnd = new Date(cur.start);
        prevEnd.setDate(cur.start.getDate() - 1);
        previousPeriodStart = prevStart;
        previousPeriodEnd = endOfLocalDay(prevEnd);
        break;
      }
      case 'lastWeek': {
        const thisWeekSun = new Date(now);
        thisWeekSun.setDate(now.getDate() - now.getDay());
        currentPeriodStart = new Date(thisWeekSun);
        currentPeriodStart.setDate(thisWeekSun.getDate() - 7);
        currentPeriodEnd = new Date(thisWeekSun);
        currentPeriodEnd.setDate(thisWeekSun.getDate() - 1);
        previousPeriodStart = new Date(currentPeriodStart);
        previousPeriodStart.setDate(currentPeriodStart.getDate() - 7);
        previousPeriodEnd = new Date(currentPeriodStart);
        previousPeriodEnd.setDate(currentPeriodStart.getDate() - 1);
        break;
      }
      case 'thisMonth': {
        currentPeriodStart = new Date(now.getFullYear(), now.getMonth(), 1);
        currentPeriodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        currentPeriodEnd.setHours(23, 59, 59, 999);
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
        currentPeriodEnd = new Date(now.getFullYear(), currentQuarter * 3 + 3, 0);
        currentPeriodEnd.setHours(23, 59, 59, 999);
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
        currentPeriodEnd = new Date(now.getFullYear(), 11, 31);
        currentPeriodEnd.setHours(23, 59, 59, 999);
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
          // Default to full current month if custom dates not provided
          currentPeriodStart = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0));
          currentPeriodEnd = new Date(Date.UTC(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999));
          previousPeriodStart = new Date(Date.UTC(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0));
          previousPeriodEnd = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999));
        }
        break;
      }
      
      default: {
        currentPeriodStart = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0));
        currentPeriodEnd = new Date(Date.UTC(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999));
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

    let cogsAccountIds = [];
    try {
      cogsAccountIds = await getCogsAccountIdsForExpenseRegister(prisma, tw);
    } catch (e) {
      console.error('daily-performance cogs account lookup failed:', e?.message || e);
      cogsAccountIds = [];
    }

    const branchIdForPayments = branchScoped ? normalizeBranchId(user?.currentBranchId) : null;

    const periodMetrics = async (startDate, endDate) => {
      const metrics = await fetchDashboardPeriodMetrics({
        prisma,
        tenantIds,
        branchId: txBranchEff,
        startDate,
        endDate,
        cogsAccountIds,
        userQ,
        tw,
        transactionBranchSlice,
        branchIdForPayments,
      });
      return {
        revenue: metrics.revenue,
        expenses: addMoney(metrics.operatingExpenses, metrics.cogs),
      };
    };

    const [currentMetrics, previousMetrics] = await Promise.all([
      periodMetrics(currentPeriodStart, currentPeriodEnd),
      periodMetrics(previousPeriodStart, previousPeriodEnd),
    ]);

    // Get current period's transactions count (invoices + sales)
    const [todayInvoiceCountSettled, todaySaleCountSettled] = await Promise.allSettled([
      prisma.invoice.count({
        where: addBranchFilter(userQ, {
          ...tw,
          issueDate: { 
            gte: currentPeriodStart,
            lte: currentPeriodEnd
          }
        })
      }),
      prisma.sale.count({
        where: addBranchFilter(userQ, {
          ...tw,
          saleDate: { 
            gte: currentPeriodStart,
            lte: currentPeriodEnd
          },
          status: 'completed'
        })
      })
    ]);
    const todayInvoiceCount = todayInvoiceCountSettled.status === 'fulfilled'
      ? todayInvoiceCountSettled.value
      : 0;
    const todaySaleCount = todaySaleCountSettled.status === 'fulfilled'
      ? todaySaleCountSettled.value
      : 0;

    const weeklyTrend = await Promise.all(
      pastWeek.map(async (date) => {
        try {
          const dayStart = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0));
          const dayEnd = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 59, 999));
          const dayMetrics = await periodMetrics(dayStart, dayEnd);
          return { revenue: dayMetrics.revenue, expenses: dayMetrics.expenses };
        } catch (e) {
          console.error('daily-performance weeklyTrend day failed:', e?.message || e);
          return { revenue: 0, expenses: 0 };
        }
      })
    );

    const weeklyRevenue = weeklyTrend.map((d) => d.revenue);
    const weeklyExpenses = weeklyTrend.map((d) => d.expenses);

    const todayRevenue = currentMetrics.revenue;
    const yesterdayRevenue = previousMetrics.revenue;
    const todayExpensesTotal = currentMetrics.expenses;
    const yesterdayExpensesTotal = previousMetrics.expenses;

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
      {
        error: 'Failed to fetch daily performance data',
        details: process.env.NODE_ENV === 'development' ? (error?.message || String(error)) : undefined,
      },
      { status: 500 }
    );
  }
}