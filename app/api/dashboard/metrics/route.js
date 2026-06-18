// app/api/dashboard/metrics/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { addBranchFilter } from '@/lib/dashboardBranchFilter';
import { endOfLocalDay } from '@/lib/dateUtils';
import {
  dashboardLocalLastWeekBounds,
  dashboardLocalThisWeekBounds,
  dashboardLocalTodayBounds,
  dashboardLocalWeekBefore,
  dashboardLocalYesterdayBounds,
} from '@/lib/dashboardDatePeriods';
import { getEffectiveDashboardBranchId } from '@/lib/branchAccess';
import { fetchDashboardPeriodMetrics } from '@/lib/dashboardGlMetrics';
import {
  getAccessibleTenantIdsForUser,
  parseDashboardTenantScope,
  tenantWhereIn,
  userForDashboardBranchFilter,
} from '@/lib/dashboardTenantScope';
import { getCogsAccountIdsForExpenseRegister } from '@/lib/getCogsAccountIdsForExpenseRegister';
import { addMoney, parseMoney, subtractMoney } from '@/lib/money';

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

    if (process.env.NODE_ENV === 'development') {
      console.log(
        `[dashboard/metrics] tenantIds=${tenantIds.join(',')}, branchScoped=${branchScoped}, currentBranchId=${user.currentBranchId || 'null'}`
      );
    }
    const dateRange = searchParams.get('dateRange') || 'thisMonth';
    const now = new Date();
    
    // Calculate date ranges
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
        const prev = dashboardLocalLastWeekBounds(now);
        previousPeriodStart = prev.start;
        previousPeriodEnd = prev.end;
        break;
      }
      
      case 'lastWeek': {
        const cur = dashboardLocalLastWeekBounds(now);
        currentPeriodStart = cur.start;
        currentPeriodEnd = cur.end;
        const prev = dashboardLocalWeekBefore(cur);
        previousPeriodStart = prev.start;
        previousPeriodEnd = prev.end;
        break;
      }
      
      case 'thisMonth':
      case 'month': {
        currentPeriodStart = new Date(now.getFullYear(), now.getMonth(), 1);
        currentPeriodEnd = endOfLocalDay(new Date(now.getFullYear(), now.getMonth() + 1, 0));
        // Previous month
        previousPeriodStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        previousPeriodEnd = endOfLocalDay(new Date(now.getFullYear(), now.getMonth(), 0));
        break;
      }
      
      case 'lastMonth': {
        // Last month's data
        currentPeriodStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        currentPeriodEnd = endOfLocalDay(new Date(now.getFullYear(), now.getMonth(), 0));
        // Month before last month
        previousPeriodStart = new Date(now.getFullYear(), now.getMonth() - 2, 1);
        previousPeriodEnd = endOfLocalDay(new Date(now.getFullYear(), now.getMonth() - 1, 0));
        break;
      }
      
      case 'thisQuarter': {
        const currentQuarter = Math.floor(now.getMonth() / 3);
        currentPeriodStart = new Date(now.getFullYear(), currentQuarter * 3, 1);
        currentPeriodEnd = endOfLocalDay(new Date(now.getFullYear(), (currentQuarter + 1) * 3, 0));
        // Previous quarter
        const prevQuarter = currentQuarter === 0 ? 3 : currentQuarter - 1;
        const prevQuarterYear = currentQuarter === 0 ? now.getFullYear() - 1 : now.getFullYear();
        previousPeriodStart = new Date(prevQuarterYear, prevQuarter * 3, 1);
        previousPeriodEnd = endOfLocalDay(new Date(now.getFullYear(), currentQuarter * 3, 0));
        break;
      }
      
      case 'lastQuarter': {
        const currentQuarter = Math.floor(now.getMonth() / 3);
        const lastQuarter = currentQuarter === 0 ? 3 : currentQuarter - 1;
        const lastQuarterYear = currentQuarter === 0 ? now.getFullYear() - 1 : now.getFullYear();
        // Last quarter's data
        currentPeriodStart = new Date(lastQuarterYear, lastQuarter * 3, 1);
        currentPeriodEnd = endOfLocalDay(new Date(lastQuarterYear, (lastQuarter + 1) * 3, 0));
        // Quarter before last quarter
        const prevQuarter = lastQuarter === 0 ? 3 : lastQuarter - 1;
        const prevQuarterYear = lastQuarter === 0 ? lastQuarterYear - 1 : lastQuarterYear;
        previousPeriodStart = new Date(prevQuarterYear, prevQuarter * 3, 1);
        previousPeriodEnd = endOfLocalDay(new Date(lastQuarterYear, lastQuarter * 3, 0));
        break;
      }
      
      case 'thisYear': {
        // This year's data
        currentPeriodStart = new Date(now.getFullYear(), 0, 1);
        currentPeriodEnd = endOfLocalDay(new Date(now.getFullYear(), 11, 31));
        // Previous year
        previousPeriodStart = new Date(now.getFullYear() - 1, 0, 1);
        previousPeriodEnd = endOfLocalDay(new Date(now.getFullYear() - 1, 11, 31));
        break;
      }
      
      case 'lastYear': {
        // Last year's data
        currentPeriodStart = new Date(now.getFullYear() - 1, 0, 1);
        currentPeriodEnd = endOfLocalDay(new Date(now.getFullYear() - 1, 11, 31));
        // Year before last year
        previousPeriodStart = new Date(now.getFullYear() - 2, 0, 1);
        previousPeriodEnd = endOfLocalDay(new Date(now.getFullYear() - 2, 11, 31));
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
          currentPeriodEnd = endOfLocalDay(new Date(now.getFullYear(), now.getMonth() + 1, 0));
          previousPeriodStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
          previousPeriodEnd = endOfLocalDay(new Date(now.getFullYear(), now.getMonth(), 0));
        }
        break;
      }
      
      default: { // month
        currentPeriodStart = new Date(now.getFullYear(), now.getMonth(), 1);
        currentPeriodEnd = endOfLocalDay(new Date(now.getFullYear(), now.getMonth() + 1, 0));
        previousPeriodStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        previousPeriodEnd = endOfLocalDay(new Date(now.getFullYear(), now.getMonth(), 0));
      }
    }
    
    // Get current period data with refund calculations
    const currentPeriodEndDate = currentPeriodEnd || new Date(); // Use currentPeriodEnd if defined, otherwise use now
    
    let cogsAccountIds = [];
    try {
      cogsAccountIds = await getCogsAccountIdsForExpenseRegister(prisma, tw);
    } catch (e) {
      console.error('[dashboard/metrics] COGS account lookup failed:', e?.message || e);
    }

    const sessionBranchRaw =
      user?.currentBranchId &&
      (typeof user.currentBranchId === 'string' ? user.currentBranchId : user.currentBranchId?.id);
    const branchIdForPayments = branchScoped && sessionBranchRaw ? sessionBranchRaw : null;

    const txBranchEff = getEffectiveDashboardBranchId(userQ);
    const transactionBranchSlice =
      txBranchEff === false
        ? { branchId: { in: [] } }
        : txBranchEff
          ? { branchId: txBranchEff }
          : {};

    const periodMetricsArgs = {
      prisma,
      tenantIds,
      branchId: txBranchEff,
      cogsAccountIds,
      userQ,
      tw,
      transactionBranchSlice,
      branchIdForPayments,
    };

    const [currentPeriodMetrics, previousPeriodMetrics] = await Promise.all([
      fetchDashboardPeriodMetrics({
        ...periodMetricsArgs,
        startDate: currentPeriodStart,
        endDate: currentPeriodEndDate,
      }),
      fetchDashboardPeriodMetrics({
        ...periodMetricsArgs,
        startDate: previousPeriodStart,
        endDate: previousPeriodEnd,
      }),
    ]);

    // Get outstanding invoices (Accounts Receivable)
    const [outstandingInvoicesData, previousOutstandingInvoicesData] = await Promise.all([
      prisma.invoice.aggregate({
        where: addBranchFilter(userQ, {
          ...tw,
          isDeleted: false,
          isReversal: false,
          status: { in: ['Pending', 'Partially Paid'] }
        }),
        _sum: { total: true }
      }),
      prisma.invoice.aggregate({
        where: addBranchFilter(userQ, {
          ...tw,
          isDeleted: false,
          isReversal: false,
          status: { in: ['Pending', 'Partially Paid'] },
          issueDate: { 
            gte: previousPeriodStart,
            lte: previousPeriodEnd
          }
        }),
        _sum: { total: true }
      })
    ]);

    const currentRevenue = currentPeriodMetrics.revenue;
    const previousRevenue = previousPeriodMetrics.revenue;
    const currentExpenses = addMoney(
      currentPeriodMetrics.operatingExpenses,
      currentPeriodMetrics.cogs
    );
    const previousExpenses = addMoney(
      previousPeriodMetrics.operatingExpenses,
      previousPeriodMetrics.cogs
    );
    const metricsSource =
      currentPeriodMetrics.source === 'gl' || previousPeriodMetrics.source === 'gl'
        ? 'gl'
        : 'operational';
    const currentProfit = subtractMoney(currentRevenue, currentExpenses);
    const previousProfit = subtractMoney(previousRevenue, previousExpenses);
    
    // Get budget information for the current period (single business only)
    let budgetInfo = null;
    try {
      if (tenantIds.length === 1) {
      const { getBudgetVsActual } = await import('@/lib/budgetService');
      const budgetTenantId = tenantIds[0];
      
      const activeBudgets = await prisma.budget.findMany({
        where: {
          tenantId: budgetTenantId,
          status: { in: ['active', 'approved'] },
          startDate: { lte: currentPeriodEnd },
          endDate: { gte: currentPeriodStart }
        },
        include: {
          items: true,
          breakdowns: true
        }
      });

      if (activeBudgets.length > 0) {
        const revenueBudget = activeBudgets.find(b => (b.budgetType || 'revenue') === 'revenue');
        const expenseBudget = activeBudgets.find(b => b.budgetType === 'expense');

        const budgetComparisons = await Promise.all(
          activeBudgets.map(async (budget) => {
            try {
              const comparison = await getBudgetVsActual(budget.id, budget.tenantId, currentPeriodEnd);
              return {
                budgetId: budget.id,
                budgetName: budget.name,
                budgetType: budget.budgetType || 'revenue',
                budgeted: budget.expectedRevenue,
                actual: comparison.comparison.actualRevenue,
                variance: comparison.comparison.variance.amount,
                variancePercent: comparison.comparison.variance.percent,
                achievement: comparison.comparison.achievement.percent,
                status: comparison.comparison.achievement.status
              };
            } catch (error) {
              console.error(`Error getting budget comparison for dashboard:`, error);
              return null;
            }
          })
        );

        const validComparisons = budgetComparisons.filter(Boolean);
        
        if (validComparisons.length > 0) {
          const revenueBudgetComparison = validComparisons.find(b => b.budgetType === 'revenue');
          const expenseBudgetComparison = validComparisons.find(b => b.budgetType === 'expense');

          budgetInfo = {
            revenue: revenueBudgetComparison ? {
              budgeted: revenueBudgetComparison.budgeted,
              actual: revenueBudgetComparison.actual,
              variance: revenueBudgetComparison.variance,
              variancePercent: revenueBudgetComparison.variancePercent,
              achievement: revenueBudgetComparison.achievement,
              status: revenueBudgetComparison.status
            } : null,
            expenses: expenseBudgetComparison ? {
              budgeted: expenseBudgetComparison.budgeted,
              actual: expenseBudgetComparison.actual,
              variance: expenseBudgetComparison.variance,
              variancePercent: expenseBudgetComparison.variancePercent,
              achievement: expenseBudgetComparison.achievement,
              status: expenseBudgetComparison.status
            } : null
          };
        }
      }
      }
    } catch (budgetError) {
      console.error('Error fetching budget data for dashboard:', budgetError);
      // Continue without budget data if there's an error
    }
    
    // Calculate actual receivables (remaining balances)
    // Include invoices with remaining balance > 0, regardless of status
    // This ensures we capture all unpaid invoices even if status values vary
    const [currentReceivablesData, previousReceivables] = await Promise.all([
      // Current receivables - sum of remaining balances and count
      prisma.invoice.findMany({
        where: addBranchFilter(userQ, {
          ...tw,
          voidedAt: null,
          refundedAt: null,
          OR: [
            { status: { in: ['Pending', 'Partially Paid', 'Partial', 'pending', 'partial'] } },
            { remainingBalance: { gt: 0 } }
          ]
        }),
        select: {
          total: true,
          totalPaid: true,
          remainingBalance: true
        }
      }).then(invoices => {
        const total = invoices.reduce((sum, invoice) => {
          // Use remainingBalance if available, otherwise calculate
          const remaining = invoice.remainingBalance != null && invoice.remainingBalance > 0
            ? invoice.remainingBalance 
            : (invoice.total || 0) - (invoice.totalPaid || 0);
          return sum + Math.max(0, remaining);
        }, 0);
        // Count invoices with actual remaining balance > 0
        const count = invoices.filter(invoice => {
          const remaining = invoice.remainingBalance != null && invoice.remainingBalance > 0
            ? invoice.remainingBalance 
            : (invoice.total || 0) - (invoice.totalPaid || 0);
          return remaining > 0;
        }).length;
        return { total, count };
      }),
      // Previous receivables
      prisma.invoice.findMany({
        where: addBranchFilter(userQ, {
          ...tw,
          voidedAt: null,
          refundedAt: null,
          issueDate: { 
            gte: previousPeriodStart,
            lte: previousPeriodEnd
          },
          OR: [
            { status: { in: ['Pending', 'Partially Paid', 'Partial', 'pending', 'partial'] } },
            { remainingBalance: { gt: 0 } }
          ]
        }),
        select: {
          total: true,
          totalPaid: true,
          remainingBalance: true
        }
      }).then(invoices => 
        invoices.reduce((sum, invoice) => {
          // Use remainingBalance if available, otherwise calculate
          const remaining = invoice.remainingBalance != null && invoice.remainingBalance > 0
            ? invoice.remainingBalance 
            : (invoice.total || 0) - (invoice.totalPaid || 0);
          return sum + Math.max(0, remaining);
        }, 0)
      )
    ]);
    
    const currentOutstandingInvoices = currentReceivablesData.total;
    const currentOutstandingInvoicesCount = currentReceivablesData.count;
    const previousOutstandingInvoices = previousReceivables;

    // Get cash flow data for current and previous periods
    const [currentCashFlow, previousCashFlow] = await Promise.all([
      // Current period cash flow
      Promise.all([
        // Cash in (invoice and sales payments)
        prisma.payment.aggregate({
          where: addBranchFilter(userQ, {
            ...tw,
            type: { in: ['invoice', 'sale'] },
            status: 'Completed',
            isReversal: false,
            paymentDate: { gte: currentPeriodStart, lte: currentPeriodEnd }
          }),
          _sum: { amount: true }
        }),
        // Cash out (expense payments)
        prisma.payment.aggregate({
          where: addBranchFilter(userQ, {
            ...tw,
            type: 'expense',
            status: 'Completed',
            isReversal: false,
            paymentDate: { gte: currentPeriodStart, lte: currentPeriodEnd }
          }),
          _sum: { amount: true }
        })
      ]),
      // Previous period cash flow
      Promise.all([
        // Cash in (invoice and sales payments)
        prisma.payment.aggregate({
          where: addBranchFilter(userQ, {
            ...tw,
            type: { in: ['invoice', 'sale'] },
            status: 'Completed',
            isReversal: false,
            paymentDate: { gte: previousPeriodStart, lte: previousPeriodEnd }
          }),
          _sum: { amount: true }
        }),
        // Cash out (expense payments)
        prisma.payment.aggregate({
          where: addBranchFilter(userQ, {
            ...tw,
            type: 'expense',
            status: 'Completed',
            isReversal: false,
            paymentDate: { gte: previousPeriodStart, lte: previousPeriodEnd }
          }),
          _sum: { amount: true }
        })
      ])
    ]);

    const currentCashIn = parseMoney(currentCashFlow[0]._sum.amount);
    const currentCashOut = parseMoney(currentCashFlow[1]._sum.amount);
    const currentNetCashFlow = subtractMoney(currentCashIn, currentCashOut);
    
    const previousCashIn = parseMoney(previousCashFlow[0]._sum.amount);
    const previousCashOut = parseMoney(previousCashFlow[1]._sum.amount);
    const previousNetCashFlow = subtractMoney(previousCashIn, previousCashOut);

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

    let byTenant = null;
    if (tenantIds.length > 1) {
      const tenantRows = await prisma.tenant.findMany({
        where: { id: { in: tenantIds } },
        select: { id: true, name: true },
      });
      const nameById = new Map(tenantRows.map((t) => [t.id, t.name]));

      byTenant = await Promise.all(
        tenantIds.map(async (tid) => {
          const singleTw = tenantWhereIn([tid]);
          let perTenantCogsIds = [];
          try {
            perTenantCogsIds = await getCogsAccountIdsForExpenseRegister(prisma, singleTw);
          } catch (_) {
            /* non-fatal */
          }
          const perTenantMetrics = await fetchDashboardPeriodMetrics({
            prisma,
            tenantIds: [tid],
            branchId: null,
            cogsAccountIds: perTenantCogsIds,
            userQ: userForDashboardBranchFilter(user, false),
            tw: singleTw,
            transactionBranchSlice: {},
            branchIdForPayments: null,
            startDate: currentPeriodStart,
            endDate: currentPeriodEndDate,
          });
          const expensesTotal = addMoney(
            perTenantMetrics.operatingExpenses,
            perTenantMetrics.cogs
          );
          return {
            tenantId: tid,
            tenantName: nameById.get(tid) || tid,
            revenue: perTenantMetrics.revenue,
            expenses: expensesTotal,
            profit: subtractMoney(perTenantMetrics.revenue, expensesTotal),
          };
        })
      );
    }
    
    return NextResponse.json({
      source: metricsSource,
      scope: {
        tenantIds,
        branchScoped,
        mode: tenantIds.length > 1 ? 'multi' : 'single',
      },
      ...(byTenant ? { byTenant } : {}),
      financialSummary: {
        revenue: {
          current: currentRevenue,
          previous: previousRevenue,
          change: parseFloat(revenueChange),
          ...(budgetInfo?.revenue && {
            budget: {
              budgeted: budgetInfo.revenue.budgeted,
              actual: budgetInfo.revenue.actual,
              variance: budgetInfo.revenue.variance,
              variancePercent: budgetInfo.revenue.variancePercent,
              achievement: budgetInfo.revenue.achievement,
              status: budgetInfo.revenue.status
            }
          })
        },
        expenses: {
          current: currentExpenses,
          previous: previousExpenses,
          change: parseFloat(expensesChange),
          ...(budgetInfo?.expenses && {
            budget: {
              budgeted: budgetInfo.expenses.budgeted,
              actual: budgetInfo.expenses.actual,
              variance: budgetInfo.expenses.variance,
              variancePercent: budgetInfo.expenses.variancePercent,
              achievement: budgetInfo.expenses.achievement,
              status: budgetInfo.expenses.status
            }
          })
        },
        profit: {
          current: currentProfit,
          previous: previousProfit,
          change: parseFloat(profitChange)
        },
        outstandingInvoices: {
          current: currentOutstandingInvoices,
          previous: previousOutstandingInvoices,
          change: parseFloat(outstandingInvoicesChange),
          count: currentOutstandingInvoicesCount
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