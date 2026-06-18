// app/api/dashboard/income-expenses/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { getEffectiveDashboardBranchId, normalizeBranchId } from '@/lib/branchAccess';
import {
  getAccessibleTenantIdsForUser,
  parseDashboardTenantScope,
  tenantWhereIn,
  userForDashboardBranchFilter,
} from '@/lib/dashboardTenantScope';
import { getCogsAccountIdsForExpenseRegister } from '@/lib/getCogsAccountIdsForExpenseRegister';
import {
  dashboardLocalThisWeekBounds,
  dashboardLocalTodayBounds,
  dashboardLocalYesterdayBounds,
} from '@/lib/dashboardDatePeriods';
import { fetchDashboardPeriodMetrics } from '@/lib/dashboardGlMetrics';
import { addMoney, parseMoney } from '@/lib/money';

// Prevent caching to ensure fresh data on branch switch
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request) {
  try {
    const user = await getUserFromSession(request);
    if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

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
    const dateRange = searchParams.get('dateRange') || 'thisMonth';
    const customStartDate = searchParams.get('startDate');
    const customEndDate = searchParams.get('endDate');
    const now = new Date();
    
    // Debug logging for custom date range
    if (dateRange === 'custom') {
      console.log('🔍 Custom date range API call:', {
        dateRange,
        customStartDate,
        customEndDate,
        tenantIds,
      });
    }
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    
    // Calculate date ranges based on the selected timeframe
    let startDate, endDate;
    
    switch (dateRange) {
      case 'today': {
        const b = dashboardLocalTodayBounds(now);
        startDate = b.start;
        endDate = b.end;
        break;
      }
      case 'yesterday': {
        const b = dashboardLocalYesterdayBounds(now);
        startDate = b.start;
        endDate = b.end;
        break;
      }
      case 'thisWeek': {
        const b = dashboardLocalThisWeekBounds(now);
        startDate = b.start;
        endDate = b.end;
        break;
      }
      case 'thisMonth': {
        startDate = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0));
        endDate = new Date(Date.UTC(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999));
        break;
      }
      case 'lastMonth': {
        startDate = new Date(Date.UTC(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0));
        endDate = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999));
        break;
      }
      case 'thisQuarter': {
        const quarter = Math.floor(now.getMonth() / 3);
        const qStartMonth = quarter * 3;
        const qEndMonth = qStartMonth + 2;
        startDate = new Date(Date.UTC(now.getFullYear(), qStartMonth, 1, 0, 0, 0, 0));
        endDate = new Date(Date.UTC(now.getFullYear(), qEndMonth + 1, 0, 23, 59, 59, 999));
        break;
      }
      case 'lastQuarter': {
        const currentQuarter = Math.floor(now.getMonth() / 3);
        const prevQuarter = currentQuarter === 0 ? 3 : currentQuarter - 1;
        const prevYear = currentQuarter === 0 ? now.getFullYear() - 1 : now.getFullYear();
        const pqStartMonth = prevQuarter * 3;
        startDate = new Date(Date.UTC(prevYear, pqStartMonth, 1, 0, 0, 0, 0));
        endDate = new Date(Date.UTC(prevYear, pqStartMonth + 3, 0, 23, 59, 59, 999));
        break;
      }
      case 'thisYear': {
        startDate = new Date(Date.UTC(now.getFullYear(), 0, 1, 0, 0, 0, 0));
        endDate = new Date(Date.UTC(now.getFullYear(), 12, 0, 23, 59, 59, 999));
        break;
      }
      case 'lastYear': {
        startDate = new Date(Date.UTC(now.getFullYear() - 1, 0, 1, 0, 0, 0, 0));
        endDate = new Date(Date.UTC(now.getFullYear() - 1, 12, 0, 23, 59, 59, 999));
        break;
      }
      case 'custom': {
        if (customStartDate && customEndDate) {
          startDate = new Date(customStartDate);
          endDate = new Date(customEndDate);
        } else {
          startDate = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0));
          endDate = new Date(Date.UTC(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999));
        }
        break;
      }
      default: {
        startDate = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0));
        endDate = new Date(Date.UTC(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999));
      }
    }
    
    // Generate appropriate time periods based on date range
    let months;
    if (dateRange === 'today' || dateRange === 'yesterday') {
      // For single days, show 6 equal hour divisions (4 hours each)
      const hourDivisions = Array.from({ length: 6 }, (_, i) => {
        const startHour = i * 4;
        const endHour = startHour + 3;
        const hour = new Date(startDate);
        hour.setHours(startHour);
        return { 
          date: hour, 
          name: `${startHour}:00-${endHour}:59`,
          startHour,
          endHour
        };
      });
      months = hourDivisions;
    } else if (dateRange === 'thisWeek') {
      // For weeks, show daily breakdown (Sun-Sat)
      const days = Array.from({ length: 7 }, (_, i) => {
        const day = new Date(startDate);
        day.setDate(startDate.getDate() + i);
        return { date: day, name: dayNames[day.getDay()] };
      });
      months = days;
    } else if (dateRange === 'thisYear') {
      // For years, show all 12 months
      months = Array.from({ length: 12 }, (_, i) => {
        const date = new Date(now.getFullYear(), i, 1);
        return { date, name: monthNames[i] };
      });
    } else if (dateRange === 'custom') {
      // For custom range, determine if it spans multiple years
      const startYear = startDate.getFullYear();
      const endYear = endDate.getFullYear();
      const yearDiff = endYear - startYear;
      
      if (yearDiff > 0) {
        // Multi-year range: show months with years
        const totalMonths = (endYear - startYear + 1) * 12;
        months = Array.from({ length: totalMonths }, (_, i) => {
          const year = startYear + Math.floor(i / 12);
          const month = i % 12;
          const date = new Date(year, month, 1);
          return { 
            date, 
            name: `${monthNames[month]} ${year}` 
          };
        });
      } else {
        // Single year: show months
        months = Array.from({ length: 12 }, (_, i) => {
          const date = new Date(startYear, i, 1);
          return { date, name: monthNames[i] };
        });
      }
    } else {
      // For all other ranges (thisMonth, lastMonth), show last 6 months
      months = Array.from({ length: 6 }, (_, i) => {
        const date = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
        // Show month and year if it's a different year
        const monthName = monthNames[date.getMonth()];
        const year = date.getFullYear();
        const currentYear = now.getFullYear();
        return { 
          date, 
          name: year !== currentYear ? `${monthName} ${year}` : monthName 
        };
      });
    }

    let cogsAccountIds = [];
    try {
      cogsAccountIds = await getCogsAccountIdsForExpenseRegister(prisma, tw);
    } catch (cogsAcctErr) {
      console.error('income-expenses: COGS account lookup failed (non-fatal):', cogsAcctErr?.message || cogsAcctErr);
    }

    const getPeriodData = async (periodInfo) => {
      let filterStartDate, filterEndDate;
      
      if (dateRange === 'today' || dateRange === 'yesterday') {
        // For 4-hour divisions, filter by the specific 4-hour period
        const startHour = periodInfo.startHour || 0;
        const endHour = periodInfo.endHour || 3;
        
        filterStartDate = new Date(periodInfo.date);
        filterStartDate.setHours(startHour, 0, 0, 0);
        filterEndDate = new Date(periodInfo.date);
        filterEndDate.setHours(endHour, 59, 59, 999);
      } else if (dateRange === 'thisWeek') {
        // For daily data, filter by the specific day
        filterStartDate = new Date(periodInfo.date);
        filterStartDate.setHours(0, 0, 0, 0);
        filterEndDate = new Date(periodInfo.date);
        filterEndDate.setHours(23, 59, 59, 999);
      } else {
        // For monthly data, filter by the month
        filterStartDate = new Date(periodInfo.date.getFullYear(), periodInfo.date.getMonth(), 1);
        filterEndDate = new Date(periodInfo.date.getFullYear(), periodInfo.date.getMonth() + 1, 0);
        filterEndDate.setHours(23, 59, 59, 999);
        
        // If the selected date range is more restrictive than the month, use the selected range
        if (startDate > filterStartDate) {
          filterStartDate = startDate;
        }
        if (endDate < filterEndDate) {
          filterEndDate = endDate;
        }
      }
      
      // Only include data if the period overlaps with the selected date range
      if (filterStartDate > filterEndDate) {
        return { income: 0, expenses: 0 };
      }
      if (Number.isNaN(filterStartDate.getTime()) || Number.isNaN(filterEndDate.getTime())) {
        return { income: 0, expenses: 0 };
      }

      const branchIdForPayments = branchScoped ? normalizeBranchId(user?.currentBranchId) : null;

      const effTxBranch = branchScoped ? getEffectiveDashboardBranchId(userQ) : null;
      const transactionBranchClause =
        !branchScoped
          ? {}
          : effTxBranch === false
            ? { branchId: { in: [] } }
            : effTxBranch
              ? { branchId: effTxBranch }
              : {};

      const metrics = await fetchDashboardPeriodMetrics({
        prisma,
        tenantIds,
        branchId: branchScoped ? getEffectiveDashboardBranchId(userQ) : null,
        startDate: filterStartDate,
        endDate: filterEndDate,
        cogsAccountIds,
        userQ,
        tw,
        transactionBranchSlice: transactionBranchClause,
        branchIdForPayments,
      });

      const loanPayments = await prisma.payment.aggregate({
        where: {
          ...tw,
          type: { in: ['Loan Payment', 'Loan Payment - Principal', 'Loan Payment - Interest'] },
          status: 'Completed',
          paymentDate: { gte: filterStartDate, lte: filterEndDate },
        },
        _sum: { amount: true },
      });

      const totalExpenses = addMoney(
        metrics.operatingExpenses,
        metrics.cogs,
        parseMoney(loanPayments._sum.amount)
      );

      return {
        income: metrics.revenue,
        expenses: totalExpenses,
      };
    };

    // Avoid connection-pool exhaustion: run periods sequentially (esp. "today" = 6 × 5 queries per period)
    const data = [];
    for (const m of months) {
      try {
        data.push(await getPeriodData(m));
      } catch (periodErr) {
        console.error('income-expenses period failed:', periodErr?.message || periodErr);
        data.push({ income: 0, expenses: 0 });
      }
    }
    
    // Debug logging for custom date range
    if (dateRange === 'custom') {
      console.log('📊 Custom date range data:', {
        months: months.map(m => m.name),
        totalIncome: data.reduce((sum, d) => addMoney(sum, d.income), 0),
        totalExpenses: data.reduce((sum, d) => addMoney(sum, d.expenses), 0),
        dataPoints: data.length
      });
    }
    
    return NextResponse.json({
      incomeExpenses: {
        months: months.map(m => m.name),
        income: data.map(d => d.income),
        expenses: data.map(d => d.expenses)
      }
    });
  } catch (error) {
    console.error('Error getting income/expenses data:', error?.message || error);
    return NextResponse.json(
      {
        error: 'Failed to fetch data',
        ...(process.env.NODE_ENV !== 'production' && { details: error?.message })
      },
      { status: 500 }
    );
  }
}