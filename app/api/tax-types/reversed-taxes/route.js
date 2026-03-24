/**
 * GET /api/tax-types/reversed-taxes
 * Returns reversed taxes: POS refunds, invoice refunds, and GL Tax-Reversal rows (e.g. expense deletion).
 */
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { fetchGlTaxReversalReportRows } from '@/lib/glReversedTaxReporting';

export async function GET(request) {
  try {
    const user = await getUserFromSession(request);
    if (!user?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
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
        saleDate: true,
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

    const glTaxReversals = await fetchGlTaxReversalReportRows(prisma, user.tenantId, {
      startDate,
      endDate,
    });

    const reversedTaxes = [
      ...refundedSales.map((s) => ({
        id: s.id,
        date: s.refundedAt,
        reference: `Sale #${s.saleNumber}`,
        type: 'POS Refund',
        taxReversed: parseFloat(s.totalTaxAmount) || 0,
        reason: s.refundReason,
        transactionId: s.id
      })),
      ...invoiceRefunds
        .filter((r) => {
          const taxAmount = r.invoice?.taxAmount;
          return taxAmount != null && Number(taxAmount) > 0;
        })
        .map((r) => ({
          id: r.id,
          date: r.processedAt || r.refundDate,
          reference: `Invoice #${r.invoice.invoiceNumber}`,
          type: 'Invoice Refund',
          taxReversed: Math.abs((r.refundAmount / (r.invoice?.total || 1)) * Number(r.invoice?.taxAmount || 0)),
          reason: r.refundReason,
          transactionId: r.invoiceId
        })),
      ...glTaxReversals
    ].sort((a, b) => new Date(b.date) - new Date(a.date));

    return NextResponse.json({
      reversedTaxes,
      totalTaxReversed: reversedTaxes.reduce((sum, r) => sum + (r.taxReversed || 0), 0)
    });
  } catch (error) {
    console.error('Error fetching reversed taxes:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch reversed taxes' },
      { status: 500 }
    );
  }
}
