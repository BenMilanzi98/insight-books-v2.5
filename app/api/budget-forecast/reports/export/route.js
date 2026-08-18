import { NextResponse } from 'next/server';
import { withBudgetForecastAuth } from '@/lib/budgetForecast/http';
import prisma from '@/lib/prisma';
import {
  reportBudgetVsActual,
  reportBudgetPlan,
  reportBudgetVsForecast,
} from '@/lib/budgetForecast/application/reportService';
import {
  exportReportAsExcel,
  exportReportAsPdf,
  buildForecastProjectionExportPayload,
} from '@/lib/budgetForecast/application/exportService';
import { resolvePeriodFilterRange } from '@/lib/budgetForecast/domain/periodFilter.js';
import { getForecast } from '@/lib/budgetForecast/application/forecastService';
import { buildPnlBudgetLayout } from '@/lib/budgetForecast/domain/pnlBudgetLayout.js';

async function tenantBusinessName(tenantId) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { name: true },
  });
  return tenant?.name || 'Business';
}

async function loadReport(user, body) {
  const reportId = String(body.reportId || 'BVA').toUpperCase();
  if (reportId === 'BVA') {
    const reportBody = { ...body };
    if (body.budgetId && body.periodKey) {
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
    return reportBudgetVsActual(user.tenantId, reportBody);
  }
  if (reportId === 'BUDGET') {
    return reportBudgetPlan(user.tenantId, body);
  }
  if (reportId === 'BVF') {
    return reportBudgetVsForecast(user.tenantId, body);
  }
  if (reportId === 'PROJECTION' && body.forecastId) {
    const forecast = await getForecast(user.tenantId, body.forecastId);
    const accounts = (forecast.lines || []).map((l) => ({
      id: l.accountId,
      accountId: l.accountId,
      accountCode: l.accountCodeSnapshot,
      accountName: l.accountNameSnapshot,
      accountType: l.accountTypeSnapshot,
      coaV2Category: null,
    }));
    const periodEdits = {};
    const periodKeys = [];
    for (const line of forecast.lines || []) {
      periodEdits[line.accountId] = {};
      for (const p of line.periodAmounts || []) {
        const d = new Date(p.periodStart);
        const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
        if (!periodKeys.includes(key)) periodKeys.push(key);
        periodEdits[line.accountId][key] = String(p.forecastAmount ?? 0);
      }
    }
    periodKeys.sort();
    const pnlGrouped = buildPnlBudgetLayout({
      accounts,
      selectedAccountIds: (forecast.lines || []).map((l) => l.accountId),
      periodEdits,
      periodKeys,
      showAdvanced: false,
    });
    const businessName = await tenantBusinessName(user.tenantId);
    return buildForecastProjectionExportPayload(forecast, pnlGrouped, { businessName });
  }
  throw Object.assign(new Error('Unknown report for export'), { status: 400 });
}

export async function POST(request) {
  return withBudgetForecastAuth(request, 'budgets.view', async (user) => {
    const body = await request.json();
    const format = String(body.format || 'xlsx').toLowerCase();
    const report = await loadReport(user, body);
    const businessName = report.businessName || (await tenantBusinessName(user.tenantId));

    let pack;
    if (format === 'pdf') {
      pack = await exportReportAsPdf(report, { businessName });
    } else if (format === 'xlsx' || format === 'excel') {
      pack = await exportReportAsExcel(report, { businessName });
    } else {
      return NextResponse.json({ error: 'Unsupported format. Use pdf or xlsx.' }, { status: 400 });
    }

    return new NextResponse(pack.body, {
      status: 200,
      headers: {
        'Content-Type': pack.contentType,
        'Content-Disposition': `attachment; filename="${pack.filename}"`,
      },
    });
  });
}
