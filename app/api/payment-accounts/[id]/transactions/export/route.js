import { NextResponse } from 'next/server';
import { getUserFromSession, hasPermission } from '@/lib/auth';
import { fetchPaymentAccountActivity } from '@/lib/paymentAccountActivityService';
import { generateCSV } from '@/lib/exportUtils';

export const dynamic = 'force-dynamic';

function safeFilename(name) {
  return String(name || 'account')
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 80);
}

function rowToExportFlat(row) {
  const d = row.paymentDate ? new Date(row.paymentDate) : null;
  const dateStr = d && !Number.isNaN(d.getTime()) ? d.toISOString().slice(0, 10) : '';
  return {
    date: dateStr,
    category: row.eventCategory || row.source || '',
    summary: row.summary || '',
    type: row.type || '',
    amount: row.amount ?? '',
    debit: row.journalDebit ?? '',
    credit: row.journalCredit ?? '',
    netDrMinusCr: row.journalNet ?? '',
    status: row.status || '',
    reference: row.reference || '',
    notes: row.notes || '',
    invoice: row.invoiceNumber || '',
    sale: row.saleNumber || '',
  };
}

const EXPORT_HEADERS = [
  { key: 'date', label: 'Date' },
  { key: 'category', label: 'Category' },
  { key: 'summary', label: 'Summary' },
  { key: 'type', label: 'Type' },
  { key: 'amount', label: 'Amount' },
  { key: 'debit', label: 'Debit (GL)' },
  { key: 'credit', label: 'Credit (GL)' },
  { key: 'netDrMinusCr', label: 'Net Dr−Cr' },
  { key: 'status', label: 'Status' },
  { key: 'reference', label: 'Reference' },
  { key: 'notes', label: 'Notes' },
  { key: 'invoice', label: 'Invoice' },
  { key: 'sale', label: 'Sale' },
];

export async function GET(request, context) {
  try {
    const user = await getUserFromSession(request);
    if (!user?.tenantId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    if (!hasPermission(user, 'payments.view')) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    const { id: accountId } = await context.params;
    const { searchParams } = new URL(request.url);
    const format = (searchParams.get('format') || 'csv').toLowerCase();

    if (!accountId) {
      return NextResponse.json({ error: 'Account id required' }, { status: 400 });
    }

    const result = await fetchPaymentAccountActivity(user.tenantId, accountId);
    if (!result) {
      return NextResponse.json({ error: 'Payment account not found' }, { status: 404 });
    }

    const flat = (result.transactions || []).map(rowToExportFlat);
    const baseName = `${safeFilename(result.account?.name)}-transactions`;

    if (format === 'csv') {
      const csv = generateCSV(flat, EXPORT_HEADERS);
      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${baseName}.csv"`,
        },
      });
    }

    if (format === 'xlsx' || format === 'excel') {
      const XLSX = await import('xlsx');
      const labeled = flat.map((item) => {
        const row = {};
        EXPORT_HEADERS.forEach((h) => {
          row[h.label] = item[h.key];
        });
        return row;
      });
      const worksheet = XLSX.utils.json_to_sheet(labeled.length ? labeled : [{}]);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Transactions');
      const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });
      return new NextResponse(excelBuffer, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${baseName}.xlsx"`,
        },
      });
    }

    if (format === 'pdf') {
      const { default: jsPDF } = await import('jspdf');
      const autoTable = (await import('jspdf-autotable')).default;
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const title = `Payment account — ${result.account?.name || 'Account'}`;
      doc.setFontSize(14);
      doc.text(title, 14, 16);
      doc.setFontSize(9);
      doc.setTextColor(100);
      doc.text(`Generated ${new Date().toLocaleString()}`, 14, 22);

      const head = [EXPORT_HEADERS.map((h) => h.label)];
      const body = flat.map((r) => EXPORT_HEADERS.map((h) => String(r[h.key] ?? '')));

      autoTable(doc, {
        startY: 26,
        head,
        body,
        styles: { fontSize: 7 },
        headStyles: { fillColor: [79, 70, 229] },
      });

      const buf = doc.output('arraybuffer');
      return new NextResponse(buf, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${baseName}.pdf"`,
        },
      });
    }

    return NextResponse.json({ error: 'Unsupported format. Use csv, xlsx, or pdf.' }, { status: 400 });
  } catch (e) {
    console.error('payment-accounts/[id]/transactions/export', e);
    return NextResponse.json(
      { error: e?.message || 'Export failed' },
      { status: 500 }
    );
  }
}
