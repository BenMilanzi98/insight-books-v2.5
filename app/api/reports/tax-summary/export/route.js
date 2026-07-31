/**
 * Wave 5 — Tax summary export (fixes broken UI link from tax-management dashboard).
 * Reuses the same filters as GET /api/reports/tax-summary (no side effects).
 */

import { NextResponse } from 'next/server';
import { getUserFromSession, requireAnyPermission } from '@/lib/auth';

function csvEscape(value) {
  const s = value == null ? '' : String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function GET(request) {
  try {
    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    const perm = await requireAnyPermission(request, [
      'tax.export',
      'taxManagement.export',
      'reports.export',
      'tax.view',
    ]);
    if (perm) return perm;

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const format = (searchParams.get('format') || 'csv').toLowerCase();

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: 'startDate and endDate are required' },
        { status: 400 }
      );
    }

    const origin = new URL(request.url).origin;
    const summaryUrl = new URL('/api/reports/tax-summary', origin);
    summaryUrl.searchParams.set('startDate', startDate);
    summaryUrl.searchParams.set('endDate', endDate);

    // Forward cookies for same-origin session auth
    const cookie = request.headers.get('cookie') || '';
    const summaryRes = await fetch(summaryUrl.toString(), {
      headers: cookie ? { cookie } : {},
      cache: 'no-store',
    });
    if (!summaryRes.ok) {
      const body = await summaryRes.json().catch(() => ({}));
      return NextResponse.json(
        { error: body.error || 'Failed to load tax summary for export' },
        { status: summaryRes.status }
      );
    }
    const data = await summaryRes.json();

    if (format !== 'csv') {
      return NextResponse.json(
        { error: 'Only format=csv is supported in this wave' },
        { status: 400 }
      );
    }

    const rows = [];
    rows.push(['Section', 'Label', 'Amount', 'Start', 'End']);
    rows.push([
      'Summary',
      'Tax collected',
      data.totalTaxCollected ?? data.summary?.totalTaxCollected ?? '',
      startDate,
      endDate,
    ]);
    rows.push([
      'Summary',
      'Tax paid',
      data.totalTaxPaid ?? data.summary?.totalTaxPaid ?? '',
      startDate,
      endDate,
    ]);

    const collected = data.collectedTaxes || data.taxCollected || data.collected || [];
    if (Array.isArray(collected)) {
      for (const item of collected) {
        rows.push([
          'Collected',
          item.taxName || item.name || item.description || item.id || '',
          item.taxAmount ?? item.amount ?? '',
          startDate,
          endDate,
        ]);
      }
    }

    const paid = data.paidTaxes || data.taxPaid || data.paid || [];
    if (Array.isArray(paid)) {
      for (const item of paid) {
        rows.push([
          'Paid',
          item.description || item.taxName || item.name || item.id || '',
          item.amount ?? item.taxAmount ?? '',
          startDate,
          endDate,
        ]);
      }
    }

    const csv = rows.map((r) => r.map(csvEscape).join(',')).join('\r\n');
    const filename = `tax-summary-${startDate}-${endDate}.csv`;
    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('GET /api/reports/tax-summary/export:', error);
    return NextResponse.json(
      { error: error.message || 'Export failed' },
      { status: 500 }
    );
  }
}
