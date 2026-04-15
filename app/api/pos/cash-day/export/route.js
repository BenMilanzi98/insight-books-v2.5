import { NextResponse } from 'next/server';
import { getUserFromSession } from '@/lib/auth';
import { generatePosDailyReport } from '@/lib/posDailyReportService';
import { getPosCashDayState } from '@/lib/posCashDayService';
import { generatePosDailySalesPdfBuffer } from '@/lib/posDailySalesPdf';
import {
  buildPosDailyLineItemHeadersWithCurrency,
  buildPosDailyLineItemDataRows,
} from '@/lib/posDailySalesLineItemsExport';
import * as XLSX from 'xlsx';

export const dynamic = 'force-dynamic';

function csvEscape(v) {
  const s = v == null ? '' : String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function GET(request) {
  try {
    const user = await getUserFromSession(request);
    if (!user?.tenantId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date') || new Date().toISOString().slice(0, 10);
    const format = (searchParams.get('format') || 'csv').toLowerCase();

    let report;
    let cashState = null;
    try {
      const pair = await Promise.all([
        generatePosDailyReport(user.tenantId, date, null, { branchIdsIn: null }),
        getPosCashDayState(user.tenantId, date),
      ]);
      report = pair[0];
      cashState = pair[1];
    } catch (_) {
      report = await generatePosDailyReport(user.tenantId, date, null, { branchIdsIn: null });
    }

    const rows = [['Daily POS Sales Report'], [`Date: ${date}`], []];
    rows.push(['Opening balance (register)', String(cashState?.metrics?.openingBalance ?? '')]);
    rows.push(['Closing balance (opening + total sales)', String(cashState?.metrics?.closingBalance ?? '')]);
    rows.push(['Total sales', String(report.totalSales ?? 0)]);
    rows.push([]);
    rows.push(['Line items — one row per product / custom line']);
    rows.push(buildPosDailyLineItemHeadersWithCurrency(report.currencyCode || 'MWK'));
    const lineRows = buildPosDailyLineItemDataRows(report.transactions);
    if (lineRows.length === 0) {
      rows.push(['', '', 'No completed POS sales for this date.', '', '', '', '', '']);
    } else {
      rows.push(...lineRows);
    }

    if (format === 'xlsx' || format === 'excel') {
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet(rows);
      XLSX.utils.book_append_sheet(wb, ws, 'POS Daily');
      const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
      return new NextResponse(buf, {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="pos-daily-${date}.xlsx"`,
        },
      });
    }

    if (format === 'pdf') {
      const pdfBuf = generatePosDailySalesPdfBuffer(report, cashState, { date });
      return new NextResponse(pdfBuf, {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="pos-daily-${date}.pdf"`,
        },
      });
    }

    const csv = rows.map((r) => r.map(csvEscape).join(',')).join('\n');
    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="pos-daily-${date}.csv"`,
      },
    });
  } catch (e) {
    console.error('pos/cash-day/export', e);
    return NextResponse.json({ error: e?.message || 'Export failed' }, { status: 500 });
  }
}
