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

    // Invoice refund tax is reported from GL (Tax-InvoiceRefund) via fetchGlTaxReversalReportRows to avoid
    // double-counting with proportional InvoiceRefund rows and to match voids (Tax-InvoiceVoid).

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
