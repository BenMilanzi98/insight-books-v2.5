// app/api/budgets/reports/route.js
import { NextResponse } from 'next/server';
import { getUserFromSession } from '@/lib/auth';
import { requireStandardAccess } from '@/lib/accessControl';
import {
  generateBudgetReport,
  generatePeriodComparisonReport,
  getRevenueBudgets,
  autoCloseExpiredBudgets
} from '@/lib/budgetService';
import prisma from '@/lib/prisma';

/**
 * Budget Reports API
 * 
 * GET /api/budgets/reports
 *   - Query params: type (budget_vs_actual, period_comparison)
 *   - For budget_vs_actual: startDate, endDate, periodType, branchId, categoryId
 *   - For period_comparison: baseStartDate, baseEndDate, comparisonStartDate, comparisonEndDate, periodType
 */
export async function GET(request) {
  try {
    const accessError = await requireStandardAccess(request);
    if (accessError) {
      return accessError;
    }

    const user = await getUserFromSession(request);
    if (!user || !user.tenantId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const reportType = searchParams.get('type') || 'budget_vs_actual';
    
    // Auto-close expired budgets first
    await autoCloseExpiredBudgets(user.tenantId);

    switch (reportType) {
      case 'budget_vs_actual': {
        // Budget vs Actual Report
        const startDate = searchParams.get('startDate');
        const endDate = searchParams.get('endDate');
        const periodType = searchParams.get('periodType');
        const branchId = searchParams.get('branchId');
        const categoryId = searchParams.get('categoryId');
        const includeComparison = searchParams.get('includeComparison') !== 'false';

        const report = await generateBudgetReport(user.tenantId, {
          startDate: startDate || undefined,
          endDate: endDate || undefined,
          periodType: periodType || undefined,
          branchId: branchId || undefined,
          categoryId: categoryId || undefined,
          includeComparison
        });

        return NextResponse.json({
          success: true,
          data: report,
          reportType: 'budget_vs_actual'
        });
      }

      case 'period_comparison': {
        // Period Comparison Report
        const baseStartDate = searchParams.get('baseStartDate');
        const baseEndDate = searchParams.get('baseEndDate');
        const comparisonStartDate = searchParams.get('comparisonStartDate');
        const comparisonEndDate = searchParams.get('comparisonEndDate');
        const periodType = searchParams.get('periodType') || 'monthly';
        const includeActuals = searchParams.get('includeActuals') !== 'false';

        if (!baseStartDate || !baseEndDate || !comparisonStartDate || !comparisonEndDate) {
          return NextResponse.json(
            { error: 'baseStartDate, baseEndDate, comparisonStartDate, and comparisonEndDate are required for period comparison' },
            { status: 400 }
          );
        }

        const report = await generatePeriodComparisonReport(user.tenantId, {
          baseStartDate,
          baseEndDate,
          comparisonStartDate,
          comparisonEndDate,
          periodType,
          includeActuals
        });

        return NextResponse.json({
          success: true,
          data: report,
          reportType: 'period_comparison'
        });
      }

      case 'summary': {
        // Budget Summary - List all budgets with their current status
        const status = searchParams.get('status');
        const periodType = searchParams.get('periodType');

        const budgets = await prisma.budget.findMany({
          where: {
            tenantId: user.tenantId,
            ...(status && { status }),
            ...(periodType && { periodType })
          },
          include: {
            breakdowns: true,
            approvedBy: {
              select: {
                id: true,
                name: true,
                email: true
              }
            }
          },
          orderBy: { startDate: 'desc' }
        });

        // Get actual totals for each budget using General Ledger
        const { getActualRevenue, getActualExpenses } = await import('@/lib/budgetService');
        const summaryData = await Promise.all(
          budgets.map(async (budget) => {
            let actual = 0;
            const budgetType = budget.budgetType || 'revenue';
            
            if (budgetType === 'expense') {
              // Get actual expenses from General Ledger
              const accountIds = (budget.items || []).map(item => item.accountId).filter(Boolean);
              const actualExpenses = await getActualExpenses(
                user.tenantId,
                budget.startDate,
                budget.endDate,
                { accountIds }
              );
              actual = actualExpenses.totalExpenses;
            } else {
              // Get actual revenue from General Ledger
              const actualRevenue = await getActualRevenue(
                user.tenantId,
                budget.startDate,
                budget.endDate
              );
              actual = actualRevenue.totalRevenue;
            }

            const budgeted = budget.expectedRevenue;
            const variance = actual - budgeted;
            const achievement = budgeted > 0 ? (actual / budgeted) * 100 : 0;

            return {
              id: budget.id,
              name: budget.name,
              periodType: budget.periodType,
              startDate: budget.startDate,
              endDate: budget.endDate,
              status: budget.status,
              isLocked: budget.isLocked,
              currency: budget.currency,
              budgeted,
              actual,
              variance,
              achievementPercent: achievement,
              breakdownCount: budget.breakdowns?.length || 0
            };
          })
        );

        // Calculate totals
        const totals = {
          totalBudgeted: summaryData.reduce((sum, b) => sum + b.budgeted, 0),
          totalActual: summaryData.reduce((sum, b) => sum + b.actual, 0),
          budgetCount: summaryData.length
        };
        totals.totalVariance = totals.totalActual - totals.totalBudgeted;
        totals.overallAchievement = totals.totalBudgeted > 0
          ? (totals.totalActual / totals.totalBudgeted) * 100
          : 0;

        return NextResponse.json({
          success: true,
          data: {
            budgets: summaryData,
            totals,
            filters: {
              status: status || null,
              periodType: periodType || null
            }
          },
          reportType: 'summary'
        });
      }

      default:
        return NextResponse.json(
          { error: 'Invalid report type. Use budget_vs_actual, period_comparison, or summary' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Error generating budget report:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate report' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/budgets/reports/export
 * Export budget report to CSV/Excel format
 */
export async function POST(request) {
  try {
    const accessError = await requireStandardAccess(request);
    if (accessError) {
      return accessError;
    }

    const user = await getUserFromSession(request);
    if (!user || !user.tenantId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { reportType, format = 'json', ...options } = body;

    let reportData;
    let filename;

    switch (reportType) {
      case 'budget_vs_actual':
        reportData = await generateBudgetReport(user.tenantId, options);
        filename = 'budget_vs_actual_report';
        break;

      case 'period_comparison':
        reportData = await generatePeriodComparisonReport(user.tenantId, options);
        filename = 'period_comparison_report';
        break;

      default:
        return NextResponse.json(
          { error: 'Invalid report type' },
          { status: 400 }
        );
    }

    if (format === 'csv') {
      // Convert to CSV format
      const csvData = convertToCSV(reportData);
      return new NextResponse(csvData, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="${filename}.csv"`
        }
      });
    }

    // Default to JSON
    return NextResponse.json({
      success: true,
      data: reportData,
      filename: `${filename}.json`
    });
  } catch (error) {
    console.error('Error exporting budget report:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to export report' },
      { status: 500 }
    );
  }
}

/**
 * Helper function to convert report data to CSV format
 */
function convertToCSV(data) {
  if (!data || !data.data) return '';

  const headers = ['Budget Name', 'Period Type', 'Start Date', 'End Date', 'Budgeted', 'Actual', 'Variance', 'Achievement %', 'Status'];
  const rows = data.data.map(item => [
    item.budget?.name || '',
    item.budget?.periodType || '',
    item.budget?.startDate ? new Date(item.budget.startDate).toLocaleDateString() : '',
    item.budget?.endDate ? new Date(item.budget.endDate).toLocaleDateString() : '',
    item.budgetedAmount?.toFixed(2) || '0.00',
    item.comparison?.actualRevenue?.toFixed(2) || '0.00',
    item.comparison?.variance?.amount?.toFixed(2) || '0.00',
    item.comparison?.achievement?.percent?.toFixed(2) || '0.00',
    item.comparison?.achievement?.status || ''
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.join(','))
  ].join('\n');

  // Add totals row
  const totals = data.totals || {};
  const totalsRow = [
    'TOTALS',
    '',
    '',
    '',
    totals.totalBudgeted?.toFixed(2) || '0.00',
    totals.totalActual?.toFixed(2) || '0.00',
    totals.totalVariance?.toFixed(2) || '0.00',
    totals.totalAchievementPercent?.toFixed(2) || '0.00',
    ''
  ];

  return csvContent + '\n' + totalsRow.join(',');
}
