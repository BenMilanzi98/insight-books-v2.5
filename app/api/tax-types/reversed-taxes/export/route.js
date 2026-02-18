/**
 * GET /api/tax-types/reversed-taxes/export?format=xlsx|pdf
 * Export reversed taxes report as Excel or PDF.
 */
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import * as XLSX from 'xlsx';

export async function GET(request) {
  try {
    const user = await getUserFromSession(request);
    if (!user?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const format = (searchParams.get('format') || 'xlsx').toLowerCase();
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const whereSale = {
      tenantId: user.tenantId,
      refundedAt: { not: null },
      totalTaxAmount: { gt: 0 }
    };
    if (startDate || endDate) {
      whereSale.refundedAt = {};
      if (startDate) whereSale.refundedAt.gte = new Date(startDate);
      if (endDate) whereSale.refundedAt.lte = new Date(endDate + 'T23:59:59');
    }
    const refundedSales = await prisma.sale.findMany({
      where: whereSale,
      select: {
        id: true,
        saleNumber: true,
        refundedAt: true,
        totalTaxAmount: true,
        refundReason: true
      },
      orderBy: { refundedAt: 'desc' }
    });
    const invoiceRefundWhere = {
      tenantId: user.tenantId,
      status: 'completed'
    };
    if (startDate || endDate) {
      invoiceRefundWhere.processedAt = {};
      if (startDate) invoiceRefundWhere.processedAt.gte = new Date(startDate);
      if (endDate) invoiceRefundWhere.processedAt.lte = new Date(endDate + 'T23:59:59');
    }
    const invoiceRefunds = await prisma.invoiceRefund.findMany({
      where: invoiceRefundWhere,
      include: {
        invoice: {
          select: {
            invoiceNumber: true,
            total: true,
            taxAmount: true
          }
        }
      },
      orderBy: { refundDate: 'desc' }
    });
    const reversedTaxes = [
      ...refundedSales.map((s) => ({
        id: s.id,
        date: s.refundedAt,
        reference: `Sale #${s.saleNumber}`,
        type: 'POS Refund',
        taxReversed: parseFloat(s.totalTaxAmount) || 0,
        reason: s.refundReason
      })),
      ...invoiceRefunds
        .filter((r) => r.invoice && Number(r.invoice.taxAmount) > 0)
        .map((r) => ({
          id: r.id,
          date: r.processedAt || r.refundDate,
          reference: `Invoice #${r.invoice.invoiceNumber}`,
          type: 'Invoice Refund',
          taxReversed: Math.abs((r.refundAmount / (r.invoice?.total || 1)) * Number(r.invoice?.taxAmount || 0)),
          reason: r.refundReason
        }))
    ].sort((a, b) => new Date(b.date) - new Date(a.date));
    const totalTaxReversed = reversedTaxes.reduce((sum, r) => sum + (r.taxReversed || 0), 0);

    const formatDate = (d) => {
      if (!d) return '';
      const x = new Date(d);
      return x.toISOString().slice(0, 10);
    };

    if (format === 'pdf') {
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      doc.setFontSize(16);
      doc.text('Reversed Taxes Report', 14, 20);
      doc.setFontSize(10);
      doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 28);
      doc.text(`Total Tax Reversed: ${Number(totalTaxReversed || 0).toFixed(2)}`, 14, 34);
      let y = 44;
      doc.setFontSize(9);
      doc.text('Date', 14, y);
      doc.text('Reference', 40, y);
      doc.text('Type', 90, y);
      doc.text('Tax Reversed', 130, y);
      doc.text('Reason', 170, y);
      y += 6;
      doc.setDrawColor(200);
      doc.line(14, y - 2, 196, y - 2);
      doc.setFontSize(8);
      for (const row of reversedTaxes || []) {
        if (y > 270) {
          doc.addPage();
          y = 20;
        }
        doc.text(formatDate(row.date), 14, y);
        doc.text(String(row.reference || '').slice(0, 22), 40, y);
        doc.text(String(row.type || '').slice(0, 14), 90, y);
        doc.text(Number(row.taxReversed || 0).toFixed(2), 130, y);
        doc.text(String(row.reason || '').slice(0, 28), 170, y);
        y += 6;
      }
      const buf = doc.output('arraybuffer');
      return new NextResponse(buf, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="reversed-taxes-${new Date().toISOString().slice(0, 10)}.pdf"`
        }
      });
    }

    const rows = (reversedTaxes || []).map((r) => ({
      Date: formatDate(r.date),
      Reference: r.reference,
      Type: r.type,
      'Tax Reversed': Number(r.taxReversed || 0),
      Reason: r.reason || ''
    }));
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, 'Reversed Taxes');
    const xlsxBuf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    return new NextResponse(xlsxBuf, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="reversed-taxes-${new Date().toISOString().slice(0, 10)}.xlsx"`
      }
    });
  } catch (error) {
    console.error('Export reversed taxes error:', error);
    return NextResponse.json(
      { error: error.message || 'Export failed' },
      { status: 500 }
    );
  }
}
