import { NextResponse } from 'next/server';
import { withBudgetForecastAuth } from '@/lib/budgetForecast/http';
import { resolvePeriodFilterRange } from '@/lib/budgetForecast/domain/periodFilter.js';
import prisma from '@/lib/prisma';
import {
  listReportDefinitions,
  reportBudgetVsActual,
  reportBudgetVsForecast,
  reportForecastVsActual,
  reportUtilization,
  reportCashOutlook,
  reportBudgetPlan,
  reportBudgetCompletion,
  exportReportAsCsv,
} from '@/lib/budgetForecast/application/reportService';

const ID_MAP = {
  BUDGET_VS_ACTUAL: 'BVA',
  BVA: 'BVA',
  BUDGET_VS_FORECAST: 'BVF',
  BVF: 'BVF',
  FORECAST_VS_ACTUAL: 'FVA',
  FVA: 'FVA',
  UTILIZATION: 'UTILIZATION',
  CASH_OUTLOOK: 'CASH_OUTLOOK',
  CASH_FLOW_FORECAST: 'CASH_OUTLOOK',
  BUDGET: 'BUDGET',
  BUDGET_REPORT: 'BUDGET',
  COMPLETION: 'COMPLETION',
  BUDGET_COMPLETION: 'COMPLETION',
};

export async function GET(request) {
  return withBudgetForecastAuth(request, 'budgets.view', async () => {
    return NextResponse.json({ success: true, data: listReportDefinitions() });
  });
}

export async function POST(request) {
  return withBudgetForecastAuth(request, 'budgets.view', async (user) => {
    const body = await request.json();
    const reportId = ID_MAP[body.reportId || body.type] || body.reportId || 'BVA';
    let report;
    const reportBody = { ...body };
    if (reportId === 'BVA' && body.budgetId && body.periodKey) {
      const budget = await prisma.budget.findFirst({
        where: { id: body.budgetId, tenantId: user.tenantId },
        select: { startDate: true, endDate: true },
      });
      if (budget) {
        const range = resolvePeriodFilterRange(budget.startDate, budget.endDate, body.periodKey);
        reportBody.startDate = range.startDate.toISOString();
        reportBody.endDate = range.endDate.toISOString();
      }
    }
    if (reportId === 'BVA') {
      report = await reportBudgetVsActual(user.tenantId, reportBody);
    } else if (reportId === 'BVF') {
      report = await reportBudgetVsForecast(user.tenantId, body);
    } else if (reportId === 'FVA') {
      report = await reportForecastVsActual(user.tenantId, body);
    } else if (reportId === 'UTILIZATION') {
      report = await reportUtilization(user.tenantId, body);
    } else if (reportId === 'CASH_OUTLOOK') {
      report = await reportCashOutlook(user.tenantId, body);
    } else if (reportId === 'BUDGET') {
      report = await reportBudgetPlan(user.tenantId, body);
    } else if (reportId === 'COMPLETION') {
      report = await reportBudgetCompletion(user.tenantId, body);
    } else {
      return NextResponse.json({ error: 'Unknown report' }, { status: 400 });
    }

    // Normalize display fields for UI
    if (Array.isArray(report.lines)) {
      report.lines = report.lines.map((l) => ({
        ...l,
        budget: l.budget ?? fromMinorSafe(l.budgetMinor),
        actual: l.actual ?? fromMinorSafe(l.actualMinor),
        forecast: l.forecast ?? fromMinorSafe(l.forecastMinor),
        category: l.category || l.kind,
      }));
      const budgetTotal = report.lines.reduce((s, l) => s + Number(l.budgetMinor || 0), 0);
      const actualTotal = report.lines.reduce((s, l) => s + Number(l.actualMinor || l.forecastMinor || 0), 0);
      report.totals = report.totals || {
        budget: budgetTotal / 100,
        actual: actualTotal / 100,
        rawVariance: (actualTotal - budgetTotal) / 100,
      };
      report.currency = report.currency || 'MWK';
    }

    if (body.format === 'csv') {
      const csv = await exportReportAsCsv(report);
      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${String(reportId).toLowerCase()}.csv"`,
        },
      });
    }

    return NextResponse.json({ success: true, data: report });
  });
}

function fromMinorSafe(minor) {
  return Number(minor || 0) / 100;
}
