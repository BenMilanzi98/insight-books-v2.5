// app/api/reports/reports/[id]/export/route.js
import { NextResponse } from 'next/server';
import { calculateDateRange } from '@/lib/dateUtils';
import { bootstrapReportRoute, auditReportAccess } from '@/lib/reportRouteBootstrap';
import { buildExportHeaderRows, prependHeaderRowsToCsv } from '@/lib/reportExportScope';

function scopeQueryFromRequest(request) {
  const { searchParams } = new URL(request.url);
  const scoped = new URLSearchParams();
  if (searchParams.get('aggregate') === 'all') {
    scoped.set('aggregate', 'all');
  } else if (searchParams.get('tenantIds')?.trim()) {
    scoped.set('tenantIds', searchParams.get('tenantIds').trim());
  }
  return scoped.toString();
}

// GET - Export a report in the specified format
export async function GET(request, { params }) {
  try {
    const boot = await bootstrapReportRoute(request);
    if (boot.error) return boot.error;

    const { user, tenantIds, scope } = boot;
    const reportId = params.id;

    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'pdf';
    const timeframe = searchParams.get('timeframe') || 'thisMonth';
    const detailed = searchParams.get('detailed') === 'true';

    const { startDate, endDate } = calculateDateRange(timeframe);
    const scopeQs = scopeQueryFromRequest(request);
    const requestUrl = new URL(request.url);
    const generateUrl = new URL(
      `/api/reports/reports/${reportId}/generate${scopeQs ? `?${scopeQs}` : ''}`,
      requestUrl.origin
    );

    const reportResponse = await fetch(generateUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: request.headers.get('cookie') || '',
      },
      body: JSON.stringify({
        timeframe,
        detailed,
      }),
    });

    if (!reportResponse.ok) {
      const errorData = await reportResponse.json().catch(() => ({}));
      return NextResponse.json(
        { error: errorData.error || 'Failed to generate report' },
        { status: reportResponse.status }
      );
    }

    const reportData = await reportResponse.json();

    await auditReportAccess({
      user,
      reportType: reportId,
      tenantIds,
      scope,
      filters: { timeframe, detailed },
      format,
    });

    const exportHeaderRows = buildExportHeaderRows(scope, {
      startDate: startDate?.toISOString?.()?.slice(0, 10) || String(startDate),
      endDate: endDate?.toISOString?.()?.slice(0, 10) || String(endDate),
    });

    switch (format.toLowerCase()) {
      case 'json':
        return NextResponse.json({ ...reportData, scope });

      case 'csv':
        return exportAsCsv(reportData, reportId, timeframe, exportHeaderRows);

      case 'pdf':
        return NextResponse.json({
          message: 'PDF generation would happen server-side in production',
          reportData,
          scope,
          format: 'pdf',
        });

      case 'xlsx':
        return NextResponse.json({
          message: 'Excel generation would happen server-side in production',
          reportData,
          scope,
          format: 'xlsx',
        });

      default:
        return NextResponse.json(
          { error: 'Unsupported export format' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error(`Error exporting report ${params.id}:`, error);
    return NextResponse.json(
      { error: 'Failed to export report. Please try again.' },
      { status: 500 }
    );
  }
}

function exportAsCsv(reportData, reportId, timeframe, headerRows = []) {
  let csvContent = '';

  if (reportData.scope?.businessLabel) {
    csvContent += `"Business(es)","${String(reportData.scope.businessLabel).replace(/"/g, '""')}"\n`;
  }

  csvContent += `"${reportData.title}"\n`;
  if (reportData.period) {
    csvContent += `"Period: ${new Date(reportData.period.startDate).toLocaleDateString()} to ${new Date(reportData.period.endDate).toLocaleDateString()}"\n\n`;
  } else if (reportData.reportDate) {
    csvContent += `"As of: ${new Date(reportData.reportDate).toLocaleDateString()}"\n\n`;
  }

  switch (reportId) {
    case 'profit-loss':
      csvContent += '"SUMMARY"\n';
      csvContent += '"Revenue","Expense","Profit"\n';
      csvContent += `"${reportData.summary.totalRevenue}","${reportData.summary.operatingExpenses + reportData.summary.costOfGoodsSold}","${reportData.summary.netProfit}"\n\n`;

      if (reportData.details) {
        if (reportData.details.revenueBreakdown) {
          csvContent += '"REVENUE BREAKDOWN"\n';
          csvContent += '"Type","Amount"\n';
          reportData.details.revenueBreakdown.forEach((item) => {
            csvContent += `"${item.type}","${item.amount}"\n`;
          });
          csvContent += '\n';
        }

        if (reportData.details.expensesByCategory) {
          csvContent += '"EXPENSES BY CATEGORY"\n';
          csvContent += '"Category","Amount"\n';
          reportData.details.expensesByCategory.forEach((item) => {
            csvContent += `"${item.category}","${item.amount}"\n`;
          });
        }
      }
      break;

    case 'balance-sheet':
      csvContent += '"SUMMARY"\n';
      csvContent += '"Total Assets","Total Liabilities","Total Equity"\n';
      csvContent += `"${reportData.summary.totalAssets}","${reportData.summary.totalLiabilities}","${reportData.summary.totalEquity}"\n\n`;
      break;

    case 'accounts-receivable':
      csvContent += '"SUMMARY"\n';
      csvContent += '"Total Receivables","Current Receivables","Past Due Receivables"\n';
      csvContent += `"${reportData.summary.totalReceivables}","${reportData.summary.currentReceivables}","${reportData.summary.pastDueReceivables}"\n\n`;
      break;

    default:
      csvContent += '"SUMMARY"\n';
      if (reportData.summary) {
        Object.entries(reportData.summary).forEach(([key, value]) => {
          const formattedKey = key
            .replace(/([A-Z])/g, ' $1')
            .replace(/^./, (str) => str.toUpperCase());
          if (typeof value === 'object') return;
          csvContent += `"${formattedKey}","${value}"\n`;
        });
      }
  }

  const body = csvContent.trimEnd();
  const csvString = headerRows?.length
    ? prependHeaderRowsToCsv(body, headerRows)
    : body;

  const headers = new Headers();
  headers.append('Content-Type', 'text/csv');
  headers.append('Content-Disposition', `attachment; filename=${reportId}-${timeframe}.csv`);

  return new NextResponse(csvString, { headers });
}
